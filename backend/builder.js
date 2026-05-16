const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { exec, spawn } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Gets a clean environment for the build process.
 * Provides safe defaults for HOME and USER if they are missing,
 * and adds flags to suppress interactive CLI warnings.
 */
function getBuildEnv() {
    return {
        ...process.env,
        HOME: process.env.HOME || os.homedir(),
        USER: process.env.USER || os.userInfo().username,
        BOT: 'true',
        CI: 'true',
        FLUTTER_SUPPRESS_ANALYTICS: 'true'
    };
}

/**
 * Main function to build APK and AAB
 */
async function buildAPK(data, updateStatus) {
    const { buildId, url, appName, packageName, splashColor, splashMode, versionName, versionCode, iconPath, splashPath, storePassword, keyPassword, keyAlias, keystoreName, googleServicesPath, fcmStoreUrl, fcmBody, apiHeaders, splashDuration } = data;
    const baseDir = path.join(__dirname, '../');
    const templateDir = path.join(baseDir, 'template_app');
    const buildDir = path.join(baseDir, 'builds', buildId);
    const storageDir = path.join(baseDir, 'apk_storage');

    try {
        await fs.ensureDir(storageDir);
        await fs.ensureDir(path.join(baseDir, 'builds'));
        
        console.log(`[${buildId}] Starting build for ${appName}...`);
        updateStatus(10);

        // 1. Copy template to builds folder
        await fs.copy(templateDir, buildDir);
        updateStatus(20);

        // 2. Handle Google Services JSON
        if (googleServicesPath && await fs.pathExists(googleServicesPath)) {
            try {
                const googleServices = await fs.readJson(googleServicesPath);
                const packageNames = googleServices.client.map(c => c.client_info.android_client_info.package_name);
                
                if (!packageNames.includes(packageName)) {
                    throw new Error(`Firebase Package Name Mismatch!\nDashboard: ${packageName}\nJSON contains: ${packageNames.join(', ')}\n\nPlease ensure your Package Name matches exactly what you configured in Firebase Console.`);
                }
            } catch (e) {
                if (e.message.includes('Firebase Package Name Mismatch')) throw e;
                console.error("Error validating google-services.json:", e);
            }

            const destPath = path.join(buildDir, 'android/app/google-services.json');
            await fs.copy(googleServicesPath, destPath);
            await applyFirebasePlugins(buildDir);
        }

        // 3. Update config.json
        const configPath = path.join(buildDir, 'assets/config.json');
        const config = {
            url,
            appName,
            splashColor: splashColor || '#6366f1',
            splashMode: splashMode || 'color',
            splashDuration: splashDuration || '2',
            fcmStoreUrl: fcmStoreUrl || '',
            fcmBody: fcmBody || {},
            apiHeaders: apiHeaders || {}
        };
        await fs.writeJson(configPath, config);
        updateStatus(30);

        // 3. Handle Icons and Splash Images
        if (iconPath && await fs.pathExists(iconPath)) {
            await generateAppIcons(buildDir, iconPath);
        }
        
        if (splashPath && await fs.pathExists(splashPath) && splashMode === 'image') {
            const destSplash = path.join(buildDir, 'assets/splash.png');
            await fs.copy(splashPath, destSplash);
        }

        // 4. Update Android Configuration
        await setupSigning(buildDir, { storePassword, keyPassword, keyAlias });
        await updateAndroidConfig(buildDir, appName, packageName, versionName, versionCode);
        updateStatus(50);

        const runBuild = (cmd, args, step) => {
            return new Promise((resolve, reject) => {
                let errorOutput = '';
                const child = spawn(cmd, args, { 
                    cwd: buildDir,
                    env: getBuildEnv()
                });

                child.stdout.on('data', (data) => {
                    console.log(`[${buildId}] STDOUT: ${data}`);
                });

                child.stderr.on('data', (data) => {
                    const str = data.toString();
                    errorOutput += str;
                    console.error(`[${buildId}] STDERR: ${str}`);
                });

                child.on('close', (code) => {
                    if (code === 0) resolve();
                    else {
                        const shortError = errorOutput.split('\n').filter(line => line.trim().length > 0).slice(-20).join('\n');
                        reject(new Error(`${cmd} failed with code ${code}.\n${shortError}`));
                    }
                });
            });
        };

        updateStatus(55);
        console.log(`[${buildId}] Accepting Android Licenses...`);
        const licenseCmd = process.platform === 'win32' ? 'echo y | flutter doctor --android-licenses' : 'yes | flutter doctor --android-licenses';
        try {
            await execPromise(licenseCmd, { env: getBuildEnv() });
        } catch (e) {
            console.log("License acceptance failed or already accepted");
        }
        
        updateStatus(56);
        console.log(`[${buildId}] Cleaning build artifacts...`);
        // Aggressive cleanup to prevent stale cache/plugin issues
        await fs.remove(path.join(buildDir, '.dart_tool'));
        await fs.remove(path.join(buildDir, 'pubspec.lock'));
        await fs.remove(path.join(buildDir, 'build'));
        await fs.remove(path.join(buildDir, 'android/.gradle'));
        await fs.remove(path.join(buildDir, 'android/app/build'));
        // Force regeneration of plugin registrant
        await fs.remove(path.join(buildDir, 'android/app/src/main/java/io/flutter/plugins'));
        await fs.remove(path.join(buildDir, 'android/app/src/main/kotlin/io/flutter/plugins'));
        
        await runBuild('flutter', ['clean']);

        updateStatus(58);
        console.log(`[${buildId}] Fetching dependencies...`);
        await runBuild('flutter', ['pub', 'get']);
        
        updateStatus(59);
        console.log(`[${buildId}] Pre-caching Android engine artifacts...`);
        await runBuild('flutter', ['precache', '--android']);
        
        updateStatus(60);
        console.log(`[${buildId}] Building APK...`);
        await runBuild('flutter', ['build', 'apk', '--release', '--no-tree-shake-icons']);
        
        updateStatus(80);
        console.log(`[${buildId}] Building App Bundle...`);
        await runBuild('flutter', ['build', 'appbundle', '--release', '--no-tree-shake-icons']);
        
        updateStatus(95);

        // 6. Copy results to storage
        const apkSource = path.join(buildDir, 'build/app/outputs/flutter-apk/app-release.apk');
        const aabSource = path.join(buildDir, 'build/app/outputs/bundle/release/app-release.aab');
        const jksSource = path.join(buildDir, 'android/app/upload-keystore.jks');
        
        const apkName = `${appName.replace(/\s+/g, '_')}_${buildId.substring(0, 8)}.apk`;
        const aabName = `${appName.replace(/\s+/g, '_')}_${buildId.substring(0, 8)}.aab`;
        
        let jksName = keystoreName ? keystoreName : `${appName.replace(/\s+/g, '_')}_${buildId.substring(0, 8)}`;
        if (!jksName.endsWith('.jks')) jksName += '.jks';

        await fs.copy(apkSource, path.join(storageDir, apkName));
        await fs.copy(aabSource, path.join(storageDir, aabName));
        await fs.copy(jksSource, path.join(storageDir, jksName));
        
        // Backup Keystore (Very Important for updates!)
        const keystoreBackupDir = path.join(baseDir, 'keystore_backups');
        await fs.ensureDir(keystoreBackupDir);
        await fs.copy(jksSource, path.join(keystoreBackupDir, jksName));

        return {
            apkUrl: `/apks/${apkName}`,
            aabUrl: `/apks/${aabName}`,
            jksUrl: `/apks/${jksName}`,
            apkPath: path.join(storageDir, apkName),
            apkName,
            aabName,
            keyAlias: keyAlias || 'upload',
            keyPassword: keyPassword || 'rehan_password_2024',
            storePassword: storePassword || 'rehan_password_2024'
        };

    } catch (error) {
        console.error(`[${buildId}] Build error:`, error);
        throw error;
    } finally {
        // Cleanup build folder ALWAYS
        await fs.remove(buildDir);
    }
}

