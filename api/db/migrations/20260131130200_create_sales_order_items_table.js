/**
 * Sales order line items. Each row is one product (from a specific inventory batch) sold in a sales order.
 *
 * - sales_order_id: required; CASCADE on order delete.
 * - product_id: required; which product was sold.
 * - inventory_id: required; inventory row we sold from (stock deducted from here).
 * - unit_price: selling price per unit; total_price = quantity × unit_price.
 */

export const up = async (knex) => {
  await knex.schema.createTable('sales_order_items', (t) => {
    t.bigIncrements('id').primary()
    t.bigInteger('tenant_id').unsigned().notNullable()

    t.bigInteger('sales_order_id').notNullable()
    t.bigInteger('product_id').notNullable()
    t.bigInteger('inventory_id').notNullable() // Batch sold from; stock deducted here

    t.integer('quantity').notNullable()
    t.decimal('unit_price', 15, 2).notNullable()
    t.decimal('total_price', 15, 2).notNullable()

    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())
    t.string('sync_status', 255).defaultTo('pending')

    t.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE')
    t.foreign('sales_order_id').references('id').inTable('sales_orders').onDelete('CASCADE')
    t.foreign('product_id').references('id').inTable('products').onDelete('CASCADE')
    t.foreign('inventory_id').references('id').inTable('inventories').onDelete('CASCADE')

    t.index('tenant_id', 'sales_order_items_tenant_id_index')
    t.index('sales_order_id', 'sales_order_items_sales_order_id_index')
    t.index('product_id', 'sales_order_items_product_id_index')
    t.index('inventory_id', 'sales_order_items_inventory_id_index')
  })
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('sales_order_items')
}
