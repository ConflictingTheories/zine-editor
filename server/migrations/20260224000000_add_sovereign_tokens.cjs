/**
 * Sovereign Tokens and Content Gates Migration
 * 
 * This migration adds:
 * - sovereign_tokens: Token ownership records for content creators
 * - content_gates: Protected content with token/subscription/credit gating
 * - delegated_tokens: Shared access tokens for readers
 */

exports.up = function (knex) {
    return knex.schema
        // Sovereign tokens for content creators
        .createTable('sovereign_tokens', function (table) {
            table.increments('id').primary();
            table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
            table.string('token_id').unique(); // unique identifier derived from identity
            table.string('identity'); // identity string (email, username, DID)
            table.text('public_key_jwk'); // JSON string of public key
            table.text('private_key_jwk'); // encrypted JSON string of private key
            table.jsonb('claims'); // arbitrary claims stored as JSON
            table.text('token_data'); // exported token blob (base64 encoded)
            table.string('palette_h1'); // visual palette hue 1
            table.string('palette_h2'); // visual palette hue 2
            table.string('palette_h3'); // visual palette hue 3
            table.integer('is_active').defaultTo(1);
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
        })
        .then(function () {
            // Content gates for protected zines
            return knex.schema.createTable('content_gates', function (table) {
                table.increments('id').primary();
                table.integer('zine_id').references('id').inTable('zines').onDelete('CASCADE');
                table.string('gate_id').unique(); // unique gate identifier
                table.string('gate_type').defaultTo('token'); // 'token', 'subscription', 'credit', 'free', 'hybrid'
                table.text('envelope'); // encrypted content envelope (base64)
                table.integer('sovereign_token_id').references('id').inTable('sovereign_tokens').onDelete('SET NULL');
                table.integer('price_credits'); // price in credits if credit-gated
                table.decimal('price_usd', 10, 2); // price in USD if USD-gated
                table.integer('min_subscription_tier'); // required subscription tier
                table.integer('is_active').defaultTo(1);
                table.timestamp('created_at').defaultTo(knex.fn.now());
                table.timestamp('updated_at').defaultTo(knex.fn.now());

                // Index for faster lookups
                table.index('gate_id');
                table.index('zine_id');
            });
        })
        .then(function () {
            // Delegated tokens for shared access
            return knex.schema.createTable('delegated_tokens', function (table) {
                table.increments('id').primary();
                table.integer('parent_token_id').references('id').inTable('sovereign_tokens').onDelete('CASCADE');
                table.integer('delegate_user_id').references('id').inTable('users').onDelete('CASCADE');
                table.string('delegation_purpose'); // e.g., 'read-only', 'preview'
                table.text('token_data'); // delegated token blob (base64)
                table.string('gate_id'); // which gate this delegates access to
                table.timestamp('expires_at'); // null = never expires
                table.integer('is_active').defaultTo(1);
                table.timestamp('created_at').defaultTo(knex.fn.now());

                table.index('parent_token_id');
                table.index('delegate_user_id');
                table.index('gate_id');
            });
        })
        .then(function () {
            // SCEE keys for content encryption
            return knex.schema.createTable('scee_keys', function (table) {
                table.increments('id').primary();
                table.integer('zine_id').references('id').inTable('zines').onDelete('CASCADE');
                table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
                table.string('key_id').unique(); // unique key identifier
                table.text('scee_key'); // base64url encoded SCEE key
                table.string('meta_passphrase_hash'); // hash of meta-passphrase for verification
                table.integer('is_active').defaultTo(1);
                table.timestamp('created_at').defaultTo(knex.fn.now());

                table.index('zine_id');
                table.index('key_id');
            });
        });
};

exports.down = function (knex) {
    return knex.schema
        .dropTableIfExists('scee_keys')
        .dropTableIfExists('delegated_tokens')
        .dropTableIfExists('content_gates')
        .dropTableIfExists('sovereign_tokens');
};

