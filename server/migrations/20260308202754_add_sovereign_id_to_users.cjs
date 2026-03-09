exports.up = async function (knex) {
    const hasSovereignId = await knex.schema.hasColumn('users', 'sovereign_id');
    if (!hasSovereignId) {
        await knex.schema.alterTable('users', function (table) {
            table.string('sovereign_id').nullable().unique();
        });
    }

    const hasTokens = await knex.schema.hasTable('sovereign_tokens');
    if (!hasTokens) {
        await knex.schema.createTable('sovereign_tokens', function (table) {
            table.increments('id').primary();
            table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
            table.string('token_id').notNullable().unique();
            table.string('identity').notNullable();
            table.text('public_key_jwk').notNullable();
            table.text('private_key_jwk').notNullable();
            table.text('claims').notNullable();
            table.text('token_data').notNullable(); // Base64 envelope
            table.string('palette_h1');
            table.string('palette_h2');
            table.string('palette_h3');
            table.boolean('is_active').defaultTo(true);
            table.timestamps(true, true);
        });
    }

    const hasGates = await knex.schema.hasTable('content_gates');
    if (!hasGates) {
        await knex.schema.createTable('content_gates', function (table) {
            table.increments('id').primary();
            table.integer('zine_id').unsigned().references('id').inTable('zines').onDelete('CASCADE');
            table.integer('sovereign_token_id').unsigned().references('id').inTable('sovereign_tokens').onDelete('SET NULL');
            table.string('gate_id').notNullable().unique();
            table.string('gate_type').defaultTo('token'); // 'token', 'payment', etc.
            table.text('envelope').notNullable(); // The encrypted data blob
            table.decimal('price_credits', 10, 2).defaultTo(0);
            table.decimal('price_usd', 10, 2).defaultTo(0);
            table.boolean('is_active').defaultTo(true);
            table.timestamps(true, true);
        });
    }

    const hasDelegated = await knex.schema.hasTable('delegated_tokens');
    if (!hasDelegated) {
        await knex.schema.createTable('delegated_tokens', function (table) {
            table.increments('id').primary();
            table.integer('parent_token_id').unsigned().references('id').inTable('sovereign_tokens').onDelete('CASCADE');
            table.integer('delegate_user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
            table.string('gate_id').notNullable();
            table.string('delegation_purpose');
            table.datetime('expires_at');
            table.boolean('is_active').defaultTo(true);
            table.timestamps(true, true);
        });
    }
};

exports.down = function (knex) {
    return knex.schema
        .dropTableIfExists('delegated_tokens')
        .dropTableIfExists('content_gates')
        .dropTableIfExists('sovereign_tokens')
        .alterTable('users', function (table) {
            table.dropColumn('sovereign_id');
        });
};
