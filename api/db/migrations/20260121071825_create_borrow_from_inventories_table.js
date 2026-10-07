export const up = async (knex) => {
  const client = knex.client.config.client
  await knex.schema.createTable('borrow_from_inventories', (t) => {
    t.bigIncrements('id').primary()
    t.bigInteger('tenant_id').unsigned().notNullable()

    // Product Reference
    t.bigInteger('product_id').notNullable()
    
    // Partner/Customer Reference (who we borrowed from)
    t.bigInteger('partner_id').notNullable()
    
    // Stock Details
    t.string('batch_no', 64)
    t.date('expiry_date')
    t.decimal('unit_cost', 15, 2)
    t.decimal('selling_price', 15, 2)
    t.string('location', 255)
    
    // Borrow Details
    t.integer('quantity').notNullable().defaultTo(0)
    t.date('borrowed_date').notNullable()
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
    t.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE')
    t.foreign('product_id').references('id').inTable('products').onDelete('CASCADE')
    t.foreign('partner_id').references('id').inTable('customers').onDelete('CASCADE')
    t.foreign('created_by').references('id').inTable('users').onDelete('SET NULL')
    
    // Indexes
    t.index('tenant_id', 'borrow_from_inventories_tenant_id_index')
    t.index('product_id', 'borrow_from_inventories_product_id_index')
    t.index('partner_id', 'borrow_from_inventories_partner_id_index')
    t.index('status', 'borrow_from_inventories_status_index')
    t.index('borrowed_date', 'borrow_from_inventories_borrowed_date_index')
  })
  
  if (client === 'pg' || client === 'postgres') {
    await knex.raw(`
      ALTER TABLE borrow_from_inventories 
      ADD CONSTRAINT check_borrow_from_status 
      CHECK (status IN ('active', 'returned', 'partially_returned'))
    `)
  }
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('borrow_from_inventories')
}
