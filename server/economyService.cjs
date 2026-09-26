/*
 * Payments — the single funding source for the credit vault.
 *
 * This service used to be the economy: it held the Stripe/XRP plumbing, the
 * "VPC" credit balance, creator-issued token issuance, trust lines, and
 * subscriptions. The credit balance now lives in `vaultService.cjs` as ledger
 * entries, and creator tokens are gone. What remains here is exactly one
 * job — turning money into credits.
 *
 * Everything degrades to a simulated result when no provider is configured,
 * and in every mode the credits are issued through `vaultService.grant`, so
 * the accounting path exercised in development is the same one that runs in
 * production.
 */

const vault = require('./vaultService.cjs');

let stripe = null;
let stripeLoadError = null;
try {
    const Stripe = require('stripe');
    if (process.env.STRIPE_SECRET_KEY) {
        stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    }
} catch (err) {
    stripeLoadError = err;
}

/** True when no real payment provider is configured. */
const isSimulated = () => !stripe;

/**
 * Create a checkout session for a credit purchase.
 *
 * Returns `{ checkoutUrl }` when Stripe is live, and `{ simulated: true }`
 * otherwise. The caller issues the credits in the simulated case.
 *
 * @param {object} args
 * @param {number} args.userId
 * @param {string} args.email
 * @param {number} args.amountUSD
 * @returns {Promise<{ checkoutUrl: string|null, sessionId: string, simulated: boolean, units: number }>}
 */
async function purchaseCredits({ userId, email, amountUSD }) {
    const amount = Number(amountUSD);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new vault.ValidationError('Amount must be greater than zero');
    }

    const units = Math.round(amount * vault.UNITS_PER_USD);

    if (!stripe) {
        return { checkoutUrl: null, sessionId: `sim_${Date.now()}`, simulated: true, units };
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
            {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'SVRN Credits',
                        description: `${vault.formatMoney(amount)} in publishing credit`
                    },
                    unit_amount: Math.round(amount * 100)
                },
                quantity: 1
            }
        ],
        mode: 'payment',
        success_url: `${frontendUrl}/?topup=success`,
        cancel_url: `${frontendUrl}/?topup=cancelled`,
        metadata: {
            userId: String(userId),
            type: 'credit_purchase',
            units: String(units)
        },
        customer_email: email || undefined
    });

    return { checkoutUrl: session.url, sessionId: session.id, simulated: false, units };
}

/**
 * Handle a Stripe webhook. Issues credits for a completed checkout.
 *
 * The previous version of this function read `metadata.userId` and fell back to
 * a hard-coded `'1'`, so a real purchase could be credited to the wrong
 * account. Untrusted metadata is now rejected outright rather than guessed.
 *
 * @param {string} signature webhook signature
 * @param {Buffer|string} payload raw request body
 * @param {object} db knex instance
 * @returns {Promise<{ received: boolean, simulated?: boolean, issued?: boolean }>}
 */
async function handleWebhook(signature, payload, db) {
    if (!stripe) {
        return { received: true, simulated: true };
    }

    let event;
    try {
        event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        // Do not swallow: an unverified webhook must be a hard failure.
        err.status = 400;
        throw err;
    }

    if (event.type !== 'checkout.session.completed') {
        return { received: true };
    }

    const session = event.data.object;
    const { userId, type, units } = session.metadata || {};

    if (type !== 'credit_purchase' || !userId || !units) {
        return { received: true, issued: false };
    }

    const user = await db('users').where({ id: Number(userId) }).first();
    if (!user) {
        // The account was deleted between checkout and webhook. Surface it
        // rather than crediting a row that does not exist.
        console.error(`Credit purchase for unknown user ${userId} (session ${session.id})`);
        return { received: true, issued: false };
    }

    await vault.grant({
        userId: user.id,
        amountUnits: Number(units),
        reason: 'grant',
        memo: `Stripe checkout ${session.id}`
    });

    return { received: true, issued: true };
}

module.exports = {
    purchaseCredits,
    handleWebhook,
    isSimulated,
    stripeLoadError
};
