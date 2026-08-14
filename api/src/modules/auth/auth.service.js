/**
 * Service: Authentication business logic
 */
import jwt from 'jsonwebtoken'

export class AuthService {
  constructor(usersService, usersRepository, tenantsRepository) {
    this.usersService = usersService
    this.usersRepository = usersRepository
    this.tenantsRepository = tenantsRepository
  }

  /**
   * Generate JWT token for a user, scoped to their tenant
   */
  generateToken(userId, tenantId) {
    const secret = process.env.JWT_SECRET || 'change-me-in-production'
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d'

    return jwt.sign(
      { userId, tenantId },
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
   * Register a new user within the caller's tenant (Admin-only route).
   */
  async register(tenantId, input) {
    const user = await this.usersService.create(tenantId, input)
    const token = this.generateToken(user.id, tenantId)

    return {
      user,
      token
    }
  }

  /**
   * Login with client_code + username + password.
   * client_code resolves which tenant this login belongs to; different tenants
   * may have identically-named users (e.g. every pharmacy has an 'admin').
   */
  async login(clientCode, username, password) {
    const tenant = await this.tenantsRepository.findByClientCode(clientCode)
    if (!tenant) {
      const error = new Error('Invalid client code')
      error.status = 401
      error.code = 'INVALID_CLIENT_CODE'
      throw error
    }
    if (tenant.status !== 'active') {
      const error = new Error('This account has been suspended. Please contact support.')
      error.status = 403
      error.code = 'TENANT_SUSPENDED'
      throw error
    }

    // Find user by username, scoped to this tenant
    const user = await this.usersRepository.findByUsername(tenant.id, username)

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
    await this.usersRepository.updateLoginTime(tenant.id, username);

    // Generate token (scoped to tenant)
    const token = this.generateToken(user.id, tenant.id)

    // Return user without password hash
    const { password_hash, ...userWithoutPassword } = user

    return {
      user: userWithoutPassword,
      token
    }
  }
}

