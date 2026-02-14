// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Load configuration from config.cjs
const CONFIG = require('./config.cjs');

const app = express();

// ═══════════════════════════════════════════════════
// USE CONFIGURATION FROM CONFIG.CJS
// ═══════════════════════════════════════════════════
const { server, jwt: jwtConfig, cors: corsConfig, database, payment, xrp } = CONFIG;
const PORT = server.port;
const NODE_ENV = server.env;
const JWT_SECRET = jwtConfig.secret;
const JWT_EXPIRY = jwtConfig.expiresIn;
const STRIPE_SECRET_KEY = payment.stripeSecretKey;
const DB_PATH = database.getPath();

// Middleware
app.use(cors({
    origin: corsConfig.origins,
    credentials: true,
    methods: corsConfig.methods,
    allowedHeaders: corsConfig.allowedHeaders,
}));
app.use(bodyParser.json({ limit: '50mb' })); // Allow large payloads for images

// ─── Security Headers ─────────────────────────────
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

// Database Setup
console.log(`[${NODE_ENV}] Database: ${DB_PATH}`);
console.log(`[${NODE_ENV}] API listening on port ${PORT}`);

// Create data directory if it doesn't exist
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    // Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password_hash TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_premium INTEGER DEFAULT 0
    )`);

    // Zines Table
    db.run(`CREATE TABLE IF NOT EXISTS zines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT,
        data TEXT, -- JSON string of pages/elements
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_published INTEGER DEFAULT 0,
        published_at DATETIME,
        author_name TEXT,
        genre TEXT,
        tags TEXT,
        read_count INTEGER DEFAULT 0,
        token_price INTEGER DEFAULT 0,
        is_token_gated INTEGER DEFAULT 0,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Credits Table (fiat-purchased virtual currency)
    db.run(`CREATE TABLE IF NOT EXISTS credits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE,
        balance DECIMAL(10,2) DEFAULT 0,
        total_spent DECIMAL(10,2) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // XRP Wallets Table
    db.run(`CREATE TABLE IF NOT EXISTS wallets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE,
        xrp_address TEXT UNIQUE,
        xrp_secret_encrypted TEXT,
        payid TEXT UNIQUE,
        is_verified INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Creator Tokens Table
    db.run(`CREATE TABLE IF NOT EXISTS tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        creator_id INTEGER,
        token_code TEXT,
        token_name TEXT,
        description TEXT,
        icon_url TEXT,
        initial_supply DECIMAL(20,2),
        current_supply DECIMAL(20,2),
        price_per_token DECIMAL(10,6),
        xrp_currency_code TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(creator_id) REFERENCES users(id)
    )`);

    // Trust Lines Table
    db.run(`CREATE TABLE IF NOT EXISTS trust_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        token_id INTEGER,
        trust_line_limit DECIMAL(20,2),
        xrpl_trustline_hash TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(token_id) REFERENCES tokens(id)
    )`);

    // Subscriptions Table
    db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subscriber_id INTEGER,
        creator_id INTEGER,
        token_id INTEGER,
        amount_per_period DECIMAL(10,2),
        period_days INTEGER DEFAULT 30,
        is_active INTEGER DEFAULT 1,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY(subscriber_id) REFERENCES users(id),
        FOREIGN KEY(creator_id) REFERENCES users(id),
        FOREIGN KEY(token_id) REFERENCES tokens(id)
    )`);

    // Bids Table
    db.run(`CREATE TABLE IF NOT EXISTS bids (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bidder_id INTEGER,
        zine_id INTEGER,
        amount DECIMAL(10,2),
        message TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(bidder_id) REFERENCES users(id),
        FOREIGN KEY(zine_id) REFERENCES zines(id)
    )`);

    // Transactions Table
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user_id INTEGER,
        to_user_id INTEGER,
        token_id INTEGER,
        amount DECIMAL(20,2),
        type TEXT,
        xrp_tx_hash TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(from_user_id) REFERENCES users(id),
        FOREIGN KEY(to_user_id) REFERENCES users(id),
        FOREIGN KEY(token_id) REFERENCES tokens(id)
    )`);

    // Reputation Table
    db.run(`CREATE TABLE IF NOT EXISTS reputation (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE,
        score INTEGER DEFAULT 0,
        level TEXT DEFAULT 'newcomer',
        total_tips_received DECIMAL(20,2) DEFAULT 0,
        total_subscribers INTEGER DEFAULT 0,
        total_content_sold INTEGER DEFAULT 0,
        total_bids_accepted INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
});

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// API Routes

// Register
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });

    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(`INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`,
        [username, email, hashedPassword],
        function (err) {
            if (err) return res.status(400).json({ error: 'User already exists' });
            const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
            res.json({ token, user: { id: this.lastID, username, is_premium: 0 } });
        }
    );
});

// Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Invalid credentials' });

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
        res.json({ token, user: { id: user.id, username: user.username, is_premium: user.is_premium } });
    });
});

// Sync / Save Zine
app.post('/api/zines', authenticateToken, (req, res) => {
    const { id, title, data, theme } = req.body; // id is local ID, or maybe server ID?
    // Strategy: If ID exists and belongs to user, update. Else create.
    // However, offline syncing is complex. For now, we'll use a simple "Save" endpoint that returns a server ID.
    // Client should store server_id mapping.

    // Allow user to specify an ID if updating, otherwise create new.
    // But SQLite IDs are auto-increment.
    // Let's assume the client sends a `serverId` if it has one.

    const serverId = req.body.serverId;

    if (serverId) {
        db.run(`UPDATE zines SET title = ?, data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
            [title, JSON.stringify(data), serverId, req.user.id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ id: serverId, status: 'updated' });
            }
        );
    } else {
        db.run(`INSERT INTO zines (user_id, title, data) VALUES (?, ?, ?)`,
            [req.user.id, title, JSON.stringify(data)],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ id: this.lastID, status: 'created' });
            }
        );
    }
});

// Get User Zines
app.get('/api/zines', authenticateToken, (req, res) => {
    db.all(`SELECT id, title, updated_at, is_published, read_count, genre, tags FROM zines WHERE user_id = ? ORDER BY updated_at DESC`,
        [req.user.id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// List Published Zines (Public)
app.get('/api/published', (req, res) => {
    const { q, genre } = req.query;
    let sql = `SELECT id, title, author_name, genre, tags, read_count, published_at FROM zines WHERE is_published = 1`;
    const params = [];

    if (genre) {
        sql += ` AND genre = ?`;
        params.push(genre);
    }
    if (q) {
        sql += ` AND (title LIKE ? OR author_name LIKE ? OR tags LIKE ?)`;
        const wildcard = `%${q}%`;
        params.push(wildcard, wildcard, wildcard);
    }

    sql += ` ORDER BY published_at DESC LIMIT 50`;

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Publish Zine
app.post('/api/publish/:id', authenticateToken, (req, res) => {
    const { author_name, genre, tags } = req.body;
    db.run(`UPDATE zines SET is_published = 1, published_at = CURRENT_TIMESTAMP, author_name = ?, genre = ?, tags = ? WHERE id = ? AND user_id = ?`,
        [author_name, genre, tags, req.params.id, req.user.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Zine not found or not owned' });
            res.json({ status: 'published' });
        }
    );
});

// Get Single Zine (for Reader)
app.get('/api/zines/:id', (req, res) => {
    // If published, anyone can read. If not, only owner.
    // Simplified: Check if published first.
    db.get(`SELECT * FROM zines WHERE id = ?`, [req.params.id], (err, zine) => {
        if (err || !zine) return res.status(404).json({ error: 'Not found' });

        if (zine.is_published) {
            // Increment read count async
            db.run(`UPDATE zines SET read_count = read_count + 1 WHERE id = ?`, [req.params.id]);
            return res.json({ ...zine, data: JSON.parse(zine.data) });
        }

        // Check auth for private zines
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(403).json({ error: 'Private zine' });

        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err || user.id !== zine.user_id) return res.status(403).json({ error: 'Forbidden' });
            res.json({ ...zine, data: JSON.parse(zine.data) });
        });
    });
});

// MCP Interface for programmatic zine manipulation and automation
app.get('/mcp/zines/:id', authenticateToken, (req, res) => {
    db.get(`SELECT * FROM zines WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], (err, zine) => {
        if (err || !zine) return res.status(404).json({ error: 'Zine not found' });
        res.json({ ...zine, data: JSON.parse(zine.data) });
    });
});

app.put('/mcp/zines/:id', authenticateToken, (req, res) => {
    const { title, data } = req.body;
    db.run(`UPDATE zines SET title = ?, data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
        [title, JSON.stringify(data), req.params.id, req.user.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Zine not found' });
            res.json({ status: 'updated' });
        }
    );
});

app.post('/mcp/zines/:id/pages', authenticateToken, (req, res) => {
    db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], (err, zine) => {
        if (err || !zine) return res.status(404).json({ error: 'Zine not found' });
        const data = JSON.parse(zine.data);
        const newPage = { id: Date.now(), elements: [], background: '#ffffff', texture: null };
        data.pages.push(newPage);
        db.run(`UPDATE zines SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [JSON.stringify(data), req.params.id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ pageId: newPage.id, pageIdx: data.pages.length - 1 });
            }
        );
    });
});

app.put('/mcp/zines/:id/pages/:pageIdx', authenticateToken, (req, res) => {
    const { background, texture } = req.body;
    db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], (err, zine) => {
        if (err || !zine) return res.status(404).json({ error: 'Zine not found' });
        const data = JSON.parse(zine.data);
        const pageIdx = parseInt(req.params.pageIdx);
        if (!data.pages[pageIdx]) return res.status(404).json({ error: 'Page not found' });
        if (background !== undefined) data.pages[pageIdx].background = background;
        if (texture !== undefined) data.pages[pageIdx].texture = texture;
        db.run(`UPDATE zines SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [JSON.stringify(data), req.params.id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ status: 'updated' });
            }
        );
    });
});

