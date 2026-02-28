import { afterEach, describe, expect, it } from 'vitest'
import { ProductsRepository } from '../../../../src/modules/inventory/products.repository.js'
import { createInventorySchema, createTestDb } from '../../../helpers/testDb.js'

describe('ProductsRepository', () => {
  let db

  afterEach(async () => {
    if (db) await db.destroy()
    db = null
  })

  it('computes stock stats from latest bin card balances', async () => {
    db = createTestDb()
    await createInventorySchema(db)
    const repo = new ProductsRepository(db)

    await db('categories').insert([{ id: 1, name: 'cat' }])
    await db('units').insert([{ id: 1, name: 'unit' }])
    await db('products').insert([
      { id: 1, product_code: 'PRD0001', name: 'A', category_id: 1, unit_id: 1 },
      { id: 2, product_code: 'PRD0002', name: 'B', category_id: 1, unit_id: 1 },
      { id: 3, product_code: 'PRD0003', name: 'C', category_id: 1, unit_id: 1 }
    ])

    await db('bin_cards').insert([
      { id: 1, product_id: 1, balance: 3 },
      { id: 2, product_id: 1, balance: 0 },
      { id: 3, product_id: 2, balance: 12 }
    ])

    const stats = await repo.getProductStockStats()
    expect(stats).toEqual({ outOfStock: 2, lowStock: 1 })
  })

  it('filters low stock products and keeps integer balances', async () => {
    db = createTestDb()
    await createInventorySchema(db)
    const repo = new ProductsRepository(db)

    await db('categories').insert([{ id: 1, name: 'cat' }])
    await db('units').insert([{ id: 1, name: 'unit' }])
    await db('products').insert([
      { id: 1, product_code: 'PRD0001', name: 'Low', category_id: 1, unit_id: 1 },
      { id: 2, product_code: 'PRD0002', name: 'High', category_id: 1, unit_id: 1 }
    ])
    await db('bin_cards').insert([
      { id: 1, product_id: 1, balance: 20 },
      { id: 2, product_id: 2, balance: 80 }
    ])

    const result = await repo.findAll({ filter: 'low-stock', sortBy: 'balance', orderBy: 'asc' })
    expect(result.total).toBe(1)
    expect(result.products).toHaveLength(1)
    expect(result.products[0]).toMatchObject({ name: 'Low', balance: 20 })
    expect(Number.isInteger(result.products[0].balance)).toBe(true)
  })

  it('falls back to zero balances when bin_cards table does not exist', async () => {
    db = createTestDb()
    await db.schema.createTable('categories', (table) => {
      table.increments('id').primary()
      table.string('name').notNullable()
    })
    await db.schema.createTable('units', (table) => {
      table.increments('id').primary()
      table.string('name').notNullable()
    })
    await db.schema.createTable('products', (table) => {
      table.increments('id').primary()
      table.string('product_code')
      table.string('name').notNullable()
      table.integer('category_id')
      table.integer('unit_id')
    })

    await db('categories').insert([{ id: 1, name: 'cat' }])
    await db('units').insert([{ id: 1, name: 'unit' }])
    await db('products').insert([{ id: 1, product_code: 'PRD0001', name: 'NoBin', category_id: 1, unit_id: 1 }])

    const repo = new ProductsRepository(db)
    const result = await repo.findAll({})

    expect(result.products[0].balance).toBe(0)
    expect(result.stats).toEqual({ outOfStock: 0, lowStock: 0 })
  })
})
