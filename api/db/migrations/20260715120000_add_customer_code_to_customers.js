/**
 * Business-facing customer reference (tenant-scoped). Internal `id` stays for FKs only.
 */
export const up = async (knex) => {
  const client = knex.client.config.client
  const hasColumn = await knex.schema.hasColumn('customers', 'customer_code')
  if (!hasColumn) {
    await knex.schema.alterTable('customers', (t) => {
      t.string('customer_code', 32).nullable()
    })
  }

  const rows = await knex('customers').select('id', 'tenant_id').orderBy(['tenant_id', 'id'])
  let currentTenant = null
  let seq = 0
  for (const row of rows) {
    if (row.tenant_id !== currentTenant) {
      currentTenant = row.tenant_id
      seq = 0
    }
    seq += 1
    const code = `CUST${String(seq).padStart(4, '0')}`
    await knex('customers').where({ id: row.id }).update({ customer_code: code })
  }

  if (client === 'sqlite3') {
    await knex.raw(`
      CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_id_customer_code_unique
      ON customers (tenant_id, customer_code)
    `)
  } else {
    await knex.schema.alterTable('customers', (t) => {
      t.string('customer_code', 32).notNullable().alter()
    })
    await knex.raw(`
      ALTER TABLE customers
      ADD CONSTRAINT customers_tenant_id_customer_code_unique UNIQUE (tenant_id, customer_code)
    `)
  }
}

export const down = async (knex) => {
  const hasColumn = await knex.schema.hasColumn('customers', 'customer_code')
  if (!hasColumn) return
  if (knex.client.config.client !== 'sqlite3') {
    await knex.raw('ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_tenant_id_customer_code_unique')
  }
  await knex.schema.alterTable('customers', (t) => {
    t.dropColumn('customer_code')
  })
}