/**
 * Updates Android project files (Manifest, Gradle, Strings)
 */
async function updateAndroidConfig(buildDir, appName, packageName, versionName, versionCode) {
    // 1. Update AndroidManifest.xml
    const manifestPath = path.join(buildDir, 'android/app/src/main/AndroidManifest.xml');
    if (await fs.pathExists(manifestPath)) {
        let manifest = await fs.readFile(manifestPath, 'utf8');
        manifest = manifest.replace(/android:label="[^"]*"/, `android:label="${appName}"`);
        // Only replace package if it exists in manifest
        if (manifest.includes('package=')) {
            manifest = manifest.replace(/package="[^"]*"/, `package="${packageName}"`);
        }

        // Add Hardware Acceleration and Launch Mode (Safely)
        if (manifest.includes('<application')) {
            if (!manifest.includes('android:hardwareAccelerated')) {
                manifest = manifest.replace('<application', '<application android:hardwareAccelerated="true"');
            }
            if (!manifest.includes('android:usesCleartextTraffic')) {
                manifest = manifest.replace('<application', '<application android:usesCleartextTraffic="true"');
            }
        }
        
        if (manifest.includes('<activity')) {
            if (manifest.includes('android:launchMode')) {
                manifest = manifest.replace(/android:launchMode="[^"]*"/, 'android:launchMode="singleTask"');
            } else {
                manifest = manifest.replace('<activity', '<activity android:launchMode="singleTask"');
            }
        }

        // Add Permissions (Camera, Mic, Location, Firebase)
        const permissions = `
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.VIDEO_CAPTURE" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
    <uses-feature android:name="android.hardware.location" android:required="false" />
    <uses-feature android:name="android.hardware.location.gps" android:required="false" />
`;
        if (!manifest.includes('android.permission.CAMERA')) {
            manifest = manifest.replace('</manifest>', `${permissions}\n</manifest>`);
        }

        await fs.writeFile(manifestPath, manifest);
    }

    // 2. Update build.gradle (Namespace and Package)
    const gradlePath = path.join(buildDir, 'android/app/build.gradle');
    if (await fs.pathExists(gradlePath)) {
        let gradle = await fs.readFile(gradlePath, 'utf8');
        // Handle both: namespace = "com..." and namespace "com..."
        gradle = gradle.replace(/namespace\s*=?\s*"[^"]*"/, `namespace = "${packageName}"`);
        // Handle both: applicationId = "com..." and applicationId "com..."
        gradle = gradle.replace(/applicationId\s*=?\s*"[^"]*"/, `applicationId = "${packageName}"`);
        gradle = gradle.replace(/versionName\s*"[^"]*"/, `versionName "${versionName || '1.0.0'}"`);
        gradle = gradle.replace(/versionCode\s*\d+/, `versionCode ${versionCode || '1'}`);
        
        // Ensure minSDK is high enough for InAppWebView (usually 19 or 21)
        // Ensure minSDK is high enough for Firebase and InAppWebView
        gradle = gradle.replace(/minSdkVersion\s+(?:\d+|flutter\.minSdkVersion)/, 'minSdkVersion 21');
        
        await fs.writeFile(gradlePath, gradle);
    }

    // 3. Force Strict Memory Limit and Disable Watching in gradle.properties
    const propsPath = path.join(buildDir, 'android/gradle.properties');
    const memoryConfig = '\norg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m -XX:+HeapDumpOnOutOfMemoryError -XX:+UseParallelGC -Dorg.gradle.workers.max=2\norg.gradle.daemon=false\norg.gradle.vfs.watch=false\n';
    if (await fs.pathExists(propsPath)) {
        await fs.appendFile(propsPath, memoryConfig);
    } else {
        await fs.writeFile(propsPath, memoryConfig);
    }

    // 4. Update strings.xml
    const stringsPath = path.join(buildDir, 'android/app/src/main/res/values/strings.xml');
    if (await fs.pathExists(stringsPath)) {
        let strings = await fs.readFile(stringsPath, 'utf8');
        strings = strings.replace(/<string name="app_name">[^<]*<\/string>/, `<string name="app_name">${appName}</string>`);
        await fs.writeFile(stringsPath, strings);
    }

    // 5. Update MainActivity (Path and Package) - Supports both Kotlin and Java
    const oldPackagePath = 'com/example/template_app';
    const newPackagePath = packageName.replace(/\./g, '/');
    const mainSrcDir = path.join(buildDir, 'android/app/src/main');
    
    const possiblePaths = [
        { dir: 'kotlin', ext: 'kt' },
        { dir: 'java', ext: 'java' }
    ];

    for (const p of possiblePaths) {
        const oldMainPath = path.join(mainSrcDir, p.dir, oldPackagePath, `MainActivity.${p.ext}`);
        if (await fs.pathExists(oldMainPath)) {
            const newMainDir = path.join(mainSrcDir, p.dir, newPackagePath);
            const newMainPath = path.join(newMainDir, `MainActivity.${p.ext}`);
            
            let content = await fs.readFile(oldMainPath, 'utf8');
            // More robust package replacement
            content = content.replace(/package\s+[a-zA-Z0-9._]+/, `package ${packageName}`);
            
            await fs.ensureDir(newMainDir);
            await fs.writeFile(newMainPath, content);
            
            // Remove old file specifically to avoid deleting the whole tree if it's shared
            if (oldMainPath !== newMainPath) {
                await fs.remove(oldMainPath);
                // Clean up old package folders if empty
                try {
                    let currentDir = path.dirname(oldMainPath);
                    while (currentDir.includes(p.dir) && (await fs.readdir(currentDir)).length === 0) {
                        await fs.remove(currentDir);
                        currentDir = path.dirname(currentDir);
                    }
                } catch (e) {}
            }
        }
    }

    // 6. Generate local.properties (Crucial for Flutter builds)
    const localPropsPath = path.join(buildDir, 'android/local.properties');
    let flutterSdkPath = '';
    try {
        const { stdout } = await execPromise('flutter sdk-path');
        flutterSdkPath = stdout.trim().replace(/\\/g, '/');
    } catch (e) {
        flutterSdkPath = process.env.FLUTTER_ROOT || 'C:/flutter'; 
    }
    
    if (flutterSdkPath) {
        // Ensure the path is escaped for Windows if necessary, but on Linux / is fine
        const propsContent = [
            `flutter.sdk=${flutterSdkPath}`,
            `flutter.versionName=${versionName || '1.0.0'}`,
            `flutter.versionCode=${versionCode || '1'}`,
            `flutter.minSdkVersion=21`,
            `flutter.targetSdkVersion=34`,
            `flutter.compileSdkVersion=34`
        ].join('\n') + '\n';
        await fs.writeFile(localPropsPath, propsContent);
    }
}

