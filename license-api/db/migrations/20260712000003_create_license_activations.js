export const up = async (knex) => {
  await knex.schema.createTable('license_activations', (t) => {
    t.bigIncrements('id').primary()
    t.bigInteger('license_id').notNullable().references('id').inTable('licenses').onDelete('CASCADE')
    t.string('device_fingerprint', 255).notNullable()
    t.string('device_name', 255)      // machine hostname / OS label
    t.string('company_name', 255)     // submitted by the app during activation
    t.string('company_phone', 100)
    t.boolean('is_active').notNullable().defaultTo(true)
    t.timestamp('activated_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_seen_at', { useTz: false }).defaultTo(knex.fn.now())

    t.index('license_id')
    t.index('device_fingerprint')
    t.index(['license_id', 'device_fingerprint'])
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('license_activations')
}
