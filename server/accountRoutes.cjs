/*
 * Account + economy routes.
 *
 * Replaces the scattered `/api/credits/*`, `/api/tokens/*`, `/api/wallet/*`,
 * `/api/trustlines`, `/api/subscriptions/*`, `/api/bids/*` and
 * `/api/sovereign/*` endpoints with one coherent account surface:
 *
 *   GET  /api/account            → profile, balance, earnings, counts
 *   GET  /api/account/ledger     → explainable balance history
 *   POST /api/account/topup      → buy credits (Stripe, or simulated offline)
 *   POST /api/account/demo-topup → grant demo credits without a payment
 *   GET  /api/zines/:id/access   → can I read this, and if not, why
 *   POST /api/zines/:id/unlock   → buy access with credits
 *
 * The token marketplace, trust lines and bids are gone: with a single credit
 * unit there is no second currency for a reader to trust-line, and a bid on a
 * fixed-price zine has no meaning.
 */

const express = require('express');
const vault = require('./vaultService.cjs');
const { DEMO_TOPUP_UNITS } = require('./demoAccount.cjs');

/**
 * Register account and economy routes.
 * @param {object} app express app
 * @param {object} deps { db, authenticateToken, economy }
 */
function registerAccountRoutes(app, { db, authenticateToken, economy }) {

    // ── Account overview ────────────────────────────────────────────────
    app.get('/api/account', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id;
            const [profile, balance, earnings] = await Promise.all([
                db('users')
                    .select('id', 'username', 'email', 'display_name', 'bio', 'is_premium', 'created_at')
                    .where({ id: userId })
                    .first(),
                vault.getBalance(userId),
                vault.getEarnings(userId),
            ]);

            const owned = await db('zines').where({ user_id: userId }).count({ c: '*' }).first();
            const published = await db('zines').where({ user_id: userId, is_published: 1 }).count({ c: '*' }).first();
            const sold = await db('purchases').where({ user_id: userId }).count({ c: '*' }).first();

            res.json({
                user: profile,
                balanceUnits: balance,
                balance: vault.fromUnits(balance),
                earnings: {
                    ...earnings,
                    amount: vault.fromUnits(earnings.earnedUnits)
                },
                counts: {
                    zines: Number(owned?.c) || 0,
                    published: Number(published?.c) || 0,
                    purchased: Number(sold?.c) || 0
                }
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── Ledger ──────────────────────────────────────────────────────────
    app.get('/api/account/ledger', authenticateToken, async (req, res) => {
        try {
            const limit = Math.min(Number(req.query.limit) || 50, 200);
            const entries = await vault.getLedger(req.user.id, { limit });
            res.json(entries.map(entry => ({
                ...entry,
                amount: vault.fromUnits(entry.amount_units)
            })));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── Top up with fiat ────────────────────────────────────────────────
    // Simulated whenever no Stripe key is configured, which is the default.
    // The credit is still issued through the real vault path, so demo/offline
    // behaviour matches production exactly.
    app.post('/api/account/topup', authenticateToken, async (req, res) => {
        try {
            const amount = Number(req.body.amount);
            if (!Number.isFinite(amount) || amount <= 0) {
                return res.status(400).json({ error: 'Enter an amount greater than zero' });
            }
            if (amount < 1) {
                return res.status(400).json({ error: 'Minimum top up is $1.00' });
            }
            if (amount > 500) {
                return res.status(400).json({ error: 'Maximum top up is $500.00' });
            }

            const user = await db('users').where({ id: req.user.id }).first();
            const result = await economy.purchaseCredits({
                userId: req.user.id,
                email: user?.email,
                amountUSD: amount
            });

            if (result.checkoutUrl) {
                // Real Stripe: the browser leaves for hosted checkout and the
                // webhook issues the credits on completion.
                return res.json({ checkoutUrl: result.checkoutUrl, sessionId: result.sessionId });
            }

            const balance = await vault.grant({
                userId: req.user.id,
                amountUnits: amount * vault.UNITS_PER_USD,
                reason: 'grant',
                memo: `Top up ${vault.formatMoney(amount)}`
            });

            res.json({
                simulated: true,
                balanceUnits: balance,
                balance: vault.fromUnits(balance)
            });
        } catch (err) {
            res.status(err.status || 500).json({ error: err.message });
        }
    });

    // ── Demo top up ─────────────────────────────────────────────────────
    // The demo account can mint its own credit so the purchase flow can be
    // exhausted and repeated without a payment provider. This is the only
    // self-serve mint in the app, and it is closed to non-demo users.
    app.post('/api/account/demo-topup', authenticateToken, async (req, res) => {
        try {
            const user = await db('users').where({ id: req.user.id }).first();
            if (!user?.is_demo) {
                return res.status(403).json({ error: 'The demo account is the only account that can mint demo credit' });
            }

            const balance = await vault.grant({
                userId: req.user.id,
                amountUnits: DEMO_TOPUP_UNITS,
                reason: 'grant',
                memo: 'Demo top up'
            });

            res.json({ balanceUnits: balance, balance: vault.fromUnits(balance) });
        } catch (err) {
            res.status(err.status || 500).json({ error: err.message });
        }
    });

    // ── Access check for a zine ─────────────────────────────────────────
    // Single source of truth for "may this reader read this?", shared by the
    // browse grid (to render a lock) and the reader view.
    app.get('/api/zines/:id/access', async (req, res) => {
        try {
            const zine = await db('zines').where({ id: req.params.id }).first();
            if (!zine) return res.status(404).json({ error: 'Not found' });

            const result = await evaluateAccess(zine, req.user);
            res.json({
                granted: result.granted,
                reason: result.reason || null,
                priceUnits: zine.price_units || 0,
                price: zine.price_units ? vault.fromUnits(zine.price_units, { currency: zine.currency }) : null,
                balanceUnits: req.user ? await vault.getBalance(req.user.id) : 0
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // ── Unlock a zine with credits ──────────────────────────────────────
    app.post('/api/zines/:id/unlock', authenticateToken, async (req, res) => {
        try {
            const zine = await db('zines').where({ id: req.params.id }).first();
            if (!zine) return res.status(404).json({ error: 'Not found' });

            const access = await evaluateAccess(zine, req.user);
            if (access.granted) {
                return res.json({ status: 'already_unlocked', balanceUnits: access.balance });
            }

            const price = zine.price_units || 0;
            if (!price) {
                // Not actually paid content; the failure is in the zine's
                // configuration, not the reader's wallet.
                return res.status(409).json({ error: 'This zine is not for sale' });
            }

            const result = await db.transaction(async (trx) => {
                return vault.purchaseZine({
                    buyerId: req.user.id,
                    creatorId: zine.user_id,
                    priceUnits: price,
                    zineId: zine.id,
                    trx
                });
            });

            // The unique index on (user_id, zine_id) makes this idempotent: a
            // double-tap on the unlock button cannot double-charge.
            await db('purchases')
                .insert({
                    user_id: req.user.id,
                    zine_id: zine.id,
                    price_units: price,
                    currency: zine.currency || 'USD',
                    source: 'purchase',
                    created_at: db.fn.now()
                })
                .onConflict(['user_id', 'zine_id'])
                .ignore();

            res.json({
                status: 'unlocked',
                balanceUnits: result.balance,
                balance: vault.fromUnits(result.balance)
            });
        } catch (err) {
            res.status(err.status || 500).json({ error: err.message });
        }
    });
}

/**
 * Decide whether a reader may read a zine in full.
 *
 * The rules, in order:
 *   1. The author always can.
 *   2. A recorded purchase always can (this is what crowdfund contributions
 *      are migrated to).
 *   3. Free zines, and crowdfunded zines that reached their goal, can.
 *   4. A live subscription to the creator can.
 *   Otherwise: a preview, with the reason the read is blocked.
 *
 * @param {object} zine zine row
 * @param {object|null} user authenticated user, or null
 * @returns {Promise<{ granted: boolean, reason?: string, balance?: number }>}
 */
async function evaluateAccess(zine, user) {
    const balance = user ? await vault.getBalance(user.id) : 0;

    if (user && Number(zine.user_id) === Number(user.id)) {
        return { granted: true, reason: 'author', balance };
    }

    if (user) {
        const purchase = await db_purchaseExists(user.id, zine.id);
        if (purchase) return { granted: true, reason: 'purchased', balance };
    }

    if (zine.monetization_type === 'free' || zine.access_level === 'public') {
        return { granted: true, reason: 'free', balance };
    }

    if (zine.monetization_type === 'crowdfund' && isFunded(zine)) {
        return { granted: true, reason: 'funded', balance };
    }

    if (user && zine.monetization_type === 'subscription') {
        const subscription = await dbSubscriptionExists(user.id, zine.user_id);
        if (subscription) return { granted: true, reason: 'subscribed', balance };
    }

    if (zine.monetization_type === 'subscription') {
        return { granted: false, reason: 'subscription_required', balance };
    }
    if (zine.monetization_type === 'crowdfund') {
        return { granted: false, reason: 'funding_required', balance };
    }
    return { granted: false, reason: 'payment_required', balance };
}

// Bound here so evaluateAccess can be reused by server.cjs without the
// function needing the module-scope db import.
let db = null;
let db_purchaseExists = async () => false;
let dbSubscriptionExists = async () => false;

/** Wire the shared db handle and existence lookups. */
function attachDb(handle) {
    db = handle;
    db_purchaseExists = async (userId, zineId) => {
        const row = await db('purchases').where({ user_id: userId, zine_id: zineId }).first();
        return Boolean(row);
    };
    dbSubscriptionExists = async (subscriberId, creatorId) => {
        const row = await db('subscriptions')
            .where({ subscriber_id: subscriberId, creator_id: creatorId, is_active: 1 })
            .first();
        if (!row) return false;
        if (row.expires_at && new Date(row.expires_at) < new Date()) return false;
        return true;
    };
}

function isFunded(zine) {
    return Number(zine.funding_goal) > 0 && Number(zine.amount_raised) >= Number(zine.funding_goal);
}

module.exports = { registerAccountRoutes, evaluateAccess, attachDb, isFunded };
