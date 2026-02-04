/**
 * Sales hold orders: snapshot of current sale (cart) before checkout.
 *
 * Hybrid schema:
 * - snapshot (jsonb): full current-order state; used only for load/restore.
 * - Index columns (customer_id, order_date, total_amount, payment_type, is_archive,
 *   encoder_id, encoder_fullname): for list UI (query, filter, sort, join customers).
 *
 * When saving: serialize current order → snapshot; copy customer_id, order_date,
 * total_amount, payment_type (and encoder) into columns.
 * When loading: read snapshot → restore into UI.
 */

export const up = async (knex) => {
  await knex.schema.createTable('sales_hold_orders', (t) => {
    t.bigIncrements('id').primary()

    // Full current-order state (restore from this only)
    t.jsonb('snapshot').notNullable()

    // Index columns for list/filter/sort (and join to customers for name)
    t.bigInteger('customer_id')
    t.date('order_date').notNullable()
    t.decimal('total_amount', 15, 2).defaultTo(0)
    t.string('payment_type', 50).notNullable().defaultTo('cash') // 'cash' | 'credit' | 'cheque'
    t.boolean('is_archive').defaultTo(false)

    t.bigInteger('encoder_id')
    t.string('encoder_fullname', 255)

    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())

    t.foreign('customer_id').references('id').inTable('customers').onDelete('SET NULL')
    t.foreign('encoder_id').references('id').inTable('users').onDelete('SET NULL')

    t.index('customer_id', 'sales_hold_orders_customer_id_index')
    t.index('order_date', 'sales_hold_orders_order_date_index')
    t.index('is_archive', 'sales_hold_orders_is_archive_index')
    t.index('payment_type', 'sales_hold_orders_payment_type_index')
  })

  await knex.raw(`
    ALTER TABLE sales_hold_orders
    ADD CONSTRAINT sales_hold_orders_payment_type_check
    CHECK (payment_type IN ('cash', 'credit', 'cheque'))
  `)
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('sales_hold_orders')
}
