/**
 * Zine Economy Simulation Script
 * 
 * Cycle:
 * 1. Creator Setup (Register -> Wallet -> Token -> Zine -> Publish)
 * 2. Consumer Action (Register -> Wallet -> Buy Credits -> Trust Line -> Buy Tokens -> Purchase Zine -> Read)
 */

const API_URL = 'http://localhost:3000/api';

// State
const state = {
    creator: { token: null, id: null, wallet: null },
    consumer: { token: null, id: null, wallet: null },
    token: { id: null, code: 'ART' + Math.floor(Math.random() * 1000) },
    zine: { id: null, price: 5 }
};

// Helper for requests
async function req(method, endpoint, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    try {
        const res = await fetch(`${API_URL}${endpoint}`, opts);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || res.statusText);
        return data;
    } catch (e) {
        console.error(`❌ ${method} ${endpoint} failed:`, e.message);
        throw e;
    }
}

async function run() {
    console.log('🚀 Starting Economy Simulation...\n');

    try {
        // ==========================================
        // 1. CREATOR SETUP
        // ==========================================
        console.log('--- 🎨 CREATOR SETUP ---');

        // 1.1 Register Creator
        const creatorUser = `creator_${Date.now()}`;
        const cReg = await req('POST', '/auth/register', {
            username: creatorUser,
            email: `${creatorUser}@test.com`,
            password: 'password123'
        });
        state.creator.token = cReg.token;
        state.creator.id = cReg.user.id;
        console.log(`✅ Creator Registered: ${creatorUser} (ID: ${state.creator.id})`);

        // 1.2 Create Wallet
        // Note: In test env, this generates a funded testnet wallet
        const cWallet = await req('POST', '/wallet/create', {}, state.creator.token);
        state.creator.wallet = cWallet.xrpAddress;
        console.log(`✅ Creator Wallet: ${cWallet.xrpAddress}`);

        // 1.3 Create Token
        const cToken = await req('POST', '/tokens/create', {
            tokenCode: state.token.code,
            tokenName: 'Artist Coin',
            description: 'Official currency of Art',
            initialSupply: 10000,
            pricePerToken: 10 // 10 Credits per Token
        }, state.creator.token);
        state.token.id = cToken.tokenId;
        console.log(`✅ Token Created: ${state.token.code} (ID: ${state.token.id})`);

        // 1.4 Create Zine
        const cZine = await req('POST', '/zines', {
            title: 'The Future of Art',
            data: { pages: [] }
        }, state.creator.token);
        state.zine.id = cZine.id;
        console.log(`✅ Zine Created: ID ${state.zine.id}`);

        // 1.5 Token Gate Zine
        await req('POST', `/zines/${state.zine.id}/token-gate`, {
            tokenPrice: state.zine.price,
            tokenId: state.token.id,
            isTokenGated: true
        }, state.creator.token);
        console.log(`✅ Zine Gated: Price ${state.zine.price} ${state.token.code}`);

        // 1.6 Publish Zine
        await req('POST', `/publish/${state.zine.id}`, {
            author_name: creatorUser,
            genre: 'sci-fi',
            tags: 'art,future'
        }, state.creator.token);
        console.log(`✅ Zine Published`);


        // ==========================================
        // 2. CONSUMER ACTION
        // ==========================================
        console.log('\n--- 👤 CONSUMER ACTION ---');

        // 2.1 Register Consumer
        const consumerUser = `user_${Date.now()}`;
        const uReg = await req('POST', '/auth/register', {
            username: consumerUser,
            email: `${consumerUser}@test.com`,
            password: 'password123'
        });
        state.consumer.token = uReg.token;
        state.consumer.id = uReg.user.id;
        console.log(`✅ Consumer Registered: ${consumerUser} (ID: ${state.consumer.id})`);

        // 2.2 Create Wallet
        const uWallet = await req('POST', '/wallet/create', {}, state.consumer.token);
        state.consumer.wallet = uWallet.xrpAddress;
        console.log(`✅ Consumer Wallet: ${uWallet.xrpAddress}`);

        // 2.3 Buy Credits (VPC)
        // Buying 1000 Credits
        const credits = await req('POST', '/credits/purchase', {
            amount: 1000,
            paymentMethod: 'simulated_stripe'
        }, state.consumer.token);
        console.log(`✅ Credits Purchased: ${credits.amount} VPC (Balance: ${credits.newBalance})`);

        // 2.4 Establish Trust Line
        // Consumer must trust Creator to hold 'ART' token
        console.log(`⏳ Establishing Trust Line (this interacts with XRPL testnet, may take 5-10s)...`);
        await req('POST', '/trustlines', {
            tokenId: state.token.id,
            limit: 10000
        }, state.consumer.token);
        console.log(`✅ Trust Line Established to ${state.token.code}`);

        // 2.5 Buy Creator Tokens
        // Need 5 tokens for zine. Price is 10 credits/token. Total 50 credits.
        // Let's buy 10 tokens just to be safe. Cost: 100 credits.
        console.log(`⏳ Buying Tokens (XRPL Payment: VPC -> Creator, Token -> User)...`);
        const buy = await req('POST', `/tokens/${state.token.id}/buy`, {
            amount: 10
        }, state.consumer.token);
        console.log(`✅ Tokens Bought: ${buy.amount} ${buy.tokenName}`);
        console.log(`   TxHash: ${buy.txHash}`);

        // 2.6 Verify Access (Should fail before purchase)
        const check1 = await req('GET', `/zines/${state.zine.id}/access`, null, state.consumer.token);
        if (check1.hasAccess) {
            console.error('❌ Error: User has access before purchase!');
        } else {
            console.log(`✅ Access Check: Denied (Correct) - Price: ${check1.tokenPrice}`);
        }

        // 2.7 Purchase Zine
        // Pay 5 ART tokens
        console.log(`⏳ Purchasing Zine (XRPL Payment: ${state.zine.price} ${state.token.code} -> Creator)...`);
        const purchase = await req('POST', `/zines/${state.zine.id}/purchase`, {}, state.consumer.token);
        console.log(`✅ Zine Purchased!`);
        console.log(`   TxHash: ${purchase.txHash}`);

        // 2.8 Read Zine (Verify Access)
        const check2 = await req('GET', `/zines/${state.zine.id}/access`, null, state.consumer.token);
        if (check2.hasAccess) {
            console.log(`✅ Access Check: GRANTED via ${check2.via || 'purchase'}`);

            // Fetch content
            const content = await req('GET', `/zines/${state.zine.id}`, null, state.consumer.token);
            console.log(`✅ Content Retrieved: "${content.title}"`);
        } else {
            console.error('❌ Error: Access denied after purchase');
        }

        console.log('\n✨ Economy Cycle Simulation Complete! ✨');

    } catch (error) {
        console.error('\n⛔ Simulation Failed');
        process.exit(1);
    }
}

run();