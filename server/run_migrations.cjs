const knex = require('knex');
const knexConfig = require('./knexfile.cjs');
const db = knex({
    ...knexConfig.development,
    connection: { filename: './data/database.sqlite' }
});

db.migrate.latest()
  .then(() => { console.log('Migrations done'); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
