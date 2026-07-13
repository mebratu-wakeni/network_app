export const up = async (knex) => {
  await knex.schema.createTable('purchase_order_items', (t) => {
    t.bigIncrements('id').primary()
    t.bigInteger('tenant_id').unsigned().notNullable()

    // Order Reference
    t.bigInteger('purchase_order_id').notNullable()
    
    // Product Reference
    t.bigInteger('product_id').notNullable()
    
    // Item Details
    t.integer('quantity').notNullable()
    t.decimal('unit_price', 15, 2).notNullable()
    t.decimal('total_price', 15, 2).notNullable() // quantity × unit_price
    
    // Inventory Reference (populated after inventory is created)
    t.bigInteger('inventory_id') // Links to inventory record created for this item
    
    // Metadata
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())
    t.string('sync_status', 255).defaultTo('pending')
    
    // Foreign Keys
    t.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE')
    t.foreign('purchase_order_id').references('id').inTable('purchase_orders').onDelete('CASCADE')
    t.foreign('product_id').references('id').inTable('products').onDelete('CASCADE')
    t.foreign('inventory_id').references('id').inTable('inventories').onDelete('CASCADE')
    
    // Indexes
    t.index('tenant_id', 'purchase_order_items_tenant_id_index')
    t.index('purchase_order_id', 'purchase_order_items_purchase_order_id_index')
    t.index('product_id', 'purchase_order_items_product_id_index')
    t.index('inventory_id', 'purchase_order_items_inventory_id_index')
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('purchase_order_items')
}
