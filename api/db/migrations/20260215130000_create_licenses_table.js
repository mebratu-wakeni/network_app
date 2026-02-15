export const up = async (knex) => {
  await knex.schema.createTable('licenses', (t) => {
    t.bigIncrements('id').primary()
    t.string('license_key', 255).notNullable()
    t.string('subscription_type', 20).notNullable()
    t.string('status', 20).notNullable().defaultTo('active')
    t.string('company_name', 255).notNullable()
    t.string('company_phone', 100).notNullable()
    t.string('company_email', 255).nullable()
    t.string('company_tin', 255).nullable()
    t.text('device_fingerprint').notNullable()
    t.timestamp('activated_at', { useTz: false }).nullable()
    t.date('expires_at').nullable()
    t.timestamp('last_validated_at', { useTz: false }).nullable()
    t.text('metadata_json').nullable()
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())

    t.unique(['license_key'], 'licenses_license_key_unique')
    t.index(['status'], 'licenses_status_index')
    t.index(['subscription_type'], 'licenses_subscription_type_index')
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('licenses')
}

