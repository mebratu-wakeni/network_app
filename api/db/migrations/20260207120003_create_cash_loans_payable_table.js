/**
 * Cash loans payable - cash borrowed from partners/others (Loans Payable 3300)
 */
export const up = async (knex) => {
  await knex.schema.createTable('cash_loans_payable', (t) => {
    t.bigIncrements('id').primary()
    t.bigInteger('tenant_id').unsigned().notNullable()
    t.bigInteger('partner_id').notNullable() // FK to customers
    t.decimal('amount', 15, 2).notNullable()
    t.date('borrowed_date').notNullable()
    t.date('expected_repay_date')
    t.decimal('repaid_amount', 15, 2).defaultTo(0)
    t.string('status', 50).defaultTo('active') // 'active' | 'repaid' | 'partially_repaid'
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
    t.index('borrowed_date')
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('cash_loans_payable')
}
