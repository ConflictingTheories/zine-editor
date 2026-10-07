/**
 * storageRoutes.cjs — server-side storage + sync API.
 *
 * Two halves:
 *
 * 1. ASSET STORE (binary, content-hash-addressed)
 *    PUT    /api/assets/:hash        upload bytes (hash verified server-side)
 *    GET    /api/assets/:hash        download (owner only; ETag = hash)
 *    DELETE /api/assets/:hash        delete bytes + index row (owner only)
 *    POST   /api/sync/assets/have    { hashes: [] } → { missing: [] }
 *
 * 2. PROJECT SYNC (JSON documents; mirrors the client storage contract)
 *    POST   /api/sync/push           upsert a project snapshot
 *    GET    /api/sync/pull?since=    changed projects incl. tombstones
 *
 * Sync philosophy (per docs/CLOUD_SYNC.md): the client's local store is the
 * source of truth; the server is backup + cross-device. Push is
 * optimistic-locking: the client sends `base_version`; a mismatch returns
 * 409 with the server copy and the client merges — the server never silently
 * discards a version. Encrypted pages stay opaque end to end: the server
 * stores envelopes, never plaintext, and asset bytes are stored as-is.
 *
 * The client contract: `toStorableProject()` output (elements reference
 * bytes by `assetId`; no `blob:` srcs, no inline bulk) — see
 * src/utils/projectAssets.js. Bytes travel separately via /api/assets.
 */

const { serializeZineData, normalizeZineData } = require('./zineStore.cjs');
const { sha256Hex } = require('./assetStore.cjs');

const MAX_ASSET_BYTES = 50 * 1024 * 1024; // 50MB per asset

function rowToSyncRecord(row) {
    let data = null;
    try {
        data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    } catch {
        data = null;
    }
    return {
        id: row.id,
        client_id: row.client_id,
        title: row.title,
        data,
        version: row.version,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at || null,
    };
}

