// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const knex = require('knex');
const knexConfig = require('./knexfile.cjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { unzipSync, strFromU8 } = require('fflate');

// Load configuration from config.cjs
const CONFIG = require('./config.cjs');

// Import economy service for Stripe and XRP integration
const economyService = require('./economyService.cjs');
const contributionService = require('./contributionService.cjs');
const sovereignService = require('./sovereignService.cjs');
const { encrypt, decrypt } = require('./encryption.cjs');
const xrpService = require('./xrpService.cjs');

const app = express();
const SVRN_STORE = path.join(__dirname, 'data', 'svrn-packages');
const SVRN_INDEX = path.join(SVRN_STORE, 'index.json');
fs.mkdirSync(SVRN_STORE, { recursive: true });
const readSvrnIndex = () => { try { return JSON.parse(fs.readFileSync(SVRN_INDEX, 'utf8')); } catch { return []; } };
const writeSvrnIndex = index => fs.writeFileSync(SVRN_INDEX, JSON.stringify(index, null, 2));
const svrnEtag = value => `\"${crypto.createHash('sha256').update(value).digest('hex')}\"`;

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

const dbEnv = NODE_ENV === 'production' ? 'production' : 'development';
const knexEnvConfig = {
    ...knexConfig[dbEnv],
    connection: {
        filename: DB_PATH
    }
};
const db = knex(knexEnvConfig);

// Run migrations on startup
db.migrate.latest()
    .then(() => console.log('Database migrations completed'))
    .catch(err => console.error('Database migration failed:', err));

// Health Check
app.get('/api/health', (req, res) => {
    db.raw('SELECT 1').then(() => {
        res.json({ status: 'ok', database: 'connected' });
    }).catch(err => {
        res.status(500).json({ status: 'error', database: 'disconnected', error: err.message });
    });
});

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized', message: 'Authentication token required' });

    // Offline Bypass Token support
    if (token === 'local_offline_token') {
        req.user = { id: 1, username: 'Local_Creator' };
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden', message: 'Invalid or expired token' });
        req.user = user;
        next();
    });
};

// ─── SVRN Publishing Node v1 ──────────────────────────────────────
// These routes deliberately remain separate from the legacy /api routes so
// this server can be deployed as a standalone SVRN node.
app.get('/.well-known/svrn-node.json', (req, res) => {
    res.json({ protocolVersion: '1.0', name: process.env.SVRN_NODE_NAME || 'SVRN Publishing Node',
        endpoints: { catalog: '/svrn/v1/catalog', search: '/svrn/v1/search', feed: '/svrn/v1/feed', packages: '/svrn/v1/issues/:id/package', profile: '/api/profile' },
        access: { publicCatalog: true, bearerProfiles: true }, capabilities: ['package-hosting', 'html-view', 'search', 'profiles', 'subscriptions'] });
});

app.get('/svrn/v1/search', (req, res) => {
    const q = String(req.query.q || '').toLowerCase()
    const items = readSvrnIndex().filter(issue => !q || [issue.title, issue.author, issue.description, ...(issue.tags || [])].join(' ').toLowerCase().includes(q))
    res.json({ items: items.slice(0, 100) })
})

app.get('/svrn/v1/catalog', (req, res) => {
    const catalog = readSvrnIndex().map(({ id, title, author, description, tags, publishedAt, size, sha256 }) =>
        ({ id, title, author, description, tags, publishedAt, size, sha256, packageUrl: `/svrn/v1/issues/${encodeURIComponent(id)}/package`, viewUrl: `/svrn/v1/issues/${encodeURIComponent(id)}/view` }));
    const etag = svrnEtag(JSON.stringify(catalog));
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res.set('ETag', etag).json({ items: catalog });
});

app.get('/svrn/v1/feed', (req, res) => {
    const all = readSvrnIndex().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    const start = Math.max(0, Number.parseInt(req.query.cursor || '0', 10) || 0);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || '25', 10) || 25));
    const items = all.slice(start, start + limit).map(({ id, title, author, description, tags, publishedAt, sha256 }) => ({ id, title, author, description, tags, publishedAt, sha256 }));
    const response = { items, nextCursor: start + limit < all.length ? String(start + limit) : null };
    const etag = svrnEtag(JSON.stringify(response));
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res.set('ETag', etag).json(response);
});

app.post('/svrn/v1/issues', authenticateToken, express.raw({ type: ['application/vnd.svrn+zip', 'application/zip'], limit: '100mb' }), (req, res) => {
    try {
        if (!req.body?.length) return res.status(400).json({ error: 'A .svrn archive is required' });
        const entries = unzipSync(new Uint8Array(req.body));
        if (!entries['manifest.json'] || !entries['content/zine.json']) return res.status(400).json({ error: 'Invalid .svrn archive' });
        const manifest = JSON.parse(strFromU8(entries['manifest.json']));
        if (manifest.formatVersion !== '1.0.0') return res.status(422).json({ error: `Unsupported SVRN format ${manifest.formatVersion}` });
        for (const [entry, expectedHash] of Object.entries(manifest.hashes || {})) {
            if (!entries[entry]) return res.status(422).json({ error: `Package is missing ${entry}` });
            const actualHash = crypto.createHash('sha256').update(entries[entry]).digest('hex');
            if (actualHash !== expectedHash) return res.status(422).json({ error: `Package integrity check failed for ${entry}` });
        }
        const issueId = String(manifest.issue?.id || crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, '_');
        const file = path.join(SVRN_STORE, `${issueId}.svrn`);
        fs.writeFileSync(file, req.body);
        const index = readSvrnIndex().filter(issue => issue.id !== issueId);
        index.push({ id: issueId, title: manifest.issue?.title || 'Untitled Zine', author: manifest.issue?.author || req.user.username,
            description: manifest.issue?.description || '', tags: manifest.issue?.tags || [], publishedAt: new Date().toISOString(),
            size: req.body.length, sha256: crypto.createHash('sha256').update(req.body).digest('hex'), ownerId: req.user.id });
        writeSvrnIndex(index);
        res.status(201).json({ id: issueId, packageUrl: `/svrn/v1/issues/${issueId}/package` });
    } catch (error) { res.status(400).json({ error: `Could not publish .svrn: ${error.message}` }); }
});

app.get('/svrn/v1/issues/:id', (req, res) => {
    const issue = readSvrnIndex().find(item => item.id === req.params.id);
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    res.json(issue);
});

app.get('/svrn/v1/issues/:id/package', (req, res) => {
    const issue = readSvrnIndex().find(item => item.id === req.params.id);
    const file = path.join(SVRN_STORE, `${req.params.id}.svrn`);
    if (!issue || !fs.existsSync(file)) return res.status(404).json({ error: 'Issue not found' });
    const etag = `\"${issue.sha256}\"`;
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res.set({ 'Content-Type': 'application/vnd.svrn+zip', 'Content-Disposition': `inline; filename=\"${issue.id}.svrn\"`, ETag: etag });
    fs.createReadStream(file).pipe(res);
});

app.get('/svrn/v1/issues/:id/view', (req, res) => {
    const issue = readSvrnIndex().find(item => item.id === req.params.id);
    if (!issue) return res.status(404).send('Issue not found');
    const packageUrl = `/svrn/v1/issues/${encodeURIComponent(issue.id)}/package`;
    res.type('html').send(`<!doctype html><meta charset=\"utf-8\"><title>${String(issue.title).replace(/</g, '&lt;')}</title><body style=\"font-family:system-ui;max-width:42rem;margin:4rem auto\"><h1>${String(issue.title).replace(/</g, '&lt;')}</h1><p>${String(issue.description || '').replace(/</g, '&lt;')}</p><p>Open this issue in an SVRN Reader, or <a href=\"${packageUrl}\">download the .svrn package</a>.</p></body>`);
});

// API Routes

// Federated profile and node subscription APIs
app.get('/api/profile/:username', async (req, res) => {
    const profile = await db('users').select('id', 'username', 'display_name', 'bio', 'avatar_url', 'profile_url', 'created_at').where({ username: req.params.username }).first()
    if (!profile) return res.status(404).json({ error: 'Profile not found' })
    res.json(profile)
})

