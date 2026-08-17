import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PurchaseRepository } from '../../../../src/modules/purchase/purchase.repository.js'
import { createTestDb } from '../../../helpers/testDb.js'

async function createPurchaseOrderCreationSchema(db) {
  await db.schema.createTable('products', (table) => {
    table.increments('id').primary()
    table.string('product_code')
    table.string('name').notNullable()
  })
  await db.schema.createTable('purchase_orders', (table) => {
    table.increments('id').primary()
    table.integer('supplier_id')
    table.date('order_date').notNullable()
    table.integer('fiscal_year')
    table.string('invoice_no')
    table.text('remark')
    table.string('payment_mode').defaultTo('cash')
    table.string('payment_status').defaultTo('paid')
    table.decimal('total_amount', 15, 2).defaultTo(0)
    table.decimal('amount_paid', 15, 2).defaultTo(0)
    table.decimal('withhold_percentage', 5, 2)
    table.decimal('withhold_amount', 15, 2)
    table.boolean('withhold_settled').defaultTo(false)
    table.string('receipt_no').notNullable()
    table.string('status').defaultTo('completed')
    table.integer('encoder_id')
    table.string('encoder_fullname')
    table.timestamp('created_at')
    table.timestamp('last_updated')
    table.string('sync_status').defaultTo('pending')
  })
  await db.schema.createTable('purchase_order_items', (table) => {
    table.increments('id').primary()
    table.integer('purchase_order_id').notNullable()
    table.integer('product_id').notNullable()
    table.integer('quantity').notNullable()
    table.decimal('unit_price', 15, 2).notNullable()
    table.decimal('total_price', 15, 2).notNullable()
    table.integer('inventory_id')
    table.timestamp('created_at')
    table.timestamp('last_updated')
    table.string('sync_status').defaultTo('pending')
  })
  await db.schema.createTable('purchase_payments', (table) => {
    table.increments('id').primary()
    table.integer('purchase_order_id').notNullable()
    table.date('payment_date')
    table.decimal('amount', 15, 2)
    table.text('note')
    table.string('payment_method')
    table.string('cheque_no')
    table.string('bank_name')
    table.string('branch_name')
    table.date('cheque_date')
    table.date('cleared_date')
    table.timestamp('created_at')
    table.timestamp('last_updated')
    table.string('sync_status').defaultTo('pending')
  })
  await db.schema.createTable('inventories', (table) => {
    table.increments('id').primary()
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

describe('PurchaseRepository createOrderWithItemsAndReceipt batch/expiry', () => {
  let db
  let repo

  beforeEach(async () => {
    db = createTestDb()
    await createPurchaseOrderCreationSchema(db)
    await db('products').insert({
      id: 10,
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

    const inventories = await db('inventories').where({ product_id: 10 }).orderBy('id', 'asc')
    expect(inventories).toHaveLength(2)
    expect(inventories.map((row) => row.batch_no)).toEqual(['BATCH-A', 'BATCH-B'])
    expect(inventories.map((row) => String(row.expiry_date).slice(0, 10))).toEqual([
      '2027-01-31',
      '2027-06-30'
    ])

    const binCards = await db('bin_cards').where({ product_id: 10 }).orderBy('id', 'asc')
    expect(binCards).toHaveLength(2)
    expect(binCards.map((row) => row.batch_no)).toEqual(['BATCH-A', 'BATCH-B'])

    expect(result.inventoryIds).toHaveLength(2)
  })
})