function registerStorageRoutes(app, { db, authenticateToken, express, assetStore }) {

    // ── Asset upload ────────────────────────────────────────────────
    // Raw binary body; the URL hash MUST match the bytes (verified both by
    // the store and here, so a misbehaving store can't accept bad data).
    app.put('/api/assets/:hash', authenticateToken, express.raw({
        type: '*/*',
        limit: `${MAX_ASSET_BYTES}b`,
    }), async (req, res) => {
        try {
            const hash = String(req.params.hash).toLowerCase();
            const bytes = req.body;
            if (!bytes || !bytes.length) {
                return res.status(400).json({ error: 'Empty upload body' });
            }
            if (sha256Hex(bytes) !== hash) {
                return res.status(422).json({ error: 'Content hash mismatch' });
            }
            const mime = (req.get('content-type') || 'application/octet-stream').split(';')[0].trim();
            await assetStore.put(hash, bytes, mime);
            await db('assets')
                .insert({ hash, user_id: req.user.id, mime, size: bytes.length })
                .onConflict('hash')
                .merge({ user_id: req.user.id, mime, size: bytes.length });
            res.status(201).json({ hash, size: bytes.length, mime });
        } catch (err) {
            res.status(err.status || 500).json({ error: err.message });
        }
    });

    // ── Asset download (owner only) ─────────────────────────────────
    app.get('/api/assets/:hash', authenticateToken, async (req, res) => {
        try {
            const hash = String(req.params.hash).toLowerCase();
            const row = await db('assets').where({ hash }).first();
            if (!row || Number(row.user_id) !== Number(req.user.id)) {
                return res.status(404).json({ error: 'Not found' });
            }
            const etag = `"${hash}"`;
            if (req.headers['if-none-match'] === etag) return res.status(304).end();
            const stored = await assetStore.get(hash);
            if (!stored) return res.status(404).json({ error: 'Not found' });
            res.set({
                'Content-Type': row.mime,
                'Content-Length': String(stored.buffer.length),
                'ETag': etag,
                'Cache-Control': 'private, immutable, max-age=31536000',
            });
            res.send(stored.buffer);
        } catch (err) {
            res.status(err.status || 500).json({ error: err.message });
        }
    });

    // ── Asset delete (owner only) ───────────────────────────────────
    app.delete('/api/assets/:hash', authenticateToken, async (req, res) => {
        try {
            const hash = String(req.params.hash).toLowerCase();
            const row = await db('assets').where({ hash }).first();
            if (!row || Number(row.user_id) !== Number(req.user.id)) {
                return res.status(404).json({ error: 'Not found' });
            }
            await assetStore.del(hash);
            await db('assets').where({ hash }).del();
            res.json({ status: 'deleted', hash });
        } catch (err) {
            res.status(err.status || 500).json({ error: err.message });
        }
    });

    // ── Which hashes is the server missing? (sync efficiency) ───────
    app.post('/api/sync/assets/have', authenticateToken, async (req, res) => {
        try {
            const hashes = (req.body?.hashes || []).map(h => String(h).toLowerCase());
            if (hashes.length > 1000) {
                return res.status(400).json({ error: 'Too many hashes (max 1000)' });
            }
            const rows = await db('assets')
                .select('hash')
                .where({ user_id: req.user.id })
                .whereIn('hash', hashes);
            const have = new Set(rows.map(r => r.hash));
            res.json({ missing: hashes.filter(h => !have.has(h)) });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── Sync push (optimistic locking) ──────────────────────────────
    // Body: { client_id, title, data, client_updated_at, base_version }
    // `data` is the toStorableProject() output — metadata + assetIds only.
    app.post('/api/sync/push', authenticateToken, async (req, res) => {
        try {
            const { client_id, title, data, base_version } = req.body || {};
            if (!client_id || typeof client_id !== 'string') {
                return res.status(400).json({ error: 'client_id is required' });
            }
            let serialized;
            try {
                serialized = serializeZineData(data ?? { pages: [] });
            } catch (err) {
                return res.status(400).json({ error: err.message });
            }

            const existing = await db('zines')
                .where({ user_id: req.user.id, client_id })
                .first();

            if (existing) {
                if (Number(base_version) !== Number(existing.version)) {
                    // Conflict: the server moved since the client's base.
                    // Return the server copy; the client merges (never silent).
                    return res.status(409).json({
                        error: 'Version conflict',
                        server: rowToSyncRecord(existing),
                    });
                }
                const [updated] = await db('zines')
                    .where({ id: existing.id })
                    .update({
                        title: title || existing.title,
                        data: serialized,
                        version: existing.version + 1,
                        updated_at: db.fn.now(),
                        deleted_at: null,
                    })
                    .returning(['id', 'client_id', 'title', 'version', 'updated_at']);
                // SQLite has no RETURNING in older versions — re-read.
                const row = updated || await db('zines').where({ id: existing.id }).first();
                return res.json({ status: 'updated', ...rowToSyncRecord(row) });
            }

            const [created] = await db('zines')
                .insert({
                    user_id: req.user.id,
                    client_id,
                    title: title || 'Untitled',
                    data: serialized,
                    version: 1,
                })
                .returning(['id', 'client_id', 'title', 'version', 'updated_at']);
            const row = created || await db('zines')
                .where({ user_id: req.user.id, client_id })
                .first();
            res.status(201).json({ status: 'created', ...rowToSyncRecord(row) });
        } catch (err) {
            res.status(err.status || 500).json({ error: err.message });
        }
    });

    // ── Sync pull ───────────────────────────────────────────────────
    // ?since=ISO — rows updated after `since`, including tombstones.
    app.get('/api/sync/pull', authenticateToken, async (req, res) => {
        try {
            const since = req.query.since ? new Date(String(req.query.since)) : null;
            if (req.query.since && Number.isNaN(since.getTime())) {
                return res.status(400).json({ error: 'Invalid since timestamp' });
            }
            let query = db('zines')
                .select('id', 'client_id', 'title', 'data', 'version', 'updated_at', 'deleted_at')
                .where({ user_id: req.user.id });
            if (since) query = query.andWhere('updated_at', '>', since.toISOString());
            const rows = await query.orderBy('updated_at', 'asc').limit(500);
            res.json({ items: rows.map(rowToSyncRecord) });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── Soft delete (sync tombstone) ─────────────────────────────────
    app.post('/api/sync/delete', authenticateToken, async (req, res) => {
        try {
            const { client_id, base_version } = req.body || {};
            if (!client_id) return res.status(400).json({ error: 'client_id is required' });
            const existing = await db('zines')
                .where({ user_id: req.user.id, client_id })
                .whereNull('deleted_at')
                .first();
            if (!existing) return res.status(404).json({ error: 'Not found' });
            if (base_version != null && Number(base_version) !== Number(existing.version)) {
                return res.status(409).json({
                    error: 'Version conflict',
                    server: rowToSyncRecord(existing),
                });
            }
            await db('zines').where({ id: existing.id }).update({
                deleted_at: db.fn.now(),
                version: existing.version + 1,
                updated_at: db.fn.now(),
            });
            res.json({ status: 'deleted', client_id });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
}

module.exports = { registerStorageRoutes };
