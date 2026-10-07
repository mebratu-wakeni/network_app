import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FinancialRepository } from '../../../../src/modules/financial/financial.repository.js'
import {
  createFinancialSchema,
  createTestDb,
  seedTwoTenantsWithFinancial
} from '../../../helpers/testDb.js'

describe('FinancialRepository tenant isolation', () => {
  let db
  let repo

  beforeEach(async () => {
    db = createTestDb()
    await createFinancialSchema(db)
    await seedTwoTenantsWithFinancial(db)
    repo = new FinancialRepository(db)
  })

  afterEach(async () => {
    if (db) await db.destroy()
  })

  it('listExpenses only returns expenses for the requested tenant', async () => {
    const t1 = await repo.listExpenses(1, { limit: 10, offset: 0 })
    const t2 = await repo.listExpenses(2, { limit: 10, offset: 0 })

    expect(t1.total).toBe(1)
    expect(Number(t1.expenses[0].amount)).toBe(50)
    expect(t2.total).toBe(1)
    expect(Number(t2.expenses[0].amount)).toBe(120)
  })

  it('getExpenseById is scoped to tenant', async () => {
    const own = await repo.getExpenseById(1, 1)
    expect(own.category).toBe('Utilities')

    const crossTenant = await repo.getExpenseById(2, 1)
    expect(crossTenant).toBeUndefined()
  })

  it('listDeposits only returns deposits for the requested tenant', async () => {
    const t1 = await repo.listDeposits(1, { limit: 10, offset: 0 })
    const t2 = await repo.listDeposits(2, { limit: 10, offset: 0 })

    expect(t1.total).toBe(1)
    expect(Number(t1.deposits[0].amount)).toBe(1000)
    expect(t2.total).toBe(1)
    expect(Number(t2.deposits[0].amount)).toBe(2000)
  })

  it('getDepositById is scoped to tenant', async () => {
    expect(await repo.getDepositById(1, 1)).toBeTruthy()
    expect(await repo.getDepositById(2, 1)).toBeUndefined()
  })

  it('listCashLoansReceivable only returns loans for tenant', async () => {
    const t1 = await repo.listCashLoansReceivable(1, { limit: 10, offset: 0 })
    const t2 = await repo.listCashLoansReceivable(2, { limit: 10, offset: 0 })

    expect(t1.total).toBe(1)
    expect(Number(t1.loans[0].amount)).toBe(500)
    expect(t2.total).toBe(1)
    expect(Number(t2.loans[0].amount)).toBe(800)
  })

  it('getTradeReceivablesSummary is tenant-scoped', async () => {
    const t1 = await repo.getTradeReceivablesSummary(1)
    const t2 = await repo.getTradeReceivablesSummary(2)

    expect(t1.orders).toHaveLength(1)
    expect(t1.orders[0].outstanding_balance).toBe(100)
    expect(t2.orders).toHaveLength(1)
    expect(t2.orders[0].outstanding_balance).toBe(200)
  })

  it('getTradePayablesSummary is tenant-scoped', async () => {
    const t1 = await repo.getTradePayablesSummary(1)
    const t2 = await repo.getTradePayablesSummary(2)

    expect(t1.orders).toHaveLength(1)
    expect(t1.orders[0].outstanding_balance).toBe(150)
    expect(t2.orders).toHaveLength(1)
    expect(t2.orders[0].outstanding_balance).toBe(300)
  })
})
