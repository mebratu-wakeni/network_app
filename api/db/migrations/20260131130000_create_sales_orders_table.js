/**
 * Sales orders table (refined schema).
 *
 * - customer_id: was retailer_id; FK to customers.
 * - receipt_no: system-generated sales order identifier (required, unique).
 * - invoice_no: government/tax authority reference (optional).
 * - withhold_ref: customer withholding receipt reference (optional, unique).
 * - withhold_percentage: no default; value comes from settings when applicable.
 * - Withholding is inferred from withhold_percentage and withhold_amount (no separate boolean).
 * - Hold orders live in sales_hold_orders (snapshot of current-order state); no is_held/hold_until here.
 * - payment_type: cash | credit | cheque (no 'borrow'); same concept as payment_mode in purchase.
 * - encoder_fullname: stores user's display_name (denormalized).
 */

export const up = async (knex) => {
  const client = knex.client.config.client
  await knex.schema.createTable('sales_orders', (t) => {
    t.bigIncrements('id').primary()
    t.bigInteger('tenant_id').unsigned().notNullable()

    // Customer reference (was retailer_id)
    t.bigInteger('customer_id')

    // Order details
    t.date('order_date').notNullable()
    t.string('invoice_no', 255) // Government/tax authority reference (optional)
    t.text('remark')

    // Payment
    t.string('payment_type', 50).notNullable().defaultTo('cash') // 'cash' | 'credit' | 'cheque'
    t.string('payment_status', 50).defaultTo('unpaid') // 'paid' | 'partial' | 'unpaid'

    // Financial
    t.decimal('total_amount', 15, 2).defaultTo(0)
    t.decimal('amount_paid', 15, 2).defaultTo(0)
    t.decimal('withhold_percentage', 5, 2) // No default; from settings when applicable
    t.decimal('withhold_amount', 15, 2)
    t.decimal('received_amount', 15, 2)
    t.boolean('withhold_settled').defaultTo(false)
    t.boolean('withhold_confirmation').defaultTo(false) // Important for withhold workflow
    t.string('withhold_ref', 255) // Customer withholding receipt ref. (optional, unique)

    // System-generated receipt (sales order identifier)
    t.string('receipt_no', 255).notNullable()

    // Status
    t.string('status', 50).defaultTo('pending') // 'pending' | 'completed' | 'archived'
    t.boolean('is_reversed').defaultTo(false)

    // Encoder (user who created the order)
    t.bigInteger('encoder_id')
    t.string('encoder_fullname', 255) // User's display_name (denormalized)

    // Metadata
    t.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now())
    t.timestamp('last_updated', { useTz: false }).defaultTo(knex.fn.now())
    t.string('sync_status', 255).defaultTo('pending')

    // Foreign keys
    t.foreign('tenant_id').references('id').inTable('tenants').onDelete('CASCADE')
    t.foreign('customer_id').references('id').inTable('customers').onDelete('SET NULL')
    t.foreign('encoder_id').references('id').inTable('users').onDelete('SET NULL')

    t.unique(['tenant_id', 'receipt_no'], 'sales_orders_tenant_id_receipt_no_unique')

    // Indexes
    t.index('tenant_id', 'sales_orders_tenant_id_index')
    t.index('receipt_no', 'sales_orders_receipt_no_index')
    t.index('customer_id', 'sales_orders_customer_id_index')
    t.index('order_date', 'sales_orders_order_date_index')
    t.index('status', 'sales_orders_status_index')
    t.index('payment_type', 'sales_orders_payment_type_index')
    t.index('payment_status', 'sales_orders_payment_status_index')
  })

  if (client === 'pg' || client === 'postgres') {
    await knex.raw(`
      ALTER TABLE sales_orders
      ADD CONSTRAINT sales_orders_status_check
      CHECK (status IN ('pending', 'completed', 'archived'))
    `)

    await knex.raw(`
      ALTER TABLE sales_orders
      ADD CONSTRAINT sales_orders_payment_status_check
      CHECK (payment_status IN ('paid', 'partial', 'unpaid'))
    `)

    await knex.raw(`
      ALTER TABLE sales_orders
      ADD CONSTRAINT sales_orders_payment_type_check
      CHECK (payment_type IN ('cash', 'credit', 'cheque'))
    `)
  }

  // Unique index for withhold_ref (nullable), scoped per tenant
  await knex.raw(`
    CREATE UNIQUE INDEX sales_orders_withhold_ref_unique
    ON sales_orders (tenant_id, withhold_ref)
    WHERE withhold_ref IS NOT NULL
  `)
}

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('sales_orders')
}
