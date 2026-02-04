export const up = async (knex) => {
  await knex.schema.createTable('system_settings', (t) => {
    t.bigIncrements('id').primary()
    t.string('setting_key', 255).notNullable().unique()
    t.text('setting_value')
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('updated_at', { useTz: false }).defaultTo(knex.fn.now())
    
    // Unique index on setting_key (already enforced by unique constraint, but explicit index for performance)
    t.index('setting_key', 'system_settings_setting_key_index')
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('system_settings')
}
