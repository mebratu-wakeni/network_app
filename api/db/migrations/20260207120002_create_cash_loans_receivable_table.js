/**
 * Cash loans receivable - cash lent to partners/others (Loans Receivable 1210)
 */
export const up = async (knex) => {
  await knex.schema.createTable('cash_loans_receivable', (t) => {
    t.bigIncrements('id').primary()
    t.bigInteger('tenant_id').unsigned().notNullable()
    t.bigInteger('partner_id').notNullable() // FK to customers
    t.decimal('amount', 15, 2).notNullable()
    t.date('lent_date').notNullable()
    t.date('expected_return_date')
    t.decimal('returned_amount', 15, 2).defaultTo(0)
    t.string('status', 50).defaultTo('active') // 'active' | 'returned' | 'partially_returned'
    t.text('notes')
    t.string('reference_no', 255)
    t.bigInteger('created_by')
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())

    t.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE')
    t.foreign('partner_id').references('id').inTable('customers').onDelete('RESTRICT')
    t.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
    t.index('tenant_id')
    t.index('partner_id')
    t.index('status')
    t.index('lent_date')
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('cash_loans_receivable')
}
