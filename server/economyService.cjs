const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const xrpl = require('xrpl');
const xrpService = require('./xrpService.cjs');
const { encrypt, decrypt } = require('./encryption.cjs');

// Rate: 1 USD = 100 VPC (Void Press Credits)
const CREDITS_PER_USD = 100;

/**
 * Initialize Stripe with API key
 */
function initStripe() {
    if (!process.env.STRIPE_SECRET_KEY) {
        console.warn('WARNING: STRIPE_SECRET_KEY not set - Stripe payments will be simulated');
        return null;
    }
    return stripe;
}

/**
 * Step 1: User requests to buy credits
 * Creates a Stripe Checkout Session
 */
async function createCheckoutSession(userId, amountUSD, userEmail) {
    const vpcAmount = amountUSD * CREDITS_PER_USD;
    const stripeInstance = initStripe();

    if (!stripeInstance) {
        return {
            sessionId: 'mock_session_' + Date.now(),
            url: null,
            vpcAmount,
            simulated: true
        };
    }

    try {
        const session = await stripeInstance.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Void Press Credits',
                            description: `${vpcAmount} credits for Void Press platform`
                        },
                        unit_amount: Math.round(amountUSD * 100)
                    },
                    quantity: 1
                }
            ],
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?payment=cancelled`,
            metadata: {
                userId: userId.toString(),
                type: 'VPC_PURCHASE',
                vpcAmount: vpcAmount.toString()
            },
            customer_email: userEmail
        });

        return {
            sessionId: session.id,
            url: session.url,
            vpcAmount
        };
    } catch (error) {
        console.error('Error creating Stripe checkout session:', error);
        throw error;
    }
}

/**
 * Step 2: Retrieve checkout session to get payment status
 */
async function retrieveCheckoutSession(sessionId) {
    const stripeInstance = initStripe();

    if (!stripeInstance || sessionId.startsWith('mock_session_')) {
        return {
            payment_status: 'paid',
            metadata: {
                userId: '1',
                vpcAmount: '100'
            }
        };
    }

    try {
        const session = await stripeInstance.checkout.sessions.retrieve(sessionId);
        return session;
    } catch (error) {
        console.error('Error retrieving Stripe session:', error);
        throw error;
    }
}

/**
 * Step 3: Handle successful payment and issue XRP credits
 */
async function fulfillCreditPurchase(userId, vpcAmount, db) {
    console.log(`Fulfilling purchase for User ${userId}: ${vpcAmount} VPC`);

    try {
        const wallet = await db('wallets').where({ user_id: userId }).first();

        if (!wallet || !wallet.xrp_address) {
            console.log(`User ${userId} has no XRP wallet - adding credits to account only`);
            await db('credits')
                .insert({ user_id: userId, balance: vpcAmount })
                .onConflict('user_id')
                .merge({
                    balance: db.raw('credits.balance + ?', [vpcAmount]),
                    updated_at: db.fn.now()
                });
            return { success: true, creditsOnly: true, amount: vpcAmount };
        }

        const userXrpAddress = wallet.xrp_address;
        let txHash = null;

        try {
            txHash = await xrpService.issuePlatformCredits(userXrpAddress, vpcAmount);
            console.log(`Issued ${vpcAmount} VPC to ${userXrpAddress}. Tx: ${txHash}`);
        } catch (error) {
            console.error("Failed to issue credits on XRPL (will fallback to credits only):", error);
        }

        await db('credits')
            .insert({ user_id: userId, balance: vpcAmount })
            .onConflict('user_id')
            .merge({
                balance: db.raw('credits.balance + ?', [vpcAmount]),
                updated_at: db.fn.now()
            });

        return {
            success: true,
            txHash,
            amount: vpcAmount,
            xrpAddress: userXrpAddress,
            fallback: !txHash
        };
    } catch (error) {
        console.error('Failed to fulfill credit purchase:', error);
        throw error;
    }
}

/**
 * Handle Stripe Webhook
 */
async function handleStripeWebhook(signature, payload, db) {
    const stripeInstance = initStripe();
    if (!stripeInstance) return { received: true, simulated: true };

    let event;
    try {
        event = stripeInstance.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        throw err;
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { userId, type, vpcAmount } = session.metadata || {};

        if (type === 'VPC_PURCHASE' && userId && vpcAmount) {
            await fulfillCreditPurchase(parseInt(userId), parseInt(vpcAmount), db);
        }
    }

    return { received: true };
}

/**
 * Create Creator Token
 */
async function createCreatorToken(creatorUserId, tokenCode, tokenName, description, initialSupply, pricePerToken, db) {
    const wallet = await db('wallets').where({ user_id: creatorUserId }).first();
    if (!wallet || !wallet.xrp_address) {
        throw new Error('Creator must set up an XRP wallet first');
    }

    const xrpCurrencyCode = tokenCode.length === 3 ? tokenCode.toUpperCase() : Buffer.from(tokenCode).toString('hex').padEnd(40, '0').toUpperCase();

    const [tokenId] = await db('tokens').insert({
        creator_id: creatorUserId,
        token_code: tokenCode.toUpperCase(),
        token_name,
        description: description || '',
        initial_supply: initialSupply || 1000000,
        current_supply: initialSupply || 1000000,
        price_per_token: pricePerToken || 0.01,
        xrp_currency_code: xrpCurrencyCode
    });

    return {
        tokenId,
        tokenCode: tokenCode.toUpperCase(),
        tokenName,
        xrpCurrencyCode,
        issuer: wallet.xrp_address,
        initialSupply: initialSupply || 1000000,
        pricePerToken: pricePerToken || 0.01
    };
}

/**
 * Issue Creator Token to a buyer
 */
async function issueCreatorTokenToBuyer(creatorUserId, buyerXrpAddress, tokenCode, amount, db) {
    const wallet = await db('wallets').where({ user_id: creatorUserId }).first();
    if (!wallet || !wallet.xrp_secret_encrypted) throw new Error('Creator wallet not found or invalid');

    const decryptedSecret = decrypt(wallet.xrp_secret_encrypted);

    try {
        const txHash = await xrpService.issueCreatorToken(decryptedSecret, buyerXrpAddress, tokenCode, amount);
        return { success: true, txHash, amount, to: buyerXrpAddress };
    } catch (error) {
        console.error('Failed to issue creator token on XRPL:', error);
        throw error;
    }
}

/**
 * Establish trust line for a user
 */
async function establishTrustLine(userSeed, issuerXrpAddress, currencyCode, limit = '1000000000') {
    try {
        const success = await xrpService.setTrustLine(userSeed, issuerXrpAddress, currencyCode, limit);
        return { success };
    } catch (error) {
        console.error('Error establishing trust line:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Transfer Credits (VPC) between users
 */
async function transferCredits(fromUserId, toUserId, amount, db) {
    const fromWallet = await db('wallets').where({ user_id: fromUserId }).first();
    const toWallet = await db('wallets').where({ user_id: toUserId }).first();

    if (!fromWallet || !fromWallet.xrp_secret_encrypted) throw new Error('Sender wallet not found');
    if (!toWallet || !toWallet.xrp_address) throw new Error('Receiver wallet not found');

    const decryptedSecret = decrypt(fromWallet.xrp_secret_encrypted);
    const platformIssuer = (xrpl.Wallet.fromSeed(process.env.PLATFORM_WALLET_SEED)).address;

    const txHash = await xrpService.sendPayment(decryptedSecret, toWallet.xrp_address, amount, 'VPC', platformIssuer);
    if (!txHash) throw new Error('XRPL Transaction failed');

    return { success: true, txHash };
}

/**
 * Get User Wallet
 */
async function getWallet(userId, db) {
    return db('wallets').where({ user_id: userId }).first();
}

/**
 * Create/Get User Wallet
 */
async function createWallet(userId, db) {
    const existing = await getWallet(userId, db);
    if (existing) return existing;

    const walletData = await xrpService.createWallet();
    const encryptedSeed = encrypt(walletData.seed);

    await db('wallets').insert({
        user_id: userId,
        xrp_address: walletData.address,
        xrp_secret_encrypted: encryptedSeed,
        is_verified: 1
    });

    return { xrp_address: walletData.address, is_verified: 1 };
}

module.exports = {
    createCheckoutSession,
    retrieveCheckoutSession,
    fulfillCreditPurchase,
    handleStripeWebhook,
    createCreatorToken,
    issueCreatorTokenToBuyer,
    establishTrustLine,
    transferCredits,
    getWallet,
    createWallet,
    CREDITS_PER_USD
};
