/*
 * Demo account — a fully-populated, offline-capable account for evaluating the
 * platform without signing up, paying, or connecting a payment provider.
 *
 * Design constraints this satisfies:
 *
 *  1. It must work with no server at all. The server seeds a matching database
 *     row when it boots; when the app is running with no backend reachable, the
 *     client synthesises the same identity locally. Both produce the same
 *     shape, so every downstream screen renders identically.
 *
 *  2. It must not be a special case sprinkled through the auth code. There is
 *     one seeded identity, and it flows through the same `user` object any
 *     real login produces. The only difference is where that object came from.
 *
 *  3. Its money must be real to the ledger, not a hard-coded number shown in
 *     the UI. The demo balance is an actual sum of actual `ledger_entries`, so
 *     buying a zine in demo mode actually debits the balance, and the demo
 *     account will run out and tell you to top up — the whole flow is
 *     exercised rather than bypassed.
 */

const DEMO_USER = {
    id: 1,
    username: 'demo',
    email: 'demo@svrn.local',
    display_name: 'Demo Publisher',
    bio: 'Sample account for exploring the platform.',
    is_demo: true
}

/** Starting balance in credit units (1 unit = 1 cent). $50.00. */
const DEMO_STARTING_UNITS = 5000

/** Free-form top-up amount offered by the demo, in credit units. $25.00 */
const DEMO_TOPUP_UNITS = 2500

/** The offline token the client presents to the API in demo mode. */
const DEMO_TOKEN = 'svrn_demo_token'

/**
 * Build the client-side demo session. Mirrors the server's seeded user so the
 * UI cannot tell which path produced it.
 * @returns {{ token: string, user: object }}
 */
function createDemoSession() {
    return {
        token: DEMO_TOKEN,
        user: { ...DEMO_USER }
    }
}

/**
 * Seed the demo user and their opening balance. Idempotent: safe to call on
 * every boot.
 *
 * @param {object} db knex instance
 * @param {object} bcrypt bcryptjs
 * @param {object} vault the vault service
 * @returns {Promise<object>} the demo user row
 */
async function seedDemoUser(db, bcrypt, vault) {
    const passwordHash = await bcrypt.hash(DEMO_USER.email, 10)

    const existing = await db('users').where({ email: DEMO_USER.email }).first()
    let user = existing

    if (existing) {
        // Keep the demo password valid even if the row predates this seeding.
        await db('users').where({ id: existing.id }).update({ password_hash: passwordHash })
    } else {
        const [id] = await db('users').insert({
            username: DEMO_USER.username,
            email: DEMO_USER.email,
            password_hash: passwordHash,
            display_name: DEMO_USER.display_name,
            bio: DEMO_USER.bio,
            is_premium: 1,
            created_at: db.fn.now()
        })
        user = await db('users').where({ id }).first()
    }

    // Grant the opening balance only once. Re-running must not top the demo up.
    const hasGrant = await db('ledger_entries')
        .where({ ref_type: 'user', ref_id: String(user.id), reason: 'grant' })
        .first()
    if (!hasGrant) {
        await vault.grant({
            userId: user.id,
            amountUnits: DEMO_STARTING_UNITS,
            reason: 'grant',
            memo: 'Demo account opening balance'
        })
    }

    return user
}

module.exports = {
    DEMO_USER,
    DEMO_STARTING_UNITS,
    DEMO_TOPUP_UNITS,
    DEMO_TOKEN,
    createDemoSession,
    seedDemoUser,
};
