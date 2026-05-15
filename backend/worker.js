const path = require('path');
const mongoose = require('mongoose');
const { buildQueue } = require('./queue');
const { buildAPK } = require('./builder');
const { Build } = require('./models'); // Fix import path

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://mohammadrehan00121_db_user:B26NSBDyNU9qS6y4@ac-14bobaj-shard-00-00.1exhb3f.mongodb.net:27017,ac-14bobaj-shard-00-01.1exhb3f.mongodb.net:27017,ac-14bobaj-shard-00-02.1exhb3f.mongodb.net:27017/apkbuilder?ssl=true&replicaSet=atlas-h5gn4h-shard-0&authSource=admin&appName=Cluster0')
    .then(() => console.log('✅ Worker connected to MongoDB'))
    .catch(err => console.error('❌ Worker MongoDB connection error:', err));

// Process Build Queue
buildQueue.process('apk-build', async (job) => {
    const { buildId, url, appName, packageName, splashColor, splashMode } = job.data;

    try {
        console.log(`🚀 [${buildId}] Starting build process for: ${appName}`);
        job.progress(5);

        // Update DB status to processing
        await Build.findOneAndUpdate({ buildId }, { status: 'processing', progress: 5 });

        const result = await buildAPK(job.data, async (p) => {
            job.progress(p);
            // Update DB progress periodically
            await Build.findOneAndUpdate({ buildId }, { progress: p });
        });

        console.log(`✅ [${buildId}] Build successful! APK: ${result.apkPath}`);

        // Update DB status to completed
        await Build.findOneAndUpdate({ buildId }, { 
            status: 'completed', 
            progress: 100,
            apkUrl: result.apkUrl,
            aabUrl: result.aabUrl,
            jksUrl: result.jksUrl,
            keyAlias: result.keyAlias,
            keyPassword: result.keyPassword,
            storePassword: result.storePassword
        });

        return { status: 'completed', ...result };

    } catch (error) {
        console.error(`❌ [${buildId}] Job failed:`, error.message);
        
        // Update DB status to failed
        await Build.findOneAndUpdate({ buildId }, { 
            status: 'failed', 
            error: error.message 
        });

        throw error;
    }
});

console.log('👷 Worker is active and waiting for jobs...');