import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { InventoriesRepository } from '../../../../src/modules/inventory/inventories.repository.js'
import { createInventorySchema, createTestDb } from '../../../helpers/testDb.js'

describe('InventoriesRepository tenant isolation', () => {
  let db
  let repo

  beforeEach(async () => {
    db = createTestDb()
    await createInventorySchema(db)
    repo = new InventoriesRepository(db)

    await db('categories').insert([
      { id: 1, tenant_id: 1, name: 'Cat1' },
      { id: 2, tenant_id: 2, name: 'Cat2' }
    ])
    await db('units').insert([
      { id: 1, tenant_id: 1, name: 'Unit1' },
      { id: 2, tenant_id: 2, name: 'Unit2' }
    ])
    await db('products').insert([
      { id: 1, tenant_id: 1, product_code: 'PRD0001', name: 'Product One', category_id: 1, unit_id: 1 },
      { id: 2, tenant_id: 2, product_code: 'PRD0001', name: 'Product Two', category_id: 2, unit_id: 2 }
    ])
    await db('inventories').insert([
      {
        id: 1,
        tenant_id: 1,
        product_id: 1,
        inventory_code: 'I0010001',
        purchase_date: '2026-01-01',
        purchase_price: 10,
        quantity: 5,
        location: 'A-1'
      },
      {
        id: 2,
        tenant_id: 2,
        product_id: 2,
        inventory_code: 'I0010002',
        purchase_date: '2026-01-01',
        purchase_price: 20,
        quantity: 8,
        location: 'B-1'
      }
    ])
  })

  afterEach(async () => {
    if (db) await db.destroy()
  })

  it('findAll only returns inventories for the requested tenant', async () => {
    const t1 = await repo.findAll(1, { limit: 10, offset: 0 })
    const t2 = await repo.findAll(2, { limit: 10, offset: 0 })

    expect(t1.total).toBe(1)
    expect(t1.stock[0].location).toBe('A-1')
    expect(t2.total).toBe(1)
    expect(t2.stock[0].location).toBe('B-1')
  })

  it('findInventoriesByProduct is scoped to tenant', async () => {
    const t1Items = await repo.findInventoriesByProduct(1, 1)
    const crossTenant = await repo.findInventoriesByProduct(1, 2)

    expect(t1Items).toHaveLength(1)
    expect(t1Items[0].inventoryCode).toBe('I0010001')
    expect(crossTenant).toHaveLength(0)
  })

  it('updateById does not affect inventories in another tenant', async () => {
    await expect(repo.updateById(2, 1, { unit_cost: 99 })).rejects.toThrow(/not found/)

    const unchanged = await db('inventories').where({ id: 1 }).first()
    expect(Number(unchanged.purchase_price)).toBe(10)

    const updated = await repo.updateById(1, 1, { unit_cost: 12.5 })
    expect(Number(updated.purchase_price)).toBe(12.5)
  })

  it('findProductByCode and findProductByName are tenant-scoped', async () => {
    const p1 = await repo.findProductByCode(1, 'PRD0001')
    const p2 = await repo.findProductByCode(2, 'PRD0001')
    expect(p1.name).toBe('Product One')
    expect(p2.name).toBe('Product Two')

    const byName = await repo.findProductByName(1, 'Product Two')
    expect(byName).toBeUndefined()
  })
})
