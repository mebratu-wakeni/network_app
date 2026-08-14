/**
 * Borrow Variance (6400): expense under 6000 — borrow-from return clearing
 * (AP at obligation unit cost vs inventory at returning lot cost).
 */
export const up = async (knex) => {
  const exists = await knex('chart_of_accounts').where({ account_code: '6400' }).first()
  if (exists) return

  const expenses = await knex('chart_of_accounts').where({ account_code: '6000' }).first()
  if (!expenses?.id) {
    // migrate.latest() often runs before seeds — COA empty; seed adds 6400
    return
  }

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

export const down = async (knex) => {
  await knex('chart_of_accounts').where({ account_code: '6400' }).del()
}
