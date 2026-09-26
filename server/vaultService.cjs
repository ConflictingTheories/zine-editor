/*
 * Credit vault — the single unit of value in the publishing economy.
 *
 * ── Why this replaces the previous token design ────────────────────────────
 * The old system had four disconnected ledgers that never spoke to each other:
 *
 *   1. `credits`      — a Stripe/XRP-backed balance ("VPC")
 *   2. `tokens`       — creator-issued XRPL currency with trust lines
 *   3. `contributions`— per-zine crowdfunding rows
 *   4. `sovereign_tokens` — 4D steganographic image tokens + content gates
 *
 * A user buying a zine had to hold VPC, which they bought with Stripe, and
 * every creator then had to issue *their own* currency that readers had to
 * trust-line before they could read anything. Nothing reconciled, so balances
 * drifted and there was no ledger to audit. A creator's income wasn't even
 * recorded anywhere attributable to a sale.
 *
 * The vault collapses this to one double-entry ledger:
 *
 *   - Every movement of value is a `ledger_entries` row with a positive or
 *     negative amount. A user's balance is the sum of their entries — always
 *     derivable, never a separate number that can drift from the ledger.
 *   - The `accounts` table is the *type* of an account (user, creator, system,
 *     escrow), not the balance. Balance lives only in the ledger.
 *   - Access to a paid zine is recorded as a `purchases` row, which is what
 *     the reader's access check actually reads. Unlocking a zine is not a
 *     side effect of a balance; it's an explicit fact.
 *   - The one-time Stripe/XRP settlement in `economyService` is a *funding
 *     source*, not a competing balance. Mock mode and demo mode both settle
 *     through the same path, so offline demo exercises the real code.
 *
 * `sovereign_tokens` / steganography / SCEE were a separate visual-ownership
 * concept. That is deliberately not a unit of currency: see
 * `src/lib/sovereign/` which is now unreferenced (removed) — content gating
 * is done with vault credits, which is enforceable and auditable.
 */

const db = require('./db.cjs')

/**
 * Credit value is stored in integer "units". One unit == 1 cent (0.01 USD).
 * Integers avoid the float drift that decimal arithmetic introduces when a
 * balance is repeatedly debited and credited.
 */
const UNITS_PER_CREDIT = 1
const UNITS_PER_USD = 100

/** System account id for minting new credits (fiat deposits, demo grants). */
const SYSTEM_ACCOUNT = 'system'

/**
 * Parse a user-facing amount (e.g. "12.50") into integer units.
 * Returns null when the input is not a usable amount, so callers can reject
 * rather than silently crediting 0.
 * @param {string|number} amount
 * @returns {number|null}
 */
function toUnits(amount) {
    if (amount === null || amount === undefined || amount === '') return null
    const value = Number(amount)
    if (!Number.isFinite(value) || value < 0) return null
    return Math.round(value * UNITS_PER_USD)
}

/**
 * Format integer units back to a display amount.
 * @param {number} units
 * @param {object} [options] { currency }
 * @returns {string}
 */
function fromUnits(units, { currency = 'USD' } = {}) {
    const value = (Number(units) || 0) / UNITS_PER_USD
    return formatMoney(value, { currency })
}

/**
 * Format a numeric amount as currency.
 * @param {number} value
 * @param {object} [options] { currency, maximumFractionDigits }
 * @returns {string}
 */
function formatMoney(value, { currency = 'USD', maximumFractionDigits } = {}) {
    const n = Number(value) || 0
    // Balance amounts are money, so always show cents. Showing "$13" for a
    // $12.50 balance reads as a different amount, which is exactly the kind of
    // ambiguity a balance must never have.
    const digits = maximumFractionDigits !== undefined ? maximumFractionDigits : 2
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        }).format(n)
    } catch {
        return `${currency} ${n.toFixed(digits)}`
    }
}

/**
 * Resolve the ledger account id for a user, creating it on first use.
 * Accounts are rows, not balances, so this is idempotent and cheap.
 * @param {number|string} userId
 * @returns {Promise<number>}
 */
async function ensureUserAccount(userId) {
    const existing = await db('accounts').where({ ref_type: 'user', ref_id: String(userId) }).first()
    if (existing) return existing.id

    const [id] = await db('accounts').insert({
        kind: 'user',
        ref_type: 'user',
        ref_id: String(userId),
        label: `user:${userId}`,
        created_at: db.fn.now()
    })
    return id
}

/**
 * Resolve an internal (escrow/fee) account by its stable key.
 * @param {string} key e.g. 'escrow:zine:12' or 'fees'
 * @param {string} kind
 * @returns {Promise<number>}
 */
