/**
 * Authentication & Authorization Middleware
 * Handles JWT verification, user loading, and permission checking
 */
import jwt from 'jsonwebtoken'
import knex from '../db/knex.js'
import { UsersRepository } from '../modules/users/users.repository.js'
import { PermissionsService } from '../services/permissions.service.js'

const usersRepository = new UsersRepository(knex)
const permissionsService = new PermissionsService(usersRepository)

/**
 * Verify JWT token and load user
 * Attaches req.user with user data and effective rules
 */
export const authenticate = async (req, res, next) => {
  try {
    // Development mode: Allow bypassing authentication
    // Set DISABLE_AUTH=true in .env for development
    if (process.env.NODE_ENV !== 'production' && process.env.DISABLE_AUTH === 'true') {
      // Create a mock admin user for development
      req.user = {
        id: 1,
        email: 'dev@localhost',
        display_name: 'Development User',
        is_active: true,
        rules: ['admin'] // Grant all permissions in dev
      }
      return next()
    }

    // Get token from Authorization header (Bearer token) or fallback to x-role for backward compatibility
    const authHeader = req.headers.authorization
    let token = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    } else if (req.headers['x-role']) {
      // Backward compatibility: if x-role header exists, allow it (for testing)
      // In production, remove this and require Bearer token
      return next()
    }

    if (!token) {
      const error = new Error('Authentication required')
      error.status = 401
      return next(error)
    }

    // Verify token
    const secret = process.env.JWT_SECRET || 'change-me-in-production'
    let decoded
    try {
      decoded = jwt.verify(token, secret)
    } catch (err) {
      const error = new Error('Invalid or expired token')
      error.status = 401
      return next(error)
    }

    // Load user
    const user = await usersRepository.findById(decoded.userId)
    if (!user || !user.is_active) {
      const error = new Error('User not found or inactive')
      error.status = 401
      return next(error)
    }

    // Load effective rules
    const effectiveRules = await permissionsService.getEffectiveRules(user.id)
    
    // Attach user and rules to request
    req.user = {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      is_active: user.is_active,
      rules: Array.from(effectiveRules)
    }

    next()
  } catch (error) {
    next(error)
  }
}

/**
 * Require specific rules (must have all)
 * @param {string[]} requiredRules - Array of rule keys (e.g., ['products.write'])
 */
export const requireRules = (requiredRules = []) => {
  return async (req, res, next) => {
    try {
      // If using x-role header (backward compatibility), allow it
      if (req.headers['x-role'] && !req.user) {
        return next()
      }

      if (!req.user) {
        const error = new Error('Authentication required')
        error.status = 401
        return next(error)
      }

      if (requiredRules.length === 0) {
        return next()
      }

      // Check if user has all required rules
      const hasAll = await permissionsService.hasAllRules(req.user.id, requiredRules)
      
      if (!hasAll) {
        const error = new Error('Forbidden: Insufficient permissions')
        error.status = 403
        return next(error)
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Require any of the specified rules (at least one)
 * @param {string[]} requiredRules - Array of rule keys
 */
export const requireAnyRule = (requiredRules = []) => {
  return async (req, res, next) => {
    try {
      if (req.headers['x-role'] && !req.user) {
        return next()
      }

      if (!req.user) {
        const error = new Error('Authentication required')
        error.status = 401
        return next(error)
      }

      if (requiredRules.length === 0) {
        return next()
      }

      const hasAny = await permissionsService.hasAnyRule(req.user.id, requiredRules)
      
      if (!hasAny) {
        const error = new Error('Forbidden: Insufficient permissions')
        error.status = 403
        return next(error)
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Require role (backward compatibility - converts to rules)
 * Works with both JWT tokens and x-role header for backward compatibility
 */
export const requireRole = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      // First, try to authenticate if JWT token is present
      const authHeader = req.headers.authorization
      if (authHeader && authHeader.startsWith('Bearer ')) {
        // JWT token present - authenticate first
        await authenticate(req, res, () => {
          // After authentication, req.user should be set
          // Continue to role check below
        })
      }

      // Backward compatibility: if x-role header exists, use it
      const role = (req.headers['x-role'] || '').toString()
      if (role && allowedRoles.includes(role)) {
        return next()
      }

      // If authenticated user (from JWT), check rules based on role
      if (req.user) {
        // Get user's roles from database
        const userRoles = await usersRepository.getUserRoles(req.user.id)
        const userRoleNames = userRoles.map(r => r.name)
        
        // Check if user has any of the allowed roles
        const hasAllowedRole = allowedRoles.some(role => userRoleNames.includes(role))
        
        if (hasAllowedRole || allowedRoles.length === 0) {
          return next()
        }
        
        const error = new Error('Forbidden')
        error.status = 403
        return next(error)
      }

      const error = new Error('Authentication required')
      error.status = 401
      return next(error)
    } catch (error) {
      next(error)
    }
  }
}

export default { authenticate, requireRules, requireAnyRule, requireRole }
