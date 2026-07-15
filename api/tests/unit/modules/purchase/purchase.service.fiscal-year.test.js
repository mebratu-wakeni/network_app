import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PurchaseService } from '../../../../src/modules/purchase/purchase.service.js'
import {
  createFiscalYearsSchema,
  createTestDb,
  seedFiscalYears,
  seedTwoTenantsWithUsers
} from '../../../helpers/testDb.js'

function makeRepository(db, overrides = {}) {
  return {
    knex: db,
    recordPayment: vi.fn().mockResolvedValue({
      payment: { id: 1, purchase_order_id: 1, amount: 25 },
      remaining_balance: 0
    }),
    reverseOrder: vi.fn().mockResolvedValue({ order_id: 1, status: 'reversed' }),
    bulkImportPurchases: vi.fn().mockResolvedValue({
      successful: [],
      failed: [],
      summary: { total: 0, successful: 0, failed: 0 }
    }),
    ...overrides
  }
}

describe('PurchaseService fiscal year guard', () => {
  let db
  let service
  let repository

  beforeEach(async () => {
    db = createTestDb()
    await createFiscalYearsSchema(db)
    await seedTwoTenantsWithUsers(db)
    await seedFiscalYears(db)
    repository = makeRepository(db)
    service = new PurchaseService(repository)
  })

  afterEach(async () => {
    if (db) await db.destroy()
  })

  it('payOrder rejects closed fiscal year', async () => {
    await expect(
      service.payOrder(1, 1, { payment_amount: 10, payment_date: '2025-06-15', payment_mode: 'cash' }, { id: 1 })
    ).rejects.toMatchObject({ status: 400 })
    expect(repository.recordPayment).not.toHaveBeenCalled()
  })

  it('payOrder proceeds when fiscal year is open', async () => {
    const result = await service.payOrder(
      1,
      1,
      { payment_amount: 10, payment_date: '2026-06-15', payment_mode: 'cash' },
      { id: 1 }
    )
    expect(result.payment_amount).toBe(25)
    expect(repository.recordPayment).toHaveBeenCalledWith(1, 1, expect.any(Object), 1)
  })

  it('reverseOrder rejects closed fiscal year', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))

    await expect(
      service.reverseOrder(1, 1, { reason: 'test' }, { id: 1 })
    ).rejects.toMatchObject({ status: 400 })
    expect(repository.reverseOrder).not.toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('bulkImport rejects when fiscal year is closed for purchase date', async () => {
    await expect(
      service.bulkImport(1, { purchase_date: '2025-06-15', stock_items: [] }, { id: 1 })
    ).rejects.toMatchObject({ status: 400 })
    expect(repository.bulkImportPurchases).not.toHaveBeenCalled()
  })
})
