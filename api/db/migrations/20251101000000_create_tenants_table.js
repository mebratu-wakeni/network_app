/**
 * Tenants table - one row per client business on the multi-tenant cloud deployment.
 * client_code is what the desktop app's Setup Wizard stores locally and sends with
 * every login request so the API can resolve which tenant a login belongs to.
 */
export const up = async (knex) => {
  await knex.schema.createTable('tenants', (t) => {
    t.bigIncrements('id').primary()
    t.string('client_code', 32).notNullable().unique()
    t.string('business_name', 255).notNullable()
    t.string('contact_name', 255)
    t.string('phone', 100)
    t.string('email', 255)
    t.string('status', 20).notNullable().defaultTo('active') // 'active' | 'suspended'
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())

    t.index('client_code', 'tenants_client_code_index')
    t.index('status', 'tenants_status_index')
  })

  const client = knex.client.config.client
  if (client === 'pg' || client === 'postgres') {
    await knex.raw(`
      ALTER TABLE tenants
      ADD CONSTRAINT tenants_status_check
      CHECK (status IN ('active', 'suspended'))
    `)
  }
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('tenants')
}
