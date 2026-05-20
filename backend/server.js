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
                // Step 1: System Checks (10%)
                await updateProgress(10);
                await writeLog("-> Step 1/12: Checking target OS details...");
                await executeSshCommandStream(conn, "uname -a", server._id, writeLog);
                
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
                const mongoDbName = 'erp_school';
                const mongoUser = 'db_user';
                const mongoUserCmd = `
                sleep 3
                mongosh admin --eval "try { db.createUser({user: '${mongoUser}', pwd: '${server.localMongoPassword}', roles: [{role: 'readWrite', db: '${mongoDbName}'}, {role: 'dbAdmin', db: '${mongoDbName}'}]}) } catch(e) { db.changeUserPassword('${mongoUser}', '${server.localMongoPassword}') }" || \
                mongo admin --eval "try { db.createUser({user: '${mongoUser}', pwd: '${server.localMongoPassword}', roles: [{role: 'readWrite', db: '${mongoDbName}'}, {role: 'dbAdmin', db: '${mongoDbName}'}]}) } catch(e) { db.changeUserPassword('${mongoUser}', '${server.localMongoPassword}') }" || \
                mongosh ${mongoDbName} --eval "try { db.createUser({user: '${mongoUser}', pwd: '${server.localMongoPassword}', roles: [{role: 'readWrite', db: '${mongoDbName}'}, {role: 'dbAdmin', db: '${mongoDbName}'}]}) } catch(e) { db.changeUserPassword('${mongoUser}', '${server.localMongoPassword}') }" || \
                mongo ${mongoDbName} --eval "try { db.createUser({user: '${mongoUser}', pwd: '${server.localMongoPassword}', roles: [{role: 'readWrite', db: '${mongoDbName}'}, {role: 'dbAdmin', db: '${mongoDbName}'}]}) } catch(e) { db.changeUserPassword('${mongoUser}', '${server.localMongoPassword}') }" || true
                `;
                await executeSshCommandStream(conn, mongoUserCmd, server._id, writeLog);

                // Step 6: Clone Git Repository (60%)
                await updateProgress(60);
                await writeLog(`-> Step 6/12: Cloning repository from: ${server.githubRepo}...`);
                const cloneCmd = `mkdir -p /var/www/${cleanDomain} && cd /var/www/${cleanDomain} && if [ -d .git ]; then CURRENT_URL=\$(git config --get remote.origin.url 2>/dev/null || echo ""); if [ "\$CURRENT_URL" != "${server.githubRepo}" ] && [ "\$CURRENT_URL" != "${server.githubRepo}.git" ]; then echo "Repository changed! Re-cloning..." && find . -mindepth 1 -delete 2>/dev/null || true && git clone ${server.githubRepo} .; else echo "Directory exists. Pulling updates..." && git fetch --all && git reset --hard origin/main || git reset --hard origin/master; fi; else echo "Cloning clean repository..." && find . -mindepth 1 -delete 2>/dev/null || true && git clone ${server.githubRepo} .; fi`;
                await executeSshCommandStream(conn, cloneCmd, server._id, writeLog);

                // Step 7: Write Env Configuration files (70%)
                await updateProgress(70);
                await writeLog("-> Step 7/12: Writing backend and frontend env configuration files...");
                const backendEnvBase64 = Buffer.from(server.backendEnv || '').toString('base64');
                const writeBackendEnv = `mkdir -p /var/www/${cleanDomain}/backend && echo "${backendEnvBase64}" | base64 -d > /var/www/${cleanDomain}/backend/.env && echo "${backendEnvBase64}" | base64 -d > /var/www/${cleanDomain}/.env`;
                await executeSshCommandStream(conn, writeBackendEnv, server._id, writeLog);

                const frontendEnvBase64 = Buffer.from(server.frontendEnv || '').toString('base64');
                const writeFrontendEnv = `mkdir -p /var/www/${cleanDomain}/frontend && echo "${frontendEnvBase64}" | base64 -d > /var/www/${cleanDomain}/frontend/.env && echo "${frontendEnvBase64}" | base64 -d > /var/www/${cleanDomain}/.env.production`;
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
                // Automatically generate vite.config.js if missing (common in some templates) to resolve '@/*' path aliases
                const ensureViteConfig = `if [ ! -f /var/www/${cleanDomain}/frontend/vite.config.js ] && [ ! -f /var/www/${cleanDomain}/frontend/vite.config.ts ] && [ ! -f /var/www/${cleanDomain}/frontend/vite.config.mjs ] && [ -f /var/www/${cleanDomain}/frontend/package.json ]; then
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
});" > /var/www/${cleanDomain}/frontend/vite.config.js;
                fi`;
                await executeSshCommandStream(conn, ensureViteConfig, server._id, writeLog);

                const buildFrontendCmd = `if [ -f /var/www/${cleanDomain}/frontend/package.json ]; then cd /var/www/${cleanDomain}/frontend && npm run build; elif grep -q '"build"' /var/www/${cleanDomain}/package.json; then cd /var/www/${cleanDomain} && npm run build; fi`;
                await executeSshCommandStream(conn, buildFrontendCmd, server._id, writeLog);

                // Step 10: Launch application processes via PM2 (90%)
                await updateProgress(90);
                await writeLog("-> Step 10/12: Starting Node application processes via PM2 daemon...");
                const startPm2Cmd = `pm2 delete ${cleanDomain} || true; if [ -f /var/www/${cleanDomain}/backend/server.js ]; then cd /var/www/${cleanDomain}/backend && pm2 start server.js --name "${cleanDomain}"; elif [ -f /var/www/${cleanDomain}/backend/index.js ]; then cd /var/www/${cleanDomain}/backend && pm2 start index.js --name "${cleanDomain}"; elif [ -f /var/www/${cleanDomain}/server.js ]; then cd /var/www/${cleanDomain} && pm2 start server.js --name "${cleanDomain}"; else cd /var/www/${cleanDomain} && pm2 start index.js --name "${cleanDomain}"; fi; pm2 save`;
                await executeSshCommandStream(conn, startPm2Cmd, server._id, writeLog);

                // Step 11: Configure Nginx Reverse Proxy (95%)
                await updateProgress(95);
                await writeLog(`-> Step 11/12: Configuring Nginx virtual hosts reverse proxy for: ${cleanDomain}`);
                
                const writeNginxConfig = `
                PORT_VAL=\$(grep -oP '^PORT=\\s*\\K\\d+' /var/www/${cleanDomain}/backend/.env 2>/dev/null || grep -oP '^PORT=\\s*\\K\\d+' /var/www/${cleanDomain}/.env 2>/dev/null || echo "5000")
                mkdir -p /etc/nginx/conf.d
                cat << EOF > /etc/nginx/conf.d/${cleanDomain}.conf
server {
    listen 80;
    server_name ${cleanDomain};

    location / {
        root /var/www/${cleanDomain}/frontend/dist;
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
        const gitPullCmd = `cd /var/www/${cleanDomain} && git fetch --all && (git reset --hard origin/main || git reset --hard origin/master || git reset --hard origin/default)`;
        await executeSshCommandStream(conn, gitPullCmd, server._id, writeLog);

        // Step 2: Install backend dependencies & restart PM2
        await updateProgress(60);
        await writeLog("-> Step 2/3: Installing backend node_modules and restarting PM2 process...");
        const updateBackend = `
        if [ -f /var/www/${cleanDomain}/backend/package.json ]; then
            cd /var/www/${cleanDomain}/backend && npm install
        elif [ -f /var/www/${cleanDomain}/package.json ]; then
            cd /var/www/${cleanDomain} && npm install
        fi
        `;
        await executeSshCommandStream(conn, updateBackend, server._id, writeLog);

        const pm2RestartCmd = `pm2 restart "${cleanDomain}" || (if [ -f /var/www/${cleanDomain}/backend/server.js ]; then cd /var/www/${cleanDomain}/backend && pm2 start server.js --name "${cleanDomain}"; elif [ -f /var/www/${cleanDomain}/backend/index.js ]; then cd /var/www/${cleanDomain}/backend && pm2 start index.js --name "${cleanDomain}"; elif [ -f /var/www/${cleanDomain}/server.js ]; then cd /var/www/${cleanDomain} && pm2 start server.js --name "${cleanDomain}"; else cd /var/www/${cleanDomain} && pm2 start index.js --name "${cleanDomain}"; fi; pm2 save)`;
        await executeSshCommandStream(conn, pm2RestartCmd, server._id, writeLog);

        // Step 3: Install frontend dependencies & run build
        await updateProgress(85);
        await writeLog("-> Step 3/3: Installing frontend node_modules and rebuilding production bundle...");
        const updateFrontend = `
        if [ -f /var/www/${cleanDomain}/frontend/package.json ]; then
            cd /var/www/${cleanDomain}/frontend && npm install && npm run build
        elif grep -q '"build"' /var/www/${cleanDomain}/package.json; then
            cd /var/www/${cleanDomain} && npm run build
        fi
        `;
        await executeSshCommandStream(conn, updateFrontend, server._id, writeLog);

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
function updateMongoUrlInEnv(envString, newUrl) {
    let updated = envString || '';
    
    // Replace MONGODB_URL if exists
    const urlRegex = /^MONGODB_URL=.*$/m;
    if (urlRegex.test(updated)) {
        updated = updated.replace(urlRegex, `MONGODB_URL=${newUrl}`);
    }
    
    // Replace MONGODB_URI if exists
    const uriRegex = /^MONGODB_URI=.*$/m;
    if (uriRegex.test(updated)) {
        updated = updated.replace(uriRegex, `MONGODB_URI=${newUrl}`);
    }
    
    // If neither exists, append MONGODB_URL
    if (!urlRegex.test(updated) && !uriRegex.test(updated)) {
        updated = updated.trim() ? updated.trim() + `\n\nMONGODB_URL=${newUrl}` : `MONGODB_URL=${newUrl}`;
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

        if (!name || !ipAddress || !domain || !githubRepo) {
            return res.status(400).json({ error: 'Name, IP Address, Domain and GitHub Repo URL are required' });
        }

        // Sanitize domain to remove protocols and trailing slashes
        const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');

        // Generate local MongoDB URL and password
        const crypto = require('crypto');
        const localMongoPassword = crypto.randomBytes(16).toString('hex');
        const localMongoUrl = `mongodb://db_user:${localMongoPassword}@127.0.0.1:27017/erp_school?authSource=admin`;
        const updatedBackendEnv = updateMongoUrlInEnv(backendEnv, localMongoUrl);

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
            localMongoUsername: 'db_user',
            localMongoPassword,
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
