import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomersService } from '../../../../src/modules/customers/customers.service.js'
import { CustomersRepository } from '../../../../src/modules/customers/customers.repository.js'
import {
  createCustomersSchema,
  createTestDb,
  seedTwoTenantsWithCustomers
} from '../../../helpers/testDb.js'

describe('CustomersService customer_code', () => {
  let db
  let service

  beforeEach(async () => {
    db = createTestDb()
    await createCustomersSchema(db)
    await seedTwoTenantsWithCustomers(db)
  })

  afterEach(async () => {
    if (db) await db.destroy()
  })

  it('assigns sequential customer_code on create', async () => {
    const repository = {
      findByName: vi.fn().mockResolvedValue(null),
      getMaxCustomerCodeNumber: vi.fn().mockResolvedValue(2),
      create: vi.fn().mockResolvedValue({ id: 99, tenant_id: 1, customer_code: 'CUST0003', name: 'New Retailer' })
    }
    service = new CustomersService(repository)

    const row = await service.create(1, {
      name: 'New Retailer',
      customer_type: 'retailer'
    })

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 1, customer_code: 'CUST0003' })
    )
    expect(row.customer_code).toBe('CUST0003')
  })

  it('assigns sequential customer_code rows on bulk import', async () => {
    service = new CustomersService(new CustomersRepository(db))

    const result = await service.bulkImport(1, [
      {
        name: 'Bulk One',
        contact_person: 'Person One',
        customer_type: 'supplier'
      },
      {
        name: 'Bulk Two',
        contact_person: 'Person Two',
        customer_type: 'retailer'
      }
    ])

    expect(result.successful).toBe(2)
    const codes = result.results.filter((r) => r.success).map((r) => r.customer.customer_code)
    expect(codes).toEqual(['CUST0003', 'CUST0004'])
  })
})
