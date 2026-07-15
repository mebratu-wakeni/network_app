import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { errorHandler, notFound } from '../../../../src/middleware/error.js'

const mockService = vi.hoisted(() => ({
  findAll: vi.fn(),
  bulkImport: vi.fn(),
  exportToCSV: vi.fn(),
  createCategory: vi.fn(),
  createUnit: vi.fn(),
  getAllCategories: vi.fn(),
  getAllUnits: vi.fn(),
  findCategoryByName: vi.fn(),
  findUnitByName: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn()
}))

vi.mock('../../../../src/middleware/auth.js', () => ({
  authenticate: (req, _res, next) => {
    req.tenantId = 1
    next()
  },
  requireTenant: (_req, _res, next) => next(),
  requireRules: () => (_req, _res, next) => next()
}))

vi.mock('../../../../src/modules/inventory/products.service.js', () => ({
  ProductsService: class MockProductsService {
    findAll = (...args) => mockService.findAll(...args)
    bulkImport = (...args) => mockService.bulkImport(...args)
    exportToCSV = (...args) => mockService.exportToCSV(...args)
    createCategory = (...args) => mockService.createCategory(...args)
    createUnit = (...args) => mockService.createUnit(...args)
    getAllCategories = (...args) => mockService.getAllCategories(...args)
    getAllUnits = (...args) => mockService.getAllUnits(...args)
    findCategoryByName = (...args) => mockService.findCategoryByName(...args)
    findUnitByName = (...args) => mockService.findUnitByName(...args)
    createProduct = (...args) => mockService.createProduct(...args)
    updateProduct = (...args) => mockService.updateProduct(...args)
    deleteProduct = (...args) => mockService.deleteProduct(...args)
  }
}))

const { default: productsRouter } = await import('../../../../src/modules/inventory/products.routes.js')

function createTestApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/products', productsRouter)
  app.use(notFound)
  app.use(errorHandler)
  return app
}

describe('products routes integration contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns products list contract for POST /api/products', async () => {
    mockService.findAll.mockResolvedValueOnce({
      products: [{ id: 1, name: 'A' }],
      total: 1,
      stats: { outOfStock: 0, lowStock: 1 }
    })

    const res = await request(createTestApp()).post('/api/products').send({ limit: 10, offset: 0 })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      ok: true,
      products: [{ id: 1, name: 'A' }],
      total: 1,
      stats: { outOfStock: 0, lowStock: 1 }
    })
  })

  it('returns validation error details for POST /api/products/create', async () => {
    const res = await request(createTestApp()).post('/api/products/create').send({
      name: '',
      category_id: -1,
      unit_id: -1
    })

    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toBe('Validation failed')
    expect(Array.isArray(res.body.details)).toBe(true)
  })

  it('returns validation error details for POST /api/products/bulk-import', async () => {
    const res = await request(createTestApp()).post('/api/products/bulk-import').send({ products: [] })
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toBe('Validation failed')
  })

  it('returns CSV payload for GET /api/products/export', async () => {
    mockService.exportToCSV.mockResolvedValueOnce('name\nA')

    const res = await request(createTestApp()).get('/api/products/export')

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.text).toBe('name\nA')
  })

  it('propagates service errors through error middleware on PUT /api/products/:id', async () => {
    mockService.updateProduct.mockRejectedValueOnce(new Error('boom'))

    const res = await request(createTestApp()).put('/api/products/1').send({ name: 'New Name' })

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ ok: false, error: 'boom' })
  })

  it('returns success message on DELETE /api/products/:id', async () => {
    mockService.deleteProduct.mockResolvedValueOnce(true)

    const res = await request(createTestApp()).delete('/api/products/1')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, message: 'Product deleted successfully' })
  })
})
