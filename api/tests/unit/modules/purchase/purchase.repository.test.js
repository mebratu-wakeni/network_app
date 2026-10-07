import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PurchaseRepository } from '../../../../src/modules/purchase/purchase.repository.js'
import {
  createPurchaseSchema,
  createTestDb,
  seedTwoTenantsWithPurchases
} from '../../../helpers/testDb.js'

describe('PurchaseRepository tenant isolation', () => {
  let db
  let repo

  beforeEach(async () => {
    db = createTestDb()
    await createPurchaseSchema(db)
    await seedTwoTenantsWithPurchases(db)
    repo = new PurchaseRepository(db)
  })

  afterEach(async () => {
    if (db) await db.destroy()
  })

  it('listOrders only returns orders for the requested tenant', async () => {
    const t1 = await repo.listOrders(1, { limit: 10, offset: 0 })
    const t2 = await repo.listOrders(2, { limit: 10, offset: 0 })

    expect(t1.total).toBe(1)
    expect(Number(t1.orders[0].total_amount)).toBe(100)
    expect(t2.total).toBe(1)
    expect(Number(t2.orders[0].total_amount)).toBe(250)
  })

  it('getOrderById is scoped to tenant', async () => {
    await db('purchase_order_items').insert({
      tenant_id: 1,
      purchase_order_id: 1,
      product_id: 1,
      quantity: 1,
      unit_price: 100,
      total_price: 100
    })
    await db('products').insert({ id: 1, tenant_id: 1, product_code: 'P1', name: 'Prod' })

    const own = await repo.getOrderById(1, 1)
    expect(own.order.receipt_no).toBe('PO000001')

    const crossTenant = await repo.getOrderById(2, 1)
    expect(crossTenant).toBeNull()
  })

  it('generateNextReceiptNumber is per-tenant', async () => {
    const next1 = await repo.generateNextReceiptNumber(1)
    const next2 = await repo.generateNextReceiptNumber(2)
    expect(next1).toBe('PO000002')
    expect(next2).toBe('PO000002')
  })

  it('findSuppliers only returns suppliers for tenant', async () => {
    const suppliers = await repo.findSuppliers(1, { limit: 10 })
    expect(suppliers).toHaveLength(1)
    expect(suppliers[0].name).toBe('Supplier A')
  })

  it('createHoldOrder and listHoldOrders are tenant-scoped', async () => {
    await repo.createHoldOrder(
      1,
      {
        supplier_id: 1,
        order_date: '2026-06-15',
        payment_mode: 'cash',
        total_amount: 50,
        items: []
      },
      { id: 1, full_name: 'User' }
    )
    await repo.createHoldOrder(
      2,
      {
        supplier_id: 2,
        order_date: '2026-06-15',
        payment_mode: 'cash',
        total_amount: 80,
        items: []
      },
      { id: 2, full_name: 'User2' }
    )

    const t1 = await repo.listHoldOrders(1, { limit: 10, offset: 0 })
    const t2 = await repo.listHoldOrders(2, { limit: 10, offset: 0 })
    expect(t1.total).toBe(1)
    expect(Number(t1.hold_orders[0].net_amount)).toBe(50)
    expect(t2.total).toBe(1)
    expect(Number(t2.hold_orders[0].net_amount)).toBe(80)
  })
})
