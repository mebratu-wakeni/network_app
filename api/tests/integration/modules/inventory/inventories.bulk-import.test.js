import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import knexModule from 'knex'
import { errorHandler, notFound } from '../../../../src/middleware/error.js'
import { validate, bulkImportStockSchema } from '../../../../src/modules/inventory/inventories.schema.js'
import { InventoriesRepository } from '../../../../src/modules/inventory/inventories.repository.js'
import { InventoriesService } from '../../../../src/modules/inventory/inventories.service.js'
import { InventoriesController } from '../../../../src/modules/inventory/inventories.controller.js'

const TENANT_ID = 1

function createTestDb() {
  return knexModule({
    client: 'sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true
  })
}

async function createSchema(db) {
  await db.schema.createTable('categories', (t) => {
    t.increments('id').primary()
    t.integer('tenant_id').unsigned().notNullable().defaultTo(TENANT_ID)
    t.string('name').notNullable()
    t.timestamp('created_at')
    t.timestamp('last_updated')
  })

  await db.schema.createTable('units', (t) => {
    t.increments('id').primary()
    t.integer('tenant_id').unsigned().notNullable().defaultTo(TENANT_ID)
    t.string('name').notNullable()
    t.timestamp('created_at')
    t.timestamp('last_updated')
  })

  await db.schema.createTable('products', (t) => {
    t.increments('id').primary()
    t.integer('tenant_id').unsigned().notNullable().defaultTo(TENANT_ID)
    t.string('product_code')
    t.string('name').notNullable()
    t.string('description')
    t.integer('category_id')
    t.integer('unit_id')
    t.string('remark')
    t.string('sync_status').defaultTo('pending')
    t.timestamp('created_at')
    t.timestamp('last_updated')
  })

  await db.schema.createTable('inventories', (t) => {
    t.increments('id').primary()
    t.integer('tenant_id').unsigned().notNullable().defaultTo(TENANT_ID)
    t.integer('product_id').notNullable()
    t.string('inventory_code')
    t.string('batch_no')
    t.date('expiry_date')
    t.date('purchase_date').notNullable()
    t.string('acquisition_type').defaultTo('cash')
    t.decimal('purchase_price', 15, 2).notNullable()
    t.integer('quantity').notNullable().defaultTo(0)
    t.decimal('selling_price', 15, 2)
    t.string('settlement_status').defaultTo('unsettled')
    t.string('location')
    t.string('notes')
    t.timestamp('created_at')
    t.timestamp('last_updated')
    t.string('sync_status').defaultTo('pending')
  })

  await db.schema.createTable('bin_cards', (t) => {
    t.increments('id').primary()
    t.integer('tenant_id').unsigned().notNullable().defaultTo(TENANT_ID)
    t.integer('product_id').notNullable()
    t.integer('inventory_id')
    t.string('batch_no')
    t.date('expiry_date')
    t.date('transaction_date').notNullable()
    t.string('transaction_type').notNullable()
    t.integer('reference_id')
    t.string('reference_table')
    t.integer('opening_balance')
    t.integer('quantity_in').defaultTo(0)
    t.integer('quantity_out').defaultTo(0)
    t.integer('balance').notNullable()
    t.decimal('unit_cost', 15, 2)
    t.decimal('total_cost', 15, 2)
    t.string('reason')
    t.string('notes')
    t.integer('created_by')
    t.timestamp('created_at')
    t.timestamp('last_updated')
    t.string('sync_status').defaultTo('pending')
  })

  await db.schema.createTable('fiscal_years', (t) => {
    t.increments('id').primary()
    t.integer('tenant_id').unsigned().notNullable()
    t.integer('fiscal_year').notNullable()
    t.date('start_date').notNullable()
    t.date('end_date').notNullable()
    t.string('status', 20).notNullable().defaultTo('open')
  })
}

function createTestApp(controller) {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.tenantId = TENANT_ID
    next()
  })
  app.post('/api/inventories/bulk-import', validate(bulkImportStockSchema), controller.bulkImport)
  app.use(notFound)
  app.use(errorHandler)
  return app
}

describe('inventories bulk-import integration', () => {
  let db
  let app

  beforeEach(async () => {
    db = createTestDb()
    await createSchema(db)
    await db('fiscal_years').insert({
      tenant_id: TENANT_ID,
      fiscal_year: 2026,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      status: 'open'
    })

    const repository = new InventoriesRepository(db)
    const service = new InventoriesService(repository)
    const controller = new InventoriesController(service)
    app = createTestApp(controller)
  })

  afterEach(async () => {
    await db.destroy()
  })

  it('auto-creates product without product_code using provided category and unit', async () => {
    const payload = {
      reason: 'Stock Correction',
      stockItems: [
        {
          productName: 'Imported Product X',
          quantity: 5,
          unitCost: 12.5,
          category: 'Analgesics',
          unit: 'Strip',
          location: 'A-01'
        }
      ]
    }

    const res = await request(app).post('/api/inventories/bulk-import').send(payload)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.success).toBe(true)
    expect(res.body.summary).toMatchObject({ total: 1, successful: 1, failed: 0 })

    const category = await db('categories').where({ tenant_id: TENANT_ID }).whereRaw('LOWER(name) = LOWER(?)', ['Analgesics']).first()
    const unit = await db('units').where({ tenant_id: TENANT_ID }).whereRaw('LOWER(name) = LOWER(?)', ['Strip']).first()
    expect(category).toBeTruthy()
    expect(unit).toBeTruthy()

    const product = await db('products').where({ tenant_id: TENANT_ID, name: 'Imported Product X' }).first()
    expect(product).toBeTruthy()
    expect(product.product_code).toMatch(/^PRD\d+$/)
    expect(product.category_id).toBe(category.id)
    expect(product.unit_id).toBe(unit.id)

    const inventory = await db('inventories').where({ tenant_id: TENANT_ID, product_id: product.id }).first()
    expect(inventory).toBeTruthy()
    expect(Number(inventory.quantity)).toBe(5)
  })
})
