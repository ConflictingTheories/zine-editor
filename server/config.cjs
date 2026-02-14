/**
 * Server Configuration Constants
 * All configuration loaded from environment variables
 * 
 * Security: Sensitive values (API keys, secrets) are NOT logged
 */

const path = require('path');
const fs = require('fs');

// Load environment at startup
const NODE_ENV = process.env.NODE_ENV || 'development';

// Server Configuration
const CONFIG = {
    server: {
        port: parseInt(process.env.PORT || '3000', 10),
        env: NODE_ENV,
        isDev: NODE_ENV === 'development',
        isProd: NODE_ENV === 'production',
    },

    // Database
    database: {
        path: process.env.DB_PATH || './database.sqlite',
        // Ensure absolute path for Docker compatibility
        getPath() {
            const dbPath = this.path;
            return dbPath.startsWith('/') ? dbPath : path.resolve(__dirname, dbPath);
        },
    },

    // JWT
    jwt: {
        secret: process.env.JWT_SECRET || 'dev_secret_key_unsafe_for_production_only',
        expiresIn: process.env.JWT_EXPIRY || '7d',
    },

    // CORS
    cors: {
        origins: (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:5175')
            .split(',')
            .map(o => o.trim()),
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    },

    // Payment Processing
    payment: {
        stripeSecretKey: process.env.STRIPE_SECRET_KEY,
        stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
        stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
        mockMode: !process.env.STRIPE_SECRET_KEY, // Use mock if no Stripe key
    },

    // XRP Ledger
    xrp: {
        network: process.env.XRP_NETWORK || 'testnet',
        apiEndpoint: process.env.XRP_API_ENDPOINT || 'https://s.altnet.rippletest.net:51234',
    },

    // Feature Flags
    features: {
        enableXRP: process.env.ENABLE_XRP !== 'false',
        enableMonetization: process.env.ENABLE_MONETIZATION !== 'false',
        enableReputation: process.env.ENABLE_REPUTATION !== 'false',
    },
};

// Validation
function validateConfig() {
    const errors = [];

    if (!CONFIG.jwt.secret) {
        errors.push('JWT_SECRET not configured');
    }

    if (CONFIG.jwt.secret === 'dev_secret_key_unsafe_for_production_only' && CONFIG.server.isProd) {
        errors.push('JWT_SECRET must be changed for production');
    }

    if (CONFIG.payment.mockMode && CONFIG.server.isProd) {
        console.warn('⚠️  WARNING: Running in mock payment mode in production. Configure STRIPE_SECRET_KEY for real payments.');
    }

    if (errors.length > 0) {
        console.error('❌ Configuration Errors:');
        errors.forEach(e => console.error(`  - ${e}`));
        process.exit(1);
    }
}

// Startup
function logConfig() {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`VOID PRESS - Server Configuration`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`Environment: ${CONFIG.server.env.toUpperCase()}`);
    console.log(`Port: ${CONFIG.server.port}`);
    console.log(`Database: ${CONFIG.database.getPath()}`);
    console.log(`JWT Expiry: ${CONFIG.jwt.expiresIn}`);
    console.log(`Payment Mode: ${CONFIG.payment.mockMode ? 'MOCK' : 'STRIPE'}`);
    console.log(`XRP Network: ${CONFIG.xrp.network}`);
    console.log(`CORS Origins: ${CONFIG.cors.origins.length} allowed`);
    console.log(`${'═'.repeat(60)}\n`);
}

// Initialize
validateConfig();
if (CONFIG.server.isDev) {
    logConfig();
}

module.exports = CONFIG;
