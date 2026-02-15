export const up = async (knex) => {
  const client = knex.client.config.client
  await knex.schema.createTable('borrow_to_inventories', (t) => {
    t.bigIncrements('id').primary()
    
    // Product Reference
    t.bigInteger('product_id').notNullable()
    
    // Partner/Customer Reference (who we lent to)
    t.bigInteger('partner_id').notNullable()
    
    // Original Inventory Reference (what we lent from our stock)
    t.bigInteger('source_inventory_id').notNullable()
    
    // Stock Details
    t.string('batch_no', 64)
    t.date('expiry_date')
    t.decimal('unit_cost', 15, 2)
    t.decimal('selling_price', 15, 2)
    
    // Borrow Details
    t.integer('quantity').notNullable().defaultTo(0)
    t.date('lent_date').notNullable()
    t.date('expected_return_date')
    t.string('status', 50).defaultTo('active') // 'active', 'returned', 'partially_returned'
    
    // Additional Information
    t.text('notes')
    t.string('document_no', 64)
    
    // Metadata
    t.bigInteger('created_by')
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())
    t.string('sync_status', 255).defaultTo('pending')
    
    // Foreign Keys
    t.foreign('product_id').references('id').inTable('products').onDelete('CASCADE')
    t.foreign('partner_id').references('id').inTable('customers').onDelete('CASCADE')
    t.foreign('source_inventory_id').references('id').inTable('inventories').onDelete('CASCADE')
    t.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
    
    // Indexes
    t.index('product_id', 'borrow_to_inventories_product_id_index')
    t.index('partner_id', 'borrow_to_inventories_partner_id_index')
    t.index('source_inventory_id', 'borrow_to_inventories_source_inventory_id_index')
    t.index('status', 'borrow_to_inventories_status_index')
    t.index('lent_date', 'borrow_to_inventories_lent_date_index')
  })
  
  if (client === 'pg' || client === 'postgres') {
    await knex.raw(`
      ALTER TABLE borrow_to_inventories 
      ADD CONSTRAINT check_borrow_to_status 
      CHECK (status IN ('active', 'returned', 'partially_returned'))
    `)
  }
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('borrow_to_inventories')
}
