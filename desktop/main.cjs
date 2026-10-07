const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const mode = process.argv.includes('--reader') ? 'reader' : 'editor';
const port = 31000 + Math.floor(Math.random() * 1000);
const frontendDirectory = path.join(__dirname, `..`, `dist-${mode}`);

function ensureDirectory(directory) {
    fs.mkdirSync(directory, { recursive: true });
    return directory;
}

function startServer() {
    const userData = ensureDirectory(app.getPath('userData'));
    const databasePath = path.join(userData, 'svrn-publisher.sqlite');
    const secretPath = path.join(userData, 'jwt-secret');
    const jwtSecret = fs.existsSync(secretPath)
        ? fs.readFileSync(secretPath, 'utf8').trim()
        : crypto.randomBytes(32).toString('hex');

    if (!fs.existsSync(secretPath)) {
        fs.writeFileSync(secretPath, jwtSecret, { mode: 0o600 });
    }

    process.env.NODE_ENV = 'production';
    process.env.PORT = String(port);
    process.env.DB_PATH = databasePath;
    process.env.SVRN_PACKAGES_PATH = path.join(userData, 'svrn-packages');
    process.env.APP_DIST = frontendDirectory;
    process.env.JWT_SECRET = process.env.JWT_SECRET || jwtSecret;
    process.env.CORS_ORIGIN = `http://127.0.0.1:${port}`;

    require(path.join(__dirname, '..', 'server', 'server.cjs'));
}

async function waitForServer() {
    const healthUrl = `http://127.0.0.1:${port}/api/health`;
    const deadline = Date.now() + 15000;

    while (Date.now() < deadline) {
        try {
            const response = await fetch(healthUrl);
            if (response.ok) return;
        } catch (error) {
            // The server may still be running migrations.
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('SVRN Publisher server did not become ready in time.');
}

async function createWindow() {
    if (!fs.existsSync(path.join(frontendDirectory, 'index.html'))) {
        throw new Error(`The ${mode} frontend build is missing.`);
    }

    startServer();
    await waitForServer();

    const window = new BrowserWindow({
        width: 1440,
        height: 960,
        minWidth: 1024,
        minHeight: 700,
        backgroundColor: '#f4f1ea',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });

    await window.loadURL(`http://127.0.0.1:${port}/`);
}

app.whenReady().then(createWindow).catch(error => {
    dialog.showErrorBox('SVRN Publisher could not start', error.message);
    app.quit();
});

app.on('window-all-closed', () => {
    app.quit();
});
