/**
 * Add Sovereign Tokens, Content Gates, SCEE Keys, and Monetization Columns
 * 
 * This migration adds:
 * - sovereign_tokens: Token ownership records for content creators
 * - content_gates: Protected content with token/subscription/credit gating
 * - delegated_tokens: Shared access tokens for readers
 * - scee_keys: Self-coding embedded encryption keys
 * - Enhanced zines columns for crowdfunding/monetization
 */

exports.up = function (knex) {
    // Helper to add column only if it doesn't exist
    const addColumnIfNotExists = (tableName, columnName, columnDef) => {
        return knex.schema.hasColumn(tableName, columnName).then(exists => {
            if (!exists) {
                return knex.schema.table(tableName, t => columnDef(t));
            }
            return null;
        });
    };

    // Helper to create table if not exists
    const createTableIfNotExists = (tableName, tableBuilder) => {
        return knex.schema.hasTable(tableName).then(exists => {
            if (!exists) {
                return knex.schema.createTable(tableName, tableBuilder);
            }
            return null;
        });
    };

    return addColumnIfNotExists('zines', 'funding_goal', t => t.decimal('funding_goal', 14, 2))
        .then(() => addColumnIfNotExists('zines', 'amount_raised', t => t.decimal('amount_raised', 14, 2).defaultTo(0)))
        .then(() => addColumnIfNotExists('zines', 'funding_currency', t => t.string('funding_currency').defaultTo('USD')))
        .then(() => addColumnIfNotExists('zines', 'is_funded', t => t.integer('is_funded').defaultTo(0)))
        .then(() => addColumnIfNotExists('zines', 'funding_deadline', t => t.timestamp('funding_deadline')))
        .then(() => addColumnIfNotExists('zines', 'monetization_type', t => t.string('monetization_type').defaultTo('free')))
        .then(() => addColumnIfNotExists('zines', 'is_premium', t => t.integer('is_premium').defaultTo(0)))
        .then(() => addColumnIfNotExists('zines', 'premium_price', t => t.decimal('premium_price', 10, 2)))
        .then(() => addColumnIfNotExists('zines', 'access_level', t => t.string('access_level').defaultTo('public')))
        .then(() => addColumnIfNotExists('zines', 'requires_token', t => t.integer('requires_token').defaultTo(0)))
        .then(() => addColumnIfNotExists('zines', 'gate_id', t => t.integer('gate_id')))
        .then(() => addColumnIfNotExists('zines', 'min_subscription_tier', t => t.integer('min_subscription_tier')))
        // Add columns to contributions if they don't exist
        .then(() => addColumnIfNotExists('contributions', 'currency', t => t.string('currency').defaultTo('USD')))
        .then(() => addColumnIfNotExists('contributions', 'xrp_tx_hash', t => t.string('xrp_tx_hash')))
        .then(() => addColumnIfNotExists('contributions', 'credit_tier', t => t.string('credit_tier')))
        .then(() => addColumnIfNotExists('contributions', 'is_refunded', t => t.integer('is_refunded').defaultTo(0)))
        // Create sovereign_tokens table
        .then(() => createTableIfNotExists('sovereign_tokens', table => {
            table.increments('id').primary();
            table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
            table.string('token_id').unique();
            table.string('identity');
            table.text('public_key_jwk');
            table.text('private_key_jwk');
            table.jsonb('claims');
            table.text('token_data');
            table.string('palette_h1');
            table.string('palette_h2');
            table.string('palette_h3');
            table.integer('is_active').defaultTo(1);
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
        }))
        // Create content_gates table
        .then(() => createTableIfNotExists('content_gates', table => {
            table.increments('id').primary();
            table.integer('zine_id').references('id').inTable('zines').onDelete('CASCADE');
            table.string('gate_id').unique();
            table.string('gate_type').defaultTo('token');
            table.text('envelope');
            table.integer('sovereign_token_id').references('id').inTable('sovereign_tokens').onDelete('SET NULL');
            table.integer('price_credits');
            table.decimal('price_usd', 10, 2);
            table.integer('min_subscription_tier');
            table.integer('is_active').defaultTo(1);
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
            table.index('gate_id');
            table.index('zine_id');
        }))
        // Create delegated_tokens table
        .then(() => createTableIfNotExists('delegated_tokens', table => {
            table.increments('id').primary();
            table.integer('parent_token_id').references('id').inTable('sovereign_tokens').onDelete('CASCADE');
            table.integer('delegate_user_id').references('id').inTable('users').onDelete('CASCADE');
            table.string('delegation_purpose');
            table.text('token_data');
            table.string('gate_id');
            table.timestamp('expires_at');
            table.integer('is_active').defaultTo(1);
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.index('parent_token_id');
            table.index('delegate_user_id');
            table.index('gate_id');
        }))
        // Create scee_keys table
        .then(() => createTableIfNotExists('scee_keys', table => {
            table.increments('id').primary();
            table.integer('zine_id').references('id').inTable('zines').onDelete('CASCADE');
            table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
            table.string('key_id').unique();
            table.text('scee_key');
            table.string('meta_passphrase_hash');
            table.integer('is_active').defaultTo(1);
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.index('zine_id');
            table.index('key_id');
        }));
};

exports.down = function (knex) {
    return knex.schema
        .dropTableIfExists('scee_keys')
        .dropTableIfExists('delegated_tokens')
        .dropTableIfExists('content_gates')
        .dropTableIfExists('sovereign_tokens')
        .then(() => {
            return knex.schema.table('zines', table => {
                table.dropColumn('funding_goal');
                table.dropColumn('amount_raised');
                table.dropColumn('funding_currency');
                table.dropColumn('is_funded');
                table.dropColumn('funding_deadline');
                table.dropColumn('monetization_type');
                table.dropColumn('is_premium');
                table.dropColumn('premium_price');
                table.dropColumn('access_level');
                table.dropColumn('requires_token');
                table.dropColumn('gate_id');
                table.dropColumn('min_subscription_tier');
            });
        });
};

