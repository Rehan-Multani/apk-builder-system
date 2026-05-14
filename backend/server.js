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
const { User, Build } = require('./models');

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

// Initialize Default Admin
async function initAdmin() {
    const adminEmail = 'admin@wapixo.com';
    const existing = await User.findOne({ email: adminEmail });
    if (!existing) {
        await User.create({
            email: adminEmail,
            password: 'adminpassword123',
            name: 'Default Admin',
            role: 'admin'
        });
        console.log('Default admin created: admin@wapixo.com / adminpassword123');
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
    { name: 'splash', maxCount: 1 }
]), async (req, res) => {
    try {
        const { url, appName, packageName: rawPackageName, splashColor, versionName, versionCode, privacyUrl, splashDuration } = req.body;
        const iconPath = req.files['icon'] ? req.files['icon'][0].path : null;
        const splashPath = req.files['splash'] ? req.files['splash'][0].path : null;

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
            versionCode: versionCode || '1'
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

        res.json({
            id: build.buildId,
            state: build.status,
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

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
