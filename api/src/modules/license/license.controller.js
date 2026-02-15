export class LicenseController {
  constructor(service) {
    this.service = service
  }

  status = async (req, res, next) => {
    try {
      const fingerprint = req.query?.device_fingerprint || req.body?.device_fingerprint || null
      const result = await this.service.getLocalStatus(fingerprint)
      res.json({ ok: true, ...result })
    } catch (err) {
      next(err)
    }
  }

  activate = async (req, res, next) => {
    try {
      const body = req.validBody || req.body
      const result = await this.service.activate(body)
      res.json(result)
    } catch (err) {
      next(err)
    }
  }
}

