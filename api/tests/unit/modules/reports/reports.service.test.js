import { describe, expect, it, vi } from 'vitest'
import { ReportsService } from '../../../../src/modules/reports/reports.service.js'

/** Minimal COA row shape used by getBalanceSheet */
function coaRow(account_code, account_name, account_type, level = 2) {
  return { account_code, account_name, account_type, level, is_active: true }
}

function makeReportsRepository({ coa = [], closing = [] } = {}) {
  return {
    getChartOfAccountsForReporting: vi.fn().mockResolvedValue(coa),
    getClosingBalances: vi.fn().mockResolvedValue(closing),
    getChartOfAccounts: vi.fn(),
    getPeriodActivity: vi.fn()
  }
}

/**
 * Balanced scenario: debit/credit storage matches service conventions;
 * ledger lines sum to ~0; assets = liabilities + equity + net income.
 */
function balancedScenario() {
  const coa = [
    coaRow('1100', 'Cash', 'Asset'),
    coaRow('2100', 'Accounts Payable', 'Liability'),
    coaRow('3100', 'Retained Earnings', 'Equity'),
    coaRow('5100', 'Sales Revenue', 'Revenue'),
    coaRow('6100', 'Expense', 'Expense')
  ]
  const closing = [
    { account_code: '1100', account_name: 'Cash', balance: 1000 },
    { account_code: '2100', account_name: 'Accounts Payable', balance: -400 },
    { account_code: '3100', account_name: 'Retained Earnings', balance: -500 },
    { account_code: '5100', account_name: 'Sales Revenue', balance: -200 },
    { account_code: '6100', account_name: 'Expense', balance: 100 }
  ]
  return { coa, closing }
}

