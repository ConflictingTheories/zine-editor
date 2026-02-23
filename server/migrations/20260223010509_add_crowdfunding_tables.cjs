exports.up = function(knex) {
  return knex.schema.table('zines', function(table) {
    table.decimal('funding_goal', 14, 2);
    table.decimal('amount_raised', 14, 2).defaultTo(0);
  }).then(function() {
    return knex.schema.createTable('contributions', function(table) {
      table.increments('id').primary();
      table.integer('user_id').references('id').inTable('users');
      table.integer('zine_id').references('id').inTable('zines');
      table.decimal('amount', 14, 2);
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('contributions').then(function() {
    return knex.schema.table('zines', function(table) {
      table.dropColumn('funding_goal');
      table.dropColumn('amount_raised');
    });
  });
};