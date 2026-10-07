exports.up = function (knex) {
    return knex.schema
        .table('users', table => {
            table.string('display_name')
            table.text('bio')
            table.string('avatar_url')
            table.string('profile_url')
        })
        .createTable('node_subscriptions', table => {
            table.increments('id').primary()
            table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
            table.string('node_url').notNullable()
            table.string('node_name')
            table.text('credentials_json')
            table.string('cursor').defaultTo('')
            table.timestamp('last_synced_at')
            table.unique(['user_id', 'node_url'])
        })
}

exports.down = function (knex) {
    return knex.schema.dropTableIfExists('node_subscriptions').table('users', table => {
        table.dropColumn('display_name')
        table.dropColumn('bio')
        table.dropColumn('avatar_url')
        table.dropColumn('profile_url')
    })
}
