import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

export class AuthService {
  constructor(repository) {
    this.repository = repository
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