app.get('/api/profile', authenticateToken, async (req, res) => {
    const profile = await db('users').select('id', 'username', 'email', 'display_name', 'bio', 'avatar_url', 'profile_url', 'created_at').where({ id: req.user.id }).first()
    res.json(profile)
})

app.put('/api/profile', authenticateToken, async (req, res) => {
    const { display_name, bio, avatar_url, profile_url } = req.body
    await db('users').where({ id: req.user.id }).update({ display_name, bio, avatar_url, profile_url })
    res.json(await db('users').select('id', 'username', 'email', 'display_name', 'bio', 'avatar_url', 'profile_url', 'created_at').where({ id: req.user.id }).first())
})

app.get('/api/search', async (req, res) => {
    const q = String(req.query.q || '').trim()
    if (!q) return res.json({ items: [] })
    const items = await db('zines').where({ is_published: 1 }).andWhere(builder => builder.where('title', 'like', `%${q}%`).orWhere('author_name', 'like', `%${q}%`).orWhere('tags', 'like', `%${q}%`)).orderBy('published_at', 'desc').limit(50)
    res.json({ items })
})

app.get('/api/node-subscriptions', authenticateToken, async (req, res) => {
    const rows = await db('node_subscriptions').where({ user_id: req.user.id })
    res.json(rows.map(row => ({ ...row, credentials: row.credentials_json ? JSON.parse(row.credentials_json) : null })))
})

app.post('/api/node-subscriptions', authenticateToken, async (req, res) => {
    const { node_url, node_name, credentials } = req.body
    if (!node_url) return res.status(400).json({ error: 'node_url is required' })
    await db('node_subscriptions').insert({ user_id: req.user.id, node_url: node_url.replace(/\/$/, ''), node_name: node_name || null, credentials_json: credentials ? JSON.stringify(credentials) : null }).onConflict(['user_id', 'node_url']).merge()
    res.status(201).json({ status: 'subscribed' })
})

app.delete('/api/node-subscriptions/:id', authenticateToken, async (req, res) => {
    await db('node_subscriptions').where({ id: req.params.id, user_id: req.user.id }).del()
    res.json({ status: 'unsubscribed' })
})

