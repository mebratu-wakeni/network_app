export const up = async (knex) => {
  const client = knex.client.config.client
  await knex.schema.createTable('purchase_hold_orders', (t) => {
    t.bigIncrements('id').primary()
    
    // Supplier Reference
    t.bigInteger('supplier_id')
    
    // Order Details
    t.date('order_date').notNullable()
    t.string('invoice_no', 255) // Reference number from supplier (optional)
    t.text('remark') // Notes/remarks
    
    // Payment Information
    t.string('payment_mode', 50).notNullable() // 'cash', 'credit', 'cheque'
    
    // Financial Details
    t.decimal('total_amount', 15, 2).defaultTo(0) // Total order amount (calculated from items)
    t.decimal('amount_paid', 15, 2) // Amount paid (for credit mode with first_payment)
    t.decimal('withhold_percentage', 5, 2) // Withhold percentage
    t.decimal('withhold_amount', 15, 2) // Calculated withhold amount
    t.decimal('first_payment', 15, 2) // For credit mode: initial payment amount (if any)
    
    // Cheque Details (stored as JSON string)
    t.text('cheque_details') // JSON string: {"bank_name": "...", "cheque_number": "...", "cheque_date": "...", "amount": ...}
    
    // Items (stored as JSON string array)
    t.text('items').notNullable() // JSON string array: [{"product_id": 1, "quantity": 100, "unit_price": 50.00, "batch_number": "...", "expiry_date": "...", ...}, ...]
    
    // Archive Status
    t.boolean('is_archive').defaultTo(false) // Indicates if the hold order is archived (no longer active)
    
    // Metadata
    t.bigInteger('encoder_id') // User who created the hold order
    t.string('encoder_fullname', 255) // Full name of encoder (denormalized for performance)
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())
    
    // Foreign Keys
    t.foreign('supplier_id').references('id').inTable('customers').onDelete('SET NULL')
    t.foreign('encoder_id').references('id').inTable('users').onDelete('SET NULL')
    
    // Indexes
    t.index('supplier_id', 'purchase_hold_orders_supplier_id_index')
    t.index('order_date', 'purchase_hold_orders_order_date_index')
    t.index('is_archive', 'purchase_hold_orders_is_archive_index')
    t.index('payment_mode', 'purchase_hold_orders_payment_mode_index')
  })
  
  if (client === 'pg' || client === 'postgres') {
    await knex.raw(`
      ALTER TABLE purchase_hold_orders 
      ADD CONSTRAINT purchase_hold_orders_payment_mode_check 
      CHECK (payment_mode IN ('cash', 'credit', 'cheque'))
    `)
  }
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('purchase_hold_orders')
}
