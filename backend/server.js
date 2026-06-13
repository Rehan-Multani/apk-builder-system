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
const { NodeSSH } = require('node-ssh');

const app = express();
app.use(cors({
    origin: ['https://frontend.cloudedata.in', 'http://localhost:5173'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
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

        // Fetch Live Logs from Bull Queue
        let logs = [];
        try {
            const job = await buildQueue.getJob(req.params.jobId);
            if (job) {
                const logsData = await job.getLogs();
                logs = logsData.logs || [];
            }
        } catch (e) {
            console.error('Failed to get logs for job:', e);
        }

        res.json({
            id: build.buildId,
            state: state, // frontend expects waiting/active/completed/failed
            progress: build.progress || 0,
            result: build.status === 'completed' ? {
                apkUrl: build.apkUrl,
                aabUrl: build.aabUrl,
                jksUrl: build.jksUrl
            } : null,
            error: build.error,
            logs: logs
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

    return conn.execCommand(cmd, {
        onStdout: (chunk) => handleData(chunk),
        onStderr: (chunk) => handleData(chunk)
    }).then((result) => {
        if (buffer.trim()) {
            onLogLine(buffer.trim());
        }
        return result.code;
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

    const connectWithRetry = async () => {
        attempt++;
        const conn = new NodeSSH();

        try {
            await conn.connect({
                host: server.ipAddress,
                port: 22,
                username: server.username || 'root',
                password: password,
                readyTimeout: 120000,
                tryKeyboard: true,
                onKeyboardInteractive: (name, instructions, instructionsLang, prompts, finish) => {
                    finish([password]);
                }
            });

            await writeLog("-> SSH Connection established successfully. Running deployment script...");

            try {
                // Step 1: System Checks & Memory Optimization (10%)
                await updateProgress(10);
                await writeLog("-> Step 1/12: Checking target OS details and configuring Swap Memory...");
                await executeSshCommandStream(conn, "uname -a", server._id, writeLog);

                // Create a 1GB Swap file if it doesn't exist to prevent out-of-memory errors during build
                const createSwapCmd = `
                if [ ! -f /swapfile ]; then
                    echo "-> Creating 1GB swap file to prevent RAM exhaustion..."
                    fallocate -l 1G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=1024
                    chmod 600 /swapfile
                    mkswap /swapfile
                    swapon /swapfile
                    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
                else
                    echo "-> Swap file already exists."
                fi
                `;
                await executeSshCommandStream(conn, createSwapCmd, server._id, writeLog);

                // Step 2: Update packages (20%)
                await updateProgress(20);
                await writeLog("-> Step 2/12: Running system package updates...");
                const updatePkgCmd = `
                if command -v apt-get &> /dev/null; then
                    export DEBIAN_FRONTEND=noninteractive && apt-get update -y
                elif command -v dnf &> /dev/null; then
                    dnf clean all && dnf check-update -y || true
                else
                    yum clean all && yum check-update -y || true
                fi
                `;
                await executeSshCommandStream(conn, updatePkgCmd, server._id, writeLog);

                // Step 3: Install Node.js (30%)
                await updateProgress(30);
                await writeLog("-> Step 3/12: Verifying Node.js environment...");
                const nodeInstallCmd = `
                if ! command -v node &> /dev/null; then
                    echo "Node.js not found. Installing..."
                    if command -v apt-get &> /dev/null; then
                        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
                    elif command -v dnf &> /dev/null; then
                        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && dnf install -y nodejs
                    else
                        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && yum install -y nodejs
                    fi
                else
                    echo "Node.js $(node -v) is already installed."
                fi
                `;
                await executeSshCommandStream(conn, nodeInstallCmd, server._id, writeLog);

                // Step 4: Install PM2 (40%)
                await updateProgress(40);
                await writeLog("-> Step 4/12: Verifying PM2 process manager...");
                const pm2InstallCmd = `if ! command -v pm2 &> /dev/null; then echo "PM2 not found. Installing..." && npm install -g pm2; else echo "PM2 $(pm2 -v) is already installed."; fi`;
                await executeSshCommandStream(conn, pm2InstallCmd, server._id, writeLog);

                // Step 5: Install Nginx & Certbot & Git & MongoDB (50%)
                await updateProgress(50);
                await writeLog("-> Step 5/12: Installing Nginx, Git, Certbot, and local MongoDB server...");

                // Let's install dependencies first
                const depCmd = `
                if command -v apt-get &> /dev/null; then
                    apt-get install -y nginx git certbot python3-certbot-nginx
                elif command -v dnf &> /dev/null; then
                    dnf install -y epel-release || true
                    dnf install -y nginx git certbot python3-certbot-nginx || dnf install -y nginx git certbot || true
                else
                    yum install -y epel-release || true
                    yum install -y nginx git certbot python3-certbot-nginx || yum install -y nginx git certbot || true
                fi
                `;
                await executeSshCommandStream(conn, depCmd, server._id, writeLog);

                // Now let's run the MongoDB installation and setup commands
                await writeLog("-> Installing MongoDB Community Edition locally...");
                const mongoInstallCmd = `
                if ! command -v mongod &> /dev/null; then
                    echo "MongoDB not found. Fetching and installing MongoDB..."
                    if command -v apt-get &> /dev/null; then
                        curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg --yes || true
                        echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list || true
                        export DEBIAN_FRONTEND=noninteractive
                        apt-get update -y || true
                        apt-get install -y mongodb-org || apt-get install -y mongodb || apt-get install -y mongodb-server || true
                    else
                        # RHEL/CentOS/Rocky/AlmaLinux
                        cat << 'EOF' > /etc/yum.repos.d/mongodb-org-7.0.repo
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/\\$releasever/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-7.0.asc
EOF
                        if command -v dnf &> /dev/null; then
                            dnf install -y mongodb-org || true
                        else
                            yum install -y mongodb-org || true
                        fi
                    fi
                else
                    echo "MongoDB is already installed on the target machine."
                fi
                systemctl daemon-reload || true
                systemctl enable mongod || systemctl enable mongodb || true
                systemctl start mongod || systemctl start mongodb || true
                `;
                await executeSshCommandStream(conn, mongoInstallCmd, server._id, writeLog);

                // Now configure the database user
                await writeLog("-> Configuring local MongoDB database and credentials...");
                const mongoDbName = server.localMongoDbName || 'erp_school';
                const mongoUser = server.localMongoUsername || 'db_user';
                const mongoUserCmd = `
                # Temporarily disable auth to create the new user if it was already enabled
                if grep -q "authorization: enabled" /etc/mongod.conf 2>/dev/null || grep -q "authorization: enabled" /etc/mongodb.conf 2>/dev/null; then
                    sed -i -E 's/^security:/#security:/g' /etc/mongod.conf 2>/dev/null || true
                    sed -i -E 's/.*authorization: enabled.*/#  authorization: enabled/g' /etc/mongod.conf 2>/dev/null || true
                    sed -i -E 's/^security:/#security:/g' /etc/mongodb.conf 2>/dev/null || true
                    sed -i -E 's/.*authorization: enabled.*/#  authorization: enabled/g' /etc/mongodb.conf 2>/dev/null || true
                    systemctl restart mongod || systemctl restart mongodb || true
                    sleep 3
                fi

                mongosh admin --eval "try { db.createUser({user: '${mongoUser}', pwd: '${server.localMongoPassword}', roles: [{role: 'userAdminAnyDatabase', db: 'admin'}, {role: 'readWriteAnyDatabase', db: 'admin'}]}) } catch(e) { db.changeUserPassword('${mongoUser}', '${server.localMongoPassword}') }" || \
                mongo admin --eval "try { db.createUser({user: '${mongoUser}', pwd: '${server.localMongoPassword}', roles: [{role: 'userAdminAnyDatabase', db: 'admin'}, {role: 'readWriteAnyDatabase', db: 'admin'}]}) } catch(e) { db.changeUserPassword('${mongoUser}', '${server.localMongoPassword}') }" || \
                mongosh ${mongoDbName} --eval "try { db.createUser({user: '${mongoUser}', pwd: '${server.localMongoPassword}', roles: [{role: 'userAdminAnyDatabase', db: 'admin'}, {role: 'readWriteAnyDatabase', db: 'admin'}]}) } catch(e) { db.changeUserPassword('${mongoUser}', '${server.localMongoPassword}') }" || \
                mongo ${mongoDbName} --eval "try { db.createUser({user: '${mongoUser}', pwd: '${server.localMongoPassword}', roles: [{role: 'userAdminAnyDatabase', db: 'admin'}, {role: 'readWriteAnyDatabase', db: 'admin'}]}) } catch(e) { db.changeUserPassword('${mongoUser}', '${server.localMongoPassword}') }" || true

                # Allow external connections AND ENABLE AUTHENTICATION for cross-VPS access
                if [ -f /etc/mongod.conf ]; then
                    sed -i -E 's/bindIp:\\s*127\\.0\\.0\\.1.*/bindIp: 0.0.0.0/' /etc/mongod.conf
                    sed -i -E 's/^#security:/security:/g' /etc/mongod.conf 2>/dev/null || true
                    sed -i -E 's/^#\\s*authorization: enabled/  authorization: enabled/g' /etc/mongod.conf 2>/dev/null || true
                    if ! grep -E -q "^\\s*authorization: enabled" /etc/mongod.conf; then
                        echo -e "\\nsecurity:\\n  authorization: enabled" >> /etc/mongod.conf
                    fi
                    systemctl restart mongod || true
                elif [ -f /etc/mongodb.conf ]; then
                    sed -i -E 's/bindIp:\\s*127\\.0\\.0\\.1.*/bindIp: 0.0.0.0/' /etc/mongodb.conf
                    sed -i -E 's/^#security:/security:/g' /etc/mongodb.conf 2>/dev/null || true
                    sed -i -E 's/^#\\s*authorization: enabled/  authorization: enabled/g' /etc/mongodb.conf 2>/dev/null || true
                    if ! grep -E -q "^\\s*authorization: enabled" /etc/mongodb.conf; then
                        echo -e "\\nsecurity:\\n  authorization: enabled" >> /etc/mongodb.conf
                    fi
                    systemctl restart mongodb || true
                fi
                sleep 3
                `;
                await executeSshCommandStream(conn, mongoUserCmd, server._id, writeLog);

                // Step 6: Clone Git Repository (60%)
                await updateProgress(60);
                await writeLog(`-> Step 6/12: Cloning repository from: ${server.githubRepo}...`);
                const cloneCmd = `mkdir -p /var/www/${cleanDomain} && cd /var/www/${cleanDomain} && if [ -d .git ]; then CURRENT_URL=\$(git config --get remote.origin.url 2>/dev/null || echo ""); if [ "\$CURRENT_URL" != "${server.githubRepo}" ] && [ "\$CURRENT_URL" != "${server.githubRepo}.git" ]; then echo "Repository changed! Re-cloning..." && find . -mindepth 1 -delete 2>/dev/null || true && GIT_TERMINAL_PROMPT=0 git clone ${server.githubRepo} .; else echo "Directory exists. Pulling updates..." && GIT_TERMINAL_PROMPT=0 git fetch --all && GIT_TERMINAL_PROMPT=0 git reset --hard origin/main || GIT_TERMINAL_PROMPT=0 git reset --hard origin/master; fi; else echo "Cloning clean repository..." && find . -mindepth 1 -delete 2>/dev/null || true && GIT_TERMINAL_PROMPT=0 git clone ${server.githubRepo} .; fi`;
                await executeSshCommandStream(conn, cloneCmd, server._id, writeLog);

                // Step 7: Write Env Configuration files (70%)
                await updateProgress(70);
                await writeLog("-> Step 7/12: Writing backend and frontend env configuration files...");
                const backendEnvBase64 = Buffer.from(server.backendEnv || '').toString('base64');
                const writeBackendEnv = `mkdir -p /var/www/${cleanDomain}/${server.backendDir} && echo "${backendEnvBase64}" | base64 -d > /var/www/${cleanDomain}/${server.backendDir}/.env && echo "${backendEnvBase64}" | base64 -d > /var/www/${cleanDomain}/.env`;
                await executeSshCommandStream(conn, writeBackendEnv, server._id, writeLog);

                const frontendEnvBase64 = Buffer.from(server.frontendEnv || '').toString('base64');
                const writeFrontendEnv = `mkdir -p /var/www/${cleanDomain}/${server.frontendDir} && echo "${frontendEnvBase64}" | base64 -d > /var/www/${cleanDomain}/${server.frontendDir}/.env && echo "${frontendEnvBase64}" | base64 -d > /var/www/${cleanDomain}/.env.production`;
                await executeSshCommandStream(conn, writeFrontendEnv, server._id, writeLog);

                // Step 8: Install Dependencies (80%)
                await updateProgress(80);
                await writeLog("-> Step 8/12: Installing npm dependencies...");
                const installBackendDeps = `if [ -f /var/www/${cleanDomain}/${server.backendDir}/package.json ]; then cd /var/www/${cleanDomain}/${server.backendDir} && npm install; elif [ -f /var/www/${cleanDomain}/package.json ]; then cd /var/www/${cleanDomain} && npm install; fi`;
                await executeSshCommandStream(conn, installBackendDeps, server._id, writeLog);

                const installFrontendDeps = `if [ -f /var/www/${cleanDomain}/${server.frontendDir}/package.json ]; then cd /var/www/${cleanDomain}/${server.frontendDir} && npm install; fi`;
                await executeSshCommandStream(conn, installFrontendDeps, server._id, writeLog);

                // Step 9: Build Frontend Assets (85%)
                await updateProgress(85);
                await writeLog("-> Step 9/12: Bundling frontend production assets...");
                // Automatically generate vite.config.js if missing (common in some templates) to resolve '@/*' path aliases
                const ensureViteConfig = `if [ ! -f /var/www/${cleanDomain}/${server.frontendDir}/vite.config.js ] && [ ! -f /var/www/${cleanDomain}/${server.frontendDir}/vite.config.ts ] && [ ! -f /var/www/${cleanDomain}/${server.frontendDir}/vite.config.mjs ] && [ -f /var/www/${cleanDomain}/${server.frontendDir}/package.json ]; then
                  echo "import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});" > /var/www/${cleanDomain}/${server.frontendDir}/vite.config.js;
                fi`;
                await executeSshCommandStream(conn, ensureViteConfig, server._id, writeLog);

                const buildFrontendCmd = `if [ -f /var/www/${cleanDomain}/${server.frontendDir}/package.json ]; then cd /var/www/${cleanDomain}/${server.frontendDir} && npm run build; elif grep -q '"build"' /var/www/${cleanDomain}/package.json; then cd /var/www/${cleanDomain} && npm run build; fi`;
                const buildCode = await executeSshCommandStream(conn, buildFrontendCmd, server._id, writeLog);

                if (buildCode !== 0) {
                    throw new Error('Frontend React/Vite build failed due to syntax or import errors in your project code. Please check the logs above to fix your code, push to GitHub, and try Redeploying.');
                }

                // Step 10: Launch application processes via PM2 (90%)
                await updateProgress(90);
                await writeLog("-> Step 10/12: Starting Node application processes via PM2 daemon...");
                // Configure UFW Firewall if active
                const firewallCmd = `
                if command -v ufw &> /dev/null; then
                    ufw allow 80/tcp || true
                    ufw allow 443/tcp || true
                    ufw allow 27017/tcp || true
                fi
                `;
                await executeSshCommandStream(conn, firewallCmd, server._id, writeLog);

                const startPm2Cmd = `pm2 delete ${cleanDomain} || true; cd /var/www/${cleanDomain}/${server.backendDir}; if [ -f server.js ]; then pm2 start server.js --name "${cleanDomain}"; elif [ -f index.js ]; then pm2 start index.js --name "${cleanDomain}"; elif [ -f app.js ]; then pm2 start app.js --name "${cleanDomain}"; else echo "ERROR: Could not find main file (server.js, index.js, or app.js) in backend directory!"; fi; pm2 save; env PATH=\\$PATH:/usr/bin pm2 startup systemd -u root --hp /root || true`;
                await executeSshCommandStream(conn, startPm2Cmd, server._id, writeLog);

                // Step 11: Configure Nginx Reverse Proxy (95%)
                await updateProgress(95);
                await writeLog(`-> Step 11/12: Configuring Nginx virtual hosts reverse proxy for: ${cleanDomain}`);

                const writeNginxConfig = `
                PORT_VAL=\$(grep -oP '^PORT=\\s*\\K\\d+' /var/www/${cleanDomain}/${server.backendDir}/.env 2>/dev/null || grep -oP '^PORT=\\s*\\K\\d+' /var/www/${cleanDomain}/.env 2>/dev/null || echo "5000")
                
                FRONTEND_ROOT="/var/www/${cleanDomain}/${server.frontendDir}/dist"
                if [ -d "/var/www/${cleanDomain}/${server.frontendDir}/build" ]; then
                    FRONTEND_ROOT="/var/www/${cleanDomain}/${server.frontendDir}/build"
                fi

                mkdir -p /etc/nginx/conf.d
                cat << EOF > /etc/nginx/conf.d/${cleanDomain}.conf
server {
    listen 80;
    server_name ${cleanDomain};

    location / {
        root $FRONTEND_ROOT;
        try_files \\$uri \\$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:\$PORT_VAL;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \\$host;
        proxy_cache_bypass \\$http_upgrade;
    }
}
EOF
                # If SELinux is active, allow Nginx reverse proxy connections
                if command -v setsebool &> /dev/null; then
                    setsebool -P httpd_can_network_connect 1 || true
                fi
                # Disable conflicting default configurations if they exist
                rm -f /etc/nginx/sites-enabled/default
                rm -f /etc/nginx/conf.d/default.conf
                
                nginx -t && (systemctl restart nginx || systemctl reload nginx || service nginx restart)
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
                conn.dispose();
            }

        } catch (err) {
            console.error(`SSH connection attempt ${attempt} failed:`, err);
            if (attempt < maxRetries) {
                await writeLog(`[WARNING] SSH Connection attempt ${attempt} failed: ${err.message}. Retrying in 3 seconds...`);
                setTimeout(connectWithRetry, 3000);
            } else {
                await writeLog(`[ERROR] SSH Connection error to root@${server.ipAddress}: ${err.message}`);
                await updateProgress(100, 'failed');
            }
        }
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

// Helper function to handle background redeployment/update over SSH
async function simulateRedeploy(server, password) {
    const cleanDomain = server.domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
    const logPrefix = () => `[${new Date().toLocaleTimeString()}]`;

    const writeLog = async (text) => {
        console.log(`[VPS-Redeploy-${server.name}] ${text}`);
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

    const conn = new NodeSSH();

    try {
        await updateProgress(10, 'deploying');
        await writeLog("-> Connecting to server SSH for code update...");

        await conn.connect({
            host: server.ipAddress,
            port: 22,
            username: server.username || 'root',
            password: password,
            readyTimeout: 120000,
            tryKeyboard: true,
            onKeyboardInteractive: (name, instructions, instructionsLang, prompts, finish) => {
                finish([password]);
            }
        });

        await writeLog("-> SSH Connection established successfully. Starting redeployment sequence...");

        // Step 1: Git pull / fetch and reset
        await updateProgress(30);
        await writeLog(`-> Step 1/3: Pulling latest commits from GitHub repository: ${server.githubRepo}`);
        const gitPullCmd = `cd /var/www/${cleanDomain} && GIT_TERMINAL_PROMPT=0 git fetch --all && (GIT_TERMINAL_PROMPT=0 git reset --hard origin/main || GIT_TERMINAL_PROMPT=0 git reset --hard origin/master || GIT_TERMINAL_PROMPT=0 git reset --hard origin/default)`;
        await executeSshCommandStream(conn, gitPullCmd, server._id, writeLog);

        // Update Environment Variables
        await updateProgress(45);
        await writeLog("-> Updating backend and frontend environment variables (.env files)...");

        const backendEnvBase64 = Buffer.from(server.backendEnv || '').toString('base64');
        const writeBackendEnv = `mkdir -p /var/www/${cleanDomain}/${server.backendDir} && echo "${backendEnvBase64}" | base64 -d > /var/www/${cleanDomain}/${server.backendDir}/.env && echo "${backendEnvBase64}" | base64 -d > /var/www/${cleanDomain}/.env`;
        await executeSshCommandStream(conn, writeBackendEnv, server._id, writeLog);

        const frontendEnvBase64 = Buffer.from(server.frontendEnv || '').toString('base64');
        const writeFrontendEnv = `mkdir -p /var/www/${cleanDomain}/${server.frontendDir} && echo "${frontendEnvBase64}" | base64 -d > /var/www/${cleanDomain}/${server.frontendDir}/.env && echo "${frontendEnvBase64}" | base64 -d > /var/www/${cleanDomain}/.env.production`;
        await executeSshCommandStream(conn, writeFrontendEnv, server._id, writeLog);

        // Step 2: Install backend dependencies & restart PM2
        await updateProgress(60);
        await writeLog("-> Step 2/3: Installing backend node_modules and restarting PM2 process...");
        const updateBackend = `
        if [ -f /var/www/${cleanDomain}/${server.backendDir}/package.json ]; then
            cd /var/www/${cleanDomain}/${server.backendDir} && npm install
        elif [ -f /var/www/${cleanDomain}/package.json ]; then
            cd /var/www/${cleanDomain} && npm install
        fi
        `;
        await executeSshCommandStream(conn, updateBackend, server._id, writeLog);

        const pm2RestartCmd = `pm2 restart "${cleanDomain}" || (cd /var/www/${cleanDomain}/${server.backendDir}; if [ -f server.js ]; then pm2 start server.js --name "${cleanDomain}"; elif [ -f index.js ]; then pm2 start index.js --name "${cleanDomain}"; elif [ -f app.js ]; then pm2 start app.js --name "${cleanDomain}"; else echo "ERROR: Could not find main file (server.js, index.js, or app.js) in backend directory!"; fi; pm2 save)`;
        await executeSshCommandStream(conn, pm2RestartCmd, server._id, writeLog);

        // Step 3: Install frontend dependencies & run build
        await updateProgress(85);
        await writeLog("-> Step 3/3: Installing frontend node_modules and rebuilding production bundle...");
        const updateFrontend = `
        if [ -f /var/www/${cleanDomain}/${server.frontendDir}/package.json ]; then
            cd /var/www/${cleanDomain}/${server.frontendDir} && npm install && npm run build
        elif grep -q '"build"' /var/www/${cleanDomain}/package.json; then
            cd /var/www/${cleanDomain} && npm run build
        fi
        `;
        const rbCode = await executeSshCommandStream(conn, updateFrontend, server._id, writeLog);

        if (rbCode !== 0) {
            throw new Error('Frontend Redeployment Build failed due to errors in your React code. Check the logs above, fix the issues in your repository, and Redeploy again.');
        }

        await writeLog("[SUCCESS] Redeployment completed successfully! Your site is running the latest updates.");
        await updateProgress(100, 'active');

    } catch (err) {
        console.error(`Redeployment failed:`, err);
        await writeLog(`[ERROR] Redeployment failed: ${err.message}`);
        await updateProgress(100, 'failed');
    } finally {
        conn.dispose();
    }
}

// Redeploy VPS Endpoint
app.post('/api/vps/redeploy', authenticate, async (req, res) => {
    try {
        const { serverId, password } = req.body;
        if (!serverId || !password) {
            return res.status(400).json({ error: 'Server ID and SSH Password are required' });
        }

        const server = await VpsServer.findOne({ _id: serverId, userId: req.user._id });
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        // Clean logs and set deploying status
        await VpsServer.updateOne(
            { _id: serverId },
            {
                $set: {
                    status: 'deploying',
                    progress: 0,
                    logs: [`[${new Date().toLocaleTimeString()}] [SYSTEM] Initiating code redeployment sequence...`]
                }
            }
        );

        // Run redeploy in background
        simulateRedeploy(server, password);

        res.json({ message: 'Redeployment initiated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to initiate redeployment' });
    }
});


// Get all VPS servers for logged in user
app.get('/api/vps/servers', authenticate, async (req, res) => {
    try {
        const servers = await VpsServer.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.json(servers);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch VPS servers' });
    }
});

// Helper to inject local mongodb url in the env variables
function updateMongoUrlInEnv(envString, newUrl, varName = 'MONGODB_URL') {
    let updated = envString || '';

    // Replace the exact varName if exists
    const regex = new RegExp(`^${varName}=.*$`, 'm');
    if (regex.test(updated)) {
        updated = updated.replace(regex, `${varName}=${newUrl}`);
    } else {
        // If it doesn't exist, append it at the bottom
        updated = updated.trim() ? updated.trim() + `\n\n${varName}=${newUrl}` : `${varName}=${newUrl}`;
    }

    return updated;
}

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
        const backendDir = req.body.backendDir?.trim() || 'backend';
        const frontendDir = req.body.frontendDir?.trim() || 'frontend';
        const mongoEnvVarName = req.body.mongoEnvVarName?.trim() || 'MONGODB_URL';

        if (!name || !ipAddress || !domain || !githubRepo) {
            return res.status(400).json({ error: 'Name, IP Address, Domain and GitHub Repo URL are required' });
        }

        // Strictly enforce HTTPS GitHub URL to prevent SSH clone prompts from hanging
        if (!/^https:\/\/(?:[a-zA-Z0-9_-]+(?:[:][a-zA-Z0-9_-]+)?@)?github\.com\//i.test(githubRepo)) {
            return res.status(409).json({ warning: 'GitHub URL must be an HTTPS URL (e.g., https://github.com/... or https://<token>@github.com/...). SSH formats like git@github.com are not supported.' });
        }

        // Helper to extract port from env variables (defaults to 5000)
        const extractPort = (bEnv, fEnv) => {
            const bMatch = bEnv?.match(/^PORT\s*=\s*(\d+)/m);
            if (bMatch) return bMatch[1];
            const fMatch = fEnv?.match(/^PORT\s*=\s*(\d+)/m);
            if (fMatch) return fMatch[1];
            return '5000';
        };

        // Globally verify that the Server Label (name) is unique
        const existingName = await VpsServer.findOne({ name: { $regex: new RegExp('^' + name + '$', 'i') } });
        if (existingName) {
            return res.status(409).json({ warning: `The Server Label "${name}" is already in use by another project. Please choose a unique name to avoid database conflicts.` });
        }

        const targetPort = extractPort(backendEnv, frontendEnv);

        // Sanitize domain to remove protocols and trailing slashes
        const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');

        // Globally verify that the Domain is not already linked to another VPS
        const existingDomain = await VpsServer.findOne({ domain: cleanDomain });
        if (existingDomain) {
            return res.status(409).json({ warning: `The domain "${cleanDomain}" is already linked to another VPS (${existingDomain.ipAddress}). Please use a different domain or remove the existing deployment.` });
        }

        // Check for collisions on the SAME VPS (IP Address)
        const existingServers = await VpsServer.find({ ipAddress });
        for (const s of existingServers) {
            // Same Port on same VPS
            const sPort = extractPort(s.backendEnv, s.frontendEnv);
            if (sPort === targetPort) {
                return res.status(409).json({
                    warning: `Port ${targetPort} is currently being used by another project (${s.name}) on this VPS. Please assign a different PORT in your environment variables to prevent conflicts.`
                });
            }
        }

        // Generate dynamic MongoDB DB Name and URL
        const crypto = require('crypto');
        const localMongoDbName = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || 'default_db';
        const localMongoUsername = `db_${localMongoDbName}`.substring(0, 30);
        const localMongoPassword = crypto.randomBytes(16).toString('hex');
        const localMongoUrl = `mongodb://${localMongoUsername}:${localMongoPassword}@${ipAddress}:27017/${localMongoDbName}?authSource=admin`;
        const updatedBackendEnv = updateMongoUrlInEnv(backendEnv, localMongoUrl, mongoEnvVarName);

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
            backendEnv: updatedBackendEnv,
            frontendEnv,
            status: 'deploying',
            progress: 0,
            logs: initialLogs,
            localMongoUrl,
            localMongoUsername: localMongoUsername,
            localMongoPassword,
            localMongoDbName,
            port: targetPort,
            backendDir,
            frontendDir,
            mongoEnvVarName,
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

// Update server environment variables
app.put('/api/vps/server/:id/env', authenticate, async (req, res) => {
    try {
        const { backendEnv, frontendEnv } = req.body;
        const server = await VpsServer.findOne({ _id: req.params.id, userId: req.user._id });

        if (!server) return res.status(404).json({ error: 'Server not found' });

        server.backendEnv = backendEnv;
        server.frontendEnv = frontendEnv;
        await server.save();

        res.json({ message: 'Environment variables updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update environment variables' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