app.delete('/mcp/zines/:id/pages/:pageIdx', authenticateToken, (req, res) => {
    db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], (err, zine) => {
        if (err || !zine) return res.status(404).json({ error: 'Zine not found' });
        const data = JSON.parse(zine.data);
        const pageIdx = parseInt(req.params.pageIdx);
        if (data.pages.length <= 1) return res.status(400).json({ error: 'Cannot delete last page' });
        if (!data.pages[pageIdx]) return res.status(404).json({ error: 'Page not found' });
        data.pages.splice(pageIdx, 1);
        db.run(`UPDATE zines SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [JSON.stringify(data), req.params.id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ status: 'deleted' });
            }
        );
    });
});

app.post('/mcp/zines/:id/pages/:pageIdx/elements', authenticateToken, (req, res) => {
    const { element } = req.body;
    db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], (err, zine) => {
        if (err || !zine) return res.status(404).json({ error: 'Zine not found' });
        const data = JSON.parse(zine.data);
        const pageIdx = parseInt(req.params.pageIdx);
        if (!data.pages[pageIdx]) return res.status(404).json({ error: 'Page not found' });
        const el = { ...element, id: 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9), zIndex: data.pages[pageIdx].elements.length };
        data.pages[pageIdx].elements.push(el);
        db.run(`UPDATE zines SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [JSON.stringify(data), req.params.id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ elementId: el.id });
            }
        );
    });
});

app.put('/mcp/zines/:id/pages/:pageIdx/elements/:elementId', authenticateToken, (req, res) => {
    const updates = req.body;
    db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], (err, zine) => {
        if (err || !zine) return res.status(404).json({ error: 'Zine not found' });
        const data = JSON.parse(zine.data);
        const pageIdx = parseInt(req.params.pageIdx);
        const el = data.pages[pageIdx]?.elements.find(e => e.id === req.params.elementId);
        if (!el) return res.status(404).json({ error: 'Element not found' });
        Object.assign(el, updates);
        db.run(`UPDATE zines SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [JSON.stringify(data), req.params.id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ status: 'updated' });
            }
        );
    });
});

app.delete('/mcp/zines/:id/pages/:pageIdx/elements/:elementId', authenticateToken, (req, res) => {
    db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], (err, zine) => {
        if (err || !zine) return res.status(404).json({ error: 'Zine not found' });
        const data = JSON.parse(zine.data);
        const pageIdx = parseInt(req.params.pageIdx);
        const elements = data.pages[pageIdx]?.elements;
        if (!elements) return res.status(404).json({ error: 'Page not found' });
        const idx = elements.findIndex(e => e.id === req.params.elementId);
        if (idx === -1) return res.status(404).json({ error: 'Element not found' });
        elements.splice(idx, 1);
        db.run(`UPDATE zines SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [JSON.stringify(data), req.params.id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ status: 'deleted' });
            }
        );
    });
});

// Model Context Protocol (MCP) Server Implementation
// This allows AI assistants to programmatically interact with the zine builder

// MCP Initialize
app.post('/mcp/initialize', (req, res) => {
    res.json({
        protocolVersion: '2024-11-05',
        capabilities: {
            tools: {},
            resources: {},
            prompts: {}
        },
        serverInfo: {
            name: 'zine-builder-mcp',
            version: '1.0.0'
        }
    });
});

// MCP Resources List
app.post('/mcp/resources/list', (req, res) => {
    res.json({
        resources: [
            {
                uri: 'zine://themes',
                name: 'Available Themes',
                description: 'List of available zine themes with their properties',
                mimeType: 'application/json'
            },
            {
                uri: 'zine://templates',
                name: 'Page Templates',
                description: 'Available page templates for different zine layouts',
                mimeType: 'application/json'
            },
            {
                uri: 'zine://assets',
                name: 'Asset Library',
                description: 'Available assets including shapes, symbols, SFX, and shaders',
                mimeType: 'application/json'
            }
        ]
    });
});

// MCP Resources Read
app.post('/mcp/resources/read', (req, res) => {
    const { uri } = req.body;
    let resourceData;

    switch (uri) {
        case 'zine://themes':
            resourceData = {
                themes: {
                    classic: { name: 'Classic Literature', colors: { background: '#fdfaf1', text: '#1a1a1a', accent: '#d4af37' }, fonts: { display: 'Playfair Display', body: 'Crimson Text', accent: 'Crimson Text' }, status: 'STABLE' },
                    fantasy: { name: 'Medieval Fantasy', colors: { background: '#f5f5dc', text: '#0a0a0a', accent: '#ffd700' }, fonts: { display: 'Cinzel', body: 'Crimson Text', accent: 'MedievalSharp' }, status: 'LEGENDARY' },
                    cyberpunk: { name: 'Cyberpunk', colors: { background: '#f0f0f0', text: '#050505', accent: '#ff003c' }, fonts: { display: 'Orbitron', body: 'Roboto Mono', accent: 'Bebas Neue' }, status: 'CONNECTED' },
                    conspiracy: { name: 'Dark Conspiracies', colors: { background: '#e8e4d9', text: '#000000', accent: '#c5b358' }, fonts: { display: 'Special Elite', body: 'Courier Prime', accent: 'Roboto Mono' }, status: 'CLASSIFIED' },
                    worldbuilding: { name: 'World Building', colors: { background: '#ecf0f1', text: '#2c3e50', accent: '#f1c40f' }, fonts: { display: 'Montserrat', body: 'Assistant', accent: 'Crimson Text' }, status: 'CHARTED' },
                    comics: { name: 'Comics', colors: { background: '#ffffff', text: '#000000', accent: '#ffd700' }, fonts: { display: 'Bangers', body: 'Comic Neue', accent: 'Bebas Neue' }, status: 'DYNAMIC' },
                    arcane: { name: 'Arcane Lore', colors: { background: '#f8f1ff', text: '#0f041b', accent: '#ff9e00' }, fonts: { display: 'Cinzel Decorative', body: 'Crimson Text', accent: 'Cinzel' }, status: 'MANIFESTED' }
                }
            };
            break;
        case 'zine://templates':
            resourceData = {
                templates: {
                    cover: { name: 'Cover Page', description: 'Title page with decorative elements', elements: ['title_text', 'subtitle_text', 'decorative_panel'] },
                    content: { name: 'Content Page', description: 'Standard content page layout', elements: ['chapter_title', 'body_text'] },
                    back: { name: 'Back Cover', description: 'Back cover with final elements', elements: ['end_text'] }
                }
            };
            break;
        case 'zine://assets':
            resourceData = {
                assets: {
                    shapes: ['circle', 'square', 'triangle', 'diamond', 'line_h', 'arrow'],
                    balloons: ['dialog', 'thought', 'shout', 'caption', 'whisper', 'narration'],
                    sfx: ['crash', 'boom', 'zap', 'pow', 'whoosh', 'splat'],
                    symbols: ['pentagram', 'skull', 'star_symbol', 'eye', 'biohazard', 'radiation', 'compass', 'rune', 'ankh', 'omega', 'infinity', 'trident'],
                    shaders: ['plasma', 'fire', 'water', 'lightning', 'voidNoise', 'galaxy']
                }
            };
            break;
        default:
            return res.status(404).json({ error: 'Resource not found' });
    }

    res.json({
        contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(resourceData, null, 2)
        }]
    });
});

// MCP Prompts List
app.post('/mcp/prompts/list', (req, res) => {
    res.json({
        prompts: [
            {
                name: 'create_story_zine',
                description: 'Generate a complete story zine with multiple pages',
                arguments: [
                    {
                        name: 'theme',
                        description: 'Theme for the zine',
                        required: true
                    },
                    {
                        name: 'genre',
                        description: 'Story genre',
                        required: true
                    },
                    {
                        name: 'title',
                        description: 'Zine title',
                        required: true
                    }
                ]
            },
            {
                name: 'generate_comic_page',
                description: 'Create a comic-style page with panels and dialogue',
                arguments: [
                    {
                        name: 'zineId',
                        description: 'Existing zine ID to add page to',
                        required: true
                    },
                    {
                        name: 'pageDescription',
                        description: 'Description of the comic page content',
                        required: true
                    }
                ]
            },
            {
                name: 'apply_theme_consistently',
                description: 'Apply a theme to an entire zine with consistent styling',
                arguments: [
                    {
                        name: 'zineId',
                        description: 'Zine ID to apply theme to',
                        required: true
                    },
                    {
                        name: 'theme',
                        description: 'Theme to apply',
                        required: true
                    }
                ]
            }
        ]
    });
});

// MCP Prompts Get
app.post('/mcp/prompts/get', (req, res) => {
    const { name, arguments: args } = req.body;
    let prompt;

    switch (name) {
        case 'create_story_zine':
            prompt = {
                description: `Create a complete ${args.genre} story zine titled "${args.title}" using the ${args.theme} theme. Include cover page, multiple content pages with story elements, and back cover.`,
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: `Create a ${args.genre} story zine with the title "${args.title}" using the ${args.theme} theme. Generate engaging content with appropriate visual elements for the theme.`
                        }
                    }
                ]
            };
            break;
        case 'generate_comic_page':
            prompt = {
                description: `Generate a comic page with panels and dialogue based on: ${args.pageDescription}`,
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: `Create a comic page for zine ${args.zineId} with the following description: ${args.pageDescription}. Include appropriate panels, dialogue balloons, and visual elements.`
                        }
                    }
                ]
            };
            break;
        case 'apply_theme_consistently':
            prompt = {
                description: `Apply the ${args.theme} theme consistently across all pages and elements in zine ${args.zineId}`,
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: `Apply the ${args.theme} theme to zine ${args.zineId}, ensuring all text colors, backgrounds, and visual elements match the theme consistently.`
                        }
                    }
                ]
            };
            break;
        default:
            return res.status(404).json({ error: 'Prompt not found' });
    }

    res.json(prompt);
});

