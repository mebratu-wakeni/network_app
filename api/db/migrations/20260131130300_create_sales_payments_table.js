export const up = async (knex) => {
  await knex.schema.createTable('sales_payments', (t) => {
    t.bigIncrements('id').primary()
    t.bigInteger('tenant_id').unsigned().notNullable()

    // Order Reference
    t.bigInteger('sales_order_id').notNullable()
    
    // Payment Details
    t.date('payment_date').notNullable()
    t.decimal('amount', 15, 2).notNullable() // Payment amount
    t.string('payment_method', 50) // Payment method (e.g., 'cash', 'cheque')
    t.text('note') // Optional note about the payment
    
    // Cheque Details (if payment_method is 'cheque')
    t.string('cheque_no', 255) // Cheque number
    t.string('bank_name', 255) // Bank name
    t.date('cheque_date') // Date on the cheque
    t.date('cleared_date') // Date when cheque was cleared
    
    // Metadata
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())
    t.string('sync_status', 255).defaultTo('pending')
    
    // Foreign Keys
    t.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE')
    t.foreign('sales_order_id').references('id').inTable('sales_orders').onDelete('CASCADE')
    
    // Indexes
    t.index('tenant_id', 'sales_payments_tenant_id_index')
    t.index('sales_order_id', 'sales_payments_sales_order_id_index')
    t.index('payment_date', 'sales_payments_payment_date_index')
    t.index('payment_method', 'sales_payments_payment_method_index')
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('sales_payments')
}
