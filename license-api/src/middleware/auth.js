import jwt from 'jsonwebtoken'

export function authenticate(req, res, next) {
  const header = req.headers['authorization'] || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required.' })
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.admin = payload
    next()
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token.' })
  }
}
