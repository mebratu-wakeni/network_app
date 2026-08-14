/**
 * Schema: Validation layer using Zod
 * Defines and validates request/response shapes for customers
 */
import { z } from 'zod'

/**
 * Schema for a single customer in bulk import
 */
export const customerSchema = z.object({
  name: z.string().min(1, 'Customer name is required').trim(),
  contact_person: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().email('Invalid email format').optional().nullable().or(z.literal('')),
  address: z.string().trim().optional().nullable(),
  license_no: z.string().trim().optional().nullable(),
  tin_no: z.string().trim().optional().nullable(),
  website: z.string().trim().optional().nullable(),
  fax: z.string().trim().optional().nullable(),
  country: z.string().trim().optional().nullable(),
  customer_type: z.enum(['supplier', 'retailer', 'both', 'other']).default('supplier')
})

const CUSTOMER_TYPES = ['supplier', 'retailer', 'both', 'other']

/**
 * Bulk import JSON body: only structural check. Validation / normalization live in CustomersService.bulkImport
 * (same split as products: route validates shape; service owns business rules per row).
 */
export const bulkImportCustomersSchema = z.object({
  customers: z
    .array(
      z.any().refine(
        (row) => row != null && typeof row === 'object' && !Array.isArray(row),
        { message: 'Each customer must be an object' }
      )
    )
    .min(1, 'At least one customer is required')
})

/** Shared enum for create/update and docs */
export const customerTypeEnumSchema = z.enum(CUSTOMER_TYPES)

/**
 * Schema for creating a new customer
 */
export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required').trim(),
  contact_person: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().email('Invalid email format').optional().nullable().or(z.literal('')),
  address: z.string().trim().optional().nullable(),
  license_no: z.string().trim().optional().nullable(),
  tin_no: z.string().trim().optional().nullable(),
  website: z.string().trim().optional().nullable(),
  fax: z.string().trim().optional().nullable(),
  country: z.string().trim().optional().nullable(),
  customer_type: z.enum(['supplier', 'retailer', 'both', 'other']).default('supplier')
})

/**
 * Schema for updating a customer
 */
export const updateCustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required').trim().optional(),
  contact_person: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  email: z.string().email('Invalid email format').optional().nullable().or(z.literal('')),
  address: z.string().trim().optional().nullable(),
  license_no: z.string().trim().optional().nullable(),
  tin_no: z.string().trim().optional().nullable(),
  website: z.string().trim().optional().nullable(),
  fax: z.string().trim().optional().nullable(),
  country: z.string().trim().optional().nullable(),
  customer_type: z.enum(['supplier', 'retailer', 'both', 'other']).optional()
})

/**
 * Schema for ID parameter validation
 */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid customer ID')
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
