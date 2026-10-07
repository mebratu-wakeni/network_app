export const up = async (knex) => {
  await knex.schema.createTable('system_settings', (t) => {
    t.bigIncrements('id').primary()
    t.bigInteger('tenant_id').unsigned().notNullable()
    t.string('setting_key', 255).notNullable()
    t.text('setting_value')
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('updated_at', { useTz: false }).defaultTo(knex.fn.now())

    t.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE')
    t.unique(['tenant_id', 'setting_key'], 'system_settings_tenant_id_setting_key_unique')
    t.index('tenant_id', 'system_settings_tenant_id_index')
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('system_settings')
}