// Register
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [userId] = await db('users').insert({
            username,
            email,
            password_hash: hashedPassword
        });

        const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
        res.json({ token, user: { id: userId, username, is_premium: 0 } });
    } catch (err) {
        res.status(400).json({ error: 'User already exists or registration failed' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await db('users').where({ email }).first();
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
        res.json({ token, user: { id: user.id, username: user.username, is_premium: user.is_premium } });
    } catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// Sync / Save Zine
app.post('/api/zines', authenticateToken, async (req, res) => {
    const { title, data, serverId } = req.body;

    try {
        if (serverId) {
            await db('zines')
                .where({ id: serverId, user_id: req.user.id })
                .update({
                    title,
                    data: JSON.stringify(data),
                    updated_at: db.fn.now()
                });
            res.json({ id: serverId, status: 'updated' });
        } else {
            const [id] = await db('zines').insert({
                user_id: req.user.id,
                title,
                data: JSON.stringify(data)
            });
            res.json({ id, status: 'created' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get User Zines
app.get('/api/zines', authenticateToken, async (req, res) => {
    try {
        const rows = await db('zines')
            .select('id', 'title', 'updated_at', 'is_published', 'read_count', 'genre', 'tags')
            .where({ user_id: req.user.id })
            .orderBy('updated_at', 'desc');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// List Published Zines (Public)
app.get('/api/published', async (req, res) => {
    const { q, genre } = req.query;
    try {
        let query = db('zines').where({ is_published: 1 });

        if (genre) {
            query = query.where({ genre });
        }
        if (q) {
            query = query.where((builder) => {
                builder.where('title', 'like', `%${q}%`)
                    .orWhere('author_name', 'like', `%${q}%`)
                    .orWhere('tags', 'like', `%${q}%`);
            });
        }

        const rows = await query.orderBy('published_at', 'desc').limit(50);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Publish Zine
app.post('/api/publish/:id', authenticateToken, async (req, res) => {
    const { author_name, genre, tags } = req.body;
    try {
        const changes = await db('zines')
            .where({ id: req.params.id, user_id: req.user.id })
            .update({
                is_published: 1,
                published_at: db.fn.now(),
                author_name,
                genre,
                tags
            });
        if (changes === 0) return res.status(404).json({ error: 'Zine not found or not owned' });
        res.json({ status: 'published' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Single Zine (for Reader)
app.get('/api/zines/:id', async (req, res) => {
    try {
        const zine = await db('zines').where({ id: req.params.id }).first();
        if (!zine) return res.status(404).json({ error: 'Not found' });

        const isFunded = zine.funding_goal > 0 && zine.amount_raised >= zine.funding_goal;

        const applyAccessControl = async (zine, user) => {
            // DEBUG: Log access check details
            console.log('Access check:', {
                zineId: zine.id,
                zineUserId: zine.user_id,
                zineMonetization: zine.monetization_type,
                zineAccessLevel: zine.access_level,
                requestUserId: user?.id,
                requestUserType: user?.id ? typeof user.id : 'none'
            });

            // 1. FREE CONTENT: Always accessible to everyone (logged in or not)
            if (zine.monetization_type === 'free' || zine.access_level === 'public') {
                console.log('Access granted: free/public content');
                return { ...zine, data: JSON.parse(zine.data) };
            }

            // 2. FUNDED CROWDFUND: Free for everyone once funded
            if (zine.monetization_type === 'crowdfund' && isFunded) {
                console.log('Access granted: crowdfunded content is funded');
                return { ...zine, data: JSON.parse(zine.data) };
            }

            // 3. AUTHOR: Always has full access
            // Fix: Ensure type-safe comparison (convert both to numbers)
            const isAuthor = user && Number(zine.user_id) === Number(user.id);
            if (isAuthor) {
                console.log('Access granted: user is author');
                return { ...zine, data: JSON.parse(zine.data) };
            }

            // 4. CHECK IF USER HAS PAID/CONTRIBUTED
            let hasPaid = false;
            if (user) {
                const contribution = await db('contributions')
                    .where({ user_id: user.id, zine_id: zine.id })
                    .first();
                if (contribution) {
                    hasPaid = true;
                    console.log('Access granted: user has contribution');
                }
            }

            const canReadFully = hasPaid;

            if (canReadFully) {
                return { ...zine, data: JSON.parse(zine.data) };
            } else {
                // Preview: only first page
                const zineData = JSON.parse(zine.data);
                const firstPage = zineData.pages.length > 0 ? [zineData.pages[0]] : [];
                return {
                    ...zine,
                    data: { pages: firstPage },
                    locked: true,
                    preview: true,
                    reason: zine.monetization_type === 'crowdfund' ? 'funding_required' : 'payment_required'
                };
            }
        };

        if (zine.is_published) {
            // Increment read count async
            db('zines').where({ id: req.params.id }).increment('read_count', 1).catch(() => { });

            const token = req.headers['authorization']?.split(' ')[1];
            if (!token) {
                return res.json(await applyAccessControl(zine, null));
            }

            jwt.verify(token, JWT_SECRET, async (err, user) => {
                if (err) {
                    return res.json(await applyAccessControl(zine, null));
                }
                return res.json(await applyAccessControl(zine, user));
            });
        } else {
            // Check auth for private zines
            const token = req.headers['authorization']?.split(' ')[1];
            if (!token) return res.status(403).json({ error: 'Private zine' });

            jwt.verify(token, JWT_SECRET, (err, user) => {
                if (err || user.id !== zine.user_id) return res.status(403).json({ error: 'Forbidden' });
                res.json({ ...zine, data: JSON.parse(zine.data) });
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// MCP Interface for programmatic zine manipulation and automation
app.get('/mcp/zines/:id', authenticateToken, async (req, res) => {
    try {
        const zine = await db('zines').where({ id: req.params.id, user_id: req.user.id }).first();
        if (!zine) return res.status(404).json({ error: 'Zine not found' });
        res.json({ ...zine, data: JSON.parse(zine.data) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/mcp/zines/:id', authenticateToken, async (req, res) => {
    const { title, data } = req.body;
    try {
        const updated = await db('zines')
            .where({ id: req.params.id, user_id: req.user.id })
            .update({
                title,
                data: JSON.stringify(data),
                updated_at: db.fn.now()
            });
        if (updated === 0) return res.status(404).json({ error: 'Zine not found' });
        res.json({ status: 'updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/mcp/zines/:id/pages', authenticateToken, async (req, res) => {
    try {
        const zine = await db('zines').where({ id: req.params.id, user_id: req.user.id }).first();
        if (!zine) return res.status(404).json({ error: 'Zine not found' });
        const data = JSON.parse(zine.data);
        const newPage = { id: Date.now(), elements: [], background: '#ffffff', texture: null };
        data.pages.push(newPage);
        await db('zines')
            .where({ id: req.params.id })
            .update({
                data: JSON.stringify(data),
                updated_at: db.fn.now()
            });
        res.json({ pageId: newPage.id, pageIdx: data.pages.length - 1 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/mcp/zines/:id/pages/:pageIdx', authenticateToken, async (req, res) => {
    const { background, texture } = req.body;
    try {
        const zine = await db('zines').where({ id: req.params.id, user_id: req.user.id }).first();
        if (!zine) return res.status(404).json({ error: 'Zine not found' });
        const data = JSON.parse(zine.data);
        const pageIdx = parseInt(req.params.pageIdx);
        if (!data.pages[pageIdx]) return res.status(404).json({ error: 'Page not found' });
        if (background !== undefined) data.pages[pageIdx].background = background;
        if (texture !== undefined) data.pages[pageIdx].texture = texture;
        await db('zines')
            .where({ id: req.params.id })
            .update({
                data: JSON.stringify(data),
                updated_at: db.fn.now()
            });
        res.json({ status: 'updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/mcp/zines/:id/pages/:pageIdx', authenticateToken, async (req, res) => {
    try {
        const zine = await db('zines').where({ id: req.params.id, user_id: req.user.id }).first();
        if (!zine) return res.status(404).json({ error: 'Zine not found' });
        const data = JSON.parse(zine.data);
        const pageIdx = parseInt(req.params.pageIdx);
        if (data.pages.length <= 1) return res.status(400).json({ error: 'Cannot delete last page' });
        if (!data.pages[pageIdx]) return res.status(404).json({ error: 'Page not found' });
        data.pages.splice(pageIdx, 1);
        await db('zines')
            .where({ id: req.params.id })
            .update({
                data: JSON.stringify(data),
                updated_at: db.fn.now()
            });
        res.json({ status: 'deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/mcp/zines/:id/pages/:pageIdx/elements', authenticateToken, async (req, res) => {
    const { element } = req.body;
    try {
        const zine = await db('zines').where({ id: req.params.id, user_id: req.user.id }).first();
        if (!zine) return res.status(404).json({ error: 'Zine not found' });
        const data = JSON.parse(zine.data);
        const pageIdx = parseInt(req.params.pageIdx);
        if (!data.pages[pageIdx]) return res.status(404).json({ error: 'Page not found' });
        const el = { ...element, id: 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9), zIndex: data.pages[pageIdx].elements.length };
        data.pages[pageIdx].elements.push(el);
        await db('zines')
            .where({ id: req.params.id })
            .update({
                data: JSON.stringify(data),
                updated_at: db.fn.now()
            });
        res.json({ elementId: el.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/mcp/zines/:id/pages/:pageIdx/elements/:elementId', authenticateToken, async (req, res) => {
    const updates = req.body;
    try {
        const zine = await db('zines').where({ id: req.params.id, user_id: req.user.id }).first();
        if (!zine) return res.status(404).json({ error: 'Zine not found' });
        const data = JSON.parse(zine.data);
        const pageIdx = parseInt(req.params.pageIdx);
        const el = data.pages[pageIdx]?.elements.find(e => e.id === req.params.elementId);
        if (!el) return res.status(404).json({ error: 'Element not found' });
        Object.assign(el, updates);
        await db('zines')
            .where({ id: req.params.id })
            .update({
                data: JSON.stringify(data),
                updated_at: db.fn.now()
            });
        res.json({ status: 'updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/mcp/zines/:id/pages/:pageIdx/elements/:elementId', authenticateToken, async (req, res) => {
    try {
        const zine = await db('zines').where({ id: req.params.id, user_id: req.user.id }).first();
        if (!zine) return res.status(404).json({ error: 'Zine not found' });
        const data = JSON.parse(zine.data);
        const pageIdx = parseInt(req.params.pageIdx);
        const elements = data.pages[pageIdx]?.elements;
        if (!elements) return res.status(404).json({ error: 'Page not found' });
        const idx = elements.findIndex(e => e.id === req.params.elementId);
        if (idx === -1) return res.status(404).json({ error: 'Element not found' });
        elements.splice(idx, 1);
        await db('zines')
            .where({ id: req.params.id })
            .update({
                data: JSON.stringify(data),
                updated_at: db.fn.now()
            });
        res.json({ status: 'deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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
    const pages = [{ id: Date.now(), elements: [], background: '#ffffff', texture: null }];
    const [zineId] = await db('zines').insert({
        user_id: userId,
        title: args.title,
        data: JSON.stringify(pages)
    });
    return { zineId, message: 'Zine created successfully' };
}

async function handleGetZine(userId, zineId) {
    const zine = await db('zines').where({ id: zineId, user_id: userId }).first();
    if (!zine) throw new Error('Zine not found');
    return { ...zine, data: JSON.parse(zine.data) };
}

async function handleAddPage(userId, args) {
    const zine = await db('zines').where({ id: args.zineId, user_id: userId }).first();
    if (!zine) throw new Error('Zine not found');
    const data = JSON.parse(zine.data);
    const newPage = {
        id: Date.now(),
        elements: [],
        background: args.background || '#ffffff',
        texture: args.texture || null
    };
    data.pages.push(newPage);
    await db('zines').where({ id: args.zineId }).update({ data: JSON.stringify(data) });
    return { pageId: newPage.id, pageIdx: data.pages.length - 1 };
}

async function handleAddTextElement(userId, args) {
    const zine = await db('zines').where({ id: args.zineId, user_id: userId }).first();
    if (!zine) throw new Error('Zine not found');
    const data = JSON.parse(zine.data);
    if (!data.pages[args.pageIdx]) throw new Error('Page not found');
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
    await db('zines').where({ id: args.zineId }).update({ data: JSON.stringify(data) });
    return { elementId: element.id };
}

async function handleAddImageElement(userId, args) {
    const zine = await db('zines').where({ id: args.zineId, user_id: userId }).first();
    if (!zine) throw new Error('Zine not found');
    const data = JSON.parse(zine.data);
    if (!data.pages[args.pageIdx]) throw new Error('Page not found');
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
    await db('zines').where({ id: args.zineId }).update({ data: JSON.stringify(data) });
    return { elementId: element.id };
}

async function handleAddPanelElement(userId, args) {
    const zine = await db('zines').where({ id: args.zineId, user_id: userId }).first();
    if (!zine) throw new Error('Zine not found');
    const data = JSON.parse(zine.data);
    if (!data.pages[args.pageIdx]) throw new Error('Page not found');
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
    await db('zines').where({ id: args.zineId }).update({ data: JSON.stringify(data) });
    return { elementId: element.id };
}

async function handleAddBalloonElement(userId, args) {
    const zine = await db('zines').where({ id: args.zineId, user_id: userId }).first();
    if (!zine) throw new Error('Zine not found');
    const data = JSON.parse(zine.data);
    if (!data.pages[args.pageIdx]) throw new Error('Page not found');
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
    await db('zines').where({ id: args.zineId }).update({ data: JSON.stringify(data) });
    return { elementId: element.id };
}

async function handleUpdateElement(userId, args) {
    const zine = await db('zines').where({ id: args.zineId, user_id: userId }).first();
    if (!zine) throw new Error('Zine not found');
    const data = JSON.parse(zine.data);
    const el = data.pages[args.pageIdx]?.elements.find(e => e.id === args.elementId);
    if (!el) throw new Error('Element not found');
    Object.assign(el, args.updates);
    await db('zines').where({ id: args.zineId }).update({ data: JSON.stringify(data) });
    return { status: 'updated' };
}

async function handleApplyTheme(userId, args) {
    const zine = await db('zines').where({ id: args.zineId, user_id: userId }).first();
    if (!zine) throw new Error('Zine not found');
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

    await db('zines').where({ id: args.zineId }).update({ data: JSON.stringify(data) });
    return { status: 'theme applied' };
}

async function handleApplyTemplate(userId, args) {
    const zine = await db('zines').where({ id: args.zineId, user_id: userId }).first();
    if (!zine) throw new Error('Zine not found');
    const data = JSON.parse(zine.data);
    if (!data.pages[args.pageIdx]) throw new Error('Page not found');

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
    if (!template) throw new Error('Template not found');

    data.pages[args.pageIdx].background = template.background;
    data.pages[args.pageIdx].elements = template.elements.map(el => ({
        ...el,
        id: 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        zIndex: 0
    }));

    await db('zines').where({ id: args.zineId }).update({ data: JSON.stringify(data) });
    return { status: 'template applied' };
}

async function handleExportHTML(userId, zineId) {
    const zine = await db('zines').where({ id: zineId, user_id: userId }).first();
    if (!zine) throw new Error('Zine not found');
    const project = { title: zine.title, pages: JSON.parse(zine.data) };

    // Basic HTML export - in full implementation, use the client-side exportToHTML logic
    let html = `<!DOCTYPE html><html><head><title>${project.title}</title></head><body>`;
    project.pages.forEach((p, i) => {
        html += `<div>Page ${i + 1}</div>`;
    });
    html += `</body></html>`;

    return { html };
}

async function handlePublishZine(userId, args) {
    const changes = await db('zines')
        .where({ id: args.zineId, user_id: userId })
        .update({
            is_published: 1,
            published_at: db.fn.now(),
            author_name: args.author || 'Anonymous',
            genre: args.genre || 'classic',
            tags: args.tags || ''
        });
    if (changes === 0) throw new Error('Zine not found');
    return { status: 'published' };
}

async function handleDeletePage(userId, args) {
    const zine = await db('zines').where({ id: args.zineId, user_id: userId }).first();
    if (!zine) throw new Error('Zine not found');
    const data = JSON.parse(zine.data);
    const pageIdx = parseInt(args.pageIdx);
    if (data.pages.length <= 1) throw new Error('Cannot delete last page');
    if (!data.pages[pageIdx]) throw new Error('Page not found');
    data.pages.splice(pageIdx, 1);
    await db('zines').where({ id: args.zineId }).update({
        data: JSON.stringify(data),
        updated_at: db.fn.now()
    });
    return { status: 'deleted' };
}

async function handleDuplicatePage(userId, args) {
    const zine = await db('zines').where({ id: args.zineId, user_id: userId }).first();
    if (!zine) throw new Error('Zine not found');
    const data = JSON.parse(zine.data);
    const pageIdx = parseInt(args.pageIdx);
    if (!data.pages[pageIdx]) throw new Error('Page not found');
    const newPage = JSON.parse(JSON.stringify(data.pages[pageIdx]));
    newPage.id = Date.now();
    if (newPage.elements) newPage.elements.forEach(e => { e.id = 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) });
    data.pages.splice(pageIdx + 1, 0, newPage);
    await db('zines').where({ id: args.zineId }).update({
        data: JSON.stringify(data),
        updated_at: db.fn.now()
    });
    return { pageId: newPage.id, pageIdx: pageIdx + 1 };
}

async function handleAddShapeElement(userId, args) {
    const zine = await db('zines').where({ id: args.zineId, user_id: userId }).first();
    if (!zine) throw new Error('Zine not found');
    const data = JSON.parse(zine.data);
    if (!data.pages[args.pageIdx]) throw new Error('Page not found');
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
    await db('zines').where({ id: args.zineId }).update({ data: JSON.stringify(data) });
    return { elementId: element.id };
}

async function handleAddSFXElement(userId, args) {
    const zine = await db('zines').where({ id: args.zineId, user_id: userId }).first();
    if (!zine) throw new Error('Zine not found');
    const data = JSON.parse(zine.data);
    if (!data.pages[args.pageIdx]) throw new Error('Page not found');
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
    await db('zines').where({ id: args.zineId }).update({ data: JSON.stringify(data) });
    return { elementId: element.id };
}

async function handleAddSymbolElement(userId, args) {
    const zine = await db('zines').where({ id: args.zineId, user_id: userId }).first();
    if (!zine) throw new Error('Zine not found');
    const data = JSON.parse(zine.data);
    if (!data.pages[args.pageIdx]) throw new Error('Page not found');
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
    await db('zines').where({ id: args.zineId }).update({ data: JSON.stringify(data) });
    return { elementId: element.id };
}

async function handleAddShaderElement(userId, args) {
    const zine = await db('zines').where({ id: args.zineId, user_id: userId }).first();
    if (!zine) throw new Error('Zine not found');
    const data = JSON.parse(zine.data);
    if (!data.pages[args.pageIdx]) throw new Error('Page not found');
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
    await db('zines').where({ id: args.zineId }).update({ data: JSON.stringify(data) });
    return { elementId: element.id };
}

async function handleDeleteElement(userId, args) {
    const zine = await db('zines').where({ id: args.zineId, user_id: userId }).first();
    if (!zine) throw new Error('Zine not found');
    const data = JSON.parse(zine.data);
    const pageIdx = parseInt(args.pageIdx);
    const elements = data.pages[pageIdx]?.elements;
    if (!elements) throw new Error('Page not found');
    const idx = elements.findIndex(e => e.id === args.elementId);
    if (idx === -1) throw new Error('Element not found');
    elements.splice(idx, 1);
    await db('zines').where({ id: args.zineId }).update({
        data: JSON.stringify(data),
        updated_at: db.fn.now()
    });
    return { status: 'deleted' };
}

async function handleDuplicateElement(userId, args) {
    const zine = await db('zines').where({ id: args.zineId, user_id: userId }).first();
    if (!zine) throw new Error('Zine not found');
    const data = JSON.parse(zine.data);
    const pageIdx = parseInt(args.pageIdx);
    const el = data.pages[pageIdx]?.elements.find(e => e.id === args.elementId);
    if (!el) throw new Error('Element not found');
    const newEl = JSON.parse(JSON.stringify(el));
    newEl.id = 'el_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    newEl.x += 20;
    newEl.y += 20;
    data.pages[pageIdx].elements.push(newEl);
    await db('zines').where({ id: args.zineId }).update({
        data: JSON.stringify(data),
        updated_at: db.fn.now()
    });
    return { elementId: newEl.id };
}

async function handleMoveLayer(userId, args) {
    const zine = await db('zines').where({ id: args.zineId, user_id: userId }).first();
    if (!zine) throw new Error('Zine not found');
    const data = JSON.parse(zine.data);
    const pageIdx = parseInt(args.pageIdx);
    const elements = data.pages[pageIdx]?.elements;
    if (!elements) throw new Error('Page not found');
    const idx = elements.findIndex(e => e.id === args.elementId);
    if (idx === -1) throw new Error('Element not found');

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
    await db('zines').where({ id: args.zineId }).update({
        data: JSON.stringify(data),
        updated_at: db.fn.now()
    });
    return { status: 'moved' };
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
app.post('/api/credits/purchase', authenticateToken, async (req, res) => {
    const { amount, paymentMethod } = req.body;
    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
    }

    try {
        // In production, this would integrate with a payment processor (Stripe, etc.)
        // For now, we simulate the purchase
        const creditRow = await db('credits').where({ user_id: req.user.id }).first();

        if (creditRow) {
            await db('credits')
                .where({ user_id: req.user.id })
                .update({
                    balance: creditRow.balance + amount,
                    total_spent: creditRow.total_spent + amount,
                    updated_at: db.fn.now()
                });

            // Record transaction
            await db('transactions').insert({
                from_user_id: req.user.id,
                to_user_id: null,
                amount: amount,
                type: 'credit_purchase',
                description: `Purchased ${amount} credits via ${paymentMethod || 'simulated'}`
            });

            res.json({ success: true, newBalance: creditRow.balance + amount, amount });
        } else {
            await db('credits').insert({
                user_id: req.user.id,
                balance: amount,
                total_spent: amount
            });

            // Record transaction
            await db('transactions').insert({
                from_user_id: req.user.id,
                to_user_id: null,
                amount: amount,
                type: 'credit_purchase',
                description: `Purchased ${amount} credits via ${paymentMethod || 'simulated'}`
            });

            res.json({ success: true, newBalance: amount, amount });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get credit balance
app.get('/api/credits/balance', authenticateToken, async (req, res) => {
    try {
        const row = await db('credits').where({ user_id: req.user.id }).first();
        res.json({ balance: row ? row.balance : 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---- Wallet API ----

// Helper to get or create wallet
const getOrCreateWallet = async (userId, providedAddress, providedPayId) => {
    try {
        const existing = await db('wallets').where({ user_id: userId }).first();

        if (existing) {
            return existing;
        }

        // Create new wallet if not exists
        // If address provided, use it (non-custodial view), else generate (custodial)
        const walletData = providedAddress ? { address: providedAddress, seed: null } : await xrpService.createWallet();
        const encryptedSecret = walletData.seed ? encrypt(walletData.seed) : null;

        await db('wallets').insert({
            user_id: userId,
            xrp_address: walletData.address,
            xrp_secret_encrypted: encryptedSecret,
            payid: providedPayId || null,
            is_verified: 1
        });

        return { xrp_address: walletData.address, xrp_secret_encrypted: walletData.seed };
    } catch (e) {
        throw e;
    }
};

// Create new XRP wallet for user
app.post('/api/wallet/create', authenticateToken, async (req, res) => {
    const { xrpAddress, payid } = req.body;

    try {
        const wallet = await getOrCreateWallet(req.user.id, xrpAddress, payid);
        res.json({ success: true, xrpAddress: wallet.xrp_address, payid: wallet.payid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get user's wallet info
app.get('/api/wallet', authenticateToken, async (req, res) => {
    try {
        const wallet = await db('wallets').where({ user_id: req.user.id }).first();
        res.json(wallet || { xrp_address: null, payid: null, is_verified: false });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ---- Tokens API ----

// Create new token (creator issues their own currency)
app.post('/api/tokens/create', authenticateToken, async (req, res) => {
    const { tokenCode, tokenName, description, iconUrl, initialSupply, pricePerToken } = req.body;

    if (!tokenCode || !tokenName) {
        return res.status(400).json({ error: 'Token code and name required' });
    }

    // Generate XRPL-compatible currency code (max 20 chars, uppercase)
    const xrpCurrencyCode = tokenCode.length === 3 ? tokenCode.toUpperCase() : Buffer.from(tokenCode).toString('hex').padEnd(40, '0').toUpperCase();

    try {
        const [tokenId] = await db('tokens').insert({
            creator_id: req.user.id,
            token_code: tokenCode.toUpperCase(),
            token_name: tokenName,
            description: description || '',
            icon_url: iconUrl || null,
            initial_supply: initialSupply || 1000000,
            current_supply: initialSupply || 1000000,
            price_per_token: pricePerToken || 0.01,
            xrp_currency_code: xrpCurrencyCode
        });

        // Initialize reputation for creator
        await db('reputation')
            .insert({ user_id: req.user.id, score: 0, level: 'creator' })
            .onConflict('user_id')
            .ignore();

        res.json({ success: true, tokenId, tokenCode: xrpCurrencyCode, tokenName });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all active tokens (marketplace)
app.get('/api/tokens', async (req, res) => {
    const { creatorId } = req.query;
    try {
        let query = db('tokens as t')
            .join('users as u', 't.creator_id', 'u.id')
            .select('t.*', 'u.username as creator_name')
            .where('t.is_active', 1);

        if (creatorId) {
            query = query.where('t.creator_id', creatorId);
        }

        const rows = await query.orderBy('t.created_at', 'desc');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get specific token
app.get('/api/tokens/:id', async (req, res) => {
    try {
        const token = await db('tokens as t')
            .join('users as u', 't.creator_id', 'u.id')
            .select('t.*', 'u.username as creator_name')
            .where('t.id', req.params.id)
            .first();

        if (!token) return res.status(404).json({ error: 'Token not found' });
        res.json(token);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Buy tokens with credits
app.post('/api/tokens/:id/buy', authenticateToken, async (req, res) => {
    const { amount } = req.body;
    const tokenId = req.params.id;

    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    try {
        const token = await db('tokens').where({ id: tokenId, is_active: 1 }).first();
        if (!token) return res.status(404).json({ error: 'Token not found' });

        const totalCost = amount * token.price_per_token;
        const creditRow = await db('credits').where({ user_id: req.user.id }).first();
        const currentBalance = creditRow ? creditRow.balance : 0;

        if (currentBalance < totalCost) {
            return res.status(400).json({ error: 'Insufficient credits', required: totalCost, available: currentBalance });
        }

        const vpcResult = await economyService.transferCredits(req.user.id, token.creator_id, totalCost, db);
        const buyerWallet = await db('wallets').where({ user_id: req.user.id }).first();
        if (!buyerWallet) return res.status(500).json({ error: 'Wallet error after payment' });

        const tokenTx = await economyService.issueCreatorTokenToBuyer(token.creator_id, buyerWallet.xrp_address, token.token_code, amount, db);

        // Update DB state
        await db.transaction(async trx => {
            await trx('credits').where({ user_id: req.user.id }).decrement('balance', totalCost);
            await trx('credits')
                .insert({ user_id: token.creator_id, balance: totalCost })
                .onConflict('user_id')
                .merge({ balance: db.raw('credits.balance + ?', [totalCost]) });
            await trx('tokens').where({ id: tokenId }).decrement('current_supply', amount);
            await trx('transactions').insert({
                from_user_id: req.user.id,
                to_user_id: token.creator_id,
                token_id: tokenId,
                amount,
                type: 'token_purchase',
                description: `Bought ${amount} ${token.token_name}`,
                xrp_tx_hash: tokenTx.txHash
            });
        });

        res.json({ success: true, amount, totalCost, tokenName: token.token_name, txHash: tokenTx.txHash });
    } catch (err) {
        console.error('Token buy failed:', err);
        res.status(500).json({ error: err.message });
    }
});

// Purchase Zine with Tokens (Instant Unlock)
app.post('/api/zines/:id/purchase', authenticateToken, async (req, res) => {
    const zineId = req.params.id;

    try {
        const zine = await db('zines as z')
            .leftJoin('tokens as t', function () {
                this.on('z.token_price', '>', 0).andOn('t.creator_id', '=', 'z.user_id');
            })
            .leftJoin('wallets as w', 'z.user_id', 'w.user_id')
            .select('z.*', 't.token_code', 't.xrp_currency_code', 'w.xrp_address as creator_address')
            .where('z.id', zineId)
            .first();

        if (!zine) return res.status(404).json({ error: 'Zine not found' });
        if (!zine.is_token_gated || zine.token_price <= 0) return res.status(400).json({ error: 'Zine is free' });
        if (!zine.xrp_currency_code) return res.status(400).json({ error: 'Creator has no active token' });

        const wallet = await db('wallets').where({ user_id: req.user.id }).first();
        if (!wallet) return res.status(404).json({ error: 'User wallet not found' });

        const decryptedSecret = decrypt(wallet.xrp_secret_encrypted);
        const txHash = await xrpService.sendPayment(
            decryptedSecret,
            zine.creator_address,
            zine.token_price,
            zine.xrp_currency_code,
            zine.creator_address
        );

        if (!txHash) throw new Error('Payment failed on ledger');

        await db('bids').insert({
            bidder_id: req.user.id,
            zine_id: zineId,
            amount: zine.token_price,
            message: 'Instant Purchase via Token',
            status: 'accepted'
        });

        res.json({ success: true, txHash, message: 'Zine purchased successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Purchase failed: ' + error.message });
    }
});

// ---- Trust Lines API ----

// Create trust line record
app.post('/api/trustlines', authenticateToken, async (req, res) => {
    const { tokenId, limit } = req.body;
    if (!tokenId) return res.status(400).json({ error: 'Token ID required' });

    try {
        const existing = await db('trust_lines')
            .where({ user_id: req.user.id, token_id: tokenId, is_active: 1 })
            .first();

        if (existing) return res.status(400).json({ error: 'Trust line already exists' });

        const tokenInfo = await db('tokens as t')
            .join('wallets as w', 't.creator_id', 'w.user_id')
            .select('t.xrp_currency_code', 'w.xrp_address as issuer_address')
            .where('t.id', tokenId)
            .first();

        if (!tokenInfo) return res.status(404).json({ error: 'Token info not found' });

        const wallet = await db('wallets').where({ user_id: req.user.id }).first();
        if (!wallet) return res.status(404).json({ error: 'User wallet not found' });

        const decryptedSecret = decrypt(wallet.xrp_secret_encrypted);
        const result = await economyService.establishTrustLine(decryptedSecret, tokenInfo.issuer_address, tokenInfo.xrp_currency_code, limit);

        if (!result.success) return res.status(500).json({ error: 'XRPL TrustSet failed: ' + result.error });

        const [id] = await db('trust_lines').insert({
            user_id: req.user.id,
            token_id: tokenId,
            trust_line_limit: limit || 1000000,
            xrpl_trustline_hash: 'confirmed_on_ledger'
        });

        res.json({ success: true, trustLineId: id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get user's trust lines
app.get('/api/trustlines', authenticateToken, async (req, res) => {
    try {
        const rows = await db('trust_lines as tl')
            .join('tokens as t', 'tl.token_id', 't.id')
            .select('tl.*', 't.token_code', 't.token_name')
            .where({ 'tl.user_id': req.user.id, 'tl.is_active': 1 });
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---- Subscriptions API ----

// Subscribe to creator
app.post('/api/subscriptions/subscribe', authenticateToken, async (req, res) => {
    const { creatorId, tokenId, amountPerPeriod, periodDays } = req.body;
    if (!creatorId || !tokenId) return res.status(400).json({ error: 'Creator ID and Token ID required' });
    if (creatorId === req.user.id) return res.status(400).json({ error: 'Cannot subscribe to yourself' });

    const amount = amountPerPeriod || 10;
    const period = periodDays || 30;

    try {
        const creditRow = await db('credits').where({ user_id: req.user.id }).first();
        const currentBalance = creditRow ? creditRow.balance : 0;
        if (currentBalance < amount) {
            return res.status(400).json({ error: 'Insufficient credits', required: amount, available: currentBalance });
        }

        const creator = await db('users').where({ id: creatorId }).select('id', 'username').first();
        if (!creator) return res.status(404).json({ error: 'Creator not found' });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + period);

        const existing = await db('subscriptions')
            .where({ subscriber_id: req.user.id, creator_id: creatorId, is_active: 1 })
            .first();

        await db.transaction(async trx => {
            await trx('credits').where({ user_id: req.user.id }).decrement('balance', amount);

            if (existing) {
                await trx('subscriptions')
                    .where({ id: existing.id })
                    .update({
                        amount_per_period: amount,
                        expires_at: expiresAt.toISOString(),
                        token_id: tokenId
                    });
            } else {
                await trx('subscriptions').insert({
                    subscriber_id: req.user.id,
                    creator_id: creatorId,
                    token_id: tokenId,
                    amount_per_period: amount,
                    period_days: period,
                    expires_at: expiresAt.toISOString()
                });
                await trx('reputation')
                    .where({ user_id: creatorId })
                    .increment({ total_subscribers: 1, score: 10 });
            }

            await trx('transactions').insert({
                from_user_id: req.user.id,
                to_user_id: creatorId,
                token_id: tokenId,
                amount,
                type: 'subscription',
                description: `Subscribed to creator for ${amount} credits`
            });
        });

        res.json({ success: true, message: existing ? 'Subscription renewed' : 'Subscribed successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Cancel subscription
app.post('/api/subscriptions/cancel', authenticateToken, async (req, res) => {
    const { subscriptionId } = req.body;
    if (!subscriptionId) return res.status(400).json({ error: 'Subscription ID required' });

    try {
        const changes = await db('subscriptions')
            .where({ id: subscriptionId, subscriber_id: req.user.id })
            .update({ is_active: 0 });
        if (changes === 0) return res.status(404).json({ error: 'Subscription not found' });
        res.json({ success: true, message: 'Subscription cancelled' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get user's subscriptions
app.get('/api/subscriptions', authenticateToken, async (req, res) => {
    const { type } = req.query;
    try {
        let query = db('subscriptions as s');
        if (type === 'subscribers') {
            query = query.join('users as u', 's.subscriber_id', 'u.id')
                .select('s.*', 'u.username as subscriber_name')
                .where({ 's.creator_id': req.user.id, 's.is_active': 1 });
        } else {
            query = query.join('users as u', 's.creator_id', 'u.id')
                .select('s.*', 'u.username as creator_name')
                .where({ 's.subscriber_id': req.user.id, 's.is_active': 1 });
        }
        const rows = await query;
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---- Bids API ----

// Place bid on content
app.post('/api/bids/create', authenticateToken, async (req, res) => {
    const { zineId, amount, message } = req.body;
    if (!zineId || !amount) return res.status(400).json({ error: 'Zine ID and amount required' });

    try {
        const creditRow = await db('credits').where({ user_id: req.user.id }).first();
        const currentBalance = creditRow ? creditRow.balance : 0;
        if (currentBalance < amount) {
            return res.status(400).json({ error: 'Insufficient credits', required: amount, available: currentBalance });
        }

        const [id] = await db('bids').insert({
            bidder_id: req.user.id,
            zine_id: zineId,
            amount: amount,
            message: message || null
        });

        res.json({ success: true, bidId: id, amount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Accept bid
app.post('/api/bids/:id/accept', authenticateToken, async (req, res) => {
    const bidId = req.params.id;

    try {
        const bid = await db('bids as b')
            .join('zines as z', 'b.zine_id', 'z.id')
            .select('b.*', 'z.user_id as zine_owner_id')
            .where('b.id', bidId)
            .first();

        if (!bid) return res.status(404).json({ error: 'Bid not found' });
        if (bid.zine_owner_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

        await db.transaction(async trx => {
            await trx('credits').where({ user_id: bid.bidder_id }).decrement('balance', bid.amount);
            await trx('credits')
                .insert({ user_id: req.user.id, balance: bid.amount })
                .onConflict('user_id')
                .merge({ balance: db.raw('credits.balance + ?', [bid.amount]) });

            await trx('bids').where({ id: bidId }).update({ status: 'accepted' });

            await trx('transactions').insert({
                from_user_id: bid.bidder_id,
                to_user_id: req.user.id,
                amount: bid.amount,
                type: 'bid_accepted',
                description: 'Bid accepted for content'
            });

            await trx('reputation')
                .where({ user_id: req.user.id })
                .increment({
                    total_bids_accepted: 1,
                    score: 15,
                    total_content_sold: bid.amount
                });
        });

        res.json({ success: true, message: 'Bid accepted', amount: bid.amount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reject bid
app.post('/api/bids/:id/reject', authenticateToken, async (req, res) => {
    const bidId = req.params.id;

    try {
        const bid = await db('bids as b')
            .join('zines as z', 'b.zine_id', 'z.id')
            .select('b.*', 'z.user_id as zine_owner_id')
            .where('b.id', bidId)
            .first();

        if (!bid) return res.status(404).json({ error: 'Bid not found' });
        if (bid.zine_owner_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

        await db('bids').where({ id: bidId }).update({ status: 'rejected' });
        res.json({ success: true, message: 'Bid rejected' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get bids for user's content
app.get('/api/bids', authenticateToken, async (req, res) => {
    const { zineId } = req.query;
    try {
        let query = db('bids as b')
            .join('users as u', 'b.bidder_id', 'u.id')
            .join('zines as z', 'b.zine_id', 'z.id')
            .select('b.*', 'u.username as bidder_name', 'z.title as zine_title');

        if (zineId) {
            query = query.where('b.zine_id', zineId);
        } else {
            query = query.where(builder => {
                builder.where('b.bidder_id', req.user.id).orWhere('z.user_id', req.user.id);
            });
        }

        const rows = await query.orderBy('b.created_at', 'desc');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---- Reputation API ----

// Get user reputation
app.get('/api/reputation/:userId', async (req, res) => {
    try {
        const rep = await db('reputation as r')
            .join('users as u', 'r.user_id', 'u.id')
            .select('r.*', 'u.username')
            .where('r.user_id', req.params.userId)
            .first();

        if (!rep) {
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

        let level = 'newcomer';
        if (rep.score >= 1000) level = 'legendary';
        else if (rep.score >= 500) level = 'master';
        else if (rep.score >= 200) level = 'established';
        else if (rep.score >= 100) level = 'contributor';
        else if (rep.score >= 50) level = 'supporter';

        res.json({ ...rep, level });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update reputation (internal, called after actions)
app.post('/api/reputation/update', authenticateToken, async (req, res) => {
    const { action, amount } = req.body;

    try {
        await db('reputation')
            .insert({ user_id: req.user.id, score: 0, level: 'newcomer' })
            .onConflict('user_id')
            .ignore();

        let scoreIncrease = 0;
        switch (action) {
            case 'publish': scoreIncrease = 5; break;
            case 'subscribe': scoreIncrease = 3; break;
            case 'tip': scoreIncrease = 2; break;
            case 'bid_accepted': scoreIncrease = 15; break;
            case 'content_sold': scoreIncrease = 10; break;
            default: scoreIncrease = amount || 1;
        }

        await db('reputation')
            .where({ user_id: req.user.id })
            .increment('score', scoreIncrease)
            .update({ updated_at: db.fn.now() });

        res.json({ success: true, scoreIncrease });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---- Marketplace API ----

// Get marketplace listings
app.get('/api/market', async (req, res) => {
    const { sort } = req.query;

    try {
        let query = db('tokens as t')
            .join('users as u', 't.creator_id', 'u.id')
            .select('t.*', 'u.username as creator_name', db.raw('(t.initial_supply - t.current_supply) as tokens_sold'))
            .where({ 't.is_active': 1 })
            .where('t.current_supply', '>', 0);

        switch (sort) {
            case 'popular': query = query.orderBy('tokens_sold', 'desc'); break;
            case 'newest': query = query.orderBy('t.created_at', 'desc'); break;
            case 'price_low': query = query.orderBy('t.price_per_token', 'asc'); break;
            case 'price_high': query = query.orderBy('t.price_per_token', 'desc'); break;
            default: query = query.orderBy('tokens_sold', 'desc');
        }

        const rows = await query;
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get transaction history
app.get('/api/transactions', authenticateToken, async (req, res) => {
    const { type } = req.query;

    try {
        let query = db('transactions as t')
            .leftJoin('users as from_user', 't.from_user_id', 'from_user.id')
            .leftJoin('users as to_user', 't.to_user_id', 'to_user.id')
            .leftJoin('tokens as token', 't.token_id', 'token.id')
            .select(
                't.*',
                'from_user.username as from_username',
                'to_user.username as to_username',
                'token.token_name'
            )
            .where(builder => {
                builder.where('t.from_user_id', req.user.id).orWhere('t.to_user_id', req.user.id);
            });

        if (type) {
            query = query.where('t.type', type);
        }

        const rows = await query.orderBy('t.created_at', 'desc').limit(50);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---- Zine Tokenization ----

// Set token price for zine (token gating)
app.post('/api/zines/:id/token-gate', authenticateToken, async (req, res) => {
    const { tokenPrice, tokenId, isTokenGated } = req.body;
    const zineId = req.params.id;

    try {
        const zine = await db('zines').where({ id: zineId, user_id: req.user.id }).first();
        if (!zine) return res.status(404).json({ error: 'Zine not found or not owned' });

        await db('zines').where({ id: zineId }).update({
            token_price: tokenPrice || 0,
            is_token_gated: isTokenGated ? 1 : 0,
            updated_at: db.fn.now()
        });

        res.json({ success: true, tokenPrice, isTokenGated: !!isTokenGated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get zine with token access check
app.get('/api/zines/:id/access', authenticateToken, async (req, res) => {
    const zineId = req.params.id;

    try {
        const zine = await db('zines').where({ id: zineId }).first();
        if (!zine) return res.status(404).json({ error: 'Not found' });

        if (!zine.is_token_gated || zine.token_price === 0 || zine.user_id === req.user.id) {
            return res.json({ hasAccess: true });
        }

        const sub = await db('subscriptions')
            .where({ subscriber_id: req.user.id, creator_id: zine.user_id, is_active: 1 })
            .first();
        if (sub) return res.json({ hasAccess: true, via: 'subscription' });

        const bid = await db('bids')
            .where({ bidder_id: req.user.id, zine_id: zineId, status: 'accepted' })
            .first();
        if (bid) return res.json({ hasAccess: true, via: 'bid' });

        res.json({
            hasAccess: false,
            tokenPrice: zine.token_price,
            creatorId: zine.user_id
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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

// Stripe Checkout Session
app.post('/api/stripe/create-checkout-session', authenticateToken, async (req, res) => {
    const { amountUSD } = req.body;

    // Basic validation to prevent tampering
    if (typeof amountUSD !== 'number' || isNaN(amountUSD) || amountUSD <= 0 || amountUSD > 10000) {
        return res.status(400).json({ error: 'Invalid amountUSD' });
    }

    try {
        const session = await economyService.createCheckoutSession(req.user.id, amountUSD, req.user.email);
        res.json(session);
    } catch (error) {
        console.error('Stripe error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Stripe public config (publishable key) - safe to expose to frontend
app.get('/api/stripe/config', (req, res) => {
    try {
        res.json({ publishableKey: CONFIG.payment.stripePublishableKey || null, enabled: !CONFIG.payment.mockMode });
    } catch (err) {
        res.status(500).json({ error: 'Failed to read Stripe config' });
    }
});

// Confirm Stripe payment after redirect (frontend calls this to finalize credit issuance)
app.post('/api/stripe/confirm-payment', authenticateToken, async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

    try {
        const session = await economyService.retrieveCheckoutSession(sessionId);
        const paymentStatus = session.payment_status || session.status || 'unknown';
        const metadata = session.metadata || {};

        if (paymentStatus !== 'paid') return res.status(400).json({ error: 'Payment not completed' });
        if (!metadata.userId || parseInt(metadata.userId) !== req.user.id) return res.status(403).json({ error: 'Session does not match user' });

        const vpcAmount = metadata.vpcAmount ? parseInt(metadata.vpcAmount) : Math.round((session.amount_total || 0) / 100 * economyService.CREDITS_PER_USD);
        const result = await economyService.fulfillCreditPurchase(req.user.id, vpcAmount, db);
        res.json({ success: true, result });
    } catch (err) {
        console.error('Confirm payment failed:', err);
        res.status(500).json({ error: err.message });
    }
});

// Stripe Webhook
app.post('/api/stripe/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];

    try {
        const result = await economyService.handleStripeWebhook(sig, req.body, db);
        res.json(result);
    } catch (err) {
        res.status(400).send(`Webhook Error: ${err.message}`);
    }
});

// Legacy/Simulated endpoint for dev (mapped to Stripe flow)
app.post('/api/payment/initiate', authenticateToken, async (req, res) => {
    const { credits } = req.body;
    const amountUSD = credits / 100;
    try {
        const user = await db('users').where({ id: req.user.id }).first();
        const session = await economyService.createCheckoutSession(req.user.id, amountUSD, user.email);
        res.json({
            sessionId: session.sessionId,
            paymentUrl: session.url,
            simulated: session.simulated
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// ---- Contributions API ----

// Create a payment intent for a contribution
app.post('/api/zines/:id/contribute', authenticateToken, async (req, res) => {
    const { amount_dollars } = req.body;
    const { id: zine_id } = req.params;
    const { id: user_id } = req.user;

    try {
        const result = await contributionService.createContributionIntent(zine_id, amount_dollars, user_id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stripe webhook for payment confirmation
app.post('/api/stripe-webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
    try {
        await contributionService.handleStripeWebhook(req.body, req.headers['stripe-signature']);
        res.json({ received: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ============================================
// Sovereign Token API Endpoints
// ============================================

// Create a new sovereign token
app.post('/api/sovereign/create-token', authenticateToken, async (req, res) => {
    const { identity, claims } = req.body;

    try {
        const result = await sovereignService.createToken(db, req.user.id, identity, claims);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user's sovereign tokens
app.get('/api/sovereign/tokens', authenticateToken, async (req, res) => {
    try {
        const tokens = await sovereignService.getUserTokens(db, req.user.id);
        res.json(tokens);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Verify a sovereign token
app.post('/api/sovereign/verify', async (req, res) => {
    const { tokenData } = req.body;

    try {
        const result = await sovereignService.verifyToken(db, tokenData);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Seal content with a token gate
app.post('/api/sovereign/seal', authenticateToken, async (req, res) => {
    const { zineId, tokenId, content } = req.body;

    if (!zineId || !tokenId || !content) {
        return res.status(400).json({ error: 'zineId, tokenId, and content are required' });
    }

    try {
        const result = await sovereignService.sealContent(db, zineId, tokenId, content);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Unlock content with a token
app.post('/api/sovereign/unlock', async (req, res) => {
    const { gateId, tokenData } = req.body;

    if (!gateId || !tokenData) {
        return res.status(400).json({ error: 'gateId and tokenData are required' });
    }

    try {
        const result = await sovereignService.unlockContent(db, gateId, tokenData);
        res.json(result);
    } catch (error) {
        res.status(403).json({ error: error.message });
    }
});

// Create a delegated token
app.post('/api/sovereign/delegate', authenticateToken, async (req, res) => {
    const { tokenId, userId, purpose, ttl } = req.body;

    if (!tokenId || !purpose) {
        return res.status(400).json({ error: 'tokenId and purpose are required' });
    }

    try {
        const result = await sovereignService.createDelegation(db, tokenId, userId || req.user.id, purpose, ttl);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get gate info (public - no content revealed)
app.get('/api/gates/:gateId', async (req, res) => {
    try {
        const gate = await sovereignService.getGateInfo(db, req.params.gateId);
        if (!gate) {
            return res.status(404).json({ error: 'Gate not found' });
        }
        res.json(gate);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Check access to a zine
app.get('/api/zines/:id/access', authenticateToken, async (req, res) => {
    try {
        const result = await sovereignService.checkAccess(db, req.params.id, req.user.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Crowdfunding API Endpoints
// ============================================

// Get zine funding status
app.get('/api/zines/:id/funding', async (req, res) => {
    try {
        const zine = await db('zines').where({ id: req.params.id }).first();
        if (!zine) {
            return res.status(404).json({ error: 'Zine not found' });
        }

        const isFunded = zine.funding_goal > 0 && zine.amount_raised >= zine.funding_goal;

        res.json({
            zineId: zine.id,
            fundingGoal: zine.funding_goal || 0,
            amountRaised: zine.amount_raised || 0,
            isFunded: !!isFunded,
            remaining: zine.funding_goal ? Math.max(0, zine.funding_goal - zine.amount_raised) : null,
            currency: zine.funding_currency || 'USD',
            deadline: zine.funding_deadline,
            contributorCount: await db('contributions').where({ zine_id: zine.id }).count('* as count').first()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Set funding goal for zine
app.post('/api/zines/:id/funding', authenticateToken, async (req, res) => {
    const { fundingGoal, currency, deadline } = req.body;
    const zineId = req.params.id;

    try {
        const zine = await db('zines').where({ id: zineId, user_id: req.user.id }).first();
        if (!zine) {
            return res.status(404).json({ error: 'Zine not found or not owned' });
        }

        await db('zines').where({ id: zineId }).update({
            funding_goal: fundingGoal || null,
            funding_currency: currency || 'USD',
            funding_deadline: deadline || null,
            monetization_type: fundingGoal ? 'crowdfund' : zine.monetization_type
        });

        res.json({ success: true, fundingGoal, currency: currency || 'USD' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get contributors for a zine
app.get('/api/zines/:id/contributors', async (req, res) => {
    try {
        const contributors = await db('contributions as c')
            .join('users as u', 'c.user_id', 'u.id')
            .select('c.*', 'u.username')
            .where('c.zine_id', req.params.id)
            .orderBy('c.created_at', 'desc');

        res.json(contributors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get producers (contributors with aggregated data and tiers) for a zine
app.get('/api/zines/:id/producers', async (req, res) => {
    try {
        // Get aggregated producer data - group by user and show their total contribution and tier
        const producers = await db('contributions as c')
            .join('users as u', 'c.user_id', 'u.id')
            .select(
                'c.user_id',
                'u.username',
                db.raw('SUM(c.amount) as total_contributed'),
                db.raw('MAX(c.credit_tier) as credit_tier'),
                db.raw('COUNT(*) as contribution_count'),
                db.raw('MAX(c.created_at) as latest_contribution')
            )
            .where('c.zine_id', req.params.id)
            .groupBy('c.user_id', 'u.username')
            .orderBy('total_contributed', 'desc');

        // Format the credit tier for display
        const formattedProducers = producers.map(p => ({
            user_id: p.user_id,
            username: p.username,
            total_contributed: parseFloat(p.total_contributed) || 0,
            credit_tier: p.credit_tier || 'supporter',
            tier_display: formatCreditTier(p.credit_tier),
            contribution_count: p.contribution_count,
            latest_contribution: p.latest_contribution
        }));

        res.json(formattedProducers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper function to format credit tier for display
function formatCreditTier(tier) {
    if (!tier) return 'Supporter';
    const tierMap = {
        'executive_producer': 'Executive Producer',
        'associate_producer': 'Associate Producer',
        'supporter': 'Supporter',
        'contributor': 'Contributor'
    };
    return tierMap[tier] || tier.charAt(0).toUpperCase() + tier.slice(1).replace(/_/g, ' ');
}

// Process crowdfunding payment (after Stripe success)
app.post('/api/zines/:id/fund', authenticateToken, async (req, res) => {
    const { amount, paymentIntentId } = req.body;
    const zineId = req.params.id;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
    }

    try {
        // Verify payment with Stripe (simplified)
        // In production, verify the payment intent properly

        // Determine credit tier based on contribution
        const zine = await db('zines').where({ id: zineId }).first();
        const goal = zine.funding_goal || 0;
        const creditTier = goal > 0 && (amount / goal) >= 0.2 ? 'executive_producer' : 'associate_producer';

        // Record contribution
        await db('contributions').insert({
            user_id: req.user.id,
            zine_id: zineId,
            amount,
            currency: zine.funding_currency || 'USD',
            stripe_payment_intent: paymentIntentId,
            credit_tier: creditTier
        });

        // Update zine amount raised
        const newRaised = (zine.amount_raised || 0) + amount;
        const isNowFunded = goal > 0 && newRaised >= goal;

        await db('zines').where({ id: zineId }).update({
            amount_raised: newRaised,
            is_funded: isNowFunded ? 1 : 0
        });

        res.json({
            success: true,
            amountRaised: newRaised,
            isFunded: isNowFunded,
            creditTier,
            message: isNowFunded ? 'Funding goal reached! Content is now free for everyone.' : 'Thank you for your contribution!'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve static files from React app

// Serve index.html (index.html) for unknown routes (SPA)
// app.get('(.*)', (req, res) => {
//     res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
// });

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
