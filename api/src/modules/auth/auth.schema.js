/**
 * Schema: Validation for authentication
 */
import { z } from 'zod'

/**
 * Schema for user registration
 */
export const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').trim().toLowerCase(),
  email: z.string().email('Invalid email address').trim().toLowerCase().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  display_name: z.string().min(1, 'Display name is required').trim().optional()
})

/**
 * Schema for login.
 * client_code identifies which tenant this login belongs to (set once by the
 * desktop app's Setup Wizard and sent silently with every login request).
 */
export const loginSchema = z.object({
  client_code: z.string().min(1, 'Client code is required').trim().toUpperCase(),
  username: z.string().min(1, 'Username is required').trim().toLowerCase(),
  password: z.string().min(1, 'Password is required')
})

/**
 * Validation middleware
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

