/**
 * Reports controller: financial statements
 */
export class ReportsController {
  constructor(service) {
    this.service = service
  }

  getIncomeStatement = async (req, res, next) => {
    try {
      const { date_from, date_to } = req.query
      if (!date_from || !date_to) {
        const err = new Error('date_from and date_to are required')
        err.status = 400
        throw err
      }
      const report = await this.service.getIncomeStatement(req.tenantId, { date_from, date_to })
      res.json({ success: true, report })
    } catch (err) {
      next(err)
    }
  }

  getBalanceSheet = async (req, res, next) => {
    try {
      const { as_of_date } = req.query
      if (!as_of_date) {
        const err = new Error('as_of_date is required')
        err.status = 400
        throw err
      }
      const report = await this.service.getBalanceSheet(req.tenantId, { as_of_date })
      res.json({ success: true, report })
    } catch (err) {
      next(err)
    }
  }

  getCashFlow = async (req, res, next) => {
    try {
      const { date_from, date_to } = req.query
      if (!date_from || !date_to) {
        const err = new Error('date_from and date_to are required')
        err.status = 400
        throw err
      }
      const report = await this.service.getCashFlow(req.tenantId, { date_from, date_to })
      res.json({ success: true, report })
    } catch (err) {
      next(err)
    }
  }

  getStatementOfChangesInEquity = async (req, res, next) => {
    try {
      const { date_from, date_to } = req.query
      if (!date_from || !date_to) {
        const err = new Error('date_from and date_to are required')
        err.status = 400
        throw err
      }
      const report = await this.service.getStatementOfChangesInEquity(req.tenantId, { date_from, date_to })
      res.json({ success: true, report })
    } catch (err) {
      next(err)
    }
  }
}
