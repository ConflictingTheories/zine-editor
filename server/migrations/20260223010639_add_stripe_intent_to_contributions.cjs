exports.up = function(knex) {
  return knex.schema.table('contributions', function(table) {
    table.string('stripe_payment_intent').unique();
  });
};

exports.down = function(knex) {
  return knex.schema.table('contributions', function(table) {
    table.dropColumn('stripe_payment_intent');
  });
};