export const up = async (knex) => {
  const client = knex.client.config.client
  await knex.schema.createTable('purchase_orders', (t) => {
    t.bigIncrements('id').primary()
    
    // Supplier Reference
    t.bigInteger('supplier_id')
    
    // Order Details
    t.date('order_date').notNullable()
    t.string('invoice_no', 255) // Reference number from supplier (external reference, optional)
    t.text('remark') // Notes/remarks
    
    // Payment Information
    t.string('payment_mode', 50).notNullable() // 'cash', 'credit', 'cheque'
    t.string('payment_status', 50).defaultTo('paid') // 'paid', 'partial', 'unpaid'
    
    // Financial Details
    t.decimal('total_amount', 15, 2).defaultTo(0) // Total order amount (subtotal)
    t.decimal('amount_paid', 15, 2) // Amount paid so far
    t.decimal('withhold_percentage', 5, 2) // Withhold percentage (e.g., 2.5)
    t.decimal('withhold_amount', 15, 2) // Calculated withhold amount
    t.boolean('withhold_settled').defaultTo(false) // Whether withhold has been settled
    
    // Receipt Information
    t.string('receipt_no', 255).notNullable().unique() // System-generated receipt number (format: PO#######)
    
    // Status
    t.string('status', 50).defaultTo('completed') // 'completed', 'archived', 'reversed'
    
    // Metadata
    t.bigInteger('encoder_id') // User who created the order
    t.string('encoder_fullname', 255) // Full name of encoder (denormalized for performance)
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())
    t.string('sync_status', 255).defaultTo('pending')
    
    // Foreign Keys
    t.foreign('supplier_id').references('id').inTable('customers').onDelete('SET NULL')
    t.foreign('encoder_id').references('id').inTable('users').onDelete('SET NULL')
    
    // Indexes
    t.index('receipt_no', 'purchase_orders_receipt_no_index')
    t.index('supplier_id', 'purchase_orders_supplier_id_index')
    t.index('order_date', 'purchase_orders_order_date_index')
    t.index('status', 'purchase_orders_status_index')
    t.index('payment_mode', 'purchase_orders_payment_mode_index')
    t.index('payment_status', 'purchase_orders_payment_status_index')
  })
  
  if (client === 'pg' || client === 'postgres') {
    await knex.raw(`
      ALTER TABLE purchase_orders 
      ADD CONSTRAINT purchase_orders_status_check 
      CHECK (status IN ('completed', 'archived', 'reversed'))
    `)
    
    await knex.raw(`
      ALTER TABLE purchase_orders 
      ADD CONSTRAINT purchase_orders_payment_status_check 
      CHECK (payment_status IN ('paid', 'partial', 'unpaid'))
    `)
    
    await knex.raw(`
      ALTER TABLE purchase_orders 
      ADD CONSTRAINT purchase_orders_payment_mode_check 
      CHECK (payment_mode IN ('cash', 'credit', 'cheque'))
    `)
  }
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('purchase_orders')
}
