const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { buildQueue } = require('./queue');
const { User, Build, VpsServer } = require('./models');

const app = express();
app.use(cors({
    origin: ['https://frontend.cloudedata.in', 'http://localhost:5173'],
    credentials: true
}));
app.use(express.json());
app.use('/apks', express.static(path.join(__dirname, '../apk_storage')));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'wapixo_secret_key_2024';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mohammadrehan00121_db_user:B26NSBDyNU9qS6y4@ac-14bobaj-shard-00-00.1exhb3f.mongodb.net:27017,ac-14bobaj-shard-00-01.1exhb3f.mongodb.net:27017,ac-14bobaj-shard-00-02.1exhb3f.mongodb.net:27017/apkbuilder?ssl=true&replicaSet=atlas-h5gn4h-shard-0&authSource=admin&appName=Cluster0';

// Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Initialize Default Admin and Fix Typos
async function initAdmin() {
    // 1. Fix the gamil.com typo if it exists
    await User.updateOne({ email: 'admin@gamil.com' }, { email: 'admin@gmail.com' });
    console.log('Typo fix checked: admin@gamil.com -> admin@gmail.com');

    const adminEmail = 'admin@gmail.com';
    const existing = await User.findOne({ email: adminEmail });
    if (!existing) {
        await User.create({
            email: adminEmail,
            password: 'adminpassword123',
            name: 'Default Admin',
            role: 'admin'
        });
        console.log('Default admin created: admin@gmail.com / adminpassword123');
    }
}
initAdmin();

// Middleware: Authenticate with JWT
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'No token provided' });
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) return res.status(401).json({ error: 'User not found' });
        
        req.user = user;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// Multer Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'uploads/icons');
        fs.ensureDirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

function isValidPackageName(packageName) {
    const regex = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/;
    return regex.test(packageName);
}

// --- API Routes ---

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
});

