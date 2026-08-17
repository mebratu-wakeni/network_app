import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PurchaseRepository } from '../../../../src/modules/purchase/purchase.repository.js'
import {
  createPurchaseSchema,
  createTestDb,
  seedTwoTenantsWithPurchases,
  seedTwoTenantsWithUsers
} from '../../../helpers/testDb.js'

async function extendPurchaseSchemaForOrderCreation(db) {
  await db.schema.alterTable('purchase_orders', (table) => {
    table.integer('fiscal_year')
    table.string('invoice_no')
    table.decimal('withhold_percentage', 5, 2)
    table.boolean('withhold_settled').defaultTo(false)
    table.integer('encoder_id')
    table.string('encoder_fullname')
    table.string('sync_status').defaultTo('pending')
  })
  await db.schema.alterTable('purchase_order_items', (table) => {
    table.integer('inventory_id')
    table.timestamp('created_at')
    table.timestamp('last_updated')
    table.string('sync_status').defaultTo('pending')
  })
  await db.schema.alterTable('purchase_payments', (table) => {
    table.text('note')
    table.string('cheque_no')
    table.string('bank_name')
    table.string('branch_name')
    table.date('cheque_date')
    table.date('cleared_date')
    table.timestamp('last_updated')
    table.string('sync_status').defaultTo('pending')
  })
  await db.schema.createTable('inventories', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.integer('product_id').notNullable()
    table.string('inventory_code')
    table.string('batch_no')
    table.date('expiry_date')
    table.date('purchase_date')
    table.string('acquisition_type').defaultTo('cash')
    table.decimal('purchase_price', 15, 2)
    table.integer('quantity').notNullable().defaultTo(0)
    table.decimal('selling_price', 15, 2)
    table.string('settlement_status')
    table.string('location')
    table.text('notes')
    table.timestamp('created_at')
    table.timestamp('last_updated')
    table.string('sync_status').defaultTo('pending')
  })
  await db.schema.createTable('bin_cards', (table) => {
    table.increments('id').primary()
    table.integer('tenant_id').unsigned().notNullable()
    table.integer('product_id').notNullable()
    table.integer('inventory_id')
    table.string('batch_no')
    table.date('expiry_date')
    table.date('transaction_date')
    table.string('transaction_type')
    table.integer('reference_id')
    table.string('reference_table')
    table.integer('opening_balance')
    table.integer('quantity_in').defaultTo(0)
    table.integer('quantity_out').defaultTo(0)
    table.integer('balance').notNullable().defaultTo(0)
    table.decimal('unit_cost', 15, 2)
    table.decimal('total_cost', 15, 2)
    table.string('reason')
    table.text('notes')
    table.integer('created_by')
    table.timestamp('created_at')
    table.timestamp('last_updated')
  })
}

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

describe('PurchaseRepository createOrderWithItemsAndReceipt batch/expiry', () => {
  let db
  let repo

  beforeEach(async () => {
    db = createTestDb()
    await createPurchaseSchema(db)
    await extendPurchaseSchemaForOrderCreation(db)
    await seedTwoTenantsWithUsers(db)
    await db('customers').insert({
      id: 1,
      tenant_id: 1,
      customer_code: 'SUP1',
      name: 'Supplier A',
      customer_type: 'supplier'
    })
    await db('products').insert({
      id: 10,
      tenant_id: 1,
      product_code: 'PRD10',
      name: 'Amoxicillin'
    })
    repo = new PurchaseRepository(db)
  })

  afterEach(async () => {
    if (db) await db.destroy()
  })

  it('persists distinct batch/expiry per line when product_id repeats', async () => {
    const result = await repo.createOrderWithItemsAndReceipt(
      1,
      {
        order: {
          supplier_id: 1,
          order_date: '2026-07-20',
          receipt_no: 'PO000100',
          payment_mode: 'credit',
          payment_status: 'unpaid',
          total_amount: 200,
          amount_paid: 0,
          withhold_percentage: 0,
          withhold_amount: 0,
          status: 'completed'
        },
        items: [
          {
            product_id: 10,
            quantity: 5,
            unit_price: 20,
            total_price: 100,
            batch_number: 'BATCH-A',
            expiry_date: '2027-01-31'
          },
          {
            product_id: 10,
            quantity: 5,
            unit_price: 20,
            total_price: 100,
            batch_number: 'BATCH-B',
            expiry_date: '2027-06-30'
          }
        ]
      },
      1
    )

    const inventories = await db('inventories')
      .where({ tenant_id: 1, product_id: 10 })
      .orderBy('id', 'asc')
    expect(inventories).toHaveLength(2)
    expect(inventories.map((row) => row.batch_no)).toEqual(['BATCH-A', 'BATCH-B'])
    expect(inventories.map((row) => String(row.expiry_date).slice(0, 10))).toEqual([
      '2027-01-31',
      '2027-06-30'
    ])

    const binCards = await db('bin_cards')
      .where({ tenant_id: 1, product_id: 10 })
      .orderBy('id', 'asc')
    expect(binCards).toHaveLength(2)
    expect(binCards.map((row) => row.batch_no)).toEqual(['BATCH-A', 'BATCH-B'])

    expect(result.inventoryIds).toHaveLength(2)
  })
})
