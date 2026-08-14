import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as fiscalGuard from '../../../../src/services/fiscal-year.guard.js'
import { PurchaseService } from '../../../../src/modules/purchase/purchase.service.js'

function makeRepository(overrides = {}) {
  return {
    knex: {},
    findProducts: vi.fn().mockResolvedValue([]),
    findSuppliers: vi.fn().mockResolvedValue([]),
    getWithholdPercentageSetting: vi.fn().mockResolvedValue(2),
    generateNextReceiptNumber: vi.fn().mockResolvedValue('PO000123'),
    createOrderWithItemsAndReceipt: vi.fn().mockImplementation(async (_tenantId, { order }) => ({
      order: {
        id: 1,
        receipt_no: order.receipt_no,
        supplier_id: order.supplier_id,
        order_date: order.order_date,
        status: order.status,
        created_at: '2026-01-01'
      }
    })),
    ...overrides
  }
}

describe('PurchaseService', () => {
  beforeEach(() => {
    vi.spyOn(fiscalGuard, 'assertFiscalYearOpen').mockResolvedValue({ fiscal_year: 2026 })
  })

  it('creates cash order with full payment and withhold amount', async () => {
    const repository = makeRepository()
    const service = new PurchaseService(repository)

    const result = await service.createOrder(
      {
        supplier_id: 10,
        order_date: '2026-02-01',
        items: [{ product_id: 1, quantity: 2, unit_price: 50 }],
        payment_mode: 'cash',
        withhold_percentage: 10,
        notes: 'cash purchase'
      },
      { id: 7, full_name: 'Tester' },
      1
    )

    expect(result.receipt_number).toBe('PO000123')
    expect(result.subtotal).toBe(100)
    expect(result.withhold_amount).toBe(10)
    expect(result.net_amount).toBe(90)
    expect(fiscalGuard.assertFiscalYearOpen).toHaveBeenCalledWith(repository.knex, 1, '2026-02-01')
    expect(repository.createOrderWithItemsAndReceipt).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        order: expect.objectContaining({
          payment_status: 'paid',
          amount_paid: 90,
          fiscal_year: 2026
        })
      }),
      7
    )
  })

  it('marks credit order as partial when first payment is provided', async () => {
    const repository = makeRepository()
    const service = new PurchaseService(repository)

    await service.createOrder(
      {
        supplier_id: 10,
        order_date: '2026-02-01',
        items: [{ product_id: 1, quantity: 1, unit_price: 100 }],
        payment_mode: 'credit',
        first_payment: 25,
        withhold_percentage: 0
      },
      { id: 3 },
      1
    )

    expect(repository.createOrderWithItemsAndReceipt).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        order: expect.objectContaining({
          payment_status: 'partial',
          amount_paid: 25
        }),
        initialPayment: expect.objectContaining({
          payment_method: 'credit',
          amount: 25
        })
      }),
      3
    )
  })

  it('does not apply company withhold when client sends null (unchecked checkbox)', async () => {
    const repository = makeRepository()
    const service = new PurchaseService(repository)

    const result = await service.createOrder(
      {
        supplier_id: 10,
        order_date: '2026-02-01',
        items: [{ product_id: 1, quantity: 2, unit_price: 50 }],
        payment_mode: 'cash',
        withhold_percentage: null
      },
      { id: 7, full_name: 'Tester' },
      1
    )

    expect(result.subtotal).toBe(100)
    expect(result.withhold_amount).toBe(0)
    expect(result.net_amount).toBe(100)
    expect(repository.getWithholdPercentageSetting).not.toHaveBeenCalled()
    expect(repository.createOrderWithItemsAndReceipt).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        order: expect.objectContaining({
          withhold_percentage: null,
          withhold_amount: 0,
          amount_paid: 100
        })
      }),
      7
    )
  })

  it('uses company withhold setting only when withhold_percentage is omitted', async () => {
    const repository = makeRepository()
    const service = new PurchaseService(repository)

    const result = await service.createOrder(
      {
        supplier_id: 10,
        order_date: '2026-02-01',
        items: [{ product_id: 1, quantity: 2, unit_price: 50 }],
        payment_mode: 'cash'
      },
      { id: 7, full_name: 'Tester' },
      1
    )

    expect(repository.getWithholdPercentageSetting).toHaveBeenCalled()
    expect(result.withhold_amount).toBe(2)
    expect(result.net_amount).toBe(98)
  })

  it('throws a 400 error when cheque mode has no cheque details', async () => {
    const service = new PurchaseService(makeRepository())
    await expect(
      service.createOrder({
        supplier_id: 1,
        order_date: '2026-02-01',
        items: [{ product_id: 1, quantity: 1, unit_price: 20 }],
        payment_mode: 'cheque'
      })
    ).rejects.toMatchObject({ message: 'cheque_details is required for cheque payment', status: 400 })
  })

  it('throws a 400 error when creating order without items', async () => {
    const service = new PurchaseService(makeRepository())
    await expect(
      service.createOrder({
        supplier_id: 1,
        order_date: '2026-02-01',
        items: [],
        payment_mode: 'cash'
      })
    ).rejects.toMatchObject({ message: 'At least one item is required', status: 400 })
  })
})