/**
 * Sets up Android Signing (Keystore & key.properties)
 */
async function setupSigning(buildDir, signingData) {
    const keyPath = path.join(buildDir, 'android/app/upload-keystore.jks');
    const propsPath = path.join(buildDir, 'android/key.properties');
    
    const storePass = signingData.storePassword || 'rehan_password_2024';
    const keyPass = signingData.keyPassword || 'rehan_password_2024';
    const keyAlias = signingData.keyAlias || 'upload';
    
    const sanitize = (str) => str.replace(/[`"'$()]/g, '');
    const sStorePass = sanitize(storePass);
    const sKeyPass = sanitize(keyPass);
    const sKeyAlias = sanitize(keyAlias);

    // 1. Generate Keystore if doesn't exist
    if (!(await fs.pathExists(keyPath))) {
        if (sStorePass.length < 6 || sKeyPass.length < 6) {
            throw new Error('Keystore passwords must be at least 6 characters long.');
        }
        
        await fs.ensureDir(path.dirname(keyPath));
        console.log('Generating new keystore...');
        const keygenCmd = `keytool -genkey -v -keystore "${keyPath}" -keyalg RSA -keysize 2048 -validity 10000 -alias "${sKeyAlias}" -storepass "${sStorePass}" -keypass "${sKeyPass}" -dname "CN=Rehan, OU=Dev, O=Wapixo, L=Mumbai, S=MH, C=IN"`;
        await execPromise(keygenCmd);
    }

    // 2. Create key.properties
    const propsContent = `storePassword=${sStorePass}\nkeyPassword=${sKeyPass}\nkeyAlias=${sKeyAlias}\nstoreFile=upload-keystore.jks`;
    await fs.writeFile(propsPath, propsContent);
}

/**
 * Generates Android app icons in all required sizes using sharp
 */
async function generateAppIcons(buildDir, iconPath) {
    const sharp = require('sharp');
    const resDir = path.join(buildDir, 'android/app/src/main/res');
    
    const sizes = [
        { name: 'mipmap-mdpi', size: 48 },
        { name: 'mipmap-hdpi', size: 72 },
        { name: 'mipmap-xhdpi', size: 96 },
        { name: 'mipmap-xxhdpi', size: 144 },
        { name: 'mipmap-xxxhdpi', size: 192 }
    ];

    for (const s of sizes) {
        const dir = path.join(resDir, s.name);
        await fs.ensureDir(dir);
        await sharp(iconPath)
            .resize(s.size, s.size)
            .toFile(path.join(dir, 'ic_launcher.png'));
    }
}

/**
 * Applies Google Services Gradle Plugins
 */
async function applyFirebasePlugins(buildDir) {
    // 1. Root build.gradle
    const rootGradlePath = path.join(buildDir, 'android/build.gradle');
    if (await fs.pathExists(rootGradlePath)) {
        let rootGradle = await fs.readFile(rootGradlePath, 'utf8');
        const classpath = "        classpath 'com.google.gms:google-services:4.4.0'";
        if (!rootGradle.includes('google-services')) {
            // Target the buildscript dependencies block specifically
            rootGradle = rootGradle.replace(/(buildscript\s*\{[\s\S]*?dependencies\s*\{)/, `$1\n${classpath}`);
            await fs.writeFile(rootGradlePath, rootGradle);
        }
    }

    // 2. App build.gradle
    const appGradlePath = path.join(buildDir, 'android/app/build.gradle');
    if (await fs.pathExists(appGradlePath)) {
        let appGradle = await fs.readFile(appGradlePath, 'utf8');
        const plugin = "\napply plugin: 'com.google.gms.google-services'";
        if (!appGradle.includes('com.google.gms.google-services')) {
            if (appGradle.includes("id \"com.android.application\"")) {
                appGradle = appGradle.replace("id \"com.android.application\"", "id \"com.android.application\"" + "\n    id \"com.google.gms.google-services\"");
            } else if (appGradle.includes("apply plugin: 'com.android.application'")) {
                appGradle = appGradle.replace("apply plugin: 'com.android.application'", "apply plugin: 'com.android.application'" + plugin);
            } else {
                appGradle += plugin;
            }
            await fs.writeFile(appGradlePath, appGradle);
        }
    }
}

module.exports = { buildAPK };
