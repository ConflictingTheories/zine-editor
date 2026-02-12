const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'void_press_secret_key_change_in_prod'; // Use env var in production

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Allow large payloads for images

// Database Setup
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

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
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
});

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
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
            const token = jwt.sign({ id: this.lastID, username }, SECRET_KEY);
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

        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY);
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

        jwt.verify(token, SECRET_KEY, (err, user) => {
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
            tools: {}
        },
        serverInfo: {
            name: 'zine-builder-mcp',
            version: '1.0.0'
        }
    });
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
            case 'add_text_element':
                result = await handleAddTextElement(req.user.id, args);
                break;
            case 'add_image_element':
                result = await handleAddImageElement(req.user.id, args);
                break;
            case 'add_panel_element':
                result = await handleAddPanelElement(req.user.id, args);
                break;
            case 'add_balloon_element':
                result = await handleAddBalloonElement(req.user.id, args);
                break;
            case 'update_element':
                result = await handleUpdateElement(req.user.id, args);
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
        const project = {
            id: Date.now(),
            title: args.title,
            theme: args.theme || 'classic',
            pages: [{ id: Date.now(), elements: [], background: '#ffffff', texture: null }]
        };

        db.run(`INSERT INTO zines (user_id, title, data) VALUES (?, ?, ?)`,
            [userId, args.title, JSON.stringify(project.pages)],
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

// Static Files
// Serve root folder, but exclude backend files
app.use((req, res, next) => {
    if (req.path.endsWith('.sqlite') || req.path === '/server/' || req.path === '/server.js') {
        return res.status(403).send('Forbidden');
    }
    next();
});
app.use(express.static(__dirname));

// Serve index.html (zine_builder.html) for unknown routes (SPA)
// Actually, let's keep it simple and just serve static.
// app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'zine_builder.html')));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