// MCP Tools List
app.post('/mcp/tools/list', (req, res) => {
    res.json({
        tools: [
            {
                name: 'create_zine',
                description: 'Create a new zine project',
                inputSchema: {
                    type: 'object',
                    properties: {
                        title: { type: 'string', description: 'Zine title' },
                        theme: { type: 'string', description: 'Theme key (optional)', enum: ['classic', 'fantasy', 'cyberpunk', 'conspiracy', 'worldbuilding', 'comics', 'arcane'] }
                    },
                    required: ['title']
                }
            },
            {
                name: 'get_zine',
                description: 'Get zine data by ID',
                inputSchema: {
                    type: 'object',
                    properties: {
                        zineId: { type: 'integer', description: 'Zine ID' }
                    },
                    required: ['zineId']
                }
            },
            {
                name: 'add_page',
                description: 'Add a new page to a zine',
                inputSchema: {
                    type: 'object',
                    properties: {
                        zineId: { type: 'integer', description: 'Zine ID' },
                        background: { type: 'string', description: 'Page background color (optional)' },
                        texture: { type: 'string', description: 'Page texture URL (optional)' }
                    },
                    required: ['zineId']
                }
            },
            {
                name: 'delete_page',
                description: 'Delete a page from a zine',
                inputSchema: {
                    type: 'object',
                    properties: {
                        zineId: { type: 'integer', description: 'Zine ID' },
                        pageIdx: { type: 'integer', description: 'Page index to delete' }
                    },
                    required: ['zineId', 'pageIdx']
                }
            },
            {
                name: 'duplicate_page',
                description: 'Duplicate a page in a zine',
                inputSchema: {
                    type: 'object',
                    properties: {
                        zineId: { type: 'integer', description: 'Zine ID' },
                        pageIdx: { type: 'integer', description: 'Page index to duplicate' }
                    },
                    required: ['zineId', 'pageIdx']
                }
            },
            {
                name: 'add_text_element',
                description: 'Add a text element to a page',
                inputSchema: {
                    type: 'object',
                    properties: {
                        zineId: { type: 'integer', description: 'Zine ID' },
                        pageIdx: { type: 'integer', description: 'Page index' },
                        content: { type: 'string', description: 'Text content' },
                        x: { type: 'number', description: 'X position', default: 80 },
                        y: { type: 'number', description: 'Y position', default: 80 },
                        fontSize: { type: 'number', description: 'Font size', default: 18 },
                        color: { type: 'string', description: 'Text color', default: '#0a0a0a' }
                    },
                    required: ['zineId', 'pageIdx', 'content']
                }
            },
            {
                name: 'add_image_element',
                description: 'Add an image element to a page',
                inputSchema: {
                    type: 'object',
                    properties: {
                        zineId: { type: 'integer', description: 'Zine ID' },
                        pageIdx: { type: 'integer', description: 'Page index' },
                        src: { type: 'string', description: 'Image URL or data URL' },
                        x: { type: 'number', description: 'X position', default: 80 },
                        y: { type: 'number', description: 'Y position', default: 80 },
                        width: { type: 'number', description: 'Width', default: 200 },
                        height: { type: 'number', description: 'Height', default: 200 }
                    },
                    required: ['zineId', 'pageIdx', 'src']
                }
            },
            {
                name: 'add_panel_element',
                description: 'Add a panel element to a page',
                inputSchema: {
                    type: 'object',
                    properties: {
                        zineId: { type: 'integer', description: 'Zine ID' },
                        pageIdx: { type: 'integer', description: 'Page index' },
                        x: { type: 'number', description: 'X position', default: 40 },
                        y: { type: 'number', description: 'Y position', default: 40 },
                        width: { type: 'number', description: 'Width', default: 220 },
                        height: { type: 'number', description: 'Height', default: 160 }
                    },
                    required: ['zineId', 'pageIdx']
                }
            },
            {
                name: 'add_shape_element',
                description: 'Add a shape element to a page',
                inputSchema: {
                    type: 'object',
                    properties: {
                        zineId: { type: 'integer', description: 'Zine ID' },
                        pageIdx: { type: 'integer', description: 'Page index' },
                        shape: { type: 'string', description: 'Shape type', enum: ['circle', 'square', 'triangle', 'diamond', 'line_h', 'arrow'], default: 'circle' },
                        x: { type: 'number', description: 'X position', default: 80 },
                        y: { type: 'number', description: 'Y position', default: 80 },
                        width: { type: 'number', description: 'Width', default: 100 },
                        height: { type: 'number', description: 'Height', default: 100 },
                        fill: { type: 'string', description: 'Fill color', default: '#0a0a0a' }
                    },
                    required: ['zineId', 'pageIdx']
                }
            },
            {
                name: 'add_balloon_element',
                description: 'Add a speech balloon to a page',
                inputSchema: {
                    type: 'object',
                    properties: {
                        zineId: { type: 'integer', description: 'Zine ID' },
                        pageIdx: { type: 'integer', description: 'Page index' },
                        content: { type: 'string', description: 'Balloon text' },
                        balloonType: { type: 'string', description: 'Balloon type', enum: ['dialog', 'thought', 'shout', 'caption', 'whisper', 'narration'], default: 'dialog' },
                        x: { type: 'number', description: 'X position', default: 80 },
                        y: { type: 'number', description: 'Y position', default: 80 }
                    },
                    required: ['zineId', 'pageIdx', 'content']
                }
            },
            {
                name: 'add_sfx_element',
                description: 'Add an SFX element to a page',
                inputSchema: {
                    type: 'object',
                    properties: {
                        zineId: { type: 'integer', description: 'Zine ID' },
                        pageIdx: { type: 'integer', description: 'Page index' },
                        sfxType: { type: 'string', description: 'SFX type', enum: ['crash', 'boom', 'zap', 'pow', 'whoosh', 'splat'], default: 'boom' },
                        x: { type: 'number', description: 'X position', default: 80 },
                        y: { type: 'number', description: 'Y position', default: 80 }
                    },
                    required: ['zineId', 'pageIdx']
                }
            },
            {
                name: 'add_symbol_element',
                description: 'Add a symbol element to a page',
                inputSchema: {
                    type: 'object',
                    properties: {
                        zineId: { type: 'integer', description: 'Zine ID' },
                        pageIdx: { type: 'integer', description: 'Page index' },
                        symbol: { type: 'string', description: 'Symbol type', enum: ['pentagram', 'skull', 'star_symbol', 'eye', 'biohazard', 'radiation', 'compass', 'rune', 'ankh', 'omega', 'infinity', 'trident'], default: 'star_symbol' },
                        x: { type: 'number', description: 'X position', default: 80 },
                        y: { type: 'number', description: 'Y position', default: 80 }
                    },
                    required: ['zineId', 'pageIdx']
                }
            },
            {
                name: 'add_shader_element',
                description: 'Add a shader element to a page',
                inputSchema: {
                    type: 'object',
                    properties: {
                        zineId: { type: 'integer', description: 'Zine ID' },
                        pageIdx: { type: 'integer', description: 'Page index' },
                        shaderPreset: { type: 'string', description: 'Shader preset', enum: ['plasma', 'fire', 'water', 'lightning', 'voidNoise', 'galaxy'], default: 'plasma' },
                        x: { type: 'number', description: 'X position', default: 80 },
                        y: { type: 'number', description: 'Y position', default: 80 },
                        width: { type: 'number', description: 'Width', default: 220 },
                        height: { type: 'number', description: 'Height', default: 220 }
                    },
                    required: ['zineId', 'pageIdx']
                }
            },
            {
                name: 'update_element',
                description: 'Update an element\'s properties',
                inputSchema: {
                    type: 'object',
                    properties: {
                        zineId: { type: 'integer', description: 'Zine ID' },
                        pageIdx: { type: 'integer', description: 'Page index' },
                        elementId: { type: 'string', description: 'Element ID' },
                        updates: { type: 'object', description: 'Properties to update' }
                    },
                    required: ['zineId', 'pageIdx', 'elementId', 'updates']
                }
            },
            {
                name: 'delete_element',
                description: 'Delete an element from a page',
                inputSchema: {
                    type: 'object',
                    properties: {
                        zineId: { type: 'integer', description: 'Zine ID' },
                        pageIdx: { type: 'integer', description: 'Page index' },
                        elementId: { type: 'string', description: 'Element ID to delete' }
                    },
                    required: ['zineId', 'pageIdx', 'elementId']
                }
            },
            {
                name: 'duplicate_element',
                description: 'Duplicate an element on a page',
                inputSchema: {
                    type: 'object',
                    properties: {
                        zineId: { type: 'integer', description: 'Zine ID' },
                        pageIdx: { type: 'integer', description: 'Page index' },
                        elementId: { type: 'string', description: 'Element ID to duplicate' }
                    },
                    required: ['zineId', 'pageIdx', 'elementId']
                }
            },
            {
                name: 'move_layer',
                description: 'Move an element up or down in the layer stack',
                inputSchema: {
                    type: 'object',
                    properties: {
                        zineId: { type: 'integer', description: 'Zine ID' },
                        pageIdx: { type: 'integer', description: 'Page index' },
                        elementId: { type: 'string', description: 'Element ID' },
                        direction: { type: 'string', description: 'Move direction', enum: ['up', 'down', 'top', 'bottom'] }
                    },
                    required: ['zineId', 'pageIdx', 'elementId', 'direction']
                }
            },
            {
                name: 'apply_theme',
                description: 'Apply a theme to a zine',
                inputSchema: {
                    type: 'object',
                    properties: {
                        zineId: { type: 'integer', description: 'Zine ID' },
                        theme: { type: 'string', description: 'Theme key', enum: ['classic', 'fantasy', 'cyberpunk', 'conspiracy', 'worldbuilding', 'comics', 'arcane'] }
                    },
                    required: ['zineId', 'theme']
                }
            },
            {
                name: 'apply_template',
                description: 'Apply a template to a page',
                inputSchema: {
                    type: 'object',
                    properties: {
                        zineId: { type: 'integer', description: 'Zine ID' },
                        pageIdx: { type: 'integer', description: 'Page index' },
                        template: { type: 'string', description: 'Template type', enum: ['cover', 'content', 'back'] }
                    },
                    required: ['zineId', 'pageIdx', 'template']
                }
            },
            {
                name: 'export_html',
                description: 'Export zine as HTML',
                inputSchema: {
                    type: 'object',
                    properties: {
                        zineId: { type: 'integer', description: 'Zine ID' }
                    },
                    required: ['zineId']
                }
            },
            {
                name: 'publish_zine',
                description: 'Publish zine to make it publicly readable',
                inputSchema: {
                    type: 'object',
                    properties: {
                        zineId: { type: 'integer', description: 'Zine ID' },
                        author: { type: 'string', description: 'Author name' },
                        genre: { type: 'string', description: 'Genre' },
                        tags: { type: 'string', description: 'Comma-separated tags' }
                    },
                    required: ['zineId']
                }
            }
        ]
    });
});

