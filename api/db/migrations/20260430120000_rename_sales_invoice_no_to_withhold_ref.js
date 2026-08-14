/**
 * Rename sales_orders.sales_invoice_no → withhold_ref (customer withholding receipt reference).
 */

export async function up(knex) {
  const hasTable = await knex.schema.hasTable('sales_orders')
  if (!hasTable) return

  const hasOld = await knex.schema.hasColumn('sales_orders', 'sales_invoice_no')
  if (!hasOld) return

  await knex.raw('DROP INDEX IF EXISTS sales_orders_sales_invoice_no_unique')
  await knex.schema.alterTable('sales_orders', (t) => {
    t.renameColumn('sales_invoice_no', 'withhold_ref')
  })
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS sales_orders_withhold_ref_unique
    ON sales_orders (withhold_ref)
    WHERE withhold_ref IS NOT NULL
  `)
}

export async function down(knex) {
  const hasTable = await knex.schema.hasTable('sales_orders')
  if (!hasTable) return

  const hasNew = await knex.schema.hasColumn('sales_orders', 'withhold_ref')
  if (!hasNew) return

  await knex.raw('DROP INDEX IF EXISTS sales_orders_withhold_ref_unique')
  await knex.schema.alterTable('sales_orders', (t) => {
    t.renameColumn('withhold_ref', 'sales_invoice_no')
  })
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS sales_orders_sales_invoice_no_unique
    ON sales_orders (sales_invoice_no)
    WHERE sales_invoice_no IS NOT NULL
  `)
}
