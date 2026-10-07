import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FiscalYearsRepository } from '../../../../src/modules/fiscal-years/fiscal-years.repository.js'
import {
  createFiscalTransactionSchema,
  createTestDb,
  seedFiscalYears,
  seedTwoTenantsWithUsers
} from '../../../helpers/testDb.js'

describe('FiscalYearsRepository tenant isolation', () => {
  let db
  let repo

  beforeEach(async () => {
    db = createTestDb()
    await createFiscalTransactionSchema(db)
    await seedTwoTenantsWithUsers(db)
    await seedFiscalYears(db)
    repo = new FiscalYearsRepository(db)
  })

  afterEach(async () => {
    if (db) await db.destroy()
  })

  it('listAll returns only fiscal years for the requested tenant', async () => {
    const t1 = await repo.listAll(1)
    const t2 = await repo.listAll(2)

    expect(t1).toHaveLength(2)
    expect(t1.every((fy) => fy.tenant_id === 1)).toBe(true)
    expect(t2).toHaveLength(1)
    expect(t2[0].tenant_id).toBe(2)
  })

  it('getByYear is scoped to tenant', async () => {
    const fy = await repo.getByYear(1, 2025)
    expect(fy).toMatchObject({ tenant_id: 1, fiscal_year: 2025 })

    const cross = await repo.getByYear(2, 2024)
    expect(cross).toBeUndefined()
  })

  it('getCurrent and getAnyOpen are scoped to tenant', async () => {
    const current = await repo.getCurrent(1)
    expect(current.fiscal_year).toBe(2026)

    await db('fiscal_years').where({ tenant_id: 2 }).update({ status: 'closed' })
    const none = await repo.getCurrent(2)
    expect(none).toBeUndefined()
  })

  it('hasOverlappingDates ignores other tenants', async () => {
    const overlaps = await repo.hasOverlappingDates(2, '2024-01-01', '2024-12-31')
    expect(overlaps).toBe(false)
  })

  it('create inserts tenant_id', async () => {
    await db('fiscal_years').where({ tenant_id: 2 }).delete()

    const row = await repo.create(2, {
      fiscal_year: 2027,
      start_date: '2027-01-01',
      end_date: '2027-12-31'
    })

    expect(row).toMatchObject({ tenant_id: 2, fiscal_year: 2027, status: 'open' })
    expect(await repo.getByYear(2, 2027)).toBeTruthy()
    expect(await repo.getByYear(1, 2027)).toBeUndefined()
  })

  it('getTransactionCountsInRange counts only tenant transactions', async () => {
    await db('expenses').insert([
      { tenant_id: 1, paid_on: '2025-03-01', amount: 100 },
      { tenant_id: 1, paid_on: '2025-04-01', amount: 50 },
      { tenant_id: 2, paid_on: '2025-03-01', amount: 999 }
    ])
    await db('sales_orders').insert([
      { tenant_id: 1, order_date: '2025-05-01', total_amount: 200 },
      { tenant_id: 2, order_date: '2025-05-01', total_amount: 300 }
    ])

    const counts = await repo.getTransactionCountsInRange(1, '2025-01-01', '2025-12-31')
    expect(counts.expenses).toBe(2)
    expect(counts.sales).toBe(1)
    expect(counts.purchases).toBe(0)
  })

  it('getClosingBalances sums ledger entries per tenant', async () => {
    await db('account_ledger').insert([
      { tenant_id: 1, transaction_date: '2025-01-01', account_code: '5100', account_name: 'Sales', debit: 0, credit: 100 },
      { tenant_id: 1, transaction_date: '2025-02-01', account_code: '5100', account_name: 'Sales', debit: 0, credit: 50 },
      { tenant_id: 2, transaction_date: '2025-01-01', account_code: '5100', account_name: 'Sales', debit: 0, credit: 999 }
    ])

    const balances = await repo.getClosingBalances(1, '2025-12-31')
    const sales = balances.find((b) => b.account_code === '5100')
    expect(sales.balance).toBe(-150)
  })

  it('delete removes only tenant fiscal year row', async () => {
    await repo.create(2, { fiscal_year: 2027, start_date: '2027-01-01', end_date: '2027-12-31' })

    const ok = await repo.delete(2, 2027)
    expect(ok).toBe(true)
    expect(await repo.getByYear(2, 2027)).toBeUndefined()
    expect(await repo.getByYear(1, 2026)).toBeTruthy()
  })
})