// MCP Tools Call
app.post('/mcp/tools/call', authenticateToken, async (req, res) => {
    const { name, arguments: args } = req.body;

    try {
        let result;

        switch (name) {
            case 'create_zine':
                result = await handleCreateZine(req.user.id, args);
                break;
            case 'get_zine':
                result = await handleGetZine(req.user.id, args.zineId);
                break;
            case 'add_page':
                result = await handleAddPage(req.user.id, args);
                break;
            case 'delete_page':
                result = await handleDeletePage(req.user.id, args);
                break;
            case 'duplicate_page':
                result = await handleDuplicatePage(req.user.id, args);
                break;
            case 'add_text_element':
                result = await handleAddTextElement(req.user.id, args);
                break;
            case 'add_image_element':
                result = await handleAddImageElement(req.user.id, args);
                break;
            case 'add_panel_element':
                result = await handleAddPanelElement(req.user.id, args);
                break;
            case 'add_shape_element':
                result = await handleAddShapeElement(req.user.id, args);
                break;
            case 'add_balloon_element':
                result = await handleAddBalloonElement(req.user.id, args);
                break;
            case 'add_sfx_element':
                result = await handleAddSFXElement(req.user.id, args);
                break;
            case 'add_symbol_element':
                result = await handleAddSymbolElement(req.user.id, args);
                break;
            case 'add_shader_element':
                result = await handleAddShaderElement(req.user.id, args);
                break;
            case 'update_element':
                result = await handleUpdateElement(req.user.id, args);
                break;
            case 'delete_element':
                result = await handleDeleteElement(req.user.id, args);
                break;
            case 'duplicate_element':
                result = await handleDuplicateElement(req.user.id, args);
                break;
            case 'move_layer':
                result = await handleMoveLayer(req.user.id, args);
                break;
            case 'apply_theme':
                result = await handleApplyTheme(req.user.id, args);
                break;
            case 'apply_template':
                result = await handleApplyTemplate(req.user.id, args);
                break;
            case 'export_html':
                result = await handleExportHTML(req.user.id, args.zineId);
                break;
            case 'publish_zine':
                result = await handlePublishZine(req.user.id, args);
                break;
            default:
                throw new Error(`Unknown tool: ${name}`);
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Tool handlers
async function handleCreateZine(userId, args) {
    return new Promise((resolve, reject) => {
        const pages = [{ id: Date.now(), elements: [], background: '#ffffff', texture: null }];

        db.run(`INSERT INTO zines (user_id, title, data) VALUES (?, ?, ?)`,
            [userId, args.title, JSON.stringify(pages)],
            function (err) {
                if (err) return reject(err);
                resolve({ zineId: this.lastID, message: 'Zine created successfully' });
            }
        );
    });
}

async function handleGetZine(userId, zineId) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM zines WHERE id = ? AND user_id = ?`, [zineId, userId], (err, zine) => {
            if (err || !zine) return reject(new Error('Zine not found'));
            resolve({ ...zine, data: JSON.parse(zine.data) });
        });
    });
}

async function handleAddPage(userId, args) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [args.zineId, userId], (err, zine) => {
            if (err || !zine) return reject(new Error('Zine not found'));
            const data = JSON.parse(zine.data);
            const newPage = {
                id: Date.now(),
                elements: [],
                background: args.background || '#ffffff',
                texture: args.texture || null
            };
            data.pages.push(newPage);
            db.run(`UPDATE zines SET data = ? WHERE id = ?`, [JSON.stringify(data), args.zineId], function (err) {
                if (err) return reject(err);
                resolve({ pageId: newPage.id, pageIdx: data.pages.length - 1 });
            });
        });
    });
}

async function handleAddTextElement(userId, args) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [args.zineId, userId], (err, zine) => {
            if (err || !zine) return reject(new Error('Zine not found'));
            const data = JSON.parse(zine.data);
            if (!data.pages[args.pageIdx]) return reject(new Error('Page not found'));
            const element = {
                id: 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                type: 'text',
                content: args.content,
                x: args.x || 80,
                y: args.y || 80,
                width: 220,
                height: 50,
                fontSize: args.fontSize || 18,
                fontFamily: 'Crimson Text',
                color: args.color || '#0a0a0a',
                align: 'left',
                zIndex: data.pages[args.pageIdx].elements.length
            };
            data.pages[args.pageIdx].elements.push(element);
            db.run(`UPDATE zines SET data = ? WHERE id = ?`, [JSON.stringify(data), args.zineId], function (err) {
                if (err) return reject(err);
                resolve({ elementId: element.id });
            });
        });
    });
}

async function handleAddImageElement(userId, args) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [args.zineId, userId], (err, zine) => {
            if (err || !zine) return reject(new Error('Zine not found'));
            const data = JSON.parse(zine.data);
            if (!data.pages[args.pageIdx]) return reject(new Error('Page not found'));
            const element = {
                id: 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                type: 'image',
                src: args.src,
                x: args.x || 80,
                y: args.y || 80,
                width: args.width || 200,
                height: args.height || 200,
                zIndex: data.pages[args.pageIdx].elements.length
            };
            data.pages[args.pageIdx].elements.push(element);
            db.run(`UPDATE zines SET data = ? WHERE id = ?`, [JSON.stringify(data), args.zineId], function (err) {
                if (err) return reject(err);
                resolve({ elementId: element.id });
            });
        });
    });
}

async function handleAddPanelElement(userId, args) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [args.zineId, userId], (err, zine) => {
            if (err || !zine) return reject(new Error('Zine not found'));
            const data = JSON.parse(zine.data);
            if (!data.pages[args.pageIdx]) return reject(new Error('Page not found'));
            const element = {
                id: 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                type: 'panel',
                x: args.x || 40,
                y: args.y || 40,
                width: args.width || 220,
                height: args.height || 160,
                panelBorderWidth: 4,
                panelBorderColor: '#0a0a0a',
                panelBorderStyle: 'solid',
                fill: 'transparent',
                zIndex: data.pages[args.pageIdx].elements.length
            };
            data.pages[args.pageIdx].elements.push(element);
            db.run(`UPDATE zines SET data = ? WHERE id = ?`, [JSON.stringify(data), args.zineId], function (err) {
                if (err) return reject(err);
                resolve({ elementId: element.id });
            });
        });
    });
}

async function handleAddBalloonElement(userId, args) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [args.zineId, userId], (err, zine) => {
            if (err || !zine) return reject(new Error('Zine not found'));
            const data = JSON.parse(zine.data);
            if (!data.pages[args.pageIdx]) return reject(new Error('Page not found'));
            const element = {
                id: 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                type: 'balloon',
                content: args.content,
                balloonType: args.balloonType || 'dialog',
                x: args.x || 80,
                y: args.y || 80,
                width: 200,
                height: 80,
                fontSize: 14,
                zIndex: data.pages[args.pageIdx].elements.length
            };
            data.pages[args.pageIdx].elements.push(element);
            db.run(`UPDATE zines SET data = ? WHERE id = ?`, [JSON.stringify(data), args.zineId], function (err) {
                if (err) return reject(err);
                resolve({ elementId: element.id });
            });
        });
    });
}

async function handleUpdateElement(userId, args) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [args.zineId, userId], (err, zine) => {
            if (err || !zine) return reject(new Error('Zine not found'));
            const data = JSON.parse(zine.data);
            const el = data.pages[args.pageIdx]?.elements.find(e => e.id === args.elementId);
            if (!el) return reject(new Error('Element not found'));
            Object.assign(el, args.updates);
            db.run(`UPDATE zines SET data = ? WHERE id = ?`, [JSON.stringify(data), args.zineId], function (err) {
                if (err) return reject(err);
                resolve({ status: 'updated' });
            });
        });
    });
}

async function handleApplyTheme(userId, args) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [args.zineId, userId], (err, zine) => {
            if (err || !zine) return reject(new Error('Zine not found'));
            const data = JSON.parse(zine.data);
            // Apply theme colors - simplified version
            const themeColors = {
                classic: { background: '#fdfaf1', text: '#1a1a1a', accent: '#d4af37' },
                fantasy: { background: '#f5f5dc', text: '#0a0a0a', accent: '#ffd700' },
                cyberpunk: { background: '#f0f0f0', text: '#050505', accent: '#ff003c' },
                conspiracy: { background: '#e8e4d9', text: '#000000', accent: '#c5b358' },
                worldbuilding: { background: '#ecf0f1', text: '#2c3e50', accent: '#f1c40f' },
                comics: { background: '#ffffff', text: '#000000', accent: '#ffd700' },
                arcane: { background: '#f8f1ff', text: '#0f041b', accent: '#ff9e00' }
            };
            const colors = themeColors[args.theme] || themeColors.classic;

            data.pages.forEach(page => {
                if (page.background === '#ffffff') page.background = colors.background;
                page.elements.forEach(el => {
                    if (el.color && ['#000000', '#333333', '#666666'].includes(el.color)) el.color = colors.text;
                    if (el.fill && ['#000000', '#333333', '#666666'].includes(el.fill)) el.fill = colors.accent;
                });
            });

            db.run(`UPDATE zines SET data = ? WHERE id = ?`, [JSON.stringify(data), args.zineId], function (err) {
                if (err) return reject(err);
                resolve({ status: 'theme applied' });
            });
        });
    });
}

async function handleApplyTemplate(userId, args) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [args.zineId, userId], (err, zine) => {
            if (err || !zine) return reject(new Error('Zine not found'));
            const data = JSON.parse(zine.data);
            if (!data.pages[args.pageIdx]) return reject(new Error('Page not found'));

            const templates = {
                cover: {
                    background: '#1a1a1a',
                    elements: [
                        { type: 'text', content: 'ZINE TITLE', x: 50, y: 150, width: 428, height: 100, fontSize: 64, color: '#d4af37', align: 'center', bold: true },
                        { type: 'text', content: 'Issue No. 01', x: 50, y: 260, width: 428, height: 40, fontSize: 24, color: '#fdfaf1', align: 'center' },
                        { type: 'panel', x: 40, y: 40, width: 448, height: 736, panelBorderWidth: 8, panelBorderColor: '#d4af37' }
                    ]
                },
                content: {
                    background: '#fdfaf1',
                    elements: [
                        { type: 'text', content: 'CHAPTER NAME', x: 50, y: 50, width: 428, height: 60, fontSize: 32, color: '#1a1a1a', bold: true },
                        { type: 'text', content: 'Start your story here...', x: 50, y: 120, width: 428, height: 600, fontSize: 16, color: '#1a1a1a' }
                    ]
                },
                back: {
                    background: '#1a1a1a',
                    elements: [
                        { type: 'text', content: 'THE END', x: 50, y: 380, width: 428, height: 60, fontSize: 48, color: '#fdfaf1', align: 'center', bold: true }
                    ]
                }
            };

            const template = templates[args.template];
            if (!template) return reject(new Error('Template not found'));

            data.pages[args.pageIdx].background = template.background;
            data.pages[args.pageIdx].elements = template.elements.map(el => ({
                ...el,
                id: 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                zIndex: 0
            }));

            db.run(`UPDATE zines SET data = ? WHERE id = ?`, [JSON.stringify(data), args.zineId], function (err) {
                if (err) return reject(err);
                resolve({ status: 'template applied' });
            });
        });
    });
}

async function handleExportHTML(userId, zineId) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM zines WHERE id = ? AND user_id = ?`, [zineId, userId], (err, zine) => {
            if (err || !zine) return reject(new Error('Zine not found'));
            const project = { title: zine.title, pages: JSON.parse(zine.data) };

            // Basic HTML export - in full implementation, use the client-side exportToHTML logic
            let html = `<!DOCTYPE html><html><head><title>${project.title}</title></head><body>`;
            project.pages.forEach((p, i) => {
                html += `<div>Page ${i + 1}</div>`;
            });
            html += `</body></html>`;

            resolve({ html });
        });
    });
}

