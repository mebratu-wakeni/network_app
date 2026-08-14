import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

export class PlatformAdminsService {
  constructor(repository) {
    this.repository = repository
  }

  async login(username, password) {
    if (!username || !password) {
      const err = new Error('Username and password are required.')
      err.status = 400
      throw err
    }

    const admin = await this.repository.findByUsername(username)
    if (!admin) {
      const err = new Error('Invalid username or password.')
      err.status = 401
      throw err
    }

    const valid = await bcrypt.compare(password, admin.password_hash)
    if (!valid) {
      const err = new Error('Invalid username or password.')
      err.status = 401
      throw err
    }

    const secret = process.env.JWT_SECRET || 'change-me-in-production'
    // `type: 'platform_admin'` disambiguates this token from tenant-user JWTs
    // (which carry userId/tenantId instead) so neither can be used as the other.
    const token = jwt.sign(
      { sub: admin.id, username: admin.username, type: 'platform_admin' },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    )

    await this.repository.updateLastSeen(admin.id)

    return {
      token,
      admin: { id: admin.id, username: admin.username, display_name: admin.display_name }
    }
  }

  async changePassword(adminId, currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
      const err = new Error('Current password and new password are required.')
      err.status = 400
      throw err
    }
    if (newPassword.length < 8) {
      const err = new Error('New password must be at least 8 characters.')
      err.status = 400
      throw err
    }

    const admin = await this.repository.findById(adminId)
    if (!admin) {
      const err = new Error('Admin not found.')
      err.status = 404
      throw err
    }

    const valid = await bcrypt.compare(currentPassword, admin.password_hash)
    if (!valid) {
      const err = new Error('Current password is incorrect.')
      err.status = 401
      throw err
    }

    const newHash = await bcrypt.hash(newPassword, 10)
    await this.repository.updatePassword(adminId, newHash)
    return { ok: true }
  }
}
