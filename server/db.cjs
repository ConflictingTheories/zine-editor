/*
 * Shared database handle.
 *
 * Previously `contributionService.cjs` and `economyService.cjs` each called
 * `require('knexfile.cjs')` and then used it as if it were the knex instance
 * itself. `knexfile.cjs` exports a config map, not a query builder, so those
 * two services were operating on an object with no `.select()` — every call
 * through them would have thrown at runtime. Nothing exercised those paths, so
 * the bug was invisible.
 *
 * There is now exactly one knex instance in the process, created here from the
 * same config `runtime.cjs` migrates, and every service imports this.
 */

require('dotenv').config();

const knex = require('knex');
const knexConfig = require('./knexfile.cjs');
const path = require('path');

const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const dbPath = process.env.DB_PATH || './data/database.sqlite';
const resolvedPath = dbPath.startsWith('/') ? dbPath : path.resolve(__dirname, dbPath);

const db = knex({
    ...knexConfig[environment],
    connection: { filename: resolvedPath },
});

module.exports = db;
module.exports.resolvedPath = resolvedPath;
