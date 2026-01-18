export const up = async (knex) => {
  await knex.schema.createTable('borrow_returns', (t) => {
    t.bigIncrements('id').primary()
    
    // Inventory References
    t.bigInteger('borrowed_inventory_id').notNullable()
    t.bigInteger('returning_inventory_id').notNullable()
    
    // Pricing Information
    t.decimal('estimated_price', 15, 2).notNullable()
    t.decimal('actual_price', 15, 2).notNullable()
    
    // Return Details
    t.integer('quantity_returned').notNullable()
    t.date('returned_on').notNullable()
    
    // Additional Information
    t.text('note')
    
    // Metadata
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())
    t.string('sync_status', 20).defaultTo('pending')
    
    // Foreign Keys
    t.foreign('borrowed_inventory_id').references('id').inTable('inventories')
    t.foreign('returning_inventory_id').references('id').inTable('inventories')
    
    // Indexes
    t.index('borrowed_inventory_id', 'borrow_returns_borrowed_inventory_id_index')
    t.index('returning_inventory_id', 'borrow_returns_returning_inventory_id_index')
    t.index('returned_on', 'borrow_returns_returned_on_index')
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('borrow_returns')
}
