/**
 * Identity hardening + server-side storage + sync.
 *
 * - users: stripe_connect_account_id (nullable; Stripe Connect onboarding lands
 *   later), updated_at.
 * - password_reset_tokens: single-use, hashed, expiring reset tokens.
 * - zines: client_id (client-generated UUID, unique per user — idempotent
 *   sync), version (optimistic-locking counter), deleted_at (soft delete so
 *   sync tombstones propagate).
 * - assets: content-hash-addressed binary store metadata. Bytes live on disk
 *   (dev) or S3 (prod); this table is the index.
 *
 * Written in plain knex — no SQLite-isms — so Postgres is a config change.
 */

exports.up = function (knex) {
    return knex.schema
        .table('users', (table) => {
            table.string('stripe_connect_account_id').nullable();
            table.timestamp('updated_at').nullable();
        })
        .createTable('password_reset_tokens', (table) => {
            table.increments('id').primary();
            table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
            table.string('token_hash', 64).notNullable().unique();
            table.timestamp('expires_at').notNullable();
            table.timestamp('used_at').nullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.index(['user_id']);
        })
        .table('zines', (table) => {
            table.string('client_id', 64).nullable();
            table.integer('version').notNullable().defaultTo(1);
            table.timestamp('deleted_at').nullable();
        })
        .createTable('assets', (table) => {
            table.string('hash', 64).primary(); // sha256 hex of the bytes
            table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
            table.string('mime').notNullable().defaultTo('application/octet-stream');
            table.integer('size').notNullable().defaultTo(0);
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.index(['user_id']);
        })
        .then(() => {
            // Backfill client_id for pre-sync rows so the unique index below
            // never collides on NULL. (Multiple NULLs are allowed by unique
            // indexes in both SQLite and Postgres, but explicit ids are
            // cleaner for the sync protocol.)
            return knex('zines')
                .whereNull('client_id')
                .update({
                    client_id: knex.raw(`'legacy-' || id`),
                });
        })
        .then(() => {
            return knex.schema.table('zines', (table) => {
                table.unique(['user_id', 'client_id']);
            });
        });
};

exports.down = function (knex) {
    return knex.schema
        .table('zines', (table) => {
            table.dropUnique(['user_id', 'client_id']);
        })
        .dropTableIfExists('assets')
        .table('zines', (table) => {
            table.dropColumn('client_id');
            table.dropColumn('version');
            table.dropColumn('deleted_at');
        })
        .dropTableIfExists('password_reset_tokens')
        .table('users', (table) => {
            table.dropColumn('stripe_connect_account_id');
            table.dropColumn('updated_at');
        });
};
