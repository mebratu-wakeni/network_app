/**
 * Controller: HTTP layer for system settings
 */
export class SettingsController {
  constructor(service) {
    this.service = service
  }

  getSettings = async (req, res, next) => {
    try {
      const settings = await this.service.getSettings(req.tenantId)
      res.json({ ok: true, settings })
    } catch (err) {
      next(err)
    }
  }

  updateSettings = async (req, res, next) => {
    try {
      const body = req.validBody || req.body
      const settings = await this.service.updateSettings(req.tenantId, body)
      res.json({ ok: true, settings })
    } catch (err) {
      next(err)
    }
  }
}
