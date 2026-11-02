import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SalesRepository } from '../../../../src/modules/sales/sales.repository.js'
import {
  createSalesReversalSchema,
  createTestDb,
  seedSalesReversalTenant
} from '../../../helpers/testDb.js'

const TENANT = 1

async function ledgerNet(db, accountCode) {
  const row = await db('account_ledger')
    .where({ tenant_id: TENANT, account_code: accountCode })
    .select(db.raw('COALESCE(SUM(debit - credit), 0) as net'))
    .first()
  return Number(row?.net ?? 0)
}

describe('SalesRepository.reverseOrder', () => {
  let db
  let repo

  beforeEach(async () => {
    db = createTestDb()
    await createSalesReversalSchema(db)
    await seedSalesReversalTenant(db, TENANT)
    repo = new SalesRepository(db)
  })

  afterEach(async () => {
    if (db) await db.destroy()
  })

  async function createCreditSale() {
    const { order } = await repo.createOrderWithItems(
      TENANT,
      {
        order: {
          customer_id: 1,
          order_date: '2026-06-10',
          payment_type: 'credit',
          payment_status: 'unpaid',
          total_amount: 100,
          amount_paid: 0,
          received_amount: 100,
          withhold_amount: 0,
          receipt_no: 'SO000099',
          status: 'completed'
        },
        items: [
          {
            product_id: 1,
            inventory_id: 1,
            quantity: 5,
            unit_price: 20,
            total_price: 100
          }
        ]
      },
      1
    )
    return order.id
  }

  it('blocks reverse when withhold is settled (repository guard)', async () => {
    const orderId = await createCreditSale()
    await db('sales_orders').where({ id: orderId }).update({
      withhold_amount: 5,
      withhold_settled: true,
      withhold_confirmation: true,
      withhold_ref: 'WH-SET'
    })

    await expect(repo.reverseOrder(TENANT, orderId, 1)).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/settled/i)
    })
    const row = await db('sales_orders').where({ id: orderId }).first()
    expect(row.is_reversed).toBeFalsy()
  })

  it('blocks reverse when withhold is confirmed; allows after rollback', async () => {
    const orderId = await createCreditSale()
    await db('sales_orders').where({ id: orderId }).update({
      withhold_amount: 5,
      withhold_settled: false,
      withhold_confirmation: true,
      withhold_ref: 'WH-CONF'
    })

    await expect(repo.reverseOrder(TENANT, orderId, 1)).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/roll back/i)
    })

    await repo.rollbackWithhold(TENANT, orderId)

    await repo.reverseOrder(TENANT, orderId, 1)
    const row = await db('sales_orders').where({ id: orderId }).first()
    expect(row.is_reversed).toBeTruthy()
    expect(row.status).toBe('archived')
  })

  it('restores inventory, bin returns, and nets GL after sale + follow-up payment', async () => {
    const orderId = await createCreditSale()

    const invAfterSale = await db('inventories').where({ id: 1 }).first()
    expect(Number(invAfterSale.quantity)).toBe(15)

    const issued = await db('bin_cards').where({ reference_id: orderId, transaction_type: 'issued' })
    expect(issued.length).toBe(1)

    await repo.recordPayment(TENANT, orderId, {
      amount: 40,
      payment_date: '2026-06-12',
      payment_method: 'cash'
    }, 1)

    await repo.reverseOrder(TENANT, orderId, 1)

    const invAfterRev = await db('inventories').where({ id: 1 }).first()
    expect(Number(invAfterRev.quantity)).toBe(20)

    const returns = await db('bin_cards').where({ reference_id: orderId, transaction_type: 'return' })
    expect(returns.length).toBe(1)

    const saleRev = await db('account_ledger')
      .where({ tenant_id: TENANT, reference_id: orderId, transaction_type: 'sale_reversal' })
    expect(saleRev.length).toBeGreaterThan(0)

    const payRev = await db('account_ledger')
      .where({ tenant_id: TENANT, transaction_type: 'sales_payment_reversal' })
    expect(payRev.length).toBeGreaterThan(0)

    expect(await ledgerNet(db, '5100')).toBe(0)
    expect(await ledgerNet(db, '1300')).toBe(0)
    expect(await ledgerNet(db, '6100')).toBe(0)
    expect(await ledgerNet(db, '1200')).toBe(0)
    expect(await ledgerNet(db, '1100')).toBe(0)
  })
})
