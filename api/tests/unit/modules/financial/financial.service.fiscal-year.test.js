import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FinancialService } from '../../../../src/modules/financial/financial.service.js'
import {
  createFiscalYearsSchema,
  createTestDb,
  seedFiscalYears,
  seedTwoTenantsWithUsers
} from '../../../helpers/testDb.js'

function makeRepository(db, overrides = {}) {
  return {
    knex: db,
    createExpense: vi.fn().mockResolvedValue({ id: 1, amount: 50 }),
    createDeposit: vi.fn().mockResolvedValue({ id: 1, amount: 100 }),
    getDepositById: vi.fn().mockResolvedValue({ id: 1, deposit_date: '2026-06-15', amount: 100 }),
    updateDeposit: vi.fn().mockResolvedValue({ id: 1, amount: 120 }),
    reverseDeposit: vi.fn().mockResolvedValue({ id: 1, is_reversed: true }),
    createCashLoanReceivable: vi.fn().mockResolvedValue({ id: 1, amount: 500 }),
    recordCashLoanReceivableReturn: vi.fn().mockResolvedValue({ loan_id: 1, status: 'returned' }),
    createCashLoanPayable: vi.fn().mockResolvedValue({ id: 1, amount: 300 }),
    recordCashLoanPayableRepayment: vi.fn().mockResolvedValue({ loan_id: 1, status: 'repaid' }),
    createWithholdReceivableSettlement: vi.fn().mockResolvedValue({ orders_settled: 1 }),
    createWithholdPayableSettlement: vi.fn().mockResolvedValue({ orders_settled: 1 }),
    ...overrides
  }
}

describe('FinancialService fiscal year guard', () => {
  let db
  let service
  let repository

  beforeEach(async () => {
    db = createTestDb()
    await createFiscalYearsSchema(db)
    await seedTwoTenantsWithUsers(db)
    await seedFiscalYears(db)
    repository = makeRepository(db)
    service = new FinancialService(repository)
  })

  afterEach(async () => {
    if (db) await db.destroy()
  })

  it('createExpense rejects closed fiscal year', async () => {
    await expect(
      service.createExpense(1, { category: 'Rent', paid_on: '2025-06-15', amount: 50 }, { id: 1 })
    ).rejects.toMatchObject({ status: 400 })
    expect(repository.createExpense).not.toHaveBeenCalled()
  })

  it('createExpense proceeds when fiscal year is open', async () => {
    await service.createExpense(1, { category: 'Rent', paid_on: '2026-06-15', amount: 50 }, { id: 1 })
    expect(repository.createExpense).toHaveBeenCalledWith(1, expect.objectContaining({ fiscal_year: 2026 }), 1)
  })

  it('createDeposit rejects closed fiscal year', async () => {
    await expect(
      service.createDeposit(1, { deposit_date: '2025-06-15', amount: 100 }, { id: 1 })
    ).rejects.toMatchObject({ status: 400 })
    expect(repository.createDeposit).not.toHaveBeenCalled()
  })

  it('reverseDeposit rejects closed fiscal year', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))

    await expect(service.reverseDeposit(1, 1, { id: 1 })).rejects.toMatchObject({ status: 400 })
    expect(repository.reverseDeposit).not.toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('createCashLoanReceivable rejects closed fiscal year', async () => {
    await expect(
      service.createCashLoanReceivable(1, { partner_id: 1, amount: 100, lent_date: '2025-06-15' }, { id: 1 })
    ).rejects.toMatchObject({ status: 400 })
    expect(repository.createCashLoanReceivable).not.toHaveBeenCalled()
  })

  it('recordCashLoanPayableRepayment rejects closed fiscal year', async () => {
    await expect(
      service.recordCashLoanPayableRepayment(1, 1, { amount: 50, repay_date: '2025-06-15' }, { id: 1 })
    ).rejects.toMatchObject({ status: 400 })
    expect(repository.recordCashLoanPayableRepayment).not.toHaveBeenCalled()
  })

  it('createWithholdReceivableSettlement rejects closed fiscal year', async () => {
    await expect(
      service.createWithholdReceivableSettlement(1, { settlement_date: '2025-06-15', sales_order_ids: [1] }, { id: 1 })
    ).rejects.toMatchObject({ status: 400 })
    expect(repository.createWithholdReceivableSettlement).not.toHaveBeenCalled()
  })

  it('createWithholdPayableSettlement proceeds when fiscal year is open', async () => {
    await service.createWithholdPayableSettlement(
      1,
      { settlement_date: '2026-06-15', purchase_order_ids: [1] },
      { id: 1 }
    )
    expect(repository.createWithholdPayableSettlement).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ fiscal_year: 2026 }),
      1
    )
  })
})
