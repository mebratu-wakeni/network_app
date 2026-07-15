import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CustomersRepository } from '../../../../src/modules/customers/customers.repository.js'
import {
  createCustomersSchema,
  createTestDb,
  seedTwoTenantsWithCustomers
} from '../../../helpers/testDb.js'

describe('CustomersRepository tenant isolation', () => {
  let db
  let repo

  beforeEach(async () => {
    db = createTestDb()
    await createCustomersSchema(db)
    await seedTwoTenantsWithCustomers(db)
    repo = new CustomersRepository(db)
  })

  afterEach(async () => {
    if (db) await db.destroy()
  })

  it('findAll only returns customers for the requested tenant', async () => {
    const t1 = await repo.findAll(1, { limit: 10, offset: 0 })
    const t2 = await repo.findAll(2, { limit: 10, offset: 0 })

    expect(t1.total).toBe(2)
    expect(t1.customers.every((c) => c.tenant_id === 1)).toBe(true)
    expect(t2.total).toBe(1)
    expect(t2.customers[0].contact_person).toBe('Bob')
  })

  it('findById is scoped to tenant', async () => {
    const own = await repo.findById(1, 1)
    expect(own.name).toBe('Supplier One')

    const crossTenant = await repo.findById(2, 1)
    expect(crossTenant).toBeUndefined()
  })

  it('findByName and findSupplierByName are scoped to tenant', async () => {
    const t1 = await repo.findByName(1, 'Supplier One')
    const t2 = await repo.findByName(2, 'Supplier One')
    expect(t1.id).toBe(1)
    expect(t2.id).toBe(2)

    const supplier = await repo.findSupplierByName(1, 'Supplier One')
    expect(supplier.id).toBe(1)

    const missing = await repo.findSupplierByName(1, 'Retailer Walk-in')
    expect(missing).toBeFalsy()
  })

  it('findByContactPerson and getContactPersonKeysLowerSet are tenant-scoped', async () => {
    const alice = await repo.findByContactPerson(1, 'Alice')
    expect(alice.id).toBe(1)

    const cross = await repo.findByContactPerson(2, 'Alice')
    expect(cross).toBeFalsy()

    const keys = await repo.getContactPersonKeysLowerSet(1)
    expect(keys.has('alice')).toBe(true)
    expect(keys.has('bob')).toBe(false)
  })

  it('update and delete do not affect customers in another tenant', async () => {
    const updated = await repo.update(1, 1, { name: 'Updated Supplier' })
    expect(updated.name).toBe('Updated Supplier')

    const blockedUpdate = await repo.update(2, 1, { name: 'Hacked' })
    expect(blockedUpdate).toBeUndefined()

    await repo.delete(1, 3)
    expect(await repo.findById(1, 3)).toBeUndefined()

    expect(await repo.delete(2, 3)).toBe(false)
    expect(await repo.findById(1, 1)).toBeTruthy()
  })

  it('getMaxCustomerCodeNumber returns highest CUST suffix for tenant', async () => {
    expect(await repo.getMaxCustomerCodeNumber(1)).toBe(2)
    expect(await repo.getMaxCustomerCodeNumber(2)).toBe(1)
  })

  it('create stores tenant_id and keeps rows isolated', async () => {
    const created = await repo.create({
      tenant_id: 2,
      customer_code: 'CUST0099',
      name: 'New Supplier',
      customer_type: 'supplier'
    })
    expect(created.tenant_id).toBe(2)
    expect(await repo.findById(1, created.id)).toBeUndefined()
    expect(await repo.findById(2, created.id)).toBeTruthy()
  })
})
