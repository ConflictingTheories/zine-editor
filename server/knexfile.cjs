const path = require('path');

module.exports = {
    development: {
        client: 'sqlite3',
        connection: {
            filename: process.env.DB_PATH || path.join(__dirname, 'server', 'database.sqlite')
        },
        useNullAsDefault: true,
        migrations: {
            directory: path.join(__dirname, 'server', 'migrations')
        }
    },

    production: {
        client: 'pg',
        connection: process.env.DATABASE_URL || {
            host: process.env.DB_HOST || 'db',
            port: process.env.DB_PORT || 5432,
            user: process.env.DB_USER || 'zineuser',
            password: process.env.DB_PASSWORD || 'zinepass',
            database: process.env.DB_NAME || 'zinedb'
        },
        pool: {
            min: 2,
            max: 10
        },
        migrations: {
            directory: path.join(__dirname, 'server', 'migrations')
        }
    }
};
