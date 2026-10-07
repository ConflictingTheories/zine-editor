exports.up = function (knex) {
    return knex.schema.createTable('spritz', (table) => {
        table.increments('id').primary();
        table.integer('user_id').references('id').inTable('users');
        table.string('title');
        table.text('data'); // JSON string - game bundle manifest
        table.text('description');
        table.string('cover_url');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.integer('is_published').defaultTo(0);
        table.integer('is_public').defaultTo(1);
        table.timestamp('published_at');
        table.decimal('price', 10, 2).defaultTo(0);
        table.integer('play_count').defaultTo(0);
        table.string('version').defaultTo('1.0.0');
        table.string('engine_version');
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('spritz');
};