app.get('/api/history', authenticate, async (req, res) => {
    try {
        const builds = await Build.find({}).sort({ createdAt: -1 });
        res.json(builds);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

app.post('/api/build', authenticate, upload.fields([
    { name: 'icon', maxCount: 1 },
    { name: 'splash', maxCount: 1 },
    { name: 'googleServices', maxCount: 1 }
]), async (req, res) => {
    try {
        const { url, appName, packageName: rawPackageName, splashColor, versionName, versionCode, splashDuration, storePassword, keyPassword, keyAlias, keystoreName, useFirebase, fcmStoreUrl, fcmBody, apiHeaders, useSafeArea, safeAreaTop, safeAreaBottom } = req.body;
        const iconPath = req.files['icon'] ? req.files['icon'][0].path : null;
        const splashPath = req.files['splash'] ? req.files['splash'][0].path : null;
        const googleServicesPath = req.files['googleServices'] ? req.files['googleServices'][0].path : null;

        if (!url || !appName) {
            return res.status(400).json({ error: 'URL and App Name are required' });
        }

        const packageName = rawPackageName || `com.${appName.toLowerCase().replace(/\s+/g, '')}.app`;
        if (!isValidPackageName(packageName)) {
            return res.status(400).json({ error: 'Invalid package name format' });
        }

        const buildId = uuidv4();
        
        // Save to MongoDB
        const newBuild = await Build.create({
            buildId,
            url,
            appName,
            packageName,
            versionName: versionName || '1.0.0',
            versionCode: versionCode || '1',
            status: 'queued',
            keyAlias: keyAlias || 'upload',
            keyPassword: keyPassword || 'rehan_password_2024',
            storePassword: storePassword || 'rehan_password_2024',
            googleServicesPath,
            userId: req.user._id
        });

        // Add job to queue
        const job = await buildQueue.add('apk-build', {
            buildId,
            url,
            appName,
            packageName,
            splashColor: req.body.splashColor || '#6366f1',
            splashMode: req.body.splashMode || 'color',
            versionName: versionName || '1.0.0',
            versionCode: versionCode || '1',
            iconPath,
            splashPath,
            storePassword,
            keyPassword,
            keyAlias,
            keystoreName,
            googleServicesPath,
            fcmStoreUrl,
            fcmBody: (() => {
                try { return typeof fcmBody === 'string' ? JSON.parse(fcmBody) : fcmBody; }
                catch (e) { return {}; }
            })(),
            apiHeaders: (() => {
                try { return typeof apiHeaders === 'string' ? JSON.parse(apiHeaders) : apiHeaders; }
                catch (e) { return {}; }
            })(),
            splashDuration: req.body.splashDuration || '2',
            useSafeArea: useSafeArea,
            safeAreaTop: safeAreaTop,
            safeAreaBottom: safeAreaBottom
        }, { jobId: buildId });
        res.json({ message: 'Build queued', jobId: job.id, build: newBuild });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to queue build' });
    }
});

app.get('/api/status/:jobId', async (req, res) => {
    try {
        const build = await Build.findOne({ buildId: req.params.jobId });
        if (!build) return res.status(404).json({ error: 'Build not found' });

        // Map database status to frontend expected states
        let state = 'waiting';
        if (build.status === 'processing') state = 'active';
        else if (build.status === 'completed') state = 'completed';
        else if (build.status === 'failed') state = 'failed';

        res.json({
            id: build.buildId,
            state: state, // frontend expects waiting/active/completed/failed
            progress: build.progress || 0,
            result: build.status === 'completed' ? {
                apkUrl: build.apkUrl,
                aabUrl: build.aabUrl
            } : null,
            error: build.error
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

// Change Password Route
app.post('/api/change-password', async (req, res) => {
    try {
        const { userId, currentPassword, newPassword } = req.body;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Incorrect current password' });

        user.password = newPassword; // Pre-save hook will hash it
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- One-Click VPS Deployment Endpoints ---

// Helper function to simulate background deployment
async function simulateDeployment(server) {
    const deploymentSteps = [
        { progress: 10, log: `-> Establishing SSH connection on ${server.username || 'root'}@${server.ipAddress}... Success` },
        { progress: 20, log: "-> Verifying system environment... Linux system detected." },
        { progress: 30, log: "-> Running package manager update: apt-get update && apt-get upgrade -y... Done" },
        { progress: 40, log: "-> Installing required dependencies: Node.js (v20), Git, Nginx, PM2, and Certbot... Done" },
        { progress: 50, log: `-> Cloning GitHub Repository: ${server.githubRepo}... Success` },
        { progress: 60, log: "-> Creating backend env configuration: writing backend/.env... Configured" },
        { progress: 70, log: "-> Installing backend dependencies & spawning web API process via PM2... Started" },
        { progress: 80, log: "-> Building frontend static build: running npm run build... Done" },
        { progress: 90, log: `-> Configuring Nginx virtual hosts reverse proxy for domain: ${server.domain}... Configured` },
        { progress: 95, log: `-> Requesting Let's Encrypt SSL Certificate for ${server.domain} via Certbot... Success` },
        { progress: 100, log: `[SUCCESS] Host setup completed successfully! Your project is online at: https://${server.domain}` }
    ];

    let stepIndex = 0;
    const interval = setInterval(async () => {
        if (stepIndex >= deploymentSteps.length) {
            clearInterval(interval);
            return;
        }

        const step = deploymentSteps[stepIndex];
        try {
            const dbServer = await VpsServer.findById(server._id);
            if (!dbServer) {
                // Server was destroyed in the meantime
                clearInterval(interval);
                return;
            }

            await VpsServer.updateOne(
                { _id: server._id },
                {
                    $set: { progress: step.progress, status: step.progress === 100 ? 'active' : 'deploying' },
                    $push: { logs: `[${new Date().toLocaleTimeString()}] ${step.log}` }
                }
            );
        } catch (err) {
            console.error('Error updating deployment simulation:', err);
            clearInterval(interval);
        }
        stepIndex++;
    }, 4000); // 4 seconds interval
}

// Helper function to simulate warm reboot
async function simulateReboot(serverId) {
    try {
        await VpsServer.updateOne(
            { _id: serverId },
            {
                $set: { status: 'rebooting', progress: 50 },
                $push: { logs: `[${new Date().toLocaleTimeString()}] [SYSTEM] Reboot command received. Gracefully stopping services...` }
            }
        );

        setTimeout(async () => {
            const dbServer = await VpsServer.findById(serverId);
            if (!dbServer) return; // Server was destroyed

            await VpsServer.updateOne(
                { _id: serverId },
                {
                    $set: { status: 'active', progress: 100 },
                    $push: { logs: `[${new Date().toLocaleTimeString()}] [SYSTEM] Server boot sequence completed. All services active.` }
                }
            );
        }, 10000); // 10 seconds reboot simulation
    } catch (err) {
        console.error('Error running reboot simulation:', err);
    }
}

// Get all VPS servers for logged in user
app.get('/api/vps/servers', authenticate, async (req, res) => {
    try {
        const servers = await VpsServer.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.json(servers);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch VPS servers' });
    }
});

// Deploy new VPS
app.post('/api/vps/deploy', authenticate, async (req, res) => {
    try {
        const { name, ipAddress, username, password, domain, githubRepo, backendEnv, frontendEnv } = req.body;
        if (!name || !ipAddress || !domain || !githubRepo) {
            return res.status(400).json({ error: 'Name, IP Address, Domain and GitHub Repo URL are required' });
        }

        const serverId = `vps-${uuidv4().substring(0, 8)}`;
        const initialLogs = [
            `[${new Date().toLocaleTimeString()}] [SYSTEM] Connecting to server SSH on root@${ipAddress}...`,
            `[${new Date().toLocaleTimeString()}] [SYSTEM] Target IP: ${ipAddress} (User: ${username || 'root'})`,
            `[${new Date().toLocaleTimeString()}] [SYSTEM] Domain Name: ${domain}`,
            `[${new Date().toLocaleTimeString()}] [SYSTEM] Repository: ${githubRepo}`
        ];

        const server = await VpsServer.create({
            serverId,
            name,
            ipAddress,
            username: username || 'root',
            domain,
            githubRepo,
            backendEnv,
            frontendEnv,
            status: 'deploying',
            progress: 0,
            logs: initialLogs,
            userId: req.user._id
        });

        // Trigger simulation in the background
        simulateDeployment(server);

        res.json({ message: 'Deployment initiated', server });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to deploy VPS' });
    }
});

// Get a single server's status and logs
app.get('/api/vps/server/:id', authenticate, async (req, res) => {
    try {
        const server = await VpsServer.findOne({ _id: req.params.id, userId: req.user._id });
        if (!server) return res.status(404).json({ error: 'Server not found' });
        res.json(server);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch server details' });
    }
});

// Perform action on server (reboot, destroy)
app.post('/api/vps/server/:id/action', authenticate, async (req, res) => {
    try {
        const { action } = req.body;
        const server = await VpsServer.findOne({ _id: req.params.id, userId: req.user._id });
        if (!server) return res.status(404).json({ error: 'Server not found' });

        if (action === 'reboot') {
            if (server.status === 'deploying' || server.status === 'rebooting') {
                return res.status(400).json({ error: 'Server is currently busy' });
            }
            simulateReboot(server._id);
            res.json({ message: 'Reboot initiated' });
        } else if (action === 'destroy') {
            await VpsServer.deleteOne({ _id: server._id });
            res.json({ message: 'Server destroyed successfully' });
        } else {
            res.status(400).json({ error: 'Invalid action' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to process server action' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
