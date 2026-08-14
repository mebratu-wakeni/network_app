import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

export class AuthService {
  constructor(repository) {
    this.repository = repository
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

    const user = await this.repository.findById(adminId)
    if (!user) {
      const err = new Error('Admin user not found.')
      err.status = 404
      throw err
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash)
    if (!valid) {
      const err = new Error('Current password is incorrect.')
      err.status = 401
      throw err
    }

    const newHash = await bcrypt.hash(newPassword, 10)
    await this.repository.updatePassword(adminId, newHash)
    return { ok: true }
  }

  async login(username, password) {
    if (!username || !password) {
      const err = new Error('Username and password are required.')
      err.status = 400
      throw err
    }

    const user = await this.repository.findByUsername(username)
    if (!user) {
      const err = new Error('Invalid username or password.')
      err.status = 401
      throw err
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      const err = new Error('Invalid username or password.')
      err.status = 401
      throw err
    }

    const token = jwt.sign(
      { sub: user.id, username: user.username, display_name: user.display_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    )

    await this.repository.updateLastSeen(user.id)

    return {
      token,
      admin: { id: user.id, username: user.username, display_name: user.display_name }
    }
  }
}
