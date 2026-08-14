export const up = async (knex) => {
  await knex.schema.createTable('admin_users', (t) => {
    t.bigIncrements('id').primary()
    t.string('username', 100).notNullable().unique()
    t.string('password_hash', 255).notNullable()
    t.string('display_name', 255)
    t.boolean('is_active').notNullable().defaultTo(true)
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('admin_users')
}
