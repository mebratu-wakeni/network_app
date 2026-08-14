/**
 * Deposits table - capital contributions, seed, bank deposits
 */
export const up = async (knex) => {
  await knex.schema.createTable('deposits', (t) => {
    t.bigIncrements('id').primary()
    t.bigInteger('tenant_id').unsigned().notNullable()
    t.date('deposit_date').notNullable()
    t.string('type', 50).notNullable() // 'deposit' | 'contribution' | 'initial_seed' | 'capital_injection' | 'other'
    t.decimal('amount', 15, 2).notNullable()
    t.text('description')
    t.string('source', 255) // optional source/reference
    t.string('reference_no', 255) // optional external reference
    t.bigInteger('created_by')
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())

    t.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE')
    t.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
    t.index('tenant_id')
    t.index('deposit_date')
    t.index('type')
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('deposits')
}