async function handlePublishZine(userId, args) {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE zines SET is_published = 1, published_at = CURRENT_TIMESTAMP, author_name = ?, genre = ?, tags = ? WHERE id = ? AND user_id = ?`,
            [args.author || 'Anonymous', args.genre || 'classic', args.tags || '', args.zineId, userId],
            function (err) {
                if (err) return reject(err);
                if (this.changes === 0) return reject(new Error('Zine not found'));
                resolve({ status: 'published' });
            }
        );
    });
}

async function handleDeletePage(userId, args) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [args.zineId, userId], (err, zine) => {
            if (err || !zine) return reject(new Error('Zine not found'));
            const data = JSON.parse(zine.data);
            const pageIdx = parseInt(args.pageIdx);
            if (data.pages.length <= 1) return reject(new Error('Cannot delete last page'));
            if (!data.pages[pageIdx]) return reject(new Error('Page not found'));
            data.pages.splice(pageIdx, 1);
            db.run(`UPDATE zines SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [JSON.stringify(data), args.zineId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ status: 'deleted' });
                }
            );
        });
    });
}

async function handleDuplicatePage(userId, args) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [args.zineId, userId], (err, zine) => {
            if (err || !zine) return reject(new Error('Zine not found'));
            const data = JSON.parse(zine.data);
            const pageIdx = parseInt(args.pageIdx);
            if (!data.pages[pageIdx]) return reject(new Error('Page not found'));
            const newPage = JSON.parse(JSON.stringify(data.pages[pageIdx]));
            newPage.id = Date.now();
            if (newPage.elements) newPage.elements.forEach(e => { e.id = 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) });
            data.pages.splice(pageIdx + 1, 0, newPage);
            db.run(`UPDATE zines SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [JSON.stringify(data), args.zineId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ pageId: newPage.id, pageIdx: pageIdx + 1 });
                }
            );
        });
    });
}

async function handleAddShapeElement(userId, args) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [args.zineId, userId], (err, zine) => {
            if (err || !zine) return reject(new Error('Zine not found'));
            const data = JSON.parse(zine.data);
            if (!data.pages[args.pageIdx]) return reject(new Error('Page not found'));
            const shapes = { circle: { shape: 'circle', width: 100, height: 100 }, square: { shape: 'rect', width: 100, height: 100 }, triangle: { shape: 'triangle', width: 100, height: 100 }, diamond: { shape: 'diamond', width: 80, height: 100 }, line_h: { shape: 'line_h', width: 200, height: 4 }, arrow: { type: 'text', content: '➤', fontSize: 48, color: '#0a0a0a', width: 60, height: 60, fontFamily: 'sans-serif' } };
            const shapeConfig = shapes[args.shape] || shapes.circle;
            const element = {
                id: 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                type: shapeConfig.type || 'shape',
                shape: shapeConfig.shape,
                x: args.x || 80,
                y: args.y || 80,
                width: args.width || shapeConfig.width,
                height: args.height || shapeConfig.height,
                fill: args.fill || '#0a0a0a',
                zIndex: data.pages[args.pageIdx].elements.length
            };
            if (shapeConfig.content) element.content = shapeConfig.content;
            if (shapeConfig.fontSize) element.fontSize = shapeConfig.fontSize;
            if (shapeConfig.color) element.color = shapeConfig.color;
            if (shapeConfig.fontFamily) element.fontFamily = shapeConfig.fontFamily;
            data.pages[args.pageIdx].elements.push(element);
            db.run(`UPDATE zines SET data = ? WHERE id = ?`, [JSON.stringify(data), args.zineId], function (err) {
                if (err) return reject(err);
                resolve({ elementId: element.id });
            });
        });
    });
}

async function handleAddSFXElement(userId, args) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [args.zineId, userId], (err, zine) => {
            if (err || !zine) return reject(new Error('Zine not found'));
            const data = JSON.parse(zine.data);
            if (!data.pages[args.pageIdx]) return reject(new Error('Page not found'));
            const sfx = { crash: 'CRASH!', boom: 'BOOM!', zap: 'ZAP!', pow: 'POW!', whoosh: 'WHOOSH!', splat: 'SPLAT!' };
            const element = {
                id: 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                type: 'text',
                content: sfx[args.sfxType] || 'BAM!',
                x: args.x || 80,
                y: args.y || 80,
                fontSize: 52,
                fontFamily: 'Bangers',
                color: '#0a0a0a',
                width: 180,
                height: 70,
                strokeWidth: 2,
                strokeColor: '#ffffff',
                zIndex: data.pages[args.pageIdx].elements.length
            };
            data.pages[args.pageIdx].elements.push(element);
            db.run(`UPDATE zines SET data = ? WHERE id = ?`, [JSON.stringify(data), args.zineId], function (err) {
                if (err) return reject(err);
                resolve({ elementId: element.id });
            });
        });
    });
}

async function handleAddSymbolElement(userId, args) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [args.zineId, userId], (err, zine) => {
            if (err || !zine) return reject(new Error('Zine not found'));
            const data = JSON.parse(zine.data);
            if (!data.pages[args.pageIdx]) return reject(new Error('Page not found'));
            const symbols = { pentagram: '⛤', skull: '☠', star_symbol: '✦', eye: '👁', biohazard: '☣', radiation: '☢', compass: '🧭', rune: 'ᚱ', ankh: '☥', omega: 'Ω', infinity: '∞', trident: '🔱' };
            const element = {
                id: 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                type: 'text',
                content: symbols[args.symbol] || '✦',
                x: args.x || 80,
                y: args.y || 80,
                fontSize: 56,
                color: '#d4af37',
                width: 80,
                height: 80,
                fontFamily: 'sans-serif',
                zIndex: data.pages[args.pageIdx].elements.length
            };
            data.pages[args.pageIdx].elements.push(element);
            db.run(`UPDATE zines SET data = ? WHERE id = ?`, [JSON.stringify(data), args.zineId], function (err) {
                if (err) return reject(err);
                resolve({ elementId: element.id });
            });
        });
    });
}

async function handleAddShaderElement(userId, args) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [args.zineId, userId], (err, zine) => {
            if (err || !zine) return reject(new Error('Zine not found'));
            const data = JSON.parse(zine.data);
            if (!data.pages[args.pageIdx]) return reject(new Error('Page not found'));
            const element = {
                id: 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                type: 'shader',
                shaderPreset: args.shaderPreset || 'plasma',
                x: args.x || 80,
                y: args.y || 80,
                width: args.width || 220,
                height: args.height || 220,
                opacity: 1,
                zIndex: data.pages[args.pageIdx].elements.length
            };
            data.pages[args.pageIdx].elements.push(element);
            db.run(`UPDATE zines SET data = ? WHERE id = ?`, [JSON.stringify(data), args.zineId], function (err) {
                if (err) return reject(err);
                resolve({ elementId: element.id });
            });
        });
    });
}

async function handleDeleteElement(userId, args) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [args.zineId, userId], (err, zine) => {
            if (err || !zine) return reject(new Error('Zine not found'));
            const data = JSON.parse(zine.data);
            const pageIdx = parseInt(args.pageIdx);
            const elements = data.pages[pageIdx]?.elements;
            if (!elements) return reject(new Error('Page not found'));
            const idx = elements.findIndex(e => e.id === args.elementId);
            if (idx === -1) return reject(new Error('Element not found'));
            elements.splice(idx, 1);
            db.run(`UPDATE zines SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [JSON.stringify(data), args.zineId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ status: 'deleted' });
                }
            );
        });
    });
}

