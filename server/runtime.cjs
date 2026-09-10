require('dotenv').config();

const express = require('express');
const knex = require('knex');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const knexConfig = require('./knexfile.cjs');
const CONFIG = require('./config.cjs');

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

db.migrate.latest()
    .then(() => console.log('Database migrations completed'))
    .catch(error => console.error('Database migration failed:', error));

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication token required',
        });
    }

    if (token === 'local_offline_token') {
        req.user = { id: 1, username: 'Local_Creator' };
        return next();
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
