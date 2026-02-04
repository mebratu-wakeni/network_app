export const up = async (knex) => {
  await knex.schema.createTable('purchase_receipts', (t) => {
    t.bigIncrements('id').primary()
    
    // Receipt Information
    t.string('receipt_no', 255).notNullable().unique() // Receipt number (format: PO#######)
    
    // Order Reference
    t.bigInteger('purchase_order_id') // Foreign key to purchase_orders
    
    // Snapshot Data (complete receipt snapshot at time of generation)
    t.jsonb('snapshot_data').notNullable() // Complete snapshot of order data at receipt generation time
    
    // Structured JSON fields for easier querying (denormalized from snapshot_data)
    t.jsonb('order_meta') // Order metadata (supplier info, dates, etc.)
    t.jsonb('order_items') // Order items array
    t.jsonb('order_payment') // Payment information
    
    // Receipt Status
    t.boolean('voided').defaultTo(false) // Whether the receipt has been voided
    
    // Timestamps
    t.timestamp('generated_at', { useTz: false }).defaultTo(knex.fn.now()) // When receipt was generated
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())
    t.string('sync_status', 255).defaultTo('pending')
    
    // Foreign Keys
    t.foreign('purchase_order_id').references('id').inTable('purchase_orders').onDelete('SET NULL')
    
    // Indexes
    t.index('receipt_no', 'purchase_receipts_receipt_no_index')
    t.index('purchase_order_id', 'purchase_receipts_purchase_order_id_index')
    t.index('voided', 'purchase_receipts_voided_index')
    t.index('generated_at', 'purchase_receipts_generated_at_index')
  })
  
  // Create GIN indexes for JSONB columns (for efficient JSON queries) using raw SQL
  await knex.raw(`
    CREATE INDEX purchase_receipts_snapshot_data_gin_index ON purchase_receipts USING GIN (snapshot_data)
  `)
  
  await knex.raw(`
    CREATE INDEX purchase_receipts_order_meta_gin_index ON purchase_receipts USING GIN (order_meta)
  `)
  
  await knex.raw(`
    CREATE INDEX purchase_receipts_order_items_gin_index ON purchase_receipts USING GIN (order_items)
  `)
  
  // Set default values for JSONB columns using raw SQL
  await knex.raw(`
    ALTER TABLE purchase_receipts 
    ALTER COLUMN order_meta SET DEFAULT '{}'::jsonb
  `)
  
  await knex.raw(`
    ALTER TABLE purchase_receipts 
    ALTER COLUMN order_items SET DEFAULT '[]'::jsonb
  `)
  
  await knex.raw(`
    ALTER TABLE purchase_receipts 
    ALTER COLUMN order_payment SET DEFAULT '{}'::jsonb
  `)
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('purchase_receipts')
}
