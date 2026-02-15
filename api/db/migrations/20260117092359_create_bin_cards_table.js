export const up = async (knex) => {
  const client = knex.client.config.client
  await knex.schema.createTable('bin_cards', (t) => {
    t.bigIncrements('id').primary()
    
    // Product Reference (Primary)
    t.bigInteger('product_id').notNullable()
    
    // Inventory Reference (Optional)
    t.bigInteger('inventory_id')
    
    // Batch Information
    t.string('batch_no', 64)
    t.date('expiry_date')
    
    // Transaction Details
    t.date('transaction_date').notNullable()
    t.string('transaction_type', 50).notNullable()
    
    // Reference Tracking
    t.bigInteger('reference_id')
    t.string('reference_table', 32)
    t.string('document_no', 64)
    
    // Balance Tracking
    t.integer('opening_balance')
    t.integer('quantity_in').defaultTo(0)
    t.integer('quantity_out').defaultTo(0)
    t.integer('balance').notNullable()
    
    // Cost Tracking
    t.decimal('unit_cost', 15, 2)
    t.decimal('total_cost', 15, 2)
    
    // Additional Information
    t.string('reason', 255)
    t.string('notes', 500)
    
    // Audit Fields
    t.bigInteger('created_by')
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())
    t.string('sync_status', 255).defaultTo('pending')
    
    // Foreign Keys
    t.foreign('product_id').references('id').inTable('products').onDelete('CASCADE')
    t.foreign('inventory_id').references('id').inTable('inventories').onDelete('SET NULL')
    t.foreign('created_by').references('id').inTable('users')
    
    // Indexes
    t.index('product_id', 'bin_cards_product_id_index')
    t.index('inventory_id', 'bin_cards_inventory_id_index')
    t.index('transaction_date', 'bin_cards_transaction_date_index')
    t.index('transaction_type', 'bin_cards_transaction_type_index')
    t.index(['reference_table', 'reference_id'], 'bin_cards_reference_index')
    t.index('created_by', 'bin_cards_created_by_index')
  })
  
  if (client === 'pg' || client === 'postgres') {
    await knex.raw(`
      ALTER TABLE bin_cards 
      ADD CONSTRAINT check_transaction_type 
      CHECK (transaction_type IN ('received', 'issued', 'voided', 'adjustment', 'opening', 'return', 'transfer_in', 'transfer_out', 'expired', 'damaged'))
    `)
  }
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('bin_cards')
}