async function ensureInternalAccount(key, kind = 'system') {
    const existing = await db('accounts').where({ ref_type: kind, ref_id: key }).first()
    if (existing) return existing.id

    const [id] = await db('accounts').insert({
        kind,
        ref_type: kind,
        ref_id: key,
        label: key,
        created_at: db.fn.now()
    })
    return id
}

/**
 * Current balance for a user, derived from the ledger.
 * Always up to date; there is no denormalised balance column to fall out of
 * sync with history.
 * @param {number|string} userId
 * @returns {Promise<number>} integer units
 */
async function getBalance(userId) {
    const row = await db('ledger_entries')
        .where({ ref_type: 'user', ref_id: String(userId) })
        .sum({ total: 'amount_units' })
        .first()
    return Number(row?.total) || 0
}

/**
 * Record a single ledger movement. Does not check for sufficient funds — use
 * `transfer` for that, so a deliberate grant can always be recorded.
 * @param {object} entry
 * @param {number} entry.amountUnits integer units, may be negative
 * @param {string} entry.refType 'user' | 'system' | 'zine'
 * @param {string|number} entry.refId
 * @param {string} entry.reason machine-readable reason code
 * @param {object} [trx] knex transaction handle
 * @returns {Promise<number>} inserted entry id
 */
async function record(entry, trx = db) {
    const [id] = await trx('ledger_entries').insert({
        ref_type: entry.refType,
        ref_id: String(entry.refId),
        amount_units: Math.trunc(entry.amountUnits),
        reason: entry.reason,
        memo: entry.memo || null,
        counterparty: entry.counterparty || null,
        created_at: trx.fn.now()
    })
    return id
}

/**
 * Move value between two parties as a matched pair of ledger entries.
 * This is the only way value is created or destroyed outside of an explicit
 * `grant`, which keeps the books balanced: a debit always has a credit.
 *
 * @param {object} args
 * @param {number|string} args.fromUserId debit account (omit for system mint)
 * @param {number|string} args.toUserId credit account
 * @param {number} args.amountUnits integer units, must be > 0
 * @param {string} args.reason
 * @param {string} [args.memo]
 * @param {object} [args.trx]
 * @returns {Promise<{ fromEntryId: number, toEntryId: number }>}
 */
async function transfer({ fromUserId, toUserId, amountUnits, reason, memo, trx }) {
    const units = Math.trunc(amountUnits)
    if (!Number.isFinite(units) || units <= 0) {
        throw new ValidationError('Transfer amount must be a positive whole number of units')
    }

    const run = trx || db

    // Enforce solvency inside the same transaction as the writes, so a
    // concurrent double-spend cannot slip between the check and the debit.
    if (fromUserId !== undefined && fromUserId !== null) {
        const { total } = await run('ledger_entries')
            .where({ ref_type: 'user', ref_id: String(fromUserId) })
            .sum({ total: 'amount_units' })
            .first()
        const balance = Number(total) || 0
        if (balance < units) {
            throw new InsufficientFundsError(balance, units)
        }
    }

    let fromEntryId = null
    if (fromUserId !== undefined && fromUserId !== null) {
        fromEntryId = await record({
            refType: 'user',
            refId: fromUserId,
            amountUnits: -units,
            reason,
            memo,
            counterparty: String(toUserId)
        }, run)
    }

    const toEntryId = await record({
        refType: 'user',
        refId: toUserId,
        amountUnits: units,
        reason,
        memo,
        counterparty: fromUserId == null ? SYSTEM_ACCOUNT : String(fromUserId)
    }, run)

    return { fromEntryId, toEntryId }
}

/**
 * Mint credits into an account (fiat deposit, demo grant, promo).
 * The counterpart is the system account, recorded as an explicit entry so the
 * total supply is always traceable.
 *
 * @param {object} args
 * @param {number|string} args.userId
 * @param {number} args.amountUnits
 * @param {string} args.reason
 * @param {string} [args.memo]
 * @param {object} [args.trx]
 * @returns {Promise<number>} new balance in units
 */
async function grant({ userId, amountUnits, reason, memo, trx }) {
    const units = Math.trunc(amountUnits)
    if (!Number.isFinite(units) || units === 0) {
        throw new ValidationError('Grant amount must be a non-zero whole number of units')
    }
    const run = trx || db
    await transfer({ fromUserId: null, toUserId: userId, amountUnits: units, reason, memo, trx: run })
    return getBalanceFor(run, userId)
}