async function handleDuplicateElement(userId, args) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [args.zineId, userId], (err, zine) => {
            if (err || !zine) return reject(new Error('Zine not found'));
            const data = JSON.parse(zine.data);
            const pageIdx = parseInt(args.pageIdx);
            const el = data.pages[pageIdx]?.elements.find(e => e.id === args.elementId);
            if (!el) return reject(new Error('Element not found'));
            const newEl = JSON.parse(JSON.stringify(el));
            newEl.id = 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            newEl.x += 20;
            newEl.y += 20;
            data.pages[pageIdx].elements.push(newEl);
            db.run(`UPDATE zines SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [JSON.stringify(data), args.zineId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ elementId: newEl.id });
                }
            );
        });
    });
}

async function handleMoveLayer(userId, args) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT data FROM zines WHERE id = ? AND user_id = ?`, [args.zineId, userId], (err, zine) => {
            if (err || !zine) return reject(new Error('Zine not found'));
            const data = JSON.parse(zine.data);
            const pageIdx = parseInt(args.pageIdx);
            const elements = data.pages[pageIdx]?.elements;
            if (!elements) return reject(new Error('Page not found'));
            const idx = elements.findIndex(e => e.id === args.elementId);
            if (idx === -1) return reject(new Error('Element not found'));

            if (args.direction === 'up' && idx < elements.length - 1) {
                [elements[idx], elements[idx + 1]] = [elements[idx + 1], elements[idx]];
            } else if (args.direction === 'down' && idx > 0) {
                [elements[idx], elements[idx - 1]] = [elements[idx - 1], elements[idx]];
            } else if (args.direction === 'top') {
                const el = elements.splice(idx, 1)[0];
                elements.push(el);
            } else if (args.direction === 'bottom') {
                const el = elements.splice(idx, 1)[0];
                elements.unshift(el);
            }

            // Update all zIndex
            elements.forEach((e, i) => e.zIndex = i);
            db.run(`UPDATE zines SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [JSON.stringify(data), args.zineId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ status: 'moved' });
                }
            );
        });
    });
}

// Additional MCP endpoints for export and other features
app.post('/mcp/export/html', authenticateToken, (req, res) => {
    const { project } = req.body;
    // Placeholder for HTML export - in full implementation, adapt client-side exportToHTML
    // For now, return basic HTML structure
    let html = `<!DOCTYPE html><html><head><title>${project.title}</title></head><body>`;
    project.pages.forEach((p, i) => {
        html += `<div>Page ${i + 1}</div>`;
    });
    html += `</body></html>`;
    res.json({ html });
});

app.post('/mcp/export/pdf', authenticateToken, (req, res) => {
    // Placeholder for PDF export
    res.json({ message: 'PDF export not implemented server-side yet' });
});

// ============================================
// XRP PayID Integration API Endpoints
// ============================================

// ---- Credits API ----

// Purchase credits (simulated fiat purchase)
app.post('/api/credits/purchase', authenticateToken, (req, res) => {
    const { amount, paymentMethod } = req.body;
    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
    }

    // In production, this would integrate with a payment processor (Stripe, etc.)
    // For now, we simulate the purchase
    db.get(`SELECT * FROM credits WHERE user_id = ?`, [req.user.id], (err, creditRow) => {
        if (err) return res.status(500).json({ error: err.message });

        if (creditRow) {
            db.run(`UPDATE credits SET balance = balance + ?, total_spent = total_spent + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
                [amount, amount, req.user.id],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });

                    // Record transaction
                    db.run(`INSERT INTO transactions (from_user_id, to_user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)`,
                        [req.user.id, null, amount, 'credit_purchase', `Purchased ${amount} credits via ${paymentMethod || 'simulated'}`],
                        (err) => { if (err) console.error('Transaction log error:', err); }
                    );

                    res.json({ success: true, newBalance: creditRow.balance + amount, amount });
                }
            );
        } else {
            db.run(`INSERT INTO credits (user_id, balance, total_spent) VALUES (?, ?, ?)`,
                [req.user.id, amount, amount],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });

                    // Record transaction
                    db.run(`INSERT INTO transactions (from_user_id, to_user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)`,
                        [req.user.id, null, amount, 'credit_purchase', `Purchased ${amount} credits via ${paymentMethod || 'simulated'}`],
                        (err) => { if (err) console.error('Transaction log error:', err); }
                    );

                    res.json({ success: true, newBalance: amount, amount });
                }
            );
        }
    });
});

// Get credit balance
app.get('/api/credits/balance', authenticateToken, (req, res) => {
    db.get(`SELECT balance FROM credits WHERE user_id = ?`, [req.user.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ balance: row ? row.balance : 0 });
    });
});

// ---- Wallet API ----

// Create new XRP wallet for user
app.post('/api/wallet/create', authenticateToken, (req, res) => {
    const { xrpAddress, payid } = req.body;

    if (!xrpAddress) {
        return res.status(400).json({ error: 'XRP address required' });
    }

    // Check if wallet already exists
    db.get(`SELECT * FROM wallets WHERE user_id = ?`, [req.user.id], (err, existing) => {
        if (err) return res.status(500).json({ error: err.message });

        if (existing) {
            // Update existing wallet
            db.run(`UPDATE wallets SET xrp_address = ?, payid = ?, is_verified = 1 WHERE user_id = ?`,
                [xrpAddress, payid || null, req.user.id],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, xrpAddress, payid: payid || null });
                }
            );
        } else {
            // Insert new wallet
            db.run(`INSERT INTO wallets (user_id, xrp_address, payid, is_verified) VALUES (?, ?, ?, ?)`,
                [req.user.id, xrpAddress, payid || null, 1],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, xrpAddress, payid: payid || null });
                }
            );
        }
    });
});

// Get user's wallet info
app.get('/api/wallet', authenticateToken, (req, res) => {
    db.get(`SELECT xrp_address, payid, is_verified, created_at FROM wallets WHERE user_id = ?`, [req.user.id], (err, wallet) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(wallet || { xrp_address: null, payid: null, is_verified: false });
    });
});

// ---- Tokens API ----

