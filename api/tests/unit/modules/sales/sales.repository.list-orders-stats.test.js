import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SalesRepository } from '../../../../src/modules/sales/sales.repository.js'
import { createSalesSchema, createTestDb } from '../../../helpers/testDb.js'

describe('SalesRepository.listOrders stats and stat_filter', () => {
  let db
  let repo

  beforeEach(async () => {
    db = createTestDb()
    await createSalesSchema(db)
    await db('customers').insert({
      id: 1,
      tenant_id: 1,
      customer_code: 'C1',
      name: 'Customer',
      customer_type: 'retailer'
    })
    await db('sales_orders').insert([
      {
        id: 1,
        tenant_id: 1,
        customer_id: 1,
        order_date: '2026-06-01',
        receipt_no: 'SO-ACTIVE-UC',
        payment_type: 'cash',
        total_amount: 100,
        amount_paid: 90,
        withhold_amount: 10,
        withhold_settled: null,
        withhold_confirmation: false,
        status: 'completed',
        is_reversed: false
      },
      {
        id: 2,
        tenant_id: 1,
        customer_id: 1,
        order_date: '2026-06-02',
        receipt_no: 'SO-REVERSED',
        payment_type: 'cash',
        total_amount: 200,
        amount_paid: 180,
        withhold_amount: 20,
        withhold_settled: false,
        withhold_confirmation: true,
        withhold_ref: 'WH-REV',
        status: 'archived',
        is_reversed: true
      },
      {
        id: 3,
        tenant_id: 1,
        customer_id: 1,
        order_date: '2026-06-03',
        receipt_no: 'SO-ACTIVE-CF',
        payment_type: 'cash',
        total_amount: 300,
        amount_paid: 270,
        withhold_amount: 30,
        withhold_settled: null,
        withhold_confirmation: false,
        withhold_ref: 'WH-3',
        status: 'completed',
        is_reversed: false
      }
    ])
    repo = new SalesRepository(db)
  })

  afterEach(async () => {
    if (db) await db.destroy()
  })

  it('excludes reversed sales from withhold stats', async () => {
    const { stats } = await repo.listOrders({ limit: 50, offset: 0, status: 'completed' })
    expect(stats.all.count).toBe(2)
    expect(stats.withhold_confirmed.count).toBe(1)
    expect(stats.withhold_confirmed.value).toBe(30)
    expect(stats.withhold_unconfirmed.count).toBe(1)
    expect(stats.unsettled.count).toBe(2)
  })

  it('stat_filter withhold_unconfirmed returns active rows when withhold_settled is null', async () => {
    const { orders, total, stats } = await repo.listOrders({
      limit: 50,
      offset: 0,
      status: 'completed',
      stat_filter: 'withhold_unconfirmed'
    })
    expect(total).toBe(1)
    expect(orders[0].receipt_no).toBe('SO-ACTIVE-UC')
    expect(stats.withhold_unconfirmed.count).toBe(1)
  })

  it('stat_filter withhold_confirmed lists only completed non-reversed confirmed withhold', async () => {
    const { orders, total } = await repo.listOrders({
      limit: 50,
      offset: 0,
      status: 'completed',
      stat_filter: 'withhold_confirmed'
    })
    expect(total).toBe(1)
    expect(orders[0].receipt_no).toBe('SO-ACTIVE-CF')
  })
})
