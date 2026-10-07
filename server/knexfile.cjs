const path = require('path');

module.exports = {
    development: {
        client: 'sqlite3',
        connection: {
            filename: process.env.DB_PATH || path.join(__dirname, 'data', 'database.sqlite')
        },
        useNullAsDefault: true,
        migrations: {
            directory: path.join(__dirname, 'migrations')
        }
    },

    production: process.env.DATABASE_URL
        ? {
            // Postgres is a config change, not a rewrite: every migration in
            // server/migrations is written in plain knex with no SQLite-isms.
            client: 'pg',
            connection: process.env.DATABASE_URL,
            migrations: {
                directory: path.join(__dirname, 'migrations')
            }
        }
        : {
            client: 'sqlite3',
            connection: {
                filename: process.env.DB_PATH || path.join(__dirname, 'data', 'database.sqlite')
            },
            useNullAsDefault: true,
            migrations: {
                directory: path.join(__dirname, 'migrations')
            }
        }
};
