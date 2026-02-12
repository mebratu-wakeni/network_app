/**
 * Expenses table - aligned with create expense UI
 * customer_id, category, paid_on, invoice_no, amount, description, payment_method,
 * withhold_percentage, cheque_no, cheque_date, bank_name, bank_transfer_ref, created_by, etc.
 */
export const up = async (knex) => {
  await knex.schema.createTable('expenses', (t) => {
    t.bigIncrements('id').primary()
    t.bigInteger('customer_id')
    t.text('category').notNullable()
    t.date('paid_on').notNullable()
    t.string('invoice_no', 255)
    t.decimal('amount', 15, 2).notNullable()
    t.text('description')
    t.string('payment_method', 50).notNullable().defaultTo('cash')
    t.decimal('withhold_percentage', 5, 2)
    t.string('cheque_no', 100)
    t.date('cheque_date')
    t.string('bank_name', 255)
    t.string('bank_transfer_ref', 255)
    t.bigInteger('created_by')
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())

    t.foreign('customer_id').references('id').inTable('customers').onDelete('SET NULL')
    t.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
    t.index('paid_on')
    t.index('category')
    t.index('payment_method')
    t.index('customer_id')
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('expenses')
}
