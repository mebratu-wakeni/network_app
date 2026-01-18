export const up = async (knex) => {
  await knex.schema.createTable('units', (t) => {
    t.bigIncrements('id').primary()
    t.string('name', 255).notNullable()
    t.string('abbreviation', 255)
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())
    t.string('sync_status', 255).defaultTo('pending')
    
    t.unique('name', 'units_name_unique')
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('units')
}
