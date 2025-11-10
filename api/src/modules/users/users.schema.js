/**
 * Schema: Validation for users using Zod
 */
import { z } from 'zod'

/**
 * Schema for user registration
 */
export const registerUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').trim().toLowerCase(),
  email: z.string().email('Invalid email address').trim().toLowerCase().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  display_name: z.string().min(1, 'Display name is required').trim().optional()
})

/**
 * Schema for updating user (excludes password)
 */
export const updateUserSchema = z.object({
  display_name: z.string().min(1, 'Display name cannot be empty').trim().optional(),
  is_active: z.boolean().optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
)

/**
 * Schema for id parameter
 */
export const idParamSchema = z.object({
  id: z.coerce.number().int('ID must be an integer').positive('ID must be positive')
})

/**
 * Validation middleware (reuse from testItems pattern)
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

// Assign role: allow either roleName or roleId
export const assignRoleByNameSchema = z.object({
  roleName: z.string().min(1, 'roleName is required').trim().toLowerCase()
})

export const assignRoleByIdSchema = z.object({
  roleId: z.coerce.number().int('roleId must be an integer').positive('roleId must be positive')
})

export const assignRoleSchema = z.union([assignRoleByNameSchema, assignRoleByIdSchema])

export const removeRoleSchema = z.union([assignRoleByNameSchema, assignRoleByIdSchema])

// Assign rule: allow either ruleKey or ruleId
export const assignRuleByKeySchema = z.object({
  ruleKey: z.string().min(1, 'ruleKey is required').trim()
})

export const assignRuleByIdSchema = z.object({
  ruleId: z.coerce.number().int('ruleId must be an integer').positive('ruleId must be positive')
})

export const assignRuleSchema = z.union([assignRuleByKeySchema, assignRuleByIdSchema])

export const removeRuleSchema = z.union([assignRuleByKeySchema, assignRuleByIdSchema])

export const searchUsersSchema = z.object({
  searchQuery: z.string().optional().default(''),
  tableConfig: z.object({
    limit: z.coerce.number().min(1).max(100).optional().default(10),
    offset: z.coerce.number().min(0).optional().default(0),
    sortBy: z.enum(['id', 'username', 'email', 'display_name', 'is_active', 'created_at', 'updated_at']).optional().default('id'),
    orderBy: z.enum(['asc', 'desc']).optional().default('desc')
  }).optional().default({
    limit: 10,
    offset: 0,
    sortBy: 'id',
    orderBy: 'desc'
  })
}).transform((data) => ({
  searchQuery: data.searchQuery || '',
  tableConfig: {
    limit: data.tableConfig?.limit ?? 10,
    offset: data.tableConfig?.offset ?? 0,
    sortBy: data.tableConfig?.sortBy ?? 'id',
    orderBy: data.tableConfig?.orderBy ?? 'desc'
  }
}))

// Update profile schema
export const updateUserProfileSchema = z.object({
  username: z.string().min(3).max(30).optional(),
  email: z.string().email().optional(),
  displayName: z.string().min(1).max(100).optional(),
  // Add other profile fields as needed
});

// Change password schema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(8)
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});


