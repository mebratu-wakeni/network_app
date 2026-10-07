/**
 * Integration: borrow-from + returns clear Accounts Payable; inventory (1300) credits use returning lot cost;
 * Borrow Variance (6400) absorbs (c_r − C_b) × q vs obligation C_b from borrow_from_inventories.unit_cost.
 *
 * Scenario:
 * 1. Initial stock: Product A batch x, 24 @ 4
 * 2. Borrow 10 batch y @ 100 (C_b = 100)
 * 3. Return [batch y: 2, batch x: 4]
 * 4. Return remaining 4 from batch y
 * 5. AP (3100) net ≈ 0; 1300 reflects opening + borrow − returns at lot costs; 6100 untouched; 6400 = mixed-lot variance.
 */
import path from 'path'
import { fileURLToPath } from 'url'
import knexModule from 'knex'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { InventoriesRepository } from '../../../../src/modules/inventory/inventories.repository.js'
import { seedDefaultChartOfAccountsForTenant } from '../../../helpers/testDb.js'

const TENANT_ID = 1

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function makeDb () {
  return knexModule({
    client: 'sqlite3',
    connection: ':memory:',
    useNullAsDefault: true,
    migrations: { directory: path.resolve(__dirname, '../../../../db/migrations') },
    seeds: { directory: path.resolve(__dirname, '../../../../db/seeds') }
  })
}

async function ledgerNet (db, accountCode) {
  const row = await db('account_ledger')
    .where('account_code', accountCode)
    .select(db.raw('COALESCE(SUM(debit - credit), 0) as b'))
    .first()
  return Number(row?.b ?? 0)
}

describe('borrow-from / borrow-return GL (full settlement)', () => {
  let db

  beforeEach(async () => {
    db = makeDb()
    await db.migrate.latest()
    await db.seed.run()
    await db('tenants').insert({
      id: TENANT_ID,
      client_code: 'TEST',
      business_name: 'Test Pharmacy',
      status: 'active'
    })
    await seedDefaultChartOfAccountsForTenant(db, TENANT_ID)
    await db('categories').insert({ tenant_id: TENANT_ID, name: 'TestCat', sync_status: 'pending' })
    await db('units').insert({ tenant_id: TENANT_ID, name: 'UnitT', sync_status: 'pending' })
    await db('customers').insert({
      tenant_id: TENANT_ID,
      name: 'Supplier Partner',
      customer_type: 'supplier',
      sync_status: 'pending'
    })
  })

  afterEach(async () => {
    await db.destroy()
  })

  it('after full returns: AP ≈ 0, 1300 at returning-lot costs, 6400 holds variance, no COGS (6100)', async () => {
    const supplier = await db('customers').where({ name: 'Supplier Partner' }).first()
    expect(supplier).toBeTruthy()

    const repo = new InventoriesRepository(db)

    const importResult = await repo.bulkImport(
      TENANT_ID,
      [
        {
          product_name: 'Product A',
          quantity: 24,
          unit_cost: 4,
          batch_number: 'x',
          category: 'TestCat',
          unit: 'UnitT',
          location: 'Main'
        }
      ],
      { reason: 'initial stock', purchase_date: '2026-01-01' }
    )

    expect(importResult.failed?.length ?? 0).toBe(0)
    expect(importResult.successful?.length).toBe(1)
    const productId = importResult.successful[0].product_id
    const invXId = importResult.successful[0].inventory_id

    const inv1300AfterImport = await ledgerNet(db, '1300')
    const opening4300 = await ledgerNet(db, '4300')
    expect(inv1300AfterImport).toBeCloseTo(96, 2)
    expect(opening4300).toBeCloseTo(-96, 2)

    const borrowRow = await repo.createBorrowFromInventory(
      TENANT_ID,
      {
        partnerId: supplier.id,
        productId,
        quantity: 10,
        purchasePrice: 100,
        batchNo: 'y'
      },
      null
    )

    const invYId = borrowRow.inventory_id
    expect(invYId).toBeTruthy()
    expect(invYId).not.toBe(invXId)

    expect(await ledgerNet(db, '1300')).toBeCloseTo(1096, 2)
    expect(await ledgerNet(db, '3100')).toBeCloseTo(-1000, 2)

    // Step 3: mixed lots — batch y first then batch x (stress non–contract-cost first)
    await repo.processBorrowFromReturn(
      TENANT_ID,
      {
        borrowedInventoryId: invYId,
        returnItems: [
          { inventory_id: invYId, quantity: 2 },
          { inventory_id: invXId, quantity: 4 }
        ],
        returnedOn: '2026-02-01'
      },
      null
    )

    // Step 4: remaining 4 from batch y
    await repo.processBorrowFromReturn(
      TENANT_ID,
      {
        borrowedInventoryId: invYId,
        returnItems: [{ inventory_id: invYId, quantity: 4 }],
        returnedOn: '2026-02-02'
      },
      null
    )

    const apNet = await ledgerNet(db, '3100')
    const invNet = await ledgerNet(db, '1300')
    const bvNet = await ledgerNet(db, '6400')
    const cogsNet = await ledgerNet(db, '6100')

    expect(Math.abs(apNet)).toBeLessThan(0.05)
    // 96 opening + 1000 borrow − (2×100 + 4×4 + 4×100) = 480
    expect(invNet).toBeCloseTo(480, 2)
    // One mixed line: (4 − 100) × 4 = −384 net on 6400 (debit − credit)
    expect(bvNet).toBeCloseTo(-384, 2)
    expect(Math.abs(cogsNet)).toBeLessThan(0.05)

    const yRow = await db('inventories').where({ id: invYId }).first()
    expect(Number(yRow.quantity)).toBe(4)

    const xRow = await db('inventories').where({ id: invXId }).first()
    expect(Number(xRow.quantity)).toBe(20)
  })
})
