import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SalesService } from '../../../../src/modules/sales/sales.service.js'
import {
  createFiscalYearsSchema,
  createTestDb,
  seedFiscalYears,
  seedTwoTenantsWithUsers
} from '../../../helpers/testDb.js'

function makeRepository(db, overrides = {}) {
  return {
    knex: db,
    generateNextSalesReceiptNumber: vi.fn().mockResolvedValue('SO000099'),
    createOrderWithItems: vi.fn().mockResolvedValue({
      order: { id: 1, receipt_no: 'SO000099', total_amount: 100, withhold_amount: 0, received_amount: 100, payment_type: 'cash', payment_status: 'paid', status: 'completed', created_at: '2026-06-01' },
      items: [{ id: 1 }]
    }),
    recordPayment: vi.fn().mockResolvedValue({ amount_paid: 50, payment_status: 'partial' }),
    recordBulkCustomerPayment: vi.fn().mockResolvedValue({ total_applied: 100, applied: [] }),
    reverseOrder: vi.fn().mockResolvedValue({ order_id: 1, status: 'reversed' }),
    ...overrides
  }
}

describe('SalesService fiscal year guard', () => {
  let db
  let service
  let repository

  beforeEach(async () => {
    db = createTestDb()
    await createFiscalYearsSchema(db)
    await seedTwoTenantsWithUsers(db)
    await seedFiscalYears(db)
    repository = makeRepository(db)
    service = new SalesService(repository)
  })

  afterEach(async () => {
    if (db) await db.destroy()
  })

  it('recordPayment rejects closed fiscal year', async () => {
    await expect(
      service.recordPayment(1, 1, { payment_amount: 10, payment_date: '2025-06-15' })
    ).rejects.toMatchObject({ status: 400 })
    expect(repository.recordPayment).not.toHaveBeenCalled()
  })

  it('recordPayment proceeds when fiscal year is open', async () => {
    const result = await service.recordPayment(1, 1, {
      payment_amount: 10,
      payment_date: '2026-06-15'
    })
    expect(result.payment_status).toBe('partial')
    expect(repository.recordPayment).toHaveBeenCalledWith(1, 1, expect.any(Object), null)
  })

  it('recordBulkCustomerSales rejects when tenant has no fiscal year', async () => {
    await db('fiscal_years').where({ tenant_id: 2 }).delete()

    await expect(
      service.recordBulkCustomerSales(2, {
        customer_id: 1,
        payment_amount: 50,
        payment_date: '2026-06-15'
      })
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('No fiscal year covers')
    })
    expect(repository.recordBulkCustomerPayment).not.toHaveBeenCalled()
  })

  it('reverseOrder rejects closed fiscal year', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))

    await expect(service.reverseOrder(1, 1, { id: 1 })).rejects.toMatchObject({ status: 400 })
    expect(repository.reverseOrder).not.toHaveBeenCalled()

    vi.useRealTimers()
  })
})
