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

    production: {
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
