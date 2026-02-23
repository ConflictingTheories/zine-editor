/**
 * Enhance Zines Table for Crowdfunding and Monetization
 * 
 * This migration adds:
 * - Crowdfunding fields (funding_goal, amount_raised, is_funded)
 * - Monetization type (free, crowdfund, subscription, token, one_time, premium)
 * - Access control fields
 */

exports.up = function (knex) {
    return knex.schema.table('zines', function (table) {
        // Crowdfunding fields
        table.decimal('funding_goal', 14, 2);
        table.decimal('amount_raised', 14, 2).defaultTo(0);
        table.string('funding_currency').defaultTo('USD'); // USD, XRP, CREDIT
        table.integer('is_funded').defaultTo(0); // 0 = not funded, 1 = funded
        table.timestamp('funding_deadline');

        // Monetization type
        table.string('monetization_type').defaultTo('free'); // 'free', 'crowdfund', 'subscription', 'token', 'one_time', 'premium'

        // Premium content
        table.integer('is_premium').defaultTo(0);
        table.decimal('premium_price', 10, 2);

        // Access level
        table.string('access_level').defaultTo('public'); // 'public', 'subscriber', 'token_holder', 'owner'

        // Token gating
        table.integer('requires_token').defaultTo(0); // requires sovereign token
        table.integer('gate_id'); // link to content_gates table

        // Subscription tiers
        table.integer('min_subscription_tier'); // 1 = basic, 2 = premium, 3 = VIP
    })
        .then(function () {
            // Create contributions table for crowdfunding
            return knex.schema.createTableIfNotExists('contributions', function (table) {
                table.increments('id').primary();
                table.integer('user_id').references('id').inTable('users').onDelete('CASCADE');
                table.integer('zine_id').references('id').inTable('zines').onDelete('CASCADE');
                table.decimal('amount', 14, 2); // amount in currency specified
                table.string('currency').defaultTo('USD'); // USD, XRP, CREDIT
                table.string('stripe_payment_intent').unique();
                table.string('xrp_tx_hash'); // XRP transaction hash
                table.string('credit_tier'); // 'associate_producer', 'executive_producer'
                table.integer('is_refunded').defaultTo(0);
                table.timestamp('created_at').defaultTo(knex.fn.now());

                table.index('zine_id');
                table.index('user_id');
            });
        })
        .then(function () {
            // Add index for funded zines lookup
            return knex.schema.raw(`
            CREATE INDEX IF NOT EXISTS idx_zines_is_funded 
            ON zines(is_funded) WHERE is_funded = 1
        `);
        });
};

exports.down = function (knex) {
    return knex.schema
        .table('zines', function (table) {
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
        })
        .then(function () {
            return knex.schema.dropTableIfExists('contributions');
        });
};

