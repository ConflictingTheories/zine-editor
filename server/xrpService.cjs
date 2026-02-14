const xrpl = require('xrpl');

// Configuration
const XRPL_NODE_URL = process.env.XRPL_NODE_URL || 'wss://s.altnet.rippletest.net:51233';
const PLATFORM_SEED = process.env.PLATFORM_WALLET_SEED;
const PLATFORM_CURRENCY = 'VPC'; // Void Press Credits

/**
 * Connect to XRPL and perform actions
 */
async function withClient(action) {
    const client = new xrpl.Client(XRPL_NODE_URL);
    await client.connect();
    try {
        return await action(client);
    } finally {
        await client.disconnect();
    }
}

/**
 * Create a new wallet for a user
 * In a real app, store seed ENCRYPTED.
 */
async function createWallet() {
    // For testnet, we can fund. For mainnet, just generate.
    const wallet = xrpl.Wallet.generate();
    return {
        address: wallet.address,
        seed: wallet.seed // WARNING: Encrypt before storing!
    };
}

/**
 * Establish a Trust Line
 * User must trust the Issuer (Platform or Creator) to hold their tokens.
 */
async function setTrustLine(userSeed, issuerAddress, currencyCode, limit = '1000000000') {
    return withClient(async (client) => {
        const userWallet = xrpl.Wallet.fromSeed(userSeed);

        const trustSet = {
            TransactionType: 'TrustSet',
            Account: userWallet.address,
            LimitAmount: {
                currency: currencyCode,
                issuer: issuerAddress,
                value: limit
            }
        };

        const ts = await client.submitAndWait(trustSet, { wallet: userWallet });
        return ts.result.meta.TransactionResult === 'tesSUCCESS';
    });
}

/**
 * Check if a Trust Line exists
 */
async function checkTrustLine(userAddress, issuerAddress, currencyCode) {
    return withClient(async (client) => {
        const response = await client.request({
            command: 'account_lines',
            account: userAddress,
            peer: issuerAddress
        });

        const lines = response.result.lines;
        // Check if a line exists with the currency and a limit > 0
        return lines.some(line => line.currency === currencyCode && parseFloat(line.limit) > 0);
    });
}

/**
 * Issue Platform Credits (VPC) to a user
 * Triggered after Stripe payment success.
 */
async function issuePlatformCredits(userAddress, amount) {
    if (!PLATFORM_SEED) throw new Error('Platform wallet not configured');

    return withClient(async (client) => {
        const platformWallet = xrpl.Wallet.fromSeed(PLATFORM_SEED);

        const payment = {
            TransactionType: 'Payment',
            Account: platformWallet.address,
            Destination: userAddress,
            Amount: {
                currency: PLATFORM_CURRENCY,
                value: amount.toString(),
                issuer: platformWallet.address
            }
        };

        const result = await client.submitAndWait(payment, { wallet: platformWallet });

        if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
            // Check if failure is due to missing trust line
            if (result.result.meta.TransactionResult === 'tecPATH_DRY') {
                throw new Error('User has not established trust line for VPC');
            }
            throw new Error(`XRPL Payment Failed: ${result.result.meta.TransactionResult}`);
        }

        return result.result.hash;
    });
}

/**
 * Creator issues their own token to a buyer/subscriber
 */
async function issueCreatorToken(creatorSeed, buyerAddress, tokenCode, amount) {
    return withClient(async (client) => {
        const creatorWallet = xrpl.Wallet.fromSeed(creatorSeed);

        const payment = {
            TransactionType: 'Payment',
            Account: creatorWallet.address,
            Destination: buyerAddress,
            Amount: {
                currency: tokenCode,
                value: amount.toString(),
                issuer: creatorWallet.address
            }
        };

        const result = await client.submitAndWait(payment, { wallet: creatorWallet });
        if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
            throw new Error(`XRPL Payment Failed: ${result.result.meta.TransactionResult}`);
        }
        // Return tx hash on success (consistent with other methods)
        return result.result.hash;
    });
}

/**
 * Send a payment (VPC or other tokens)
 */
async function sendPayment(senderSeed, destinationAddress, amount, currency, issuer) {
    return withClient(async (client) => {
        const wallet = xrpl.Wallet.fromSeed(senderSeed);

        const payment = {
            TransactionType: 'Payment',
            Account: wallet.address,
            Destination: destinationAddress,
            Amount: {
                currency: currency,
                value: amount.toString(),
                issuer: issuer
            }
        };

        const result = await client.submitAndWait(payment, { wallet });
        return result.result.meta.TransactionResult === 'tesSUCCESS' ? result.result.hash : null;
    });
}

/**
 * Get Balances for a user (VPC and other tokens)
 */
async function getBalances(address) {
    return withClient(async (client) => {
        const response = await client.request({
            command: 'account_lines',
            account: address
        });

        return response.result.lines.map(line => ({
            currency: line.currency,
            balance: line.balance,
            issuer: line.account
        }));
    });
}

/**
 * Get Account Info
 */
async function getAccountInfo(address) {
    return withClient(async (client) => {
        try {
            const response = await client.request({
                command: 'account_info',
                account: address,
                ledger_index: 'validated'
            });
            return response.result.account_data;
        } catch (error) {
            if (error.data && error.data.error === 'actNotFound') return null;
            throw error;
        }
    });
}

module.exports = {
    createWallet,
    setTrustLine,
    checkTrustLine,
    issuePlatformCredits,
    issueCreatorToken,
    sendPayment,
    getBalances,
    getAccountInfo,
    PLATFORM_CURRENCY
};