/**
 * Renumber Borrow Variance 4400 → 6400 (4400 sat in the equity block numerically; 6xxx = Expenses).
 */
export const up = async (knex) => {
  const has6400 = await knex('chart_of_accounts').where({ account_code: '6400' }).first()
  const has4400 = await knex('chart_of_accounts').where({ account_code: '4400' }).first()

  if (has4400 && !has6400) {
    const hasLedger = await knex.schema.hasTable('account_ledger')
    if (hasLedger) {
      await knex('account_ledger').where({ account_code: '4400' }).update({ account_code: '6400' })
    }
    await knex('chart_of_accounts').where({ account_code: '4400' }).update({ account_code: '6400' })
    return
  }

  if (!has6400) {
    const expenses = await knex('chart_of_accounts').where({ account_code: '6000' }).first()
    if (!expenses?.id) return
    await knex('chart_of_accounts').insert({
      account_code: '6400',
      account_name: 'Borrow Variance',
      account_type: 'Expense',
      account_category: 'Expenses',
      parent_account_id: expenses.id,
      level: 2,
      is_active: true,
      description: 'Cost difference between borrow obligation (unit_cost) and returning lot cost on borrow-from returns',
      sync_status: 'pending'
    })
  }
}

export const down = async (knex) => {
  const has6400 = await knex('chart_of_accounts').where({ account_code: '6400' }).first()
  const has4400 = await knex('chart_of_accounts').where({ account_code: '4400' }).first()
  if (has6400 && !has4400) {
    const hasLedger = await knex.schema.hasTable('account_ledger')
    if (hasLedger) {
      await knex('account_ledger').where({ account_code: '6400' }).update({ account_code: '4400' })
    }
    await knex('chart_of_accounts').where({ account_code: '6400' }).update({ account_code: '4400' })
  }
}
