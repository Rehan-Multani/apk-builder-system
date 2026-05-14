const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const TEMPLATE_PATH = path.join(__dirname, '../template_app');
const BUILDS_PATH = path.join(__dirname, '../builds');
const STORAGE_PATH = path.join(__dirname, '../apk_storage');

async function buildAPK(data, onProgress) {
    const { buildId, url, appName, packageName, splashColor } = data;
    if (!buildId) throw new Error('buildId is required but was undefined');
    const workingDir = path.join(BUILDS_PATH, buildId);

    try {
        // 1. Ensure storage exists
        await fs.ensureDir(STORAGE_PATH);
        await fs.ensureDir(BUILDS_PATH);

        // 2. Copy template to builds
        onProgress(20);
        await fs.copy(TEMPLATE_PATH, workingDir);

        // 3. Update config.json
        const configDir = path.join(workingDir, 'assets');
        await fs.ensureDir(configDir);
        const configPath = path.join(configDir, 'config.json');
        await fs.writeJson(configPath, { url, splashColor }, { spaces: 2 });

        // 4. Update Package Name & App Name in Android files
        onProgress(30);
        await updateAndroidConfig(workingDir, appName, packageName);
        
        // 5. Run Flutter Build
        console.log(`Running flutter build for ${buildId}...`);
        // On VPS, this will work. Locally it might fail if flutter is missing.
        const { stdout, stderr } = await execPromise('flutter build apk --release', {
            cwd: workingDir
        });
        
        onProgress(80);

        // 6. Move APK to storage
        const sourceApk = path.join(workingDir, 'build/app/outputs/flutter-apk/app-release.apk');
        const targetApkName = `${appName.replace(/\s+/g, '_')}_${buildId}.apk`;
        const targetPath = path.join(STORAGE_PATH, targetApkName);

        if (await fs.pathExists(sourceApk)) {
            await fs.copy(sourceApk, targetPath);
        } else {
            throw new Error('APK not found after build');
        }

        // 7. Cleanup
        await fs.remove(workingDir);
        
        onProgress(100);
        return targetPath;

    } catch (error) {
        console.error('Builder Error:', error);
        // Cleanup on failure
        if (await fs.pathExists(workingDir)) {
            await fs.remove(workingDir);
        }
        throw error;
    }
}

async function updateAndroidConfig(workingDir, appName, packageName) {
    // 1. Update app_name in strings.xml
    const stringsPath = path.join(workingDir, 'android/app/src/main/res/values/strings.xml');
    if (await fs.pathExists(stringsPath)) {
        let stringsContent = await fs.readFile(stringsPath, 'utf8');
        stringsContent = stringsContent.replace(/<string name="app_name">.*<\/string>/, `<string name="app_name">${appName}</string>`);
        await fs.writeFile(stringsPath, stringsContent);
    }

    // 2. Update applicationId in build.gradle
    const gradlePath = path.join(workingDir, 'android/app/build.gradle');
    if (await fs.pathExists(gradlePath)) {
        let gradleContent = await fs.readFile(gradlePath, 'utf8');
        gradleContent = gradleContent.replace(/applicationId ".*"/, `applicationId "${packageName}"`);
        await fs.writeFile(gradlePath, gradleContent);
    }
}

module.exports = { buildAPK };
