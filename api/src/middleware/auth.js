// Minimal RBAC scaffold. For now, reads role from `x-role` header.
// Later, replace with JWT/session decoding and persistent roles.

export const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    const role = (req.headers['x-role'] || '').toString()
    if (allowedRoles.length === 0 || allowedRoles.includes(role)) {
      return next()
    }
    return res.status(403).json({ ok: false, error: 'Forbidden' })
  }
}

export default { requireRole }

