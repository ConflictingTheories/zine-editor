const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { unzipSync, strFromU8 } = require('fflate');

const store = process.env.SVRN_PACKAGES_PATH || path.join(__dirname, 'data', 'svrn-packages');
const indexFile = path.join(store, 'index.json');
fs.mkdirSync(store, { recursive: true });

const readIndex = () => {
    try {
        return JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    } catch {
        return [];
    }
};

const writeIndex = issues => {
    fs.writeFileSync(indexFile, JSON.stringify(issues, null, 2));
};

const etagFor = value => `\"${crypto.createHash('sha256').update(value).digest('hex')}\"`;
const escapeHtml = value => String(value || '').replace(/</g, '&lt;');

function registerSvrnRoutes(app, { authenticateToken, express }) {
    app.get('/.well-known/svrn-node.json', (req, res) => {
        res.json({
            protocolVersion: '1.0',
            name: process.env.SVRN_NODE_NAME || 'SVRN Publishing Node',
            endpoints: {
                catalog: '/svrn/v1/catalog',
                search: '/svrn/v1/search',
                feed: '/svrn/v1/feed',
                packages: '/svrn/v1/issues/:id/package',
                profile: '/api/profile',
            },
            access: { publicCatalog: true, bearerProfiles: true },
            capabilities: ['package-hosting', 'html-view', 'search', 'profiles', 'subscriptions'],
        });
    });

    app.get('/svrn/v1/search', (req, res) => {
        const query = String(req.query.q || '').toLowerCase();
        const items = readIndex().filter(issue => !query || [
            issue.title,
            issue.author,
            issue.description,
            ...(issue.tags || []),
        ].join(' ').toLowerCase().includes(query));
        res.json({ items: items.slice(0, 100) });
    });

    app.get('/svrn/v1/catalog', (req, res) => {
        const catalog = readIndex().map(({ id, title, author, description, tags, publishedAt, size, sha256 }) => ({
            id,
            title,
            author,
            description,
            tags,
            publishedAt,
            size,
            sha256,
            packageUrl: `/svrn/v1/issues/${encodeURIComponent(id)}/package`,
            viewUrl: `/svrn/v1/issues/${encodeURIComponent(id)}/view`,
        }));
        const etag = etagFor(JSON.stringify(catalog));
        if (req.headers['if-none-match'] === etag) return res.status(304).end();
        res.set('ETag', etag).json({ items: catalog });
    });

    app.get('/svrn/v1/feed', (req, res) => {
        const issues = readIndex().sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
        const start = Math.max(0, Number.parseInt(req.query.cursor || '0', 10) || 0);
        const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || '25', 10) || 25));
        const items = issues.slice(start, start + limit).map(({ id, title, author, description, tags, publishedAt, sha256 }) => ({
            id, title, author, description, tags, publishedAt, sha256,
        }));
        const response = { items, nextCursor: start + limit < issues.length ? String(start + limit) : null };
        const etag = etagFor(JSON.stringify(response));
        if (req.headers['if-none-match'] === etag) return res.status(304).end();
        res.set('ETag', etag).json(response);
    });

    app.post('/svrn/v1/issues', authenticateToken, express.raw({
        type: ['application/vnd.svrn+zip', 'application/zip'],
        limit: '100mb',
    }), (req, res) => {
        try {
            if (!req.body?.length) return res.status(400).json({ error: 'A .svrn archive is required' });
            const entries = unzipSync(new Uint8Array(req.body));
            if (!entries['manifest.json'] || !entries['content/zine.json']) {
                return res.status(400).json({ error: 'Invalid .svrn archive' });
            }
            const manifest = JSON.parse(strFromU8(entries['manifest.json']));
            if (manifest.formatVersion !== '1.0.0') {
                return res.status(422).json({ error: `Unsupported SVRN format ${manifest.formatVersion}` });
            }
            for (const [entry, expectedHash] of Object.entries(manifest.hashes || {})) {
                if (!entries[entry]) return res.status(422).json({ error: `Package is missing ${entry}` });
                const actualHash = crypto.createHash('sha256').update(entries[entry]).digest('hex');
                if (actualHash !== expectedHash) {
                    return res.status(422).json({ error: `Package integrity check failed for ${entry}` });
                }
            }

            const issueId = String(manifest.issue?.id || crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, '_');
            fs.writeFileSync(path.join(store, `${issueId}.svrn`), req.body);
            const issues = readIndex().filter(issue => issue.id !== issueId);
            issues.push({
                id: issueId,
                title: manifest.issue?.title || 'Untitled Zine',
                author: manifest.issue?.author || req.user.username,
                description: manifest.issue?.description || '',
                tags: manifest.issue?.tags || [],
                publishedAt: new Date().toISOString(),
                size: req.body.length,
                sha256: crypto.createHash('sha256').update(req.body).digest('hex'),
                ownerId: req.user.id,
            });
            writeIndex(issues);
            res.status(201).json({ id: issueId, packageUrl: `/svrn/v1/issues/${issueId}/package` });
        } catch (error) {
            res.status(400).json({ error: `Could not publish .svrn: ${error.message}` });
        }
    });

    app.get('/svrn/v1/issues/:id', (req, res) => {
        const issue = readIndex().find(item => item.id === req.params.id);
        if (!issue) return res.status(404).json({ error: 'Issue not found' });
        res.json(issue);
    });

    app.get('/svrn/v1/issues/:id/package', (req, res) => {
        const issue = readIndex().find(item => item.id === req.params.id);
        const file = path.join(store, `${req.params.id}.svrn`);
        if (!issue || !fs.existsSync(file)) return res.status(404).json({ error: 'Issue not found' });
        const etag = `\"${issue.sha256}\"`;
        if (req.headers['if-none-match'] === etag) return res.status(304).end();
        res.set({
            'Content-Type': 'application/vnd.svrn+zip',
            'Content-Disposition': `inline; filename=\"${issue.id}.svrn\"`,
            ETag: etag,
        });
        fs.createReadStream(file).pipe(res);
    });

    app.get('/svrn/v1/issues/:id/view', (req, res) => {
        const issue = readIndex().find(item => item.id === req.params.id);
        if (!issue) return res.status(404).send('Issue not found');
        const packageUrl = `/svrn/v1/issues/${encodeURIComponent(issue.id)}/package`;
        res.type('html').send(`<!doctype html><meta charset=\"utf-8\"><title>${escapeHtml(issue.title)}</title><body style=\"font-family:system-ui;max-width:42rem;margin:4rem auto\"><h1>${escapeHtml(issue.title)}</h1><p>${escapeHtml(issue.description)}</p><p>Open this issue in an SVRN Reader, or <a href=\"${packageUrl}\">download the .svrn package</a>.</p></body>`);
    });
}

module.exports = { registerSvrnRoutes };
