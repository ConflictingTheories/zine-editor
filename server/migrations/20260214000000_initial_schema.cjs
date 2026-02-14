exports.up = function (knex) {
    return knex.schema
        .createTable('users', (table) => {
            table.increments('id').primary();
            table.string('username').unique();
            table.string('email').unique();
            table.string('password_hash');
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.integer('is_premium').defaultTo(0);
        })
        .createTable('zines', (table) => {
            table.increments('id').primary();
            table.integer('user_id').references('id').inTable('users');
            table.string('title');
            table.text('data'); // JSON string
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
            table.integer('is_published').defaultTo(0);
            table.timestamp('published_at');
            table.string('author_name');
            table.string('genre');
            table.string('tags');
            table.integer('read_count').defaultTo(0);
            table.integer('token_price').defaultTo(0);
            table.integer('is_token_gated').defaultTo(0);
        })
        .createTable('credits', (table) => {
            table.increments('id').primary();
            table.integer('user_id').unique().references('id').inTable('users');
            table.decimal('balance', 10, 2).defaultTo(0);
            table.decimal('total_spent', 10, 2).defaultTo(0);
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
        })
        .createTable('wallets', (table) => {
            table.increments('id').primary();
            table.integer('user_id').unique().references('id').inTable('users');
            table.string('xrp_address').unique();
            table.text('xrp_secret_encrypted');
            table.string('payid').unique();
            table.integer('is_verified').defaultTo(0);
            table.timestamp('created_at').defaultTo(knex.fn.now());
        })
        .createTable('tokens', (table) => {
            table.increments('id').primary();
            table.integer('creator_id').references('id').inTable('users');
            table.string('token_code');
            table.string('token_name');
            table.text('description');
            table.string('icon_url');
            table.decimal('initial_supply', 20, 2);
            table.decimal('current_supply', 20, 2);
            table.decimal('price_per_token', 10, 6);
            table.string('xrp_currency_code');
            table.integer('is_active').defaultTo(1);
            table.timestamp('created_at').defaultTo(knex.fn.now());
        })
        .createTable('trust_lines', (table) => {
            table.increments('id').primary();
            table.integer('user_id').references('id').inTable('users');
            table.integer('token_id').references('id').inTable('tokens');
            table.decimal('trust_line_limit', 20, 2);
            table.string('xrpl_trustline_hash');
            table.integer('is_active').defaultTo(1);
            table.timestamp('created_at').defaultTo(knex.fn.now());
        })
        .createTable('subscriptions', (table) => {
            table.increments('id').primary();
            table.integer('subscriber_id').references('id').inTable('users');
            table.integer('creator_id').references('id').inTable('users');
            table.integer('token_id').references('id').inTable('tokens');
            table.decimal('amount_per_period', 10, 2);
            table.integer('period_days').defaultTo(30);
            table.integer('is_active').defaultTo(1);
            table.timestamp('started_at').defaultTo(knex.fn.now());
            table.timestamp('expires_at');
        })
        .createTable('bids', (table) => {
            table.increments('id').primary();
            table.integer('bidder_id').references('id').inTable('users');
            table.integer('zine_id').references('id').inTable('zines');
            table.decimal('amount', 10, 2);
            table.text('message');
            table.string('status').defaultTo('pending');
            table.timestamp('created_at').defaultTo(knex.fn.now());
        })
        .createTable('transactions', (table) => {
            table.increments('id').primary();
            table.integer('from_user_id').references('id').inTable('users');
            table.integer('to_user_id').references('id').inTable('users');
            table.integer('token_id').references('id').inTable('tokens');
            table.decimal('amount', 20, 2);
            table.string('type');
            table.string('xrp_tx_hash');
            table.text('description');
            table.timestamp('created_at').defaultTo(knex.fn.now());
        })
        .createTable('reputation', (table) => {
            table.increments('id').primary();
            table.integer('user_id').unique().references('id').inTable('users');
            table.integer('score').defaultTo(0);
            table.string('level').defaultTo('newcomer');
            table.decimal('total_tips_received', 20, 2).defaultTo(0);
            table.integer('total_subscribers').defaultTo(0);
            table.integer('total_content_sold').defaultTo(0);
            table.integer('total_bids_accepted').defaultTo(0);
            table.timestamp('updated_at').defaultTo(knex.fn.now());
        });
};

exports.down = function (knex) {
    return knex.schema
        .dropTableIfExists('reputation')
        .dropTableIfExists('transactions')
        .dropTableIfExists('bids')
        .dropTableIfExists('subscriptions')
        .dropTableIfExists('trust_lines')
        .dropTableIfExists('tokens')
        .dropTableIfExists('wallets')
        .dropTableIfExists('credits')
        .dropTableIfExists('zines')
        .dropTableIfExists('users');
};
