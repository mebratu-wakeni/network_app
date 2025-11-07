/**
 * Schema: Validation layer using Zod
 * Defines and validates request/response shapes
 */
import { z } from 'zod'

/**
 * Schema for creating a test item
 */
export const createTestItemSchema = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  quantity: z.coerce.number().int('Quantity must be an integer').nonnegative('Quantity must be non-negative').default(0)
})

/**
 * Schema for updating a test item (all fields optional)
 */
export const updateTestItemSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').trim().optional(),
  quantity: z.coerce.number().int('Quantity must be an integer').nonnegative('Quantity must be non-negative').optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
)

/**
 * Schema for validating id parameter
 */
export const idParamSchema = z.object({
  id: z.coerce.number().int('ID must be an integer').positive('ID must be positive')
})

/**
 * Validation middleware factory
 * Creates middleware that validates req.body against a schema
 * On success, attaches validated data to req.validBody
 * On failure, passes error to next() for error handler
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
    
    // Attach validated and transformed data to request
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
    
    // Attach validated params
    req.validParams = result.data
    next()
  }
}

