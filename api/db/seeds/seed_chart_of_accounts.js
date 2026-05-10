export const seed = async (knex) => {
  // Clear existing chart of accounts
  await knex('chart_of_accounts').del()

  const accounts = [
    { account_code: '1000', account_name: 'Current Assets', account_type: 'Asset', account_category: 'Current Assets', parent_account_id: null, level: 1, is_active: true, description: 'All current assets' },
    { account_code: '1100', account_name: 'Cash', account_type: 'Asset', account_category: 'Current Assets', parent_account_code: '1000', level: 2, is_active: true, description: 'Cash on hand and in bank' },
    { account_code: '1200', account_name: 'Accounts Receivable', account_type: 'Asset', account_category: 'Current Assets', parent_account_code: '1000', level: 2, is_active: true, description: 'Amounts owed by customers' },
    { account_code: '1210', account_name: 'Loans Receivable', account_type: 'Asset', account_category: 'Current Assets', parent_account_code: '1000', level: 2, is_active: true, description: 'Cash lent to partners or others (due from others)' },
    { account_code: '1250', account_name: 'Withhold Receivable', account_type: 'Asset', account_category: 'Current Assets', parent_account_code: '1000', level: 2, is_active: true, description: 'Withholding tax receivable from customers' },
    { account_code: '1300', account_name: 'Inventory', account_type: 'Asset', account_category: 'Current Assets', parent_account_code: '1000', level: 2, is_active: true, description: 'Goods available for sale' },
    { account_code: '1400', account_name: 'Prepaid Expenses', account_type: 'Asset', account_category: 'Current Assets', parent_account_code: '1000', level: 2, is_active: true, description: 'Expenses paid in advance' },
    { account_code: '2000', account_name: 'Fixed Assets', account_type: 'Asset', account_category: 'Fixed Assets', parent_account_id: null, level: 1, is_active: true, description: 'All fixed assets' },
    { account_code: '2100', account_name: 'Equipment', account_type: 'Asset', account_category: 'Fixed Assets', parent_account_code: '2000', level: 2, is_active: true, description: 'Office and business equipment' },
    { account_code: '2200', account_name: 'Accumulated Depreciation', account_type: 'Asset', account_category: 'Fixed Assets', parent_account_code: '2000', level: 2, is_active: true, description: 'Accumulated depreciation on fixed assets' },
    { account_code: '3000', account_name: 'Current Liabilities', account_type: 'Liability', account_category: 'Current Liabilities', parent_account_id: null, level: 1, is_active: true, description: 'All current liabilities' },
    { account_code: '3100', account_name: 'Accounts Payable', account_type: 'Liability', account_category: 'Current Liabilities', parent_account_code: '3000', level: 2, is_active: true, description: 'Amounts owed to suppliers' },
    { account_code: '3200', account_name: 'Accrued Expenses', account_type: 'Liability', account_category: 'Current Liabilities', parent_account_code: '3000', level: 2, is_active: true, description: 'Expenses incurred but not yet paid' },
    { account_code: '3210', account_name: 'Withholding Payable', account_type: 'Liability', account_category: 'Current Liabilities', parent_account_code: '3000', level: 2, is_active: true, description: 'Tax withheld from supplier payments' },
    { account_code: '3300', account_name: 'Loans Payable', account_type: 'Liability', account_category: 'Current Liabilities', parent_account_code: '3000', level: 2, is_active: true, description: 'Loans from partners or other financial institutions' },
    { account_code: '4000', account_name: 'Equity', account_type: 'Equity', account_category: 'Equity', parent_account_id: null, level: 1, is_active: true, description: 'All equity accounts' },
    { account_code: '4100', account_name: "Owner's Capital", account_type: 'Equity', account_category: 'Equity', parent_account_code: '4000', level: 2, is_active: true, description: "Owner's investment in the business" },
    { account_code: '4200', account_name: 'Retained Earnings', account_type: 'Equity', account_category: 'Equity', parent_account_code: '4000', level: 2, is_active: true, description: 'Accumulated profits/losses' },
    { account_code: '4300', account_name: 'Opening Balance', account_type: 'Equity', account_category: 'Equity', parent_account_code: '4000', level: 2, is_active: true, description: 'Opening balance for initial inventory and assets' },
    { account_code: '5000', account_name: 'Revenue', account_type: 'Revenue', account_category: 'Revenue', parent_account_id: null, level: 1, is_active: true, description: 'All revenue accounts' },
    { account_code: '5100', account_name: 'Sales Revenue', account_type: 'Revenue', account_category: 'Revenue', parent_account_code: '5000', level: 2, is_active: true, description: 'Revenue from sales of goods' },
    { account_code: '5200', account_name: 'Other Revenue', account_type: 'Revenue', account_category: 'Revenue', parent_account_code: '5000', level: 2, is_active: true, description: 'Other sources of revenue' },
    { account_code: '6000', account_name: 'Expenses', account_type: 'Expense', account_category: 'Expenses', parent_account_id: null, level: 1, is_active: true, description: 'All expense accounts' },
    { account_code: '6100', account_name: 'Cost of Goods Sold', account_type: 'Expense', account_category: 'Expenses', parent_account_code: '6000', level: 2, is_active: true, description: 'Direct costs of goods sold' },
    { account_code: '6200', account_name: 'Operating Expenses', account_type: 'Expense', account_category: 'Expenses', parent_account_code: '6000', level: 2, is_active: true, description: 'General operating expenses' },
    { account_code: '6300', account_name: 'Depreciation Expense', account_type: 'Expense', account_category: 'Expenses', parent_account_code: '6000', level: 2, is_active: true, description: 'Depreciation of fixed assets' },
    { account_code: '6400', account_name: 'Borrow Variance', account_type: 'Expense', account_category: 'Expenses', parent_account_code: '6000', level: 2, is_active: true, description: 'Borrow obligation vs returning lot cost on borrow-from returns' },
  ]

  // Separate level 1 (parent) and level 2 (child) accounts
  const level1Accounts = accounts.filter(acc => acc.level === 1)
  const level2Accounts = accounts.filter(acc => acc.level === 2)

  // Insert level 1 accounts first
  const insertedLevel1 = await knex('chart_of_accounts')
    .insert(level1Accounts.map(({ parent_account_code, ...acc }) => acc))
    .returning(['id', 'account_code'])

  // Create a map of account_code to id for level 1 accounts
  const accountCodeToId = new Map(insertedLevel1.map(acc => [acc.account_code, acc.id]))

  // Insert level 2 accounts with correct parent_account_id
  const level2AccountsWithParentId = level2Accounts.map(acc => {
    const { parent_account_code, ...rest } = acc
    return {
      ...rest,
      parent_account_id: accountCodeToId.get(parent_account_code)
    }
  })

  await knex('chart_of_accounts').insert(level2AccountsWithParentId)
}