// Create new token (creator issues their own currency)
app.post('/api/tokens/create', authenticateToken, (req, res) => {
    const { tokenCode, tokenName, description, initialSupply, pricePerToken, iconUrl } = req.body;

    if (!tokenCode || !tokenName) {
        return res.status(400).json({ error: 'Token code and name required' });
    }

    // Generate XRPL-compatible currency code (max 20 chars, uppercase)
    const xrpCurrencyCode = tokenCode.toUpperCase().slice(0, 20);

    db.run(`INSERT INTO tokens (creator_id, token_code, token_name, description, icon_url, initial_supply, current_supply, price_per_token, xrp_currency_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.id, tokenCode.toUpperCase(), tokenName, description || '', iconUrl || null, initialSupply || 1000000, initialSupply || 1000000, pricePerToken || 0.01, xrpCurrencyCode],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });

            // Initialize reputation for creator
            db.run(`INSERT OR IGNORE INTO reputation (user_id, score, level) VALUES (?, ?, ?)`,
                [req.user.id, 0, 'creator'],
                (err) => { if (err) console.error('Reputation init error:', err); }
            );

            res.json({ success: true, tokenId: this.lastID, tokenCode: xrpCurrencyCode, tokenName });
        }
    );
});

// Get all active tokens (marketplace)
app.get('/api/tokens', (req, res) => {
    const { creatorId } = req.query;
    let sql = `SELECT t.*, u.username as creator_name FROM tokens t JOIN users u ON t.creator_id = u.id WHERE t.is_active = 1`;
    const params = [];

    if (creatorId) {
        sql += ` AND t.creator_id = ?`;
        params.push(creatorId);
    }

    sql += ` ORDER BY t.created_at DESC`;

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get specific token
app.get('/api/tokens/:id', (req, res) => {
    db.get(`SELECT t.*, u.username as creator_name FROM tokens t JOIN users u ON t.creator_id = u.id WHERE t.id = ?`, [req.params.id], (err, token) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!token) return res.status(404).json({ error: 'Token not found' });
        res.json(token);
    });
});

// Buy tokens with credits
app.post('/api/tokens/:id/buy', authenticateToken, (req, res) => {
    const { amount } = req.body;
    const tokenId = req.params.id;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
    }

    // Get token info
    db.get(`SELECT * FROM tokens WHERE id = ? AND is_active = 1`, [tokenId], (err, token) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!token) return res.status(404).json({ error: 'Token not found' });

        const totalCost = amount * token.price_per_token;

        // Check user's credit balance
        db.get(`SELECT balance FROM credits WHERE user_id = ?`, [req.user.id], (err, creditRow) => {
            if (err) return res.status(500).json({ error: err.message });

            const currentBalance = creditRow ? creditRow.balance : 0;
            if (currentBalance < totalCost) {
                return res.status(400).json({ error: 'Insufficient credits', required: totalCost, available: currentBalance });
            }

            // Deduct credits and record transaction
            db.run(`UPDATE credits SET balance = balance - ? WHERE user_id = ?`,
                [totalCost, req.user.id],
                (err) => {
                    if (err) return res.status(500).json({ error: err.message });

                    // Update token supply
                    db.run(`UPDATE tokens SET current_supply = current_supply - ? WHERE id = ?`,
                        [amount, tokenId],
                        (err) => {
                            if (err) return res.status(500).json({ error: err.message });

                            // Record transaction
                            db.run(`INSERT INTO transactions (from_user_id, to_user_id, token_id, amount, type, description) VALUES (?, ?, ?, ?, ?, ?)`,
                                [req.user.id, token.creator_id, tokenId, amount, 'token_purchase', `Bought ${amount} ${token.token_name} for ${totalCost} credits`],
                                (err) => { if (err) console.error('Transaction log error:', err); }
                            );

                            res.json({ success: true, amount, totalCost, tokenName: token.token_name });
                        }
                    );
                }
            );
        });
    });
});

// ---- Trust Lines API ----

// Create trust line record
app.post('/api/trustlines', authenticateToken, (req, res) => {
    const { tokenId, limit } = req.body;

    if (!tokenId) {
        return res.status(400).json({ error: 'Token ID required' });
    }

    // Check if trust line already exists
    db.get(`SELECT * FROM trust_lines WHERE user_id = ? AND token_id = ? AND is_active = 1`,
        [req.user.id, tokenId],
        (err, existing) => {
            if (err) return res.status(500).json({ error: err.message });

            if (existing) {
                return res.status(400).json({ error: 'Trust line already exists' });
            }

            db.run(`INSERT INTO trust_lines (user_id, token_id, trust_line_limit) VALUES (?, ?, ?)`,
                [req.user.id, tokenId, limit || 1000000],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, trustLineId: this.lastID });
                }
            );
        }
    );
});

// Get user's trust lines
app.get('/api/trustlines', authenticateToken, (req, res) => {
    db.all(`SELECT tl.*, t.token_code, t.token_name FROM trust_lines tl JOIN tokens t ON tl.token_id = t.id WHERE tl.user_id = ? AND tl.is_active = 1`,
        [req.user.id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// ---- Subscriptions API ----

// Subscribe to creator
app.post('/api/subscriptions/subscribe', authenticateToken, (req, res) => {
    const { creatorId, tokenId, amountPerPeriod, periodDays } = req.body;

    if (!creatorId || !tokenId) {
        return res.status(400).json({ error: 'Creator ID and Token ID required' });
    }

    if (creatorId === req.user.id) {
        return res.status(400).json({ error: 'Cannot subscribe to yourself' });
    }

    // Calculate cost
    const amount = amountPerPeriod || 10;
    const period = periodDays || 30;

    // Check credit balance
    db.get(`SELECT balance FROM credits WHERE user_id = ?`, [req.user.id], (err, creditRow) => {
        if (err) return res.status(500).json({ error: err.message });

        const currentBalance = creditRow ? creditRow.balance : 0;
        if (currentBalance < amount) {
            return res.status(400).json({ error: 'Insufficient credits', required: amount, available: currentBalance });
        }

        // Get creator's user info
        db.get(`SELECT id, username FROM users WHERE id = ?`, [creatorId], (err, creator) => {
            if (err || !creator) return res.status(404).json({ error: 'Creator not found' });

            // Deduct credits
            db.run(`UPDATE credits SET balance = balance - ? WHERE user_id = ?`,
                [amount, req.user.id],
                (err) => {
                    if (err) return res.status(500).json({ error: err.message });

                    // Calculate expiration
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + period);

                    // Check for existing subscription
                    db.get(`SELECT * FROM subscriptions WHERE subscriber_id = ? AND creator_id = ? AND is_active = 1`,
                        [req.user.id, creatorId],
                        (err, existing) => {
                            if (err) return res.status(500).json({ error: err.message });

                            if (existing) {
                                // Update existing
                                db.run(`UPDATE subscriptions SET amount_per_period = ?, expires_at = ?, token_id = ? WHERE id = ?`,
                                    [amount, expiresAt.toISOString(), tokenId, existing.id],
                                    (err) => {
                                        if (err) return res.status(500).json({ error: err.message });

                                        // Record transaction
                                        db.run(`INSERT INTO transactions (from_user_id, to_user_id, token_id, amount, type, description) VALUES (?, ?, ?, ?, ?, ?)`,
                                            [req.user.id, creatorId, tokenId, amount, 'subscription', `Subscribed to creator for ${amount} credits`],
                                            (err) => { if (err) console.error('Transaction log error:', err); }
                                        );

                                        res.json({ success: true, message: 'Subscription renewed' });
                                    }
                                );
                            } else {
                                // Create new subscription
                                db.run(`INSERT INTO subscriptions (subscriber_id, creator_id, token_id, amount_per_period, period_days, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
                                    [req.user.id, creatorId, tokenId, amount, period, expiresAt.toISOString()],
                                    (err) => {
                                        if (err) return res.status(500).json({ error: err.message });

                                        // Record transaction
                                        db.run(`INSERT INTO transactions (from_user_id, to_user_id, token_id, amount, type, description) VALUES (?, ?, ?, ?, ?, ?)`,
                                            [req.user.id, creatorId, tokenId, amount, 'subscription', `Subscribed to creator for ${amount} credits`],
                                            (err) => { if (err) console.error('Transaction log error:', err); }
                                        );

                                        // Update creator reputation
                                        db.run(`UPDATE reputation SET total_subscribers = total_subscribers + 1, score = score + 10 WHERE user_id = ?`,
                                            [creatorId],
                                            (err) => { if (err) console.error('Reputation update error:', err); }
                                        );

                                        res.json({ success: true, subscriptionId: this.lastID });
                                    }
                                );
                            }
                        }
                    );
                }
            );
        });
    });
});

// Cancel subscription
app.post('/api/subscriptions/cancel', authenticateToken, (req, res) => {
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
        return res.status(400).json({ error: 'Subscription ID required' });
    }

    db.run(`UPDATE subscriptions SET is_active = 0 WHERE id = ? AND subscriber_id = ?`,
        [subscriptionId, req.user.id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Subscription not found' });
            res.json({ success: true, message: 'Subscription cancelled' });
        }
    );
});

// Get user's subscriptions
app.get('/api/subscriptions', authenticateToken, (req, res) => {
    const { type } = req.query;

    let sql = '';
    let params = [req.user.id];

    if (type === 'subscribers') {
        // Get people subscribed to me
        sql = `SELECT s.*, u.username as subscriber_name FROM subscriptions s JOIN users u ON s.subscriber_id = u.id WHERE s.creator_id = ? AND s.is_active = 1`;
    } else {
        // Get my subscriptions
        sql = `SELECT s.*, u.username as creator_name FROM subscriptions s JOIN users u ON s.creator_id = u.id WHERE s.subscriber_id = ? AND s.is_active = 1`;
    }

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ---- Bids API ----

// Place bid on content
app.post('/api/bids/create', authenticateToken, (req, res) => {
    const { zineId, amount, message } = req.body;

    if (!zineId || !amount) {
        return res.status(400).json({ error: 'Zine ID and amount required' });
    }

    // Check credit balance
    db.get(`SELECT balance FROM credits WHERE user_id = ?`, [req.user.id], (err, creditRow) => {
        if (err) return res.status(500).json({ error: err.message });

        const currentBalance = creditRow ? creditRow.balance : 0;
        if (currentBalance < amount) {
            return res.status(400).json({ error: 'Insufficient credits', required: amount, available: currentBalance });
        }

        db.run(`INSERT INTO bids (bidder_id, zine_id, amount, message) VALUES (?, ?, ?, ?)`,
            [req.user.id, zineId, amount, message || null],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, bidId: this.lastID, amount });
            }
        );
    });
});

// Accept bid
app.post('/api/bids/:id/accept', authenticateToken, (req, res) => {
    const bidId = req.params.id;

    // Get bid info
    db.get(`SELECT b.*, z.user_id as zine_owner_id FROM bids b JOIN zines z ON b.zine_id = z.id WHERE b.id = ?`, [bidId], (err, bid) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!bid) return res.status(404).json({ error: 'Bid not found' });

        // Verify ownership
        if (bid.zine_owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Deduct credits from bidder and transfer to owner
        db.run(`UPDATE credits SET balance = balance - ? WHERE user_id = ?`,
            [bid.amount, bid.bidder_id],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });

                // Credit the owner (insert or update)
                db.run(`INSERT INTO credits (user_id, balance) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?`,
                    [req.user.id, bid.amount, bid.amount],
                    (err) => { if (err) console.error('Credit owner error:', err); }
                );

                // Update bid status
                db.run(`UPDATE bids SET status = 'accepted' WHERE id = ?`, [bidId], (err) => {
                    if (err) console.error('Bid update error:', err);
                });

                // Record transactions
                db.run(`INSERT INTO transactions (from_user_id, to_user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)`,
                    [bid.bidder_id, req.user.id, bid.amount, 'bid_accepted', 'Bid accepted for content'],
                    (err) => { if (err) console.error('Transaction log error:', err); }
                );

                // Update reputation
                db.run(`UPDATE reputation SET total_bids_accepted = total_bids_accepted + 1, score = score + 15, total_content_sold = total_content_sold + ? WHERE user_id = ?`,
                    [bid.amount, req.user.id],
                    (err) => { if (err) console.error('Reputation update error:', err); }
                );

                res.json({ success: true, message: 'Bid accepted', amount: bid.amount });
            }
        );
    });
});

