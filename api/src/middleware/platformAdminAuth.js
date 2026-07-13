import jwt from 'jsonwebtoken'

/**
 * Auth guard for the masatech-admin (super-admin) panel routes -- distinct from
 * the tenant-user `authenticate` middleware in auth.js. Verifies a JWT signed by
 * PlatformAdminsService.login and requires `type: 'platform_admin'` so a tenant
 * user's token (which has no `type` claim) can never be used here, and vice versa.
 */
export const requirePlatformAdminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    const error = new Error('Authentication required')
    error.status = 401
    return next(error)
  }

  const secret = process.env.JWT_SECRET || 'change-me-in-production'
  try {
    const decoded = jwt.verify(token, secret)
    if (decoded.type !== 'platform_admin') {
      const error = new Error('Invalid or expired token')
      error.status = 401
      return next(error)
    }
    req.platformAdmin = decoded
    next()
  } catch {
    const error = new Error('Invalid or expired token')
    error.status = 401
    next(error)
  }
}

export default { requirePlatformAdminAuth }