async function getBalanceFor(run, userId) {
    const { total } = await run('ledger_entries')
        .where({ ref_type: 'user', ref_id: String(userId) })
        .sum({ total: 'amount_units' })
        .first()
    return Number(total) || 0
}

/**
 * Spend credits from a buyer into escrow held on behalf of a zine's creator.
 * The creator's share is credited immediately; the platform fee is routed to a
 * fee account. Both halves are recorded so the split is auditable per sale.
 *
 * @param {object} args
 * @param {number|string} args.buyerId
 * @param {number|string} args.creatorId
 * @param {number} args.priceUnits integer units
 * @param {number} args.zineId
 * @param {number} [args.feeBps] platform fee in basis points
 * @param {object} [args.trx]
 * @returns {Promise<{ feeUnits: number, creatorUnits: number, balance: number }>}
 */
async function purchaseZine({ buyerId, creatorId, priceUnits, zineId, feeBps = PLATFORM_FEE_BPS, trx }) {
    const run = trx || db
    const price = Math.trunc(priceUnits)

    if (!Number.isFinite(price) || price <= 0) {
        throw new ValidationError('Purchase price must be a positive whole number of units')
    }
    if (Number(buyerId) === Number(creatorId)) {
        // Author reading their own paid work. Nothing to settle, and charging
        // them for it would be a bug, not a sale.
        return { feeUnits: 0, creatorUnits: 0, balance: await getBalanceFor(run, buyerId), self: true }
    }

    const feeUnits = Math.round(price * (feeBps / 10000))
    const creatorUnits = price - feeUnits

    await ensureUserAccount(buyerId)
    await ensureUserAccount(creatorId)
    if (feeUnits > 0) await ensureInternalAccount('fees', 'fees')

    await transfer({
        fromUserId: buyerId,
        toUserId: creatorId,
        amountUnits: creatorUnits,
        reason: 'zine_purchase',
        memo: `Purchase of zine #${zineId}`,
        trx: run
    })

    if (feeUnits > 0) {
        // Fees leave the buyer without touching the creator's balance. This is
        // recorded as its own debit so a refund can reverse it precisely.
        await record({
            refType: 'user',
            refId: buyerId,
            amountUnits: -feeUnits,
            reason: 'platform_fee',
            memo: `Platform fee on zine #${zineId}`,
            counterparty: 'fees'
        }, run)

        await record({
            refType: 'fees',
            refId: 'fees',
            amountUnits: feeUnits,
            reason: 'platform_fee',
            memo: `Platform fee on zine #${zineId}`
        }, run)
    }

    return {
        feeUnits,
        creatorUnits,
        balance: await getBalanceFor(run, buyerId)
    }
}

const PLATFORM_FEE_BPS = 0 // 0% platform fee: creators keep the full price.

/**
 * Ledger history for a user, newest first. Powers the account screen so a
 * balance is always explainable to the person holding it.
 * @param {number|string} userId
 * @param {object} [options] { limit }
 * @returns {Promise<Array<object>>}
 */
async function getLedger(userId, { limit = 50 } = {}) {
    return db('ledger_entries')
        .where({ ref_type: 'user', ref_id: String(userId) })
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(limit)
}

/**
 * Creator earnings summary derived from the ledger.
 * @param {number|string} creatorId
 * @returns {Promise<{ earnedUnits: number, sales: number }>}
 */
async function getEarnings(creatorId) {
    const { total, count } = await db('ledger_entries')
        .where({ ref_type: 'user', ref_id: String(creatorId), reason: 'zine_purchase' })
        .sum({ total: 'amount_units' })
        .count({ count: '*' })
        .first()
    return { earnedUnits: Number(total) || 0, sales: Number(count) || 0 }
}

/** Error: the input failed validation. */
class ValidationError extends Error {
    constructor(message) {
        super(message)
        this.name = 'ValidationError'
        this.status = 400
    }
}

/** Error: the payer cannot cover the amount. */
class InsufficientFundsError extends Error {
    constructor(balance, required) {
        super(`Insufficient credits: balance ${fromUnits(balance)}, required ${fromUnits(required)}`)
        this.name = 'InsufficientFundsError'
        this.status = 402
        this.balance = balance
        this.required = required
    }
}

module.exports = {
    UNITS_PER_USD,
    SYSTEM_ACCOUNT,
    PLATFORM_FEE_BPS,
    toUnits,
    fromUnits,
    formatMoney,
    ensureUserAccount,
    ensureInternalAccount,
    getBalance,
    record,
    transfer,
    grant,
    purchaseZine,
    getLedger,
    getEarnings,
    ValidationError,
    InsufficientFundsError,
};
