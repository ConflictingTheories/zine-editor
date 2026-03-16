exports.up = function (knex) {
    return knex.schema.createTable('subscriptions', function (table) {
        table.increments('id').primary();
        table.integer('subscriber_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.integer('creator_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.integer('token_id').unsigned().references('id').inTable('tokens');
        table.decimal('amount_per_period', 10, 2).notNullable().defaultTo(0);
        table.integer('period_days').defaultTo(30);
        table.timestamp('expires_at');
        table.boolean('is_active').defaultTo(true);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        // Unique active subscription per creator-subscriber pair
        table.unique(['subscriber_id', 'creator_id', 'is_active']);
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('subscriptions');
};
