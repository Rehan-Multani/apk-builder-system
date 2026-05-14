const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs-extra');
const { buildQueue } = require('./queue');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/apks', express.static(path.join(__dirname, '../apk_storage')));

const PORT = process.env.PORT || 3000;

// Mock Database
const db = {
    builds: [],
    users: [
        { id: 1, email: 'admin@example.com', password: 'password123' }
    ]
};

// Auth Middleware (Mock)
const authenticate = (req, res, next) => {
    // For now, skip auth or implement simple check
    next();
};

// --- AUTH ROUTES ---
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = db.users.find(u => u.email === email && u.password === password);
    if (user) {
        res.json({ success: true, token: 'mock-jwt-token', user: { email: user.email } });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// --- BUILD ROUTES ---

// Get Build History
app.get('/api/builds', authenticate, (req, res) => {
    res.json(db.builds);
});

// Start Build
app.post('/api/build', authenticate, async (req, res) => {
    try {
        const { url, appName, packageName, splashColor, version } = req.body;

        if (!url || !appName) {
            return res.status(400).json({ error: 'URL and App Name are required' });
        }

        const buildId = uuidv4();
        
        const buildData = {
            id: buildId,
            url,
            appName,
            packageName: packageName || `com.example.${appName.toLowerCase().replace(/\s+/g, '')}`,
            splashColor: splashColor || '#ffffff',
            version: version || '1.0.0',
            status: 'queued',
            createdAt: new Date(),
        };

        // Add to mock DB
        db.builds.unshift(buildData);

        // Add job to queue
        const job = await buildQueue.add('apk-build', buildData);

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

// Status Endpoint (Updated to sync with DB)
app.get('/api/status/:jobId', async (req, res) => {
    const job = await buildQueue.getJob(req.params.jobId);
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    const state = await job.getState();
    const progress = job.progress();
    const result = job.returnvalue;

    // Update internal DB status
    const build = db.builds.find(b => b.id === job.data.id);
    if (build) {
        build.status = state;
        if (result) build.result = result;
    }

    res.json({ 
        id: job.id, 
        state, 
        progress, 
        result 
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
