/**
 * Controller: HTTP layer for users
 */
export class UsersController {
  constructor(service) {
    this.service = service
  }

  /**
   * GET /api/users/:id
   * Get user profile (excluding password)
   */
  getProfile = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) }
      const user = await this.service.getById(id)
      res.json({ ok: true, user })
    } catch (error) {
      next(error)
    }
  }

  /**
   * PUT /api/users/:id
   * Update user profile
   */
  updateProfile = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) }
      const user = await this.service.update(id, req.validBody)
      res.json({ ok: true, user })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/users/:id/roles
   * Assign role to user (admin only)
   */
  assignRole = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) }
      const result = await this.service.assignRoleToUser(id, req.validBody)
      res.json({ ok: true, ...result })
    } catch (error) {
      next(error)
    }
  }

  /**
   * DELETE /api/users/:id/roles
   * Remove role from user (admin only)
   */
  removeRole = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) }
      const result = await this.service.removeRoleFromUser(id, req.validBody)
      res.json({ ok: true, ...result })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/users/:id/rules
   * Assign rule to user (admin only)
   */
  assignRule = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) }
      const result = await this.service.assignRuleToUser(id, req.validBody)
      res.json({ ok: true, ...result })
    } catch (error) {
      next(error)
    }
  }

  /**
   * DELETE /api/users/:id/rules
   * Remove rule from user (admin only)
   */
  removeRule = async (req, res, next) => {
    try {
      const { id } = req.validParams || { id: Number(req.params.id) }
      const result = await this.service.removeRuleFromUser(id, req.validBody)
      res.json({ ok: true, ...result })
    } catch (error) {
      next(error)
    }
  }
}

