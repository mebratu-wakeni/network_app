export const up = async (knex) => {
  const client = knex.client.config.client
  await knex.schema.createTable('borrow_to_returns', (t) => {
    t.bigIncrements('id').primary()
    
    // Borrow Reference (what was lent)
    t.bigInteger('borrow_to_inventory_id').notNullable()
    
    // Return Details
    t.integer('quantity_returned').notNullable()
    t.date('returned_date').notNullable()
    
    // Inventory Reference (where to put returned items - optional, may go to different inventory)
    t.bigInteger('returned_to_inventory_id')
    
    // Pricing Information (if different from original)
    t.decimal('estimated_price', 15, 2)
    t.decimal('actual_price', 15, 2)
    
    // Condition/Notes
    t.string('condition', 50) // 'good', 'damaged', 'expired', etc.
    t.text('notes')
    
    // Metadata
    t.bigInteger('created_by')
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())
    t.string('sync_status', 20).defaultTo('pending')
    
    // Foreign Keys
    t.foreign('borrow_to_inventory_id').references('id').inTable('borrow_to_inventories').onDelete('CASCADE')
    t.foreign('returned_to_inventory_id').references('id').inTable('inventories').onDelete('SET NULL')
    t.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
    
    // Indexes
    t.index('borrow_to_inventory_id', 'borrow_to_returns_borrow_to_inventory_id_index')
    t.index('returned_date', 'borrow_to_returns_returned_date_index')
  })
  
  if (client === 'pg' || client === 'postgres') {
    await knex.raw(`
      ALTER TABLE borrow_to_returns 
      ADD CONSTRAINT check_borrow_to_return_condition 
      CHECK (condition IN ('good', 'damaged', 'expired', 'other') OR condition IS NULL)
    `)
  }
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('borrow_to_returns')
}