describe('ReportsService.getBalanceSheet reconciliation', () => {
  it('marks reconciliation balanced when assets equal liabilities plus equity (incl. net income)', async () => {
    const { coa, closing } = balancedScenario()
    const service = new ReportsService(makeReportsRepository({ coa, closing }))

    const result = await service.getBalanceSheet({ as_of_date: '2026-04-30' })

    expect(result.reconciliation.balanced).toBe(true)
    expect(Math.abs(result.reconciliation.variance)).toBeLessThan(0.02)
    expect(result.assets.total).toBeCloseTo(1000, 2)
    expect(result.total_liabilities_equity).toBeCloseTo(1000, 2)
    expect(result.unmapped_ledger_accounts).toHaveLength(0)
  })

  it('exposes ledger_sum_check as sum of raw closing balances', async () => {
    const { coa, closing } = balancedScenario()
    const service = new ReportsService(makeReportsRepository({ coa, closing }))

    const result = await service.getBalanceSheet({ as_of_date: '2026-04-30' })

    const expectedSum = closing.reduce((s, r) => s + Number(r.balance || 0), 0)
    expect(result.reconciliation.ledger_sum_check).toBeCloseTo(expectedSum, 2)
    expect(Math.abs(result.reconciliation.ledger_sum_check)).toBeLessThan(0.02)
  })

  it('sets balanced false and non-zero variance when totals diverge', async () => {
    const { coa, closing: baseClosing } = balancedScenario()
    const closing = baseClosing.map((r) =>
      r.account_code === '1100' ? { ...r, balance: 2000 } : r
    )
    const service = new ReportsService(makeReportsRepository({ coa, closing }))

    const result = await service.getBalanceSheet({ as_of_date: '2026-04-30' })

    expect(result.reconciliation.balanced).toBe(false)
    expect(result.reconciliation.variance).toBeCloseTo(1000, 2)
    expect(result.assets.total).toBeCloseTo(2000, 2)
    expect(result.total_liabilities_equity).toBeCloseTo(1000, 2)
  })

  it('lists unmapped ledger codes that are missing from COA', async () => {
    const { coa, closing: baseClosing } = balancedScenario()
    const closing = [
      ...baseClosing,
      { account_code: '9999', account_name: 'Orphan', balance: 50 }
    ]
    const service = new ReportsService(makeReportsRepository({ coa, closing }))

    const result = await service.getBalanceSheet({ as_of_date: '2026-04-30' })

    expect(result.unmapped_ledger_accounts.some((u) => u.account_code === '9999')).toBe(true)
    expect(result.unmapped_ledger_accounts.find((u) => u.account_code === '9999').note).toMatch(
      /no chart of accounts/i
    )
  })

  it('lists COA-backed balances that are not consumed (e.g. non–level-2)', async () => {
    const { coa: baseCoa, closing } = balancedScenario()
    const coa = [
      ...baseCoa,
      { ...coaRow('1199', 'Cash Sub', 'Asset'), level: 3 }
    ]
    const closingWithSub = [...closing, { account_code: '1199', account_name: 'Cash Sub', balance: 25 }]
    const service = new ReportsService(makeReportsRepository({ coa: coa, closing: closingWithSub }))

    const result = await service.getBalanceSheet({ as_of_date: '2026-04-30' })

    const u = result.unmapped_ledger_accounts.find((x) => x.account_code === '1199')
    expect(u).toBeDefined()
    expect(u.note).toMatch(/not included on balance sheet/i)
  })

  it('includes level-1 COA balance when no descendant has a balance (parent-only postings)', async () => {
    const coa = [
      {
        account_code: '1000',
        account_name: 'Current Assets',
        account_type: 'Asset',
        level: 1,
        id: 1,
        parent_account_id: null,
        is_active: true
      },
      {
        account_code: '1100',
        account_name: 'Cash',
        account_type: 'Asset',
        level: 2,
        id: 2,
        parent_account_id: 1,
        is_active: true
      },
      {
        account_code: '2100',
        account_name: 'Accounts Payable',
        account_type: 'Liability',
        level: 2,
        id: 3,
        parent_account_id: null,
        is_active: true
      },
      {
        account_code: '5100',
        account_name: 'Sales Revenue',
        account_type: 'Revenue',
        level: 2,
        id: 4,
        parent_account_id: null,
        is_active: true
      },
      {
        account_code: '6100',
        account_name: 'Expense',
        account_type: 'Expense',
        level: 2,
        id: 5,
        parent_account_id: null,
        is_active: true
      }
    ]
    const closing = [
      { account_code: '1000', account_name: 'Current Assets', balance: 211.5 },
      { account_code: '2100', account_name: 'Accounts Payable', balance: -211.5 }
    ]
    const service = new ReportsService(makeReportsRepository({ coa, closing }))

    const result = await service.getBalanceSheet({ as_of_date: '2026-04-03' })

    expect(result.reconciliation.balanced).toBe(true)
    expect(result.assets.lines.some((l) => l.account_code === '1000' && l.balance === 211.5)).toBe(true)
    expect(result.unmapped_ledger_accounts).toHaveLength(0)
    expect(result.coa_hierarchy_conflicts).toHaveLength(0)
  })

  it('surfaces coa_hierarchy_conflicts when parent and child both have balances', async () => {
    const coa = [
      {
        account_code: '1000',
        account_name: 'Current Assets',
        account_type: 'Asset',
        level: 1,
        id: 1,
        parent_account_id: null,
        is_active: true
      },
      {
        account_code: '1100',
        account_name: 'Cash',
        account_type: 'Asset',
        level: 2,
        id: 2,
        parent_account_id: 1,
        is_active: true
      },
      {
        account_code: '2100',
        account_name: 'AP',
        account_type: 'Liability',
        level: 2,
        id: 3,
        parent_account_id: null,
        is_active: true
      },
      {
        account_code: '3100',
        account_name: 'Retained',
        account_type: 'Equity',
        level: 2,
        id: 4,
        parent_account_id: null,
        is_active: true
      },
      {
        account_code: '5100',
        account_name: 'Sales',
        account_type: 'Revenue',
        level: 2,
        id: 5,
        parent_account_id: null,
        is_active: true
      },
      {
        account_code: '6100',
        account_name: 'Exp',
        account_type: 'Expense',
        level: 2,
        id: 6,
        parent_account_id: null,
        is_active: true
      }
    ]
    const closing = [
      { account_code: '1000', balance: 50 },
      { account_code: '1100', balance: 950 },
      { account_code: '2100', balance: -400 },
      { account_code: '3100', balance: -500 },
      { account_code: '5100', balance: -200 },
      { account_code: '6100', balance: 100 }
    ]
    const service = new ReportsService(makeReportsRepository({ coa, closing }))

    const result = await service.getBalanceSheet({ as_of_date: '2026-04-03' })

    expect(result.coa_hierarchy_conflicts.some((c) => c.account_code === '1000')).toBe(true)
    expect(result.unmapped_ledger_accounts.some((u) => u.account_code === '1000')).toBe(true)
  })

  it('suggests duplicate P&L-in-equity when variance equals negative net income', async () => {
    const coa = [
      {
        account_code: '1100',
        account_name: 'Cash',
        account_type: 'Asset',
        level: 2,
        id: 1,
        parent_account_id: null,
        is_active: true
      },
      {
        account_code: '2100',
        account_name: 'AP',
        account_type: 'Liability',
        level: 2,
        id: 2,
        parent_account_id: null,
        is_active: true
      },
      {
        account_code: '4200',
        account_name: 'Retained Earnings',
        account_type: 'Equity',
        level: 2,
        id: 3,
        parent_account_id: null,
        is_active: true
      },
      {
        account_code: '5100',
        account_name: 'Sales',
        account_type: 'Revenue',
        level: 2,
        id: 4,
        parent_account_id: null,
        is_active: true
      },
      {
        account_code: '6200',
        account_name: 'Operating Expenses',
        account_type: 'Expense',
        level: 2,
        id: 5,
        parent_account_id: null,
        is_active: true
      }
    ]
    const closing = [
      { account_code: '1100', balance: 8000 },
      { account_code: '2100', balance: -4000 },
      { account_code: '4200', balance: -4000 },
      { account_code: '5100', balance: -4000 },
      { account_code: '6200', balance: 0 }
    ]
    const service = new ReportsService(makeReportsRepository({ coa, closing }))

    const result = await service.getBalanceSheet({ as_of_date: '2026-05-02' })

    expect(result.reconciliation.balanced).toBe(false)
    expect(result.reconciliation.variance).toBeCloseTo(-4000, 2)
    expect(result.reconciliation.equation_breakdown.net_income_bridged).toBeCloseTo(4000, 2)
    expect(result.reconciliation.hints.length).toBeGreaterThan(0)
    expect(result.reconciliation.hints[0]).toMatch(/4200|Retained Earnings|twice/i)
  })
})
