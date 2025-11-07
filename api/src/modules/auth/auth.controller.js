/**
 * Controller: HTTP layer for authentication
 */
export class AuthController {
  constructor(service) {
    this.service = service
  }

  /**
   * POST /api/auth/register
   * Register a new user
   */
  register = async (req, res, next) => {
    try {
      const result = await this.service.register(req.validBody)
      res.status(201).json({ ok: true, ...result })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/auth/login
   * Login with email and password
   */
  login = async (req, res, next) => {
    try {
      const { username, password } = req.validBody
      const result = await this.service.login(username, password)
      res.json({ ok: true, ...result })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/auth/me
   * Get current user from token (protected route)
   */
  me = async (req, res, next) => {
    try {
      // req.user is set by authenticate middleware
      const user = req.user
      res.json({ ok: true, user })
    } catch (error) {
      next(error)
    }
  }
}

