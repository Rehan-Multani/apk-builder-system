const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Main function to build APK and AAB
 */
async function buildAPK(data, updateStatus) {
    const { buildId, url, appName, packageName, splashColor, splashMode, versionName, versionCode } = data;
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

        // 2. Update config.json
        const configPath = path.join(buildDir, 'assets/config.json');
        const config = {
            url,
            appName,
            splashColor,
            splashMode: splashMode || 'color'
        };
        await fs.writeJson(configPath, config);
        updateStatus(30);

        // 3. Handle Icons and Splash Images
        // (Assuming files are uploaded to temp folder by multer)
        // For now, if we have specific icon/splash, we'd copy them to buildDir/assets/

        // 4. Update Android Configuration
        await setupSigning(buildDir);
        await updateAndroidConfig(buildDir, appName, packageName, versionName, versionCode);
        updateStatus(50);

        // 5. Run Flutter Build
        console.log(`[${buildId}] Running Flutter build...`);
        // Using --no-daemon to save RAM on VPS
        const buildCmd = `flutter build apk --release --no-tree-shake-icons --no-pub`;
        const aabCmd = `flutter build appbundle --release --no-tree-shake-icons --no-pub`;

        // Execute APK Build
        await execPromise(buildCmd, { 
            cwd: buildDir,
            env: { ...process.env, HOME: '/root', USER: 'root' } 
        });
        updateStatus(80);

        // Execute AAB Build
        await execPromise(aabCmd, { 
            cwd: buildDir,
            env: { ...process.env, HOME: '/root', USER: 'root' } 
        });
        updateStatus(90);

        // 6. Copy results to storage
        const apkSource = path.join(buildDir, 'build/app/outputs/flutter-apk/app-release.apk');
        const aabSource = path.join(buildDir, 'build/app/outputs/bundle/release/app-release.aab');
        const jksSource = path.join(buildDir, 'android/app/upload-keystore.jks');
        
        const apkName = `${appName.replace(/\s+/g, '_')}_${buildId.substring(0, 8)}.apk`;
        const aabName = `${appName.replace(/\s+/g, '_')}_${buildId.substring(0, 8)}.aab`;
        const jksName = `${appName.replace(/\s+/g, '_')}_${buildId.substring(0, 8)}.jks`;

        await fs.copy(apkSource, path.join(storageDir, apkName));
        await fs.copy(aabSource, path.join(storageDir, aabName));
        
        // Backup Keystore (Very Important for updates!)
        const keystoreBackupDir = path.join(baseDir, 'keystore_backups');
        await fs.ensureDir(keystoreBackupDir);
        await fs.copy(jksSource, path.join(keystoreBackupDir, jksName));

        // 7. Cleanup build folder
        await fs.remove(buildDir);

        return {
            apkUrl: `/apks/${apkName}`,
            aabUrl: `/apks/${aabName}`,
            apkPath: path.join(storageDir, apkName),
            apkName,
            aabName
        };

    } catch (error) {
        console.error(`[${buildId}] Build error:`, error);
        throw error;
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
        await fs.writeFile(manifestPath, manifest);
    }

    // 2. Update build.gradle (Namespace and Package)
    const gradlePath = path.join(buildDir, 'android/app/build.gradle');
    if (await fs.pathExists(gradlePath)) {
        let gradle = await fs.readFile(gradlePath, 'utf8');
        gradle = gradle.replace(/namespace\s*=\s*"[^"]*"/, `namespace = "${packageName}"`);
        gradle = gradle.replace(/applicationId\s*=\s*"[^"]*"/, `applicationId = "${packageName}"`);
        gradle = gradle.replace(/versionName\s*"[^"]*"/, `versionName "${versionName || '1.0.0'}"`);
        gradle = gradle.replace(/versionCode\s*\d+/, `versionCode ${versionCode || '1'}`);
        await fs.writeFile(gradlePath, gradle);
    }

    // 3. Force Memory Limit in gradle.properties
    const propsPath = path.join(buildDir, 'android/gradle.properties');
    const memoryConfig = '\norg.gradle.jvmargs=-Xmx1024m -XX:MaxMetaspaceSize=256m -XX:+HeapDumpOnOutOfMemoryError\norg.gradle.daemon=false\n';
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
}

/**
 * Sets up Android Signing (Keystore & key.properties)
 */
async function setupSigning(buildDir) {
    const keyPath = path.join(buildDir, 'android/app/upload-keystore.jks');
    const propsPath = path.join(buildDir, 'android/key.properties');
    
    const pass = 'rehan_password_2024';
    
    // 1. Generate Keystore if doesn't exist
    if (!(await fs.pathExists(keyPath))) {
        console.log('Generating new keystore...');
        const keygenCmd = `keytool -genkey -v -keystore "${keyPath}" -keyalg RSA -keysize 2048 -validity 10000 -alias upload -storepass ${pass} -keypass ${pass} -dname "CN=Rehan, OU=Dev, O=Wapixo, L=Mumbai, S=MH, C=IN"`;
        await execPromise(keygenCmd);
    }

    // 2. Create key.properties
    const propsContent = `storePassword=${pass}\nkeyPassword=${pass}\nkeyAlias=upload\nstoreFile=upload-keystore.jks`;
    await fs.writeFile(propsPath, propsContent);
}

module.exports = { buildAPK };
