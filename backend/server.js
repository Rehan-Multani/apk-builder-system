const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs-extra');
const { buildQueue } = require('./queue');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// API to trigger build
app.post('/api/build', async (req, res) => {
    try {
        const { url, appName, packageName, splashColor } = req.body;

        if (!url || !appName) {
            return res.status(400).json({ error: 'URL and App Name are required' });
        }

        const buildId = uuidv4();
        
        // Add job to queue
        const job = await buildQueue.add('apk-build', {
            buildId,
            url,
            appName,
            packageName: packageName || `com.example.${appName.toLowerCase().replace(/\s+/g, '')}`,
            splashColor: splashColor || '#ffffff'
        });

        res.json({ 
            success: true, 
            message: 'Build started', 
            buildId,
            jobId: job.id
        });
    } catch (error) {
        console.error('Build Error:', error);
        res.status(500).json({ error: 'Failed to start build' });
    }
});

// API to check status
app.get('/api/status/:jobId', async (req, res) => {
    const job = await buildQueue.getJob(req.params.jobId);
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    const state = await job.getState();
    const progress = job.progress();
    const result = job.returnvalue;

    res.json({ 
        id: job.id, 
        state, 
        progress, 
        result 
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
