require('dotenv').config();

const express = require('express');
const knex = require('knex');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const knexConfig = require('./knexfile.cjs');
const CONFIG = require('./config.cjs');
const { DEMO_TOKEN, DEMO_USER } = require('./demoAccount.cjs');

const { server, jwt: jwtConfig, cors: corsConfig, database } = CONFIG;
const app = express();

app.use(cors({
    origin: corsConfig.origins,
    credentials: true,
    methods: corsConfig.methods,
    allowedHeaders: corsConfig.allowedHeaders,
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

const environment = server.env === 'production' ? 'production' : 'development';
const db = knex({
    ...knexConfig[environment],
    connection: { filename: database.getPath() },
});

// Migrations and demo seeding run once, in server.cjs, after this module has
// finished loading. Running them here as well meant two concurrent
// `migrate.latest()` calls racing to alter the same tables on boot.

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication token required',
        });
    }

    // The demo token and the legacy offline token both resolve to the seeded
    // demo user, so every account-scoped route works while signed in as the
    // demo account without a server round trip.
    if (token === DEMO_TOKEN || token === 'local_offline_token') {
        db('users')
            .where({ email: DEMO_USER.email })
            .first()
            .then((user) => {
                if (!user) {
                    return res.status(401).json({ error: 'Demo account unavailable' });
                }
                req.user = {
                    id: user.id,
                    username: user.username,
                    is_demo: true
                };
                req.isDemo = true;
                next();
            })
            .catch(() => res.status(500).json({ error: 'Demo lookup failed' }));
        return;
    }

    jwt.verify(token, jwtConfig.secret, (error, user) => {
        if (error) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Invalid or expired token',
            });
        }
        req.user = user;
        next();
    });
};

module.exports = {
    app,
    db,
    express,
    bodyParser,
    authenticateToken,
    config: CONFIG,
    port: server.port,
    jwtExpiry: jwtConfig.expiresIn,
};
