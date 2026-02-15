/**
 * Fiscal years table - tracks open/closed status for year-end closing
 * Calendar year: start_date = YYYY-01-01, end_date = YYYY-12-31
 */
export const up = async (knex) => {
  const client = knex.client.config.client
  await knex.schema.createTable('fiscal_years', (t) => {
    t.bigIncrements('id').primary()
    t.integer('fiscal_year').notNullable().unique() // e.g. 2025
    t.date('start_date').notNullable()
    t.date('end_date').notNullable()
    t.string('status', 20).notNullable().defaultTo('open') // 'open' | 'closed'
    t.timestamp('closed_at', { useTz: false })
    t.bigInteger('closed_by')
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())

    t.foreign('closed_by').references('id').inTable('users').onDelete('SET NULL')
    t.index('fiscal_year')
    t.index('status')
    t.index('start_date')
    t.index('end_date')
  })

  if (client === 'pg' || client === 'postgres') {
    await knex.raw(`
      ALTER TABLE fiscal_years
      ADD CONSTRAINT fiscal_years_status_check
      CHECK (status IN ('open', 'closed'))
    `)
  }

  // No seed: users create fiscal years via Settings → Fiscal Year → Create
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('fiscal_years')
}
