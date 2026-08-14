export const up = async (knex) => {
  await knex.schema.createTable('licenses', (t) => {
    t.bigIncrements('id').primary()
    t.string('license_key', 50).notNullable().unique()   // PHRM-A1B2-C3D4-E5F6
    t.string('customer_name', 255).notNullable()
    t.string('email', 255)
    // Subscription type: 'monthly' | 'yearly' | 'lifetime'
    t.string('subscription_type', 20).notNullable().defaultTo('lifetime')
    t.string('start_date', 10).notNullable()             // YYYY-MM-DD
    t.string('expires_at', 10)                           // YYYY-MM-DD, null for lifetime
    t.string('status', 20).notNullable().defaultTo('active')  // active | revoked
    t.text('notes')
    t.bigInteger('created_by').references('id').inTable('admin_users').onDelete('SET NULL')
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())

    t.index('license_key')
    t.index('status')
    t.index('customer_name')
    t.index('expires_at')
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('licenses')
}
