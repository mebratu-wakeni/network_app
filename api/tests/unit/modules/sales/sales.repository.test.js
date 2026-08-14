import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SalesRepository } from '../../../../src/modules/sales/sales.repository.js'
import {
  createSalesSchema,
  createTestDb,
  seedTwoTenantsWithSales
} from '../../../helpers/testDb.js'

describe('SalesRepository tenant isolation', () => {
  let db
  let repo

  beforeEach(async () => {
    db = createTestDb()
    await createSalesSchema(db)
    await seedTwoTenantsWithSales(db)
    repo = new SalesRepository(db)
  })

  afterEach(async () => {
    if (db) await db.destroy()
  })

  it('listOrders only returns orders for the requested tenant', async () => {
    const t1 = await repo.listOrders(1, { limit: 10, offset: 0 })
    const t2 = await repo.listOrders(2, { limit: 10, offset: 0 })

    expect(t1.total).toBe(1)
    expect(t1.orders[0].receipt_no).toBe('SO000001')
    expect(Number(t1.orders[0].total_amount)).toBe(100)
    expect(t2.total).toBe(1)
    expect(Number(t2.orders[0].total_amount)).toBe(200)
  })

  it('getOrderById is scoped to tenant', async () => {
    const own = await repo.getOrderById(1, 1)
    expect(own.order.receipt_no).toBe('SO000001')

    const crossTenant = await repo.getOrderById(2, 1)
    expect(crossTenant).toBeNull()
  })

  it('generateNextSalesReceiptNumber is per-tenant', async () => {
    const next1 = await repo.generateNextSalesReceiptNumber(1)
    const next2 = await repo.generateNextSalesReceiptNumber(2)
    expect(next1).toBe('SO000002')
    expect(next2).toBe('SO000002')
  })

  it('confirmWithhold and rollbackWithhold respect tenant scope', async () => {
    await repo.confirmWithhold(1, 1, 'WH-001')
    const updated = await db('sales_orders').where({ id: 1 }).first()
    expect(updated.withhold_ref).toBe('WH-001')

    const blocked = await repo.confirmWithhold(2, 1, 'HACK')
    expect(blocked).toBe(false)

    await repo.rollbackWithhold(1, 1)
    const rolled = await db('sales_orders').where({ id: 1 }).first()
    expect(rolled.withhold_ref).toBeNull()
  })

  it('createHoldOrder stores tenant_id and listHoldOrders filters by tenant', async () => {
    await repo.createHoldOrder(
      1,
      { items: [{ product_id: 1 }], customer_id: 1 },
      { customer_id: 1, order_date: '2026-06-15', total_amount: 50, payment_type: 'cash' },
      null
    )
    await repo.createHoldOrder(
      2,
      { items: [] },
      { customer_id: 2, order_date: '2026-06-15', total_amount: 75, payment_type: 'cash' },
      null
    )

    const t1 = await repo.listHoldOrders(1, { limit: 10, offset: 0 })
    const t2 = await repo.listHoldOrders(2, { limit: 10, offset: 0 })
    expect(t1.total).toBe(1)
    expect(Number(t1.hold_orders[0].total_amount)).toBe(50)
    expect(t2.total).toBe(1)
    expect(Number(t2.hold_orders[0].total_amount)).toBe(75)
  })
})
