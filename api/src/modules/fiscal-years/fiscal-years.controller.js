/**
 * Fiscal years controller: HTTP handlers
 */
export class FiscalYearsController {
  constructor(service) {
    this.service = service
  }

  create = async (req, res, next) => {
    try {
      const { fiscal_year, start_date, end_date } = req.body
      const row = await this.service.createFiscalYear({ fiscal_year, start_date, end_date })
      res.status(201).json({ success: true, fiscal_year: row })
    } catch (err) {
      next(err)
    }
  }

  list = async (req, res, next) => {
    try {
      const rows = await this.service.listAll()
      res.json({ success: true, fiscal_years: rows })
    } catch (err) {
      next(err)
    }
  }

  getCurrent = async (req, res, next) => {
    try {
      const row = await this.service.getCurrent()
      if (!row) {
        return res.status(404).json({ success: false, error: 'No open fiscal year found' })
      }
      res.json({ success: true, fiscal_year: row })
    } catch (err) {
      next(err)
    }
  }

  close = async (req, res, next) => {
    try {
      const { year } = req.params
      const row = await this.service.closeFiscalYear(year, req.user?.id)
      res.json({ success: true, fiscal_year: row })
    } catch (err) {
      next(err)
    }
  }

  reopen = async (req, res, next) => {
    try {
      const { year } = req.params
      const row = await this.service.reopenFiscalYear(year, req.user?.id)
      res.json({ success: true, fiscal_year: row })
    } catch (err) {
      next(err)
    }
  }

  delete = async (req, res, next) => {
    try {
      const { year } = req.params
      const force = req.query.force === 'true' || req.body?.force === true
      await this.service.deleteFiscalYear(year, force)
      res.json({ success: true })
    } catch (err) {
      next(err)
    }
  }

  getReport = async (req, res, next) => {
    try {
      const { year } = req.params
      const report = await this.service.getReport(year)
      res.json({ success: true, report })
    } catch (err) {
      next(err)
    }
  }
}
