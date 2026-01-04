/**
 * Service: Authentication business logic
 */
import jwt from 'jsonwebtoken'

export class AuthService {
  constructor(usersService, usersRepository) {
    this.usersService = usersService
    this.usersRepository = usersRepository
  }

  /**
   * Generate JWT token for a user
   */
  generateToken(userId) {
    const secret = process.env.JWT_SECRET || 'change-me-in-production'
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d'
    
    return jwt.sign(
      { userId },
      secret,
      { expiresIn }
    )
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    const secret = process.env.JWT_SECRET || 'change-me-in-production'
    try {
      return jwt.verify(token, secret)
    } catch (error) {
      const err = new Error('Invalid or expired token')
      err.status = 401
      throw err
    }
  }

  /**
   * Register a new user
   */
  async register(input) {
    const user = await this.usersService.create(input)
    const token = this.generateToken(user.id)
    
    return {
      user,
      token
    }
  }

  /**
   * Login with username and password
   */
  async login(username, password) {
    // Find user by username
    const user = await this.usersRepository.findByUsername(username);
    
    if (!user) {
      const error = new Error('Invalid username or password')
      error.status = 401
      throw error
    }

    // Check if user is active
    if (!user.is_active) {
      const error = new Error('Account is deactivated')
      error.status = 403
      throw error
    }

    // Verify password
    const isValid = await this.usersService.verifyPassword(password, user.password_hash)
    if (!isValid) {
      const error = new Error('Invalid username or password')
      error.status = 401
      throw error
    }

    // update last_login_at 
    await this.usersRepository.updateLoginTime(username);

    // Generate token
    const token = this.generateToken(user.id)

    // Return user without password hash
    const { password_hash, ...userWithoutPassword } = user
    
    return {
      user: userWithoutPassword,
      token
    }
  }
}

