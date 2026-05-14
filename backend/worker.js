const path = require('path');
const { buildQueue } = require('./queue');
const { buildAPK } = require('./builder');

buildQueue.process('apk-build', async (job) => {
    const { buildId, url, appName, packageName, splashColor } = job.data;

    try {
        job.progress(10);

        console.log(`Starting build for ${appName} (${buildId})`);

        const apkPath = await buildAPK(job.data, (p) => {
            job.progress(p);
        });

        return {
            status: 'completed',
            apkUrl: `/apks/${path.basename(apkPath)}`,
            downloadPath: apkPath
        };

    } catch (error) {
        console.error(`Job ${job.id} failed:`, error);
        throw error;
    }
});

console.log('Worker is running...');