const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const sharp = require('sharp');
const execPromise = util.promisify(exec);

const TEMPLATE_PATH = path.join(__dirname, '../template_app');
const BUILDS_PATH = path.join(__dirname, '../builds');
const STORAGE_PATH = path.join(__dirname, '../apk_storage');

async function buildAPK(data, onProgress) {
    const { buildId, url, appName, packageName, splashColor, iconPath, splashPath, versionName, versionCode, privacyUrl, splashDuration } = data;
    if (!buildId) throw new Error('buildId is required but was undefined');
    const workingDir = path.join(BUILDS_PATH, buildId);

    try {
        // 1. Prepare Workspace
        onProgress(10);
        await fs.ensureDir(STORAGE_PATH);
        await fs.ensureDir(BUILDS_PATH);
        await fs.copy(TEMPLATE_PATH, workingDir);

        // 3. Update config.json
        const configDir = path.join(workingDir, 'assets');
        await fs.ensureDir(configDir);
        const configPath = path.join(configDir, 'config.json');
        await fs.writeJson(configPath, { url, splashColor, splashDuration }, { spaces: 2 });

        // 4. Update Package Name & App Name in Android files
        onProgress(30);
        await updateAndroidConfig(workingDir, appName, packageName, versionName, versionCode);

        // 4.1 Update App Icon if provided
        if (iconPath && await fs.pathExists(iconPath)) {
            console.log(`[${buildId}] Updating App Icon...`);
            await updateAppIcon(workingDir, iconPath);
        }

        // 4.2 Update Splash Screen if provided
        if (splashPath && await fs.pathExists(splashPath)) {
            console.log(`[${buildId}] Updating Splash Screen...`);
            await updateAppSplash(workingDir, splashPath);
        }

        // 4.3 Setup Signing (Play Store compatibility)
        console.log(`[${buildId}] Setting up Signing...`);
        await setupSigning(workingDir, packageName);
        
        // 5. Run Dual Flutter Build (APK then AAB)
        console.log(`[${buildId}] Starting Dual Build (APK + AAB)...`);
        
        // Build APK
        onProgress(40);
        console.log(`[${buildId}] Building APK...`);
        await execPromise('flutter build apk --release --no-tree-shake-icons', { cwd: workingDir });
        
        // Build AAB
        onProgress(70);
        console.log(`[${buildId}] Building AAB...`);
        await execPromise('flutter build appbundle --release --no-tree-shake-icons', { cwd: workingDir });
        
        onProgress(85);

        // 6. Move results to storage
        const apkSource = path.join(workingDir, 'build/app/outputs/flutter-apk/app-release.apk');
        const aabSource = path.join(workingDir, 'build/app/outputs/bundle/release/app-release.aab');
        
        const apkName = `${appName.replace(/\s+/g, '_')}_${buildId}.apk`;
        const aabName = `${appName.replace(/\s+/g, '_')}_${buildId}.aab`;
        
        const apkTarget = path.join(STORAGE_PATH, apkName);
        const aabTarget = path.join(STORAGE_PATH, aabName);

        if (!await fs.pathExists(apkSource) || !await fs.pathExists(aabSource)) {
            throw new Error('Build failed: One or more output files missing.');
        }

        await fs.copy(apkSource, apkTarget);
        await fs.copy(aabSource, aabTarget);

        // 7. Cleanup
        await fs.remove(workingDir);
        
        onProgress(100);
        return {
            apkName,
            aabName,
            apkPath: apkTarget,
            aabPath: aabTarget
        };

    } catch (error) {
        console.error('Builder Error:', error);
        // Cleanup on failure
        if (await fs.pathExists(workingDir)) {
            await fs.remove(workingDir);
        }
        throw error;
    }
}

async function updateAndroidConfig(workingDir, appName, packageName, versionName, versionCode) {
    // 1. Update app_name in strings.xml
    const stringsPath = path.join(workingDir, 'android/app/src/main/res/values/strings.xml');
    if (await fs.pathExists(stringsPath)) {
        let stringsContent = await fs.readFile(stringsPath, 'utf8');
        stringsContent = stringsContent.replace(/<string name="app_name">.*<\/string>/, `<string name="app_name">${appName}</string>`);
        await fs.writeFile(stringsPath, stringsContent);
    }

    // 2. Update AndroidManifest.xml (Permissions & Package Name)
    const manifestPath = path.join(workingDir, 'android/app/src/main/AndroidManifest.xml');
    if (await fs.pathExists(manifestPath)) {
        let manifestContent = await fs.readFile(manifestPath, 'utf8');
        
        // Add permissions
        const permissions = [
            '<uses-permission android:name="android.permission.CAMERA" />',
            '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />',
            '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />',
            '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />'
        ];
        
        permissions.forEach(p => {
            if (!manifestContent.includes(p)) {
                manifestContent = manifestContent.replace('<manifest', `<manifest\n    ${p}`);
            }
        });

        manifestContent = manifestContent.replace(/package=".*?"/, `package="${packageName}"`);
        await fs.writeFile(manifestPath, manifestContent);
    }

    // 3. Update build.gradle.kts (PackageName, VersionCode, VersionName)
    const gradleKtsPath = path.join(workingDir, 'android/app/build.gradle.kts');
    if (await fs.pathExists(gradleKtsPath)) {
        let content = await fs.readFile(gradleKtsPath, 'utf8');
        content = content.replace(/applicationId = ".*"/, `applicationId = "${packageName}"`);
        content = content.replace(/versionCode = .*/, `versionCode = ${versionCode}`);
        content = content.replace(/versionName = ".*"/, `versionName = "${versionName}"`);
        await fs.writeFile(gradleKtsPath, content);
    }

    // 4. Update build.gradle (Groovy fallback)
    const gradlePath = path.join(workingDir, 'android/app/build.gradle');
    if (await fs.pathExists(gradlePath)) {
        let content = await fs.readFile(gradlePath, 'utf8');
        content = content.replace(/applicationId ".*"/, `applicationId "${packageName}"`);
        content = content.replace(/versionCode .*/, `versionCode ${versionCode}`);
        content = content.replace(/versionName ".*"/, `versionName "${versionName}"`);
        await fs.writeFile(gradlePath, content);
    }
}

