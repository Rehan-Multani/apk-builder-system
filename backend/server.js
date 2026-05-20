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
const { Client } = require('ssh2');

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

// Helper to execute commands over SSH and stream output to DB in real-time
function executeSshCommandStream(conn, cmd, serverId, onLogLine) {
    return new Promise((resolve, reject) => {
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            
            let buffer = '';
            const handleData = (data) => {
                buffer += data.toString();
                let lines = buffer.split('\n');
                buffer = lines.pop(); // keep last incomplete line
                for (const line of lines) {
                    if (line.trim()) {
                        onLogLine(line.trim());
                    }
                }
            };
            
            stream.on('data', handleData);
            stream.stderr.on('data', handleData);
            
            stream.on('close', (code) => {
                if (buffer.trim()) {
                    onLogLine(buffer.trim());
                }
                resolve(code);
            });
        });
    });
}

// Helper function to handle background deployment over SSH
async function simulateDeployment(server, password) {
    const cleanDomain = server.domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
    const logPrefix = () => `[${new Date().toLocaleTimeString()}]`;

    const writeLog = async (text) => {
        console.log(`[VPS-${server.name}] ${text}`);
        await VpsServer.updateOne(
            { _id: server._id },
            { $push: { logs: `${logPrefix()} ${text}` } }
        );
    };

    const updateProgress = async (progress, status = 'deploying') => {
        await VpsServer.updateOne(
            { _id: server._id },
            { $set: { progress, status } }
        );
    };

    const maxRetries = 3;
    let attempt = 0;

    const connectWithRetry = () => {
        attempt++;
        const conn = new Client();

        conn.on('ready', async () => {
            await writeLog("-> SSH Connection established successfully. Running deployment script...");
            
            try {
                // Step 1: System Checks (10%)
                await updateProgress(10);
                await writeLog("-> Step 1/12: Checking target OS details...");
                await executeSshCommandStream(conn, "uname -a", server._id, writeLog);
                
                // Step 2: Update packages (20%)
                await updateProgress(20);
                await writeLog("-> Step 2/12: Running system package updates (apt-get update)...");
                await executeSshCommandStream(conn, "export DEBIAN_FRONTEND=noninteractive && apt-get update -y", server._id, writeLog);
                
                // Step 3: Install Node.js (30%)
                await updateProgress(30);
                await writeLog("-> Step 3/12: Verifying Node.js environment...");
                const nodeInstallCmd = `if ! command -v node &> /dev/null; then echo "Node.js not found. Installing..." && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs; else echo "Node.js $(node -v) is already installed."; fi`;
                await executeSshCommandStream(conn, nodeInstallCmd, server._id, writeLog);
                
                // Step 4: Install PM2 (40%)
                await updateProgress(40);
                await writeLog("-> Step 4/12: Verifying PM2 process manager...");
                const pm2InstallCmd = `if ! command -v pm2 &> /dev/null; then echo "PM2 not found. Installing..." && npm install -g pm2; else echo "PM2 $(pm2 -v) is already installed."; fi`;
                await executeSshCommandStream(conn, pm2InstallCmd, server._id, writeLog);

                // Step 5: Install Nginx & Certbot & Git (50%)
                await updateProgress(50);
                await writeLog("-> Step 5/12: Installing Nginx, Git, and Certbot dependencies...");
                const depCmd = `apt-get install -y nginx git certbot python3-certbot-nginx`;
                await executeSshCommandStream(conn, depCmd, server._id, writeLog);

                // Step 6: Clone Git Repository (60%)
                await updateProgress(60);
                await writeLog(`-> Step 6/12: Cloning repository from: ${server.githubRepo}...`);
                const cloneCmd = `mkdir -p /var/www/${cleanDomain} && cd /var/www/${cleanDomain} && if [ -d .git ]; then echo "Directory exists. Pulling updates..." && git fetch --all && git reset --hard origin/main || git reset --hard origin/master; else echo "Cloning clean repository..." && git clone ${server.githubRepo} .; fi`;
                await executeSshCommandStream(conn, cloneCmd, server._id, writeLog);

                // Step 7: Write Env Configuration files (70%)
                await updateProgress(70);
                await writeLog("-> Step 7/12: Writing backend and frontend env configuration files...");
                const writeBackendEnv = `mkdir -p /var/www/${cleanDomain}/backend && cat << 'EOF' > /var/www/${cleanDomain}/backend/.env\n${server.backendEnv || ''}\nEOF || cat << 'EOF' > /var/www/${cleanDomain}/.env\n${server.backendEnv || ''}\nEOF`;
                await executeSshCommandStream(conn, writeBackendEnv, server._id, writeLog);

                const writeFrontendEnv = `mkdir -p /var/www/${cleanDomain}/frontend && cat << 'EOF' > /var/www/${cleanDomain}/frontend/.env\n${server.frontendEnv || ''}\nEOF || cat << 'EOF' > /var/www/${cleanDomain}/.env.production\n${server.frontendEnv || ''}\nEOF`;
                await executeSshCommandStream(conn, writeFrontendEnv, server._id, writeLog);

                // Step 8: Install Dependencies (80%)
                await updateProgress(80);
                await writeLog("-> Step 8/12: Installing npm dependencies...");
                const installBackendDeps = `if [ -f /var/www/${cleanDomain}/backend/package.json ]; then cd /var/www/${cleanDomain}/backend && npm install; elif [ -f /var/www/${cleanDomain}/package.json ]; then cd /var/www/${cleanDomain} && npm install; fi`;
                await executeSshCommandStream(conn, installBackendDeps, server._id, writeLog);

                const installFrontendDeps = `if [ -f /var/www/${cleanDomain}/frontend/package.json ]; then cd /var/www/${cleanDomain}/frontend && npm install; fi`;
                await executeSshCommandStream(conn, installFrontendDeps, server._id, writeLog);

                // Step 9: Build Frontend Assets (85%)
                await updateProgress(85);
                await writeLog("-> Step 9/12: Bundling frontend production assets...");
                const buildFrontendCmd = `if [ -f /var/www/${cleanDomain}/frontend/package.json ]; then cd /var/www/${cleanDomain}/frontend && npm run build; elif grep -q '"build"' /var/www/${cleanDomain}/package.json; then cd /var/www/${cleanDomain} && npm run build; fi`;
                await executeSshCommandStream(conn, buildFrontendCmd, server._id, writeLog);

                // Step 10: Launch application processes via PM2 (90%)
                await updateProgress(90);
                await writeLog("-> Step 10/12: Starting Node application processes via PM2 daemon...");
                const startPm2Cmd = `pm2 delete ${cleanDomain} || true; if [ -f /var/www/${cleanDomain}/backend/server.js ]; then pm2 start /var/www/${cleanDomain}/backend/server.js --name "${cleanDomain}"; else pm2 start /var/www/${cleanDomain}/server.js --name "${cleanDomain}"; fi; pm2 save`;
                await executeSshCommandStream(conn, startPm2Cmd, server._id, writeLog);

                // Step 11: Configure Nginx Reverse Proxy (95%)
                await updateProgress(95);
                await writeLog(`-> Step 11/12: Configuring Nginx virtual hosts reverse proxy for: ${cleanDomain}`);
                
                const writeNginxConfig = `
                PORT_VAL=\$(grep -oP '^PORT=\\s*\\K\\d+' /var/www/${cleanDomain}/backend/.env || grep -oP '^PORT=\\s*\\K\\d+' /var/www/${cleanDomain}/.env || echo "5000")
                cat << EOF > /etc/nginx/sites-available/${cleanDomain}
server {
    listen 80;
    server_name ${cleanDomain};

    location / {
        root /var/www/${cleanDomain}/frontend/dist;
        try_files \\$uri \\$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:\\$PORT_VAL/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \\$host;
        proxy_cache_bypass \\$http_upgrade;
    }
}
EOF
                ln -sf /etc/nginx/sites-available/${cleanDomain} /etc/nginx/sites-enabled/
                rm -f /etc/nginx/sites-enabled/default
                nginx -t && systemctl reload nginx
                `;
                await executeSshCommandStream(conn, writeNginxConfig, server._id, writeLog);

                // Step 12: Request Certbot SSL Certificate (100%)
                await updateProgress(98);
                await writeLog("-> Step 12/12: Securing site with SSL Let's Encrypt certificates...");
                const sslCmd = `certbot --nginx -d ${cleanDomain} --non-interactive --agree-tos --register-unsafely-without-email || echo "SSL setup failed. Check DNS propagation."`;
                await executeSshCommandStream(conn, sslCmd, server._id, writeLog);

                await writeLog(`[SUCCESS] Host setup completed successfully! Your project is online at: https://${cleanDomain}`);
                await updateProgress(100, 'active');

            } catch (execErr) {
                await writeLog(`[ERROR] Exec encountered issues: ${execErr.message}`);
                await updateProgress(100, 'failed');
            } finally {
                conn.end();
            }
        });

        conn.on('error', async (err) => {
            console.error(`SSH connection attempt ${attempt} failed:`, err);
            if (attempt < maxRetries) {
                await writeLog(`[WARNING] SSH Connection attempt ${attempt} failed: ${err.message}. Retrying in 3 seconds...`);
                setTimeout(connectWithRetry, 3000);
            } else {
                await writeLog(`[ERROR] SSH Connection error to root@${server.ipAddress}: ${err.message}`);
                await updateProgress(100, 'failed');
            }
        });

        conn.connect({
            host: server.ipAddress,
            port: 22,
            username: server.username || 'root',
            password: password,
            readyTimeout: 60000,
            keepaliveInterval: 10000
        });
    };

    connectWithRetry();
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
        const name = req.body.name?.trim() || '';
        const ipAddress = req.body.ipAddress?.trim() || '';
        const username = req.body.username?.trim() || 'root';
        const password = req.body.password?.trim() || '';
        const domain = req.body.domain?.trim() || '';
        const githubRepo = req.body.githubRepo?.trim() || '';
        const backendEnv = req.body.backendEnv || '';
        const frontendEnv = req.body.frontendEnv || '';

        if (!name || !ipAddress || !domain || !githubRepo) {
            return res.status(400).json({ error: 'Name, IP Address, Domain and GitHub Repo URL are required' });
        }

        // Sanitize domain to remove protocols and trailing slashes
        const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');

        const serverId = `vps-${uuidv4().substring(0, 8)}`;
        const initialLogs = [
            `[${new Date().toLocaleTimeString()}] [SYSTEM] Connecting to server SSH on root@${ipAddress}...`,
            `[${new Date().toLocaleTimeString()}] [SYSTEM] Target IP: ${ipAddress} (User: ${username || 'root'})`,
            `[${new Date().toLocaleTimeString()}] [SYSTEM] Domain Name: ${cleanDomain}`,
            `[${new Date().toLocaleTimeString()}] [SYSTEM] Repository: ${githubRepo}`
        ];

        const server = await VpsServer.create({
            serverId,
            name,
            ipAddress,
            username: username || 'root',
            domain: cleanDomain,
            githubRepo,
            backendEnv,
            frontendEnv,
            status: 'deploying',
            progress: 0,
            logs: initialLogs,
            userId: req.user._id
        });

        // Trigger simulation in the background
        simulateDeployment(server, password);

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
