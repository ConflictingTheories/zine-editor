const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

// The credit vault is the single unit of value. Payments only turn money into
// credits; every balance and unlock is a ledger fact recorded in the vault.
const economyService = require('./economyService.cjs');
const vault = require('./vaultService.cjs');
const accountRoutes = require('./accountRoutes.cjs');
const { seedDemoUser, DEMO_TOKEN } = require('./demoAccount.cjs');
const { registerSvrnRoutes } = require('./svrnRoutes.cjs');

const {
    app,
    db,
    express,
    bodyParser,
    authenticateToken,
    config: CONFIG,
    port: PORT,
    jwtExpiry: JWT_EXPIRY,
} = require('./runtime.cjs');

const { server, jwt: jwtConfig, database, payment, xrp } = CONFIG;
const JWT_SECRET = jwtConfig.secret;
const { isFunded, evaluateAccess, registerAccountRoutes } = accountRoutes;

// Health Check
app.get('/api/health', (req, res) => {
    db.raw('SELECT 1').then(() => {
        res.json({ status: 'ok', database: 'connected' });
    }).catch(err => {
        res.status(500).json({ status: 'error', database: 'disconnected', error: err.message });
    });
});

registerSvrnRoutes(app, { authenticateToken, express });

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

app.delete('/api/zines/:id', authenticateToken, async (req, res) => {
    try {
        const deleted = await db('zines')
            .where({ id: req.params.id, user_id: req.user.id })
            .del();
        if (deleted === 0) return res.status(404).json({ error: 'Zine not found' });
        res.json({ status: 'deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// The monetization models a creator can publish under. Each resolves to a
// single, unambiguous access rule in `evaluateAccess`:
//   free        — always readable
//   one_time    — a single credit purchase, recorded as a purchase
//   crowdfund   — contributions; open to all once the goal is met
//   subscription — readable while a subscription to the creator is active
const MONETIZATION_TYPES = ['free', 'one_time', 'crowdfund', 'subscription'];
const MAX_PRICE_USD = 500;

// List Published Zines (Public)
app.get('/api/published', async (req, res) => {
    const { q, genre, sort } = req.query;
    try {
        // Only the columns a browse card needs. The zine `data` column is the
        // whole document and was being shipped for all 50 results on every
        // page load.
        const columns = [
            'id', 'title', 'author_name', 'genre', 'tags',
            'monetization_type', 'price_units', 'currency',
            'cover_image', 'read_count', 'published_at',
            'funding_goal', 'amount_raised', 'access_level'
        ];

        let query = db('zines').where({ is_published: 1 }).select(columns);

        if (genre && genre !== 'all') {
            query = query.where({ genre });
        }
        if (q) {
            const term = `%${q}%`;
            query = query.where((builder) => {
                builder.where('title', 'like', term)
                    .orWhere('author_name', 'like', term)
                    .orWhere('tags', 'like', term);
            });
        }

        if (sort === 'popular') {
            query = query.orderBy('read_count', 'desc');
        } else {
            query = query.orderBy('published_at', 'desc');
        }

        const rows = await query.limit(60);
        res.json(rows.map(row => ({
            ...row,
            price: row.price_units
                ? vault.fromUnits(row.price_units, { currency: row.currency })
                : null
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Publish Zine
//
// Takes the full publication and monetization configuration in one call. The
// old handler only stored title/genre/tags, so every monetization field the
// publish dialog collected was silently discarded — the feature could not work
// end to end no matter what the client sent.
app.post('/api/publish/:id', authenticateToken, async (req, res) => {
    try {
        const {
            author_name, genre, tags, description, cover_image,
            monetization_type, price, funding_goal, currency
        } = req.body;

        const existing = await db('zines')
            .select('id', 'monetization_type', 'amount_raised')
            .where({ id: req.params.id, user_id: req.user.id })
            .first();
        if (!existing) return res.status(404).json({ error: 'Zine not found or not owned' });

        const model = MONETIZATION_TYPES.includes(monetization_type)
            ? monetization_type
            : (existing.monetization_type || 'free');

        // A paid model needs a price; a free or crowdfunded one must not carry
        // a price, or a reader would be charged for nothing.
        let priceUnits = 0
        let fundingGoal = null

        if (model === 'one_time' || model === 'subscription') {
            const parsed = Number(price)
            if (!Number.isFinite(parsed) || parsed <= 0) {
                return res.status(400).json({ error: `A ${model} zine needs a price above zero` })
            }
            if (parsed > MAX_PRICE_USD) {
                return res.status(400).json({ error: `Price cannot exceed $${MAX_PRICE_USD}` })
            }
            priceUnits = Math.round(parsed * vault.UNITS_PER_USD)
        } else if (model === 'crowdfund') {
            const parsed = Number(funding_goal)
            if (!Number.isFinite(parsed) || parsed <= 0) {
                return res.status(400).json({ error: 'A crowdfunded zine needs a funding goal' })
            }
            fundingGoal = parsed
        }

        const changes = await db('zines')
            .where({ id: req.params.id, user_id: req.user.id })
            .update({
                is_published: 1,
                published_at: db.fn.now(),
                author_name: author_name || null,
                genre: genre || null,
                tags: tags || null,
                description: description || null,
                cover_image: cover_image || null,
                monetization_type: model,
                access_level: model === 'free' ? 'public' : 'gated',
                price_units: priceUnits,
                currency: currency || 'USD',
                funding_goal: fundingGoal,
                // Re-publishing a crowdfund zine starts a new goal, so any
                // amount already raised no longer counts toward it.
                amount_raised: 0,
                is_funded: 0
            });

        if (changes === 0) return res.status(404).json({ error: 'Zine not found or not owned' });

        res.json({
            status: 'published',
            monetization_type: model,
            price: priceUnits ? vault.fromUnits(priceUnits, { currency: currency || 'USD' }) : null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Single Zine (for Reader)
//
// Returns either the full document or a single-page preview, decided by the
// shared `evaluateAccess` used by the access endpoint and the unlock flow, so
// the browse grid, the reader and the purchase button can never disagree about
// whether a zine is readable.
app.get('/api/zines/:id', async (req, res) => {
    try {
        const zine = await db('zines').where({ id: req.params.id }).first();
        if (!zine) return res.status(404).json({ error: 'Not found' });

        const token = req.headers['authorization']?.split(' ')[1];
        const user = await resolveOptionalUser(token);

        if (!zine.is_published) {
            // Unpublished work is visible only to its author.
            if (!user || Number(zine.user_id) !== Number(user.id)) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            return res.json({ ...zine, data: parseZineData(zine) });
        }

        // Reads are counted, not awaited: a slow counter must not delay the
        // document, and a counter failure must not fail the read.
        db('zines').where({ id: zine.id }).increment('read_count', 1).catch(() => { });

        const access = await evaluateAccess(zine, user);
        if (access.granted) {
            return res.json({ ...zine, data: parseZineData(zine) });
        }

        const data = parseZineData(zine);
        res.json({
            ...zine,
            data: { pages: data.pages.slice(0, 1) },
            locked: true,
            preview: true,
            reason: access.reason,
            priceUnits: zine.price_units || 0,
            price: zine.price_units
                ? vault.fromUnits(zine.price_units, { currency: zine.currency })
                : null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** Parse a zine's stored JSON document, tolerating a corrupt row. */
function parseZineData(zine) {
    try {
        const parsed = JSON.parse(zine.data);
        return { pages: Array.isArray(parsed?.pages) ? parsed.pages : [] };
    } catch {
        return { pages: [] };
    }
}

/**
 * Resolve the caller from a bearer token without requiring one.
 * A bad or absent token is simply "not signed in" — browsing public work must
 * not 401.
 * @param {string|undefined} token
 * @returns {Promise<object|null>}
 */
function resolveOptionalUser(token) {
    if (!token) return Promise.resolve(null);
    if (token === DEMO_TOKEN) return Promise.resolve(null);
    if (token === 'local_offline_token') return Promise.resolve(null);
    return new Promise((resolve) => {
        jwt.verify(token, JWT_SECRET, (err, user) => resolve(err ? null : user));
    });
}

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
    const data = {
        pages: [{ id: Date.now(), elements: [], background: '#ffffff', texture: null }],
    };
    const [zineId] = await db('zines').insert({
        user_id: userId,
        title: args.title,
        data: JSON.stringify(data)
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
// ACCOUNT & ECONOMY
//
// Replaces the previous XRP/PayID, VPC-credit, token-marketplace, trustline,
// bid and sovereign-gate endpoint families. Those were four disconnected
// ledgers behind ~35 routes that a client could not reason about; the account
// surface below is the single coherent replacement.
// ============================================
accountRoutes.attachDb(db);
registerAccountRoutes(app, { db, authenticateToken, economy: economyService });

// Stripe webhook. Declared after the JSON body parser, so the raw body
// middleware below must come first for signature verification to work.
app.post('/api/stripe/webhook',
    bodyParser.raw({ type: 'application/json' }),
    async (req, res) => {
        try {
            const result = await economyService.handleWebhook(req.headers['stripe-signature'], req.body, db);
            res.json(result);
        } catch (err) {
            res.status(err.status || 400).json({ error: err.message });
        }
    }
);

// ── Crowdfunding ──────────────────────────────────────────────────────
// Crowdfunding is retained: it is a real and useful model, and it now settles
// through the same vault as everything else. A contribution both raises the
// goal and records an explicit purchase, so contributors get permanent access
// rather than the old "any contribution row unlocks everything" behaviour.
app.get('/api/zines/:id/funding', async (req, res) => {
    try {
        const zine = await db('zines')
            .select('id', 'funding_goal', 'amount_raised', 'funding_currency', 'funding_deadline', 'is_funded')
            .where({ id: req.params.id })
            .first();
        if (!zine) return res.status(404).json({ error: 'Not found' });
        res.json({ ...zine, isFunded: isFunded(zine) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/zines/:id/fund', authenticateToken, async (req, res) => {
    const zineId = req.params.id;
    try {
        const zine = await db('zines').where({ id: zineId }).first();
        if (!zine) return res.status(404).json({ error: 'Not found' });
        if (zine.monetization_type !== 'crowdfund') {
            return res.status(409).json({ error: 'This zine is not accepting funding' });
        }

        const amount = Number(req.body.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({ error: 'Enter an amount greater than zero' });
        }

        const goal = Number(zine.funding_goal) || 0;
        const raised = Number(zine.amount_raised) || 0;
        if (goal > 0 && raised >= goal) {
            return res.status(409).json({ error: 'This zine is already fully funded' });
        }

        // A contribution from a non-author is a purchase of indefinite
        // access; a contribution from the author is topping their own pot.
        const isAuthor = Number(zine.user_id) === Number(req.user.id);
        const units = Math.round(amount * vault.UNITS_PER_USD);

        if (!isAuthor && units > 0) {
            await db.transaction(async (trx) => {
                await vault.transfer({
                    fromUserId: req.user.id,
                    toUserId: zine.user_id,
                    amountUnits: units,
                    reason: 'contribution',
                    memo: `Contribution to "${zine.title}"`,
                    trx
                });
            });
        }

        const newRaised = raised + amount;
        const funded = goal > 0 && newRaised >= goal;
        await db('zines').where({ id: zineId }).update({
            amount_raised: newRaised,
            is_funded: funded ? 1 : 0
        });

        if (!isAuthor) {
            await db('purchases')
                .insert({
                    user_id: req.user.id,
                    zine_id: zineId,
                    price_units: units,
                    currency: zine.funding_currency || 'USD',
                    source: 'crowdfund_unlock',
                    created_at: db.fn.now()
                })
                .onConflict(['user_id', 'zine_id'])
                .ignore();
        }

        res.json({
            status: 'contributed',
            amountRaised: newRaised,
            goal,
            isFunded: funded,
            message: funded
                ? 'Funding goal reached — this zine is now free for everyone.'
                : 'Thank you. You have permanent access to this zine.'
        });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
});

app.get('/api/zines/:id/contributors', async (req, res) => {
    try {
        const rows = await db('purchases as p')
            .join('users as u', 'u.id', 'p.user_id')
            .select('u.username', 'u.display_name', 'p.amount_units', 'p.created_at')
            .where('p.zine_id', req.params.id)
            .orderBy('p.created_at', 'desc')
            .limit(50);
        res.json(rows.map(row => ({
            ...row,
            amount: vault.fromUnits(row.amount_units, { currency: 'USD' })
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Serve a packaged frontend when the desktop host provides one.
if (process.env.APP_DIST) {
    const frontendRoot = path.resolve(process.env.APP_DIST);
    app.use(express.static(frontendRoot));
    app.use((req, res, next) => {
        if (req.path.startsWith('/api/') || req.path.startsWith('/mcp/')) return next();
        res.sendFile(path.join(frontendRoot, 'index.html'));
    });
}

// Seed the demo account once the schema is in place. This gives a populated,
// fully-spending account on every install, which is what makes the
// monetization flow testable without a payment provider.
const boot = async () => {
    try {
        await db.migrate.latest();
        console.log('Database migrations completed');

        const demo = await seedDemoUser(db, bcrypt, vault);
        console.log(`Demo account ready: ${demo.username} (${DEMO_TOKEN})`);
    } catch (error) {
        console.error('Database startup failed:', error);
    }

    // `server` in CONFIG is the server *settings* object, not an http.Server.
    // The listener is created here and kept on the module so it can be closed
    // by tests and the desktop shutdown hook.
    const listener = app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Payments: ${economyService.isSimulated() ? 'SIMULATED (no Stripe key)' : 'Stripe'}`);
    });
    module.exports.listener = listener;
    return listener;
};

boot();