async function updateAppSplash(workingDir, splashPath) {
    const resBase = path.join(workingDir, 'android/app/src/main/res');
    const splashFolders = ['drawable', 'drawable-v21', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
    
    for (const folder of splashFolders) {
        const targetDir = path.join(resBase, folder);
        await fs.ensureDir(targetDir);
        // Overwrite standard launch_background or a custom splash image
        await sharp(splashPath)
            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toFile(path.join(targetDir, 'launch_image.png'));
    }
}

async function setupSigning(workingDir, packageName) {
    const KEYSTORE_DIR = path.join(__dirname, '../keystores');
    await fs.ensureDir(KEYSTORE_DIR);
    
    const keystorePath = path.join(KEYSTORE_DIR, `${packageName}.jks`);
    const keyPropsPath = path.join(workingDir, 'android/key.properties');
    
    // Generate keystore if not exists
    if (!await fs.pathExists(keystorePath)) {
        console.log(`Generating keystore for ${packageName}...`);
        const cmd = `keytool -genkey -v -keystore ${keystorePath} -keyalg RSA -keysize 2048 -validity 10000 -alias upload -storepass password123 -keypass password123 -dname "CN=Builder, OU=Dev, O=Wapixo, L=City, S=State, C=IN"`;
        await execPromise(cmd);
    }
    
    // Create key.properties
    const keyProps = `storePassword=password123
keyPassword=password123
keyAlias=upload
storeFile=${keystorePath.replace(/\\/g, '/')}
`;
    await fs.writeFile(keyPropsPath, keyProps);

    // Update build.gradle.kts to use signing
    const gradleKtsPath = path.join(workingDir, 'android/app/build.gradle.kts');
    if (await fs.pathExists(gradleKtsPath)) {
        let content = await fs.readFile(gradleKtsPath, 'utf8');
        
        // Add signingConfigs if not present (simplified for demonstration)
        if (!content.includes('signingConfigs')) {
            const signingConfig = `
    signingConfigs {
        create("release") {
            val keystorePropertiesFile = rootProject.file("key.properties")
            val keystoreProperties = java.util.Properties()
            keystoreProperties.load(keystorePropertiesFile.inputStream())
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["keyPassword"] as String
            storeFile = file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["storePassword"] as String
        }
    }
    buildTypes {
        getByName("release") {
            signingConfig = signingConfigs.getByName("release")
        }
    }
`;
            content = content.replace('buildTypes {', signingConfig + '//');
        }
        await fs.writeFile(gradleKtsPath, content);
    }
}

async function updateAppIcon(workingDir, iconPath) {
    const resBase = path.join(workingDir, 'android/app/src/main/res');
    const iconMap = [
        { folder: 'mipmap-mdpi', size: 48 },
        { folder: 'mipmap-hdpi', size: 72 },
        { folder: 'mipmap-xhdpi', size: 96 },
        { folder: 'mipmap-xxhdpi', size: 144 },
        { folder: 'mipmap-xxxhdpi', size: 192 },
    ];

    for (const item of iconMap) {
        const targetDir = path.join(resBase, item.folder);
        await fs.ensureDir(targetDir);
        await sharp(iconPath)
            .resize(item.size, item.size)
            .toFile(path.join(targetDir, 'ic_launcher.png'));
            
        // Also update round icon if it exists
        const roundIconPath = path.join(targetDir, 'ic_launcher_round.png');
        await sharp(iconPath)
            .resize(item.size, item.size)
            .composite([{
                input: Buffer.from(`<svg><circle cx="${item.size / 2}" cy="${item.size / 2}" r="${item.size / 2}" fill="white"/></svg>`),
                blend: 'dest-in'
            }])
            .toFile(roundIconPath);
    }
}

module.exports = { buildAPK };
