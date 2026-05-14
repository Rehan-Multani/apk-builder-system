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
    const workingDir = path.join(BUILDS_PATH, buildId);

    try {
        // 1. Ensure storage exists
        await fs.ensureDir(STORAGE_PATH);
        await fs.ensureDir(BUILDS_PATH);

        // 2. Copy template to builds
        onProgress(20);
        await fs.copy(TEMPLATE_PATH, workingDir);

        // 3. Update config.json
        const configPath = path.join(workingDir, 'assets/config.json');
        await fs.writeJson(configPath, { url, splashColor }, { spaces: 2 });

        // 4. Update Android Application ID and Name (Basic placeholder logic)
        // In a real scenario, we'd use 'sed' or a library to replace strings in build.gradle
        onProgress(30);
        
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
            await fs.move(sourceApk, targetPath);
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

module.exports = { buildAPK };
