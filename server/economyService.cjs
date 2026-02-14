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
    // `stripe` is already initialized above with the secret key
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
                    // Issue token on XRPL and return tx hash
                    const txHash = await xrpService.issueCreatorToken(
                        creatorSeed,
                        buyerXrpAddress,
                        tokenCode,
                        amount
                    );

                    resolve({
                        success: true,
                        txHash,
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


// ═══════════════════════════════════════════════════
// NEW MARKETPLACE LOGIC
// ═══════════════════════════════════════════════════

/**
 * Get User Wallet
 */
async function getWallet(userId, db) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT user_id, xrp_address, payid, is_verified FROM wallets WHERE user_id = ?`, [userId], (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
        });
    });
}

/**
 * Create/Get User Wallet
 */
async function createWallet(userId, db) {
    // Check if exists
    const existing = await getWallet(userId, db);
    if (existing) return existing;

    // Generate new using xrpService
    const walletData = await xrpService.createWallet();

    return new Promise((resolve, reject) => {
        // ENCRYPT SEED IN REAL APP! For now storing as is (in existing column xrp_secret_encrypted)
        // Assume encryption happens or simplify for this step.
        const encryptedSeed = encrypt(walletData.seed);

        db.run(`INSERT INTO wallets (user_id, xrp_address, xrp_secret_encrypted, is_verified) VALUES (?, ?, ?, 1)`,
            [userId, walletData.address, encryptedSeed],
            function (err) {
                if (err) return reject(err);
                resolve({
                    xrp_address: walletData.address,
                    is_verified: 1
                });
            }
        );
    });
}

/**
 * Get All Tokens
 */
async function getTokens(db) {
    return new Promise((resolve, reject) => {
        db.all(`SELECT t.*, u.username as creator_name FROM tokens t JOIN users u ON t.creator_id = u.id WHERE t.is_active = 1`, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

/**
 * Get Single Token
 */
async function getToken(tokenId, db) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT t.*, u.username as creator_name FROM tokens t JOIN users u ON t.creator_id = u.id WHERE t.id = ?`, [tokenId], (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

/**
 * Buy Creator Token
 */
async function buyCreatorToken(buyerId, tokenId, amount, db) {
    // 1. Get Token Info
    const token = await getToken(tokenId, db);
    if (!token) throw new Error('Token not found');

    const cost = amount * token.price_per_token;

    // 2. Check Buyer Balance (Credits)
    return new Promise((resolve, reject) => {
        db.get(`SELECT balance FROM credits WHERE user_id = ?`, [buyerId], async (err, creditRow) => {
            if (err) return reject(err);
            if (!creditRow || creditRow.balance < cost) return reject(new Error('Insufficient credits'));

            // 3. Deduct Credits
            db.run(`UPDATE credits SET balance = balance - ? WHERE user_id = ?`, [cost, buyerId], async (err) => {
                if (err) return reject(err);

                // 4. Issue Token (XRPL)
                try {
                    // Get Buyer XRP Address
                    const buyerWallet = await getWallet(buyerId, db);
                    if (!buyerWallet || !buyerWallet.xrp_address) throw new Error('Buyer needs XRP wallet');

                    // Issue Logic
                    // We need the creator's seed to issue. 
                    // This implies the creator has authorized the platform to issue on their behalf OR we are simulating interaction.
                    // For this implementation, we'll assume we can get the creator's seed from the DB (stored encrypted).
                    const creatorWalletRow = await new Promise((res, rej) => {
                        db.get(`SELECT xrp_secret_encrypted FROM wallets WHERE user_id = ?`, [token.creator_id], (e, r) => e ? rej(e) : res(r));
                    });

                    if (!creatorWalletRow) throw new Error('Creator wallet not found');

                    const decryptedSecret = decrypt(creatorWalletRow.xrp_secret_encrypted);

                    const txHash = await xrpService.issueCreatorToken(
                        decryptedSecret,
                        buyerWallet.xrp_address,
                        token.xrp_currency_code,
                        amount
                    );

                    // 5. Record Transaction
                    db.run(`INSERT INTO transactions (from_user_id, to_user_id, token_id, amount, type, xrp_tx_hash, description) VALUES (?, ?, ?, ?, 'TOKEN_PURCHASE', ?, ?)`,
                        [buyerId, token.creator_id, tokenId, amount, txHash, `Bought ${amount} ${token.token_code}`]
                    );

                    // 6. Credit Creator (optional - maybe they get a cut of the VPC? For now just burning the VPC from buyer essentially, or transferring to platform)
                    // Let's transfer the VPC cost to the Creator!
                    // await transferCredits(buyerId, token.creator_id, cost, db); // Already deducted above, need to add to creator.

                    db.run(`UPDATE credits SET balance = balance + ? WHERE user_id = ?`, [cost, token.creator_id]);

                    resolve({ success: true, txHash });

                } catch (e) {
                    console.error("Token purchase failed", e);
                    // Refund
                    db.run(`UPDATE credits SET balance = balance + ? WHERE user_id = ?`, [cost, buyerId]);
                    reject(e);
                }
            });
        });
    });
}

/**
 * Get Subscriptions
 */
async function getSubscriptions(userId, type, db) {
    return new Promise((resolve, reject) => {
        let sql = '';
        let params = [userId];
        if (type === 'subscribers') {
            sql = `SELECT s.*, u.username, t.token_code FROM subscriptions s 
                    JOIN users u ON s.subscriber_id = u.id 
                    JOIN tokens t ON s.token_id = t.id
                    WHERE s.creator_id = ? AND s.is_active = 1`;
        } else {
            sql = `SELECT s.*, u.username as creator_name, t.token_code FROM subscriptions s 
                    JOIN users u ON s.creator_id = u.id 
                    JOIN tokens t ON s.token_id = t.id
                    WHERE s.subscriber_id = ? AND s.is_active = 1`;
        }
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

/**
 * Subscribe to Creator
 */
async function subscribeToCreator(subscriberId, creatorId, tokenId, amount, db) {
    if (subscriberId === creatorId) throw new Error("Cannot subscribe to self");

    // Check balance
    return new Promise((resolve, reject) => {
        db.get(`SELECT balance FROM credits WHERE user_id = ?`, [subscriberId], (err, row) => {
            if (err || !row || row.balance < amount) return reject(new Error('Insufficient credits'));

            // Deduct and Add
            db.serialize(() => {
                db.run(`UPDATE credits SET balance = balance - ? WHERE user_id = ?`, [amount, subscriberId]);
                db.run(`UPDATE credits SET balance = balance + ? WHERE user_id = ?`, [amount, creatorId]);

                // Create Subscription Record
                db.run(`INSERT INTO subscriptions (subscriber_id, creator_id, token_id, amount_per_period) VALUES (?, ?, ?, ?)`,
                    [subscriberId, creatorId, tokenId, amount],
                    function (err) {
                        if (err) return reject(err);
                        resolve({ subscriptionId: this.lastID });
                    }
                );
            });
        });
    });
}

/**
 * Cancel Subscription
 */
async function cancelSubscription(subId, userId, db) {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE subscriptions SET is_active = 0, expires_at = CURRENT_TIMESTAMP WHERE id = ? AND subscriber_id = ?`,
            [subId, userId],
            function (err) {
                if (err) return reject(err);
                resolve({ success: true });
            }
        );
    });
}

/**
 * Get Bids
 */
async function getBids(userId, db) {
    return new Promise((resolve, reject) => {
        // Get bids made by user AND bids received on user's zines
        const sql = `
            SELECT b.*, z.title as zine_title, u.username as bidder_name 
            FROM bids b
            JOIN zines z ON b.zine_id = z.id
            JOIN users u ON b.bidder_id = u.id
            WHERE b.bidder_id = ? OR z.user_id = ?
            ORDER BY b.created_at DESC
         `;
        db.all(sql, [userId, userId], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

/**
 * Place Bid
 */
async function placeBid(bidderId, zineId, amount, message, db) {
    // Check balance
    return new Promise((resolve, reject) => {
        db.get(`SELECT balance FROM credits WHERE user_id = ?`, [bidderId], (err, row) => {
            if (err || !row || row.balance < amount) return reject(new Error('Insufficient credits'));

            // Ideally we lock the credits? For now, we trust. 
            // Or better, deduct now and refund if rejected. Let's deduct now (escrow).
            db.run(`UPDATE credits SET balance = balance - ? WHERE user_id = ?`, [amount, bidderId], (err) => {
                if (err) return reject(err);

                db.run(`INSERT INTO bids (bidder_id, zine_id, amount, message) VALUES (?, ?, ?, ?)`,
                    [bidderId, zineId, amount, message],
                    function (err) {
                        if (err) {
                            // Refund on error
                            db.run(`UPDATE credits SET balance = balance + ? WHERE user_id = ?`, [amount, bidderId]);
                            return reject(err);
                        }
                        resolve({ bidId: this.lastID });
                    }
                );
            });
        });
    });
}

async function acceptBid(bidId, sellerId, db) {
    return new Promise((resolve, reject) => {
        // Verify ownership
        db.get(`SELECT b.*, z.user_id as owner_id FROM bids b JOIN zines z ON b.zine_id = z.id WHERE b.id = ?`, [bidId], (err, bid) => {
            if (err || !bid) return reject(new Error('Bid not found'));
            if (bid.owner_id !== sellerId) return reject(new Error('Not authorized'));
            if (bid.status !== 'accepted' && bid.status !== 'pending') return reject(new Error('Bid already processed')); // pending check
            if (bid.status !== 'pending') return reject(new Error('Bid already processed'));

            // Transfer credits from escrow (already deducted) to seller
            // Wait, where is the escrow? In `placeBid` we deducted from bidder. 
            // So now we just add to seller.

            db.serialize(() => {
                db.run(`UPDATE credits SET balance = balance + ? WHERE user_id = ?`, [bid.amount, sellerId]);
                db.run(`UPDATE bids SET status = 'accepted' WHERE id = ?`, [bidId]);

                // Transfer Zine Ownership (Optional? Or just a copy?)
                // Usually zine stays, but maybe access rights change.
                // For now, just money transfer.

                resolve({ success: true });
            });
        });
    });
}

async function rejectBid(bidId, sellerId, db) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT b.*, z.user_id as owner_id FROM bids b JOIN zines z ON b.zine_id = z.id WHERE b.id = ?`, [bidId], (err, bid) => {
            if (err || !bid) return reject(new Error('Bid not found'));
            if (bid.owner_id !== sellerId) return reject(new Error('Not authorized'));
            if (bid.status !== 'pending') return reject(new Error('Bid already processed'));

            // Refund bidder
            db.serialize(() => {
                db.run(`UPDATE credits SET balance = balance + ? WHERE user_id = ?`, [bid.amount, bid.bidder_id]);
                db.run(`UPDATE bids SET status = 'rejected' WHERE id = ?`, [bidId]);
                resolve({ success: true });
            });
        });
    });
}

/**
 * Get Reputation
 */
async function getReputation(userId, db) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM reputation WHERE user_id = ?`, [userId], (err, row) => {
            if (err) return reject(err);
            resolve(row || { score: 0, level: 'newcomer' });
        });
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

    // New Functions
    getWallet,
    createWallet,
    getTokens,
    getToken,
    buyCreatorToken,
    getSubscriptions,
    subscribeToCreator,
    cancelSubscription,
    getBids,
    placeBid,
    acceptBid,
    rejectBid,
    getReputation,

    CREDITS_PER_USD
};
