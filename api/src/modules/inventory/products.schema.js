/**
 * Schema: Validation layer using Zod
 * Defines and validates request/response shapes for products
 */
import { z } from 'zod'

/**
 * Schema for a single product in bulk import.
 * Only name is required. Category and unit are optional; backend auto-creates them if provided.
 */
export const productSchema = z.object({
  name: z.string().min(1, 'Product name is required').trim(),
  description: z.string().trim().optional().nullable(),
  category: z.string().trim().optional().nullable(),
  unit: z.string().trim().optional().nullable(),
  remark: z.string().trim().optional().nullable()
})

/**
 * Schema for bulk import products request body
 */
export const bulkImportProductsSchema = z.object({
  products: z.array(productSchema).min(1, 'At least one product is required')
})

/**
 * Schema for creating a new category
 */
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').trim(),
  description: z.string().trim().optional().nullable()
})

/**
 * Schema for creating a new unit
 */
export const createUnitSchema = z.object({
  name: z.string().min(1, 'Unit name is required').trim(),
  abbreviation: z.string().trim().optional().nullable()
})

/**
 * Schema for creating a new product
 */
export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').trim(),
  description: z.string().trim().optional().nullable(),
  category_id: z.union([z.number().int().positive(), z.null()]).optional(),
  unit_id: z.union([z.number().int().positive(), z.null()]).optional(),
  remark: z.string().trim().optional().nullable(),
  expiry_threshold: z.coerce.number().int().positive('Expiry threshold must be a positive number').optional()
})

/**
 * Validation middleware factory
 * Creates middleware that validates req.body against a schema
 */
export const validate = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    
    if (!result.success) {
      const error = new Error('Validation failed')
      error.status = 400
      error.details = result.error.issues.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
      return next(error)
    }
    
    req.validBody = result.data
    next()
  }
}

/**
 * Validation middleware for URL parameters
 */
export const validateParams = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.params)
    
    if (!result.success) {
      const error = new Error('Invalid parameter')
      error.status = 400
      error.details = result.error.issues.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
      return next(error)
    }
    
    req.validParams = result.data
    next()
  }
}
