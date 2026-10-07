export const up = async (knex) => {
  const client = knex.client.config.client
  await knex.schema.createTable('inventories', (t) => {
    t.bigIncrements('id').primary()
    t.bigInteger('tenant_id').unsigned().notNullable()

    // Product Reference
    t.bigInteger('product_id').notNullable()
    
    // Stock Identification
    t.string('inventory_code', 255)
    
    // Batch Information
    t.text('batch_no')
    t.date('expiry_date')
    
    // Acquisition Details
    t.date('purchase_date').notNullable()
    t.string('acquisition_type', 50).defaultTo('cash')
    t.decimal('purchase_price', 15, 2).notNullable()
    t.decimal('adjusted_purchase_price', 15, 2)
    
    // Stock Quantity
    t.integer('quantity').notNullable().defaultTo(0)
    
    // Pricing
    t.decimal('selling_price', 15, 2)
    
    // Settlement Status
    t.string('settlement_status', 50).defaultTo('unsettled')
    
    // Metadata
    t.string('location', 255)
    t.text('notes')
    
    // Timestamps
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())
    t.string('sync_status', 255).defaultTo('pending')
    
    // Foreign Keys
    t.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE')
    t.foreign('product_id').references('id').inTable('products').onDelete('CASCADE')
    
    // Unique Constraints
    t.unique(['tenant_id', 'inventory_code'], 'inventories_tenant_id_inventory_code_unique')
    t.unique(['tenant_id', 'product_id', 'batch_no', 'expiry_date', 'purchase_price'], 'inventories_product_batch_expiry_price_unique')
    
    // Indexes
    t.index('tenant_id', 'inventories_tenant_id_index')
    t.index('product_id', 'inventories_product_id_index')
    t.index('settlement_status', 'inventories_settlement_status_index')
    t.index('location', 'inventories_location_index')
    t.index('expiry_date', 'inventories_expiry_date_index')
    t.index('acquisition_type', 'inventories_acquisition_type_index')
    t.index('quantity', 'inventories_quantity_index')
  })
  
  if (client === 'pg' || client === 'postgres') {
    await knex.raw(`
      ALTER TABLE inventories 
      ADD CONSTRAINT check_acquisition_type 
      CHECK (acquisition_type IN ('purchase', 'cash', 'credit', 'cheque', 'borrow'))
    `)
    
    await knex.raw(`
      ALTER TABLE inventories 
      ADD CONSTRAINT check_settlement_status 
      CHECK (settlement_status IN ('unsettled', 'partially_settled', 'fully_settled'))
    `)
  }
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('inventories')
}
