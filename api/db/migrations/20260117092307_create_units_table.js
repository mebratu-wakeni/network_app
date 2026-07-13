export const up = async (knex) => {
  await knex.schema.createTable('units', (t) => {
    t.bigIncrements('id').primary()
    t.bigInteger('tenant_id').unsigned().notNullable()
    t.string('name', 255).notNullable()
    t.string('abbreviation', 255)
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())
    t.string('sync_status', 255).defaultTo('pending')

    t.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE')
    t.unique(['tenant_id', 'name'], 'units_tenant_id_name_unique')
    t.index('tenant_id', 'units_tenant_id_index')
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('units')
}
