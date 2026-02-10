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