// Reject bid
app.post('/api/bids/:id/reject', authenticateToken, (req, res) => {
    const bidId = req.params.id;

    db.get(`SELECT b.*, z.user_id as zine_owner_id FROM bids b JOIN zines z ON b.zine_id = z.id WHERE b.id = ?`, [bidId], (err, bid) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!bid) return res.status(404).json({ error: 'Bid not found' });

        if (bid.zine_owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        db.run(`UPDATE bids SET status = 'rejected' WHERE id = ?`, [bidId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: 'Bid rejected' });
        });
    });
});

// Get bids for user's content
app.get('/api/bids', authenticateToken, (req, res) => {
    const { zineId } = req.query;

    let sql = '';
    let params = [];

    if (zineId) {
        // Get bids for specific zine
        sql = `SELECT b.*, u.username as bidder_name, z.title as zine_title FROM bids b JOIN users u ON b.bidder_id = u.id JOIN zines z ON b.zine_id = z.id WHERE b.zine_id = ? ORDER BY b.created_at DESC`;
        params.push(zineId);
    } else {
        // Get all my bids (as bidder) and bids on my content
        sql = `SELECT b.*, u.username as bidder_name, z.title as zine_title FROM bids b JOIN users u ON b.bidder_id = u.id JOIN zines z ON b.zine_id = z.id WHERE b.bidder_id = ? OR z.user_id = ? ORDER BY b.created_at DESC`;
        params = [req.user.id, req.user.id];
    }

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ---- Reputation API ----

// Get user reputation
app.get('/api/reputation/:userId', (req, res) => {
    db.get(`SELECT r.*, u.username FROM reputation r JOIN users u ON r.user_id = u.id WHERE r.user_id = ?`, [req.params.userId], (err, rep) => {
        if (err) return res.status(500).json({ error: err.message });

        if (!rep) {
            // Create default reputation if not exists
            return res.json({
                user_id: req.params.userId,
                score: 0,
                level: 'newcomer',
                total_tips_received: 0,
                total_subscribers: 0,
                total_content_sold: 0,
                total_bids_accepted: 0
            });
        }

        // Calculate level based on score
        let level = 'newcomer';
        if (rep.score >= 1000) level = 'legendary';
        else if (rep.score >= 500) level = 'master';
        else if (rep.score >= 200) level = 'established';
        else if (rep.score >= 100) level = 'contributor';
        else if (rep.score >= 50) level = 'supporter';

        res.json({ ...rep, level });
    });
});

// Update reputation (internal, called after actions)
app.post('/api/reputation/update', authenticateToken, (req, res) => {
    const { action, amount } = req.body;

    // Initialize reputation if not exists
    db.run(`INSERT OR IGNORE INTO reputation (user_id, score, level) VALUES (?, ?, ?)`,
        [req.user.id, 0, 'newcomer'],
        (err) => {
            if (err) return res.status(500).json({ error: err.message });

            let scoreIncrease = 0;
            switch (action) {
                case 'publish': scoreIncrease = 5; break;
                case 'subscribe': scoreIncrease = 3; break;
                case 'tip': scoreIncrease = 2; break;
                case 'bid_accepted': scoreIncrease = 15; break;
                case 'content_sold': scoreIncrease = 10; break;
                default: scoreIncrease = amount || 1;
            }

            db.run(`UPDATE reputation SET score = score + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
                [scoreIncrease, req.user.id],
                (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, scoreIncrease });
                }
            );
        }
    );
});

// ---- Marketplace API ----

// Get marketplace listings
app.get('/api/market', (req, res) => {
    const { sort } = req.query;

    let sql = `SELECT t.*, u.username as creator_name, 
               (t.initial_supply - t.current_supply) as tokens_sold
               FROM tokens t 
               JOIN users u ON t.creator_id = u.id 
               WHERE t.is_active = 1 AND t.current_supply > 0`;

    switch (sort) {
        case 'popular': sql += ` ORDER BY tokens_sold DESC`; break;
        case 'newest': sql += ` ORDER BY t.created_at DESC`; break;
        case 'price_low': sql += ` ORDER BY t.price_per_token ASC`; break;
        case 'price_high': sql += ` ORDER BY t.price_per_token DESC`; break;
        default: sql += ` ORDER BY tokens_sold DESC`;
    }

    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get transaction history
app.get('/api/transactions', authenticateToken, (req, res) => {
    const { type } = req.query;

    let sql = `SELECT t.*, 
               from_user.username as from_username,
               to_user.username as to_username,
               token.token_name
               FROM transactions t
               LEFT JOIN users from_user ON t.from_user_id = from_user.id
               LEFT JOIN users to_user ON t.to_user_id = to_user.id
               LEFT JOIN tokens token ON t.token_id = token.id
               WHERE t.from_user_id = ? OR t.to_user_id = ?`;

    const params = [req.user.id, req.user.id];

    if (type) {
        sql += ` AND t.type = ?`;
        params.push(type);
    }

    sql += ` ORDER BY t.created_at DESC LIMIT 50`;

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ---- Zine Tokenization ----

// Set token price for zine (token gating)
app.post('/api/zines/:id/token-gate', authenticateToken, (req, res) => {
    const { tokenPrice, tokenId, isTokenGated } = req.body;
    const zineId = req.params.id;

    db.get(`SELECT * FROM zines WHERE id = ? AND user_id = ?`, [zineId, req.user.id], (err, zine) => {
        if (err || !zine) return res.status(404).json({ error: 'Zine not found or not owned' });

        db.run(`UPDATE zines SET token_price = ?, is_token_gated = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [tokenPrice || 0, isTokenGated ? 1 : 0, zineId],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, tokenPrice, isTokenGated: !!isTokenGated });
            }
        );
    });
});

// Get zine with token access check
app.get('/api/zines/:id/access', authenticateToken, (req, res) => {
    const zineId = req.params.id;

    db.get(`SELECT * FROM zines WHERE id = ?`, [zineId], (err, zine) => {
        if (err || !zine) return res.status(404).json({ error: 'Not found' });

        // If not token gated, allow access
        if (!zine.is_token_gated || zine.token_price === 0) {
            return res.json({ hasAccess: true });
        }

        // Check if user owns the zine
        if (zine.user_id === req.user.id) {
            return res.json({ hasAccess: true });
        }

        // Check if user has subscription to creator
        db.get(`SELECT * FROM subscriptions WHERE subscriber_id = ? AND creator_id = ? AND is_active = 1`,
            [req.user.id, zine.user_id],
            (err, sub) => {
                if (err) return res.status(500).json({ error: err.message });
                if (sub) return res.json({ hasAccess: true, via: 'subscription' });

                // Check if user has bid accepted
                db.get(`SELECT * FROM bids WHERE bidder_id = ? AND zine_id = ? AND status = 'accepted'`,
                    [req.user.id, zineId],
                    (err, bid) => {
                        if (err) return res.status(500).json({ error: err.message });
                        if (bid) return res.json({ hasAccess: true, via: 'bid' });

                        // No access
                        res.json({
                            hasAccess: false,
                            tokenPrice: zine.token_price,
                            creatorId: zine.user_id
                        });
                    }
                );
            }
        );
    });
});

// Static Files
// Serve root folder, but exclude backend files
app.use((req, res, next) => {
    if (req.path.endsWith('.sqlite') || req.path === '/server/' || req.path === '/server.js') {
        return res.status(403).send('Forbidden');
    }
    next();
});
app.use(express.static(__dirname));

// PAYMENT ENDPOINTS (SIMULATED WITH REAL DATABASE UPDATES)
// ═══════════════════════════════════════════════════
app.post('/api/payment/initiate', authenticateToken, (req, res) => {
    const { credits, cardLast4, billingEmail } = req.body;
    if (!credits || credits <= 0) {
        return res.status(400).json({ error: 'Invalid credit amount' });
    }

    // Create a simulated payment session
    const sessionId = 'pay_' + Math.random().toString(36).substr(2, 9);
    const amount = credits * 100; // $1 per credit

    res.json({
        sessionId,
        amount,
        credits,
        status: 'pending',
        paymentUrl: `http://localhost:5174?pay_id=${sessionId}`
    });
});

app.post('/api/payment/confirm', authenticateToken, (req, res) => {
    const { sessionId, credits } = req.body;
    if (!sessionId || !credits || credits <= 0) {
        return res.status(400).json({ error: 'Invalid payment data' });
    }

    const intCredits = parseInt(credits);

    // Add credits to user account
    db.get(`SELECT * FROM credits WHERE user_id = ?`, [req.user.id], (err, creditRow) => {
        if (err) return res.status(500).json({ error: err.message });

        if (creditRow) {
            db.run(
                `UPDATE credits SET balance = balance + ?, total_spent = total_spent + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
                [intCredits, intCredits, req.user.id],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });

                    // Record transaction
                    db.run(
                        `INSERT INTO transactions (from_user_id, to_user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)`,
                        [req.user.id, null, intCredits, 'payment_purchase', `Purchased ${intCredits} credits via payment gateway (${sessionId})`],
                        (err) => {
                            if (err) console.error('Transaction log error:', err);
                            res.json({ success: true, newBalance: creditRow.balance + intCredits, credits: intCredits });
                        }
                    );
                }
            );
        } else {
            db.run(
                `INSERT INTO credits (user_id, balance, total_spent) VALUES (?, ?, ?)`,
                [req.user.id, intCredits, intCredits],
                function (err) {
                    if (err) return res.status(500).json({ error: err.message });

                    // Record transaction
                    db.run(
                        `INSERT INTO transactions (from_user_id, to_user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)`,
                        [req.user.id, null, intCredits, 'payment_purchase', `Purchased ${intCredits} credits via payment gateway (${sessionId})`],
                        (err) => {
                            if (err) console.error('Transaction log error:', err);
                            res.json({ success: true, newBalance: intCredits, credits: intCredits });
                        }
                    );
                }
            );
        }
    });
});

// Serve index.html (zine_builder.html) for unknown routes (SPA)
// Actually, let's keep it simple and just serve static.
// app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'zine_builder.html')));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
