const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const xrpService = require('./xrpService');

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
    return stripe(process.env.STRIPE_SECRET_KEY);
}

/**
 * Step 1: User requests to buy credits
 * Creates a Stripe Checkout Session
 */
async function createCheckoutSession(userId, amountUSD, userEmail) {
    const vpcAmount = amountUSD * CREDITS_PER_USD;

    const stripeInstance = initStripe();

    if (!stripeInstance) {
        // Return mock data for development
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
 * This is called after payment confirmation
 */
async function fulfillCreditPurchase(userId, vpcAmount, db) {
    console.log(`Fulfilling purchase for User ${userId}: ${vpcAmount} VPC`);

    if (!db) {
        throw new Error('Database not provided');
    }

    return new Promise((resolve, reject) => {
        db.get(`SELECT w.xrp_address FROM wallets w WHERE w.user_id = ?`, [userId], async (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return reject(new Error('Failed to get user wallet'));
            }

            if (!row || !row.xrp_address) {
                console.log(`User ${userId} has no XRP wallet - adding credits to account only`);

                db.run(`INSERT INTO credits (user_id, balance) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?`,
                    [userId, vpcAmount, vpcAmount],
                    (err) => {
                        if (err) {
                            return reject(new Error('Failed to add credits'));
                        }
                        resolve({
                            success: true,
                            creditsOnly: true,
                            amount: vpcAmount
                        });
                    }
                );
                return;
            }

            const userXrpAddress = row.xrp_address;

            try {
                const txHash = await xrpService.issuePlatformCredits(userXrpAddress, vpcAmount);
                console.log(`Issued ${vpcAmount} VPC to ${userXrpAddress}. Tx: ${txHash}`);

                db.run(`INSERT INTO credits (user_id, balance) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?`,
                    [userId, vpcAmount, vpcAmount],
                    (err) => {
                        if (err) console.error('Failed to update credits in DB:', err);
                    }
                );

                resolve({
                    success: true,
                    txHash,
                    amount: vpcAmount,
                    xrpAddress: userXrpAddress
                });
            } catch (error) {
                console.error("Failed to issue credits on XRPL:", error);

                db.run(`INSERT INTO credits (user_id, balance) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?`,
                    [userId, vpcAmount, vpcAmount],
                    (err) => {
                        if (err) return reject(new Error('Failed to fulfill purchase'));
                        resolve({
                            success: true,
                            fallback: true,
                            amount: vpcAmount,
                            xrpError: error.message
                        });
                    }
                );
            }
        });
    });
}

/**
 * Handle Stripe Webhook
 */
async function handleStripeWebhook(signature, payload, db) {
    const stripeInstance = initStripe();

    if (!stripeInstance) {
        console.log('Stripe not configured - skipping webhook processing');
        return { received: true, simulated: true };
    }

    let event;
    try {
        event = stripeInstance.webhooks.constructEvent(
            payload,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        throw err;
    }

    console.log(`Received Stripe webhook: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { userId, type, vpcAmount } = session.metadata || {};

        if (type === 'VPC_PURCHASE' && userId && vpcAmount) {
            console.log(`Processing VPC_PURCHASE for user ${userId}: ${vpcAmount} credits`);
            await fulfillCreditPurchase(parseInt(userId), parseInt(vpcAmount), db);
        }
    }

    return { received: true };
}

/**
 * Create Creator Token
 */
async function createCreatorToken(creatorUserId, tokenCode, tokenName, description, initialSupply, pricePerToken, db) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT w.xrp_address, w.xrp_secret_encrypted FROM wallets w WHERE w.user_id = ?`,
            [creatorUserId],
            async (err, walletRow) => {
                if (err) return reject(new Error('Failed to get creator wallet'));
                if (!walletRow || !walletRow.xrp_address) {
                    return reject(new Error('Creator must set up an XRP wallet first'));
                }

                const xrpCurrencyCode = tokenCode.toUpperCase().slice(0, 20);

                db.run(`
                    INSERT INTO tokens 
                    (creator_id, token_code, token_name, description, initial_supply, current_supply, price_per_token, xrp_currency_code) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,
                    [creatorUserId, tokenCode.toUpperCase(), tokenName, description || '',
                        initialSupply || 1000000, initialSupply || 1000000, pricePerToken || 0.01, xrpCurrencyCode],
                    function (err) {
                        if (err) {
                            console.error('Failed to create token:', err);
                            return reject(new Error('Failed to create token: ' + err.message));
                        }

                        resolve({
                            tokenId: this.lastID,
                            tokenCode: tokenCode.toUpperCase(),
                            tokenName,
                            xrpCurrencyCode,
                            issuer: walletRow.xrp_address,
                            instructions: `To receive ${tokenName}, users must add a Trust Line to your address (${walletRow.xrp_address}) for currency code ${xrpCurrencyCode}`,
                            initialSupply: initialSupply || 1000000,
                            pricePerToken: pricePerToken || 0.01
                        });
                    }
                );
            }
        );
    });
}

/**
 * Issue Creator Token to a buyer
 */
async function issueCreatorTokenToBuyer(creatorUserId, buyerXrpAddress, tokenCode, amount, db) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT w.xrp_address, w.xrp_secret_encrypted FROM wallets w WHERE w.user_id = ?`,
            [creatorUserId],
            async (err, walletRow) => {
                if (err || !walletRow) return reject(new Error('Creator wallet not found'));

                const creatorSeed = walletRow.xrp_secret_encrypted;
                if (!creatorSeed) return reject(new Error('Creator wallet not properly configured'));

                try {
                    const result = await xrpService.issueCreatorToken(
                        creatorSeed,
                        buyerXrpAddress,
                        tokenCode,
                        amount
                    );

                    resolve({
                        success: result,
                        txHash: result.hash || result,
                        amount,
                        to: buyerXrpAddress
                    });
                } catch (error) {
                    console.error('Failed to issue creator token on XRPL:', error);
                    reject(error);
                }
            }
        );
    });
}

/**
 * Check if user has established trust line
 */
async function checkUserTrustLine(userXrpAddress, issuerXrpAddress, currencyCode) {
    try {
        const exists = await xrpService.checkTrustLine(userXrpAddress, issuerXrpAddress, currencyCode);
        return { exists };
    } catch (error) {
        console.error('Error checking trust line:', error);
        return { exists: false, error: error.message };
    }
}

/**
 * Establish trust line for a user
 */
async function establishTrustLine(userSeed, issuerXrpAddress, currencyCode, limit = '1000000000') {
    try {
        const result = await xrpService.setTrustLine(userSeed, issuerXrpAddress, currencyCode, limit);
        return { success: result };
    } catch (error) {
        console.error('Error establishing trust line:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Transfer Credits (VPC) between users
 */
async function transferCredits(fromUserId, toUserId, amount, db) {
    return new Promise((resolve, reject) => {
        // Get wallets for both users
        db.all(`SELECT user_id, xrp_address, xrp_secret_encrypted FROM wallets WHERE user_id IN (?, ?)`,
            [fromUserId, toUserId],
            async (err, rows) => {
                if (err) return reject(err);

                const fromWallet = rows.find(r => r.user_id === fromUserId);
                const toWallet = rows.find(r => r.user_id === toUserId);

                if (!fromWallet || !fromWallet.xrp_secret_encrypted) return reject(new Error('Sender wallet not found'));
                if (!toWallet || !toWallet.xrp_address) return reject(new Error('Receiver wallet not found'));

                // In a real app, decrypt the seed here
                const senderSeed = fromWallet.xrp_secret_encrypted;

                // Get Platform Wallet Address (Issuer of VPC)
                // For this implementation, we assume the platform wallet address is known or derived
                // Here we use a placeholder or fetch from config if available. 
                // Ideally, this comes from xrpService configuration.
                const platformIssuer = (xrpl.Wallet.fromSeed(process.env.PLATFORM_WALLET_SEED)).address;

                try {
                    const txHash = await xrpService.sendPayment(
                        senderSeed,
                        toWallet.xrp_address,
                        amount,
                        'VPC',
                        platformIssuer
                    );

                    if (!txHash) return reject(new Error('XRPL Transaction failed'));
                    resolve({ success: true, txHash });
                } catch (error) {
                    reject(error);
                }
            }
        );
    });
}

module.exports = {
    createCheckoutSession,
    retrieveCheckoutSession,
    fulfillCreditPurchase,
    handleStripeWebhook,
    createCreatorToken,
    issueCreatorTokenToBuyer,
    checkUserTrustLine,
    establishTrustLine,
    transferCredits,
    CREDITS_PER_USD
};
