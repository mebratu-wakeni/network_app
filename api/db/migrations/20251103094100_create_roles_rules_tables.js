export const up = async (knex) => {
  await knex.schema.createTable('roles', (t) => {
    t.bigIncrements('id').primary()
    t.text('name').notNullable().unique()
    t.text('description')
    t.timestamps(true, true)
  })

  await knex.schema.createTable('rules', (t) => {
    t.bigIncrements('id').primary()
    t.text('key').notNullable().unique() // e.g., 'products.read'
    t.text('description')
    t.timestamps(true, true)
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('rules')
  await knex.schema.dropTableIfExists('roles')
}

