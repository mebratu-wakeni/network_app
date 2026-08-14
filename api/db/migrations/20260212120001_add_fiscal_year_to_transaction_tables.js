/**
 * Add fiscal_year to all transaction tables and backfill from date columns
 * fiscal_year = year part of the transaction date (calendar year)
 */
export const up = async (knex) => {
  const client = knex.client.config.client
  const isPg = client === 'pg' || client === 'postgres'

  const addFiscalYearAndBackfill = async (table, dateColumn) => {
    await knex.schema.alterTable(table, (t) => {
      t.integer('fiscal_year')
    })
    await knex(table)
      .whereNotNull(dateColumn)
      .update({
        fiscal_year: isPg
          ? knex.raw(`CAST(EXTRACT(YEAR FROM ${dateColumn}) AS INTEGER)`)
          : knex.raw(`CAST(strftime('%Y', ${dateColumn}) AS INTEGER)`)
      })
    await knex.schema.alterTable(table, (t) => {
      t.index('fiscal_year')
    })
  }

  // 1. Deposits
  await addFiscalYearAndBackfill('deposits', 'deposit_date')

  // 2. Expenses
  await addFiscalYearAndBackfill('expenses', 'paid_on')

  // 3. Purchase orders
  await addFiscalYearAndBackfill('purchase_orders', 'order_date')

  // 4. Sales orders
  await addFiscalYearAndBackfill('sales_orders', 'order_date')

  // 5. Cash loans receivable
  await addFiscalYearAndBackfill('cash_loans_receivable', 'lent_date')

  // 6. Cash loans payable
  await addFiscalYearAndBackfill('cash_loans_payable', 'borrowed_date')

  // 7. Withhold receivable settlements
  await addFiscalYearAndBackfill('withhold_receivable_settlements', 'settlement_date')

  // 8. Withhold payable settlements
  await addFiscalYearAndBackfill('withhold_payable_settlements', 'settlement_date')

  // 9. Bin cards (inventory movements)
  await addFiscalYearAndBackfill('bin_cards', 'transaction_date')

  // 10. Account ledger - already has fiscal_year (string). Backfill if empty
  if (isPg) {
    await knex.raw(`
      UPDATE account_ledger
      SET fiscal_year = TO_CHAR(transaction_date, 'YYYY'),
          fiscal_period = TO_CHAR(transaction_date, 'MM')
      WHERE (fiscal_year IS NULL OR fiscal_year = '') AND transaction_date IS NOT NULL
    `)
  } else {
    await knex.raw(`
      UPDATE account_ledger
      SET fiscal_year = strftime('%Y', transaction_date),
          fiscal_period = strftime('%m', transaction_date)
      WHERE (fiscal_year IS NULL OR fiscal_year = '') AND transaction_date IS NOT NULL
    `)
  }
}

export const down = async (knex) => {
  const tables = [
    'bin_cards',
    'withhold_payable_settlements',
    'withhold_receivable_settlements',
    'cash_loans_payable',
    'cash_loans_receivable',
    'sales_orders',
    'purchase_orders',
    'expenses',
    'deposits'
  ]

  for (const table of tables) {
    await knex.schema.alterTable(table, (t) => {
      t.dropColumn('fiscal_year')
    })
  }
}
