/**
 * identityRoutes.cjs — single SVRN identity: password reset.
 *
 * Registration and login already live in server.cjs (JWT + bcrypt). This
 * module adds the missing account-management piece:
 *
 *   POST /api/auth/password-reset/request  { email }        → 200 always
 *   POST /api/auth/password-reset/confirm  { token, password } → 200 | 400
 *
 * Tokens are 32 random bytes; only the SHA-256 hash is stored (a DB leak
 * never yields a usable token). Single-use (used_at) and 1-hour expiry.
 * No email is sent yet — the token is logged for dev; wire a mailer into
 * `deliverResetToken` when one exists.
 *
 * Sessions stay JWT (existing convention in server.cjs / runtime.cjs).
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Override when a real mailer exists. */
async function deliverResetToken(user, token) {
    // DEV ONLY: no mailer configured — log the token so the flow is testable.
    console.log(`[auth] password-reset token for ${user.email}: ${token}`);
}

function hashToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function registerIdentityRoutes(app, { db, authenticateToken }) {
    // Request a reset. Always 200 — the response never reveals whether the
    // email belongs to an account.
    app.post('/api/auth/password-reset/request', async (req, res) => {
        try {
            const email = String(req.body?.email || '').trim().toLowerCase();
            if (!email) return res.json({ status: 'ok' });

            const user = await db('users').where({ email }).first();
            if (user) {
                const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
                await db('password_reset_tokens').insert({
                    user_id: user.id,
                    token_hash: hashToken(token),
                    expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MS),
                });
                // Invalidate older outstanding tokens for this user so only
                // the newest one works.
                await db('password_reset_tokens')
                    .where({ user_id: user.id })
                    .whereNull('used_at')
                    .whereNot('token_hash', hashToken(token))
                    .update({ used_at: db.fn.now() });
                await deliverResetToken(user, token);
            }
            res.json({ status: 'ok' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Confirm a reset.
    app.post('/api/auth/password-reset/confirm', async (req, res) => {
        try {
            const { token, password } = req.body || {};
            if (!token || !password || String(password).length < 8) {
                return res.status(400).json({ error: 'A valid token and a password of at least 8 characters are required' });
            }

            const row = await db('password_reset_tokens')
                .where({ token_hash: hashToken(token) })
                .whereNull('used_at')
                .first();

            if (!row || new Date(row.expires_at) < new Date()) {
                return res.status(400).json({ error: 'This reset link is invalid or has expired' });
            }

            const passwordHash = await bcrypt.hash(String(password), 10);
            await db.transaction(async (trx) => {
                await trx('users').where({ id: row.user_id }).update({
                    password_hash: passwordHash,
                    updated_at: trx.fn.now(),
                });
                await trx('password_reset_tokens')
                    .where({ id: row.id })
                    .update({ used_at: trx.fn.now() });
            });

            res.json({ status: 'ok' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Canonical "who am I" — the single-identity surface every client uses.
    // (Profile editing stays on PUT /api/profile in server.cjs.)
    app.get('/api/auth/me', authenticateToken, async (req, res) => {
        try {
            const user = await db('users')
                .select('id', 'username', 'email', 'display_name', 'bio', 'avatar_url', 'profile_url', 'created_at')
                .where({ id: req.user.id })
                .first();
            if (!user) return res.status(404).json({ error: 'Not found' });
            res.json({ user });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
}

module.exports = { registerIdentityRoutes, hashToken };
