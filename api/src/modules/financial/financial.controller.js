/**
 * Financial controller: HTTP handlers for expenses, deposits, cash loans
 */
export class FinancialController {
  constructor(service) {
    this.service = service
  }

  createExpense = async (req, res, next) => {
    try {
      const row = await this.service.createExpense(req.body, req.user)
      res.status(201).json({ success: true, expense: row })
    } catch (err) {
      next(err)
    }
  }

  listExpenses = async (req, res, next) => {
    try {
      const { limit, offset, date_from, date_to, category } = req.query
      const validDate = (v) => (v && String(v).trim() !== '' && String(v) !== 'undefined') ? String(v).trim() : null
      const result = await this.service.listExpenses({
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
        date_from: validDate(date_from),
        date_to: validDate(date_to),
        category: category && String(category).trim() !== '' && String(category) !== 'undefined' ? String(category).trim() : null
      })
      res.json({ success: true, ...result })
    } catch (err) {
      next(err)
    }
  }

  getExpenseById = async (req, res, next) => {
    try {
      const row = await this.service.getExpenseById(req.params.id)
      res.json({ success: true, expense: row })
    } catch (err) {
      next(err)
    }
  }

  createDeposit = async (req, res, next) => {
    try {
      const row = await this.service.createDeposit(req.body, req.user)
      res.status(201).json({ success: true, deposit: row })
    } catch (err) {
      next(err)
    }
  }

  getDepositStats = async (req, res, next) => {
    try {
      const { date_from, date_to } = req.query
      const validDate = (v) => (v != null && v !== '' && String(v).trim() !== '' && String(v) !== 'undefined') ? String(v).trim() : null
      const stats = await this.service.getDepositStats({
        date_from: validDate(date_from),
        date_to: validDate(date_to)
      })
      res.json({ success: true, stats })
    } catch (err) {
      next(err)
    }
  }

  listDeposits = async (req, res, next) => {
    try {
      const { limit, offset, date_from, date_to, type } = req.query
      const validDate = (v) => (v != null && v !== '' && String(v).trim() !== '' && String(v) !== 'undefined') ? String(v).trim() : null
      const result = await this.service.listDeposits({
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
        date_from: validDate(date_from),
        date_to: validDate(date_to),
        type: type || null
      })
      res.json({ success: true, ...result })
    } catch (err) {
      next(err)
    }
  }

  getDepositById = async (req, res, next) => {
    try {
      const row = await this.service.getDepositById(req.params.id)
      res.json({ success: true, deposit: row })
    } catch (err) {
      next(err)
    }
  }

  updateDeposit = async (req, res, next) => {
    try {
      const row = await this.service.updateDeposit(req.params.id, req.body, req.user)
      res.json({ success: true, deposit: row })
    } catch (err) {
      next(err)
    }
  }

  reverseDeposit = async (req, res, next) => {
    try {
      const row = await this.service.reverseDeposit(req.params.id, req.user)
      res.json({ success: true, deposit: row })
    } catch (err) {
      next(err)
    }
  }

  createCashLoanReceivable = async (req, res, next) => {
    try {
      const row = await this.service.createCashLoanReceivable(req.body, req.user)
      res.status(201).json({ success: true, loan: row })
    } catch (err) {
      next(err)
    }
  }

  listCashLoansReceivable = async (req, res, next) => {
    try {
      const { limit, offset, status } = req.query
      const result = await this.service.listCashLoansReceivable({
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
        status: status || null
      })
      res.json({ success: true, ...result })
    } catch (err) {
      next(err)
    }
  }

  recordCashLoanReceivableReturn = async (req, res, next) => {
    try {
      const result = await this.service.recordCashLoanReceivableReturn(req.params.id, req.body, req.user)
      res.json({ success: true, ...result })
    } catch (err) {
      next(err)
    }
  }

  createCashLoanPayable = async (req, res, next) => {
    try {
      const row = await this.service.createCashLoanPayable(req.body, req.user)
      res.status(201).json({ success: true, loan: row })
    } catch (err) {
      next(err)
    }
  }

  listCashLoansPayable = async (req, res, next) => {
    try {
      const { limit, offset, status } = req.query
      const result = await this.service.listCashLoansPayable({
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
        status: status || null
      })
      res.json({ success: true, ...result })
    } catch (err) {
      next(err)
    }
  }

  recordCashLoanPayableRepayment = async (req, res, next) => {
    try {
      const result = await this.service.recordCashLoanPayableRepayment(req.params.id, req.body, req.user)
      res.json({ success: true, ...result })
    } catch (err) {
      next(err)
    }
  }

  getTradeReceivablesSummary = async (req, res, next) => {
    try {
      const result = await this.service.getTradeReceivablesSummary()
      res.json({ success: true, ...result })
    } catch (err) {
      next(err)
    }
  }

  getTradePayablesSummary = async (req, res, next) => {
    try {
      const result = await this.service.getTradePayablesSummary()
      res.json({ success: true, ...result })
    } catch (err) {
      next(err)
    }
  }

  listWithholdReceivables = async (req, res, next) => {
    try {
      const { limit, offset, status } = req.query
      const result = await this.service.listWithholdReceivables({
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
        status: status || null
      })
      res.json({ success: true, ...result })
    } catch (err) {
      next(err)
    }
  }

  createWithholdReceivableSettlement = async (req, res, next) => {
    try {
      const result = await this.service.createWithholdReceivableSettlement(req.body, req.user)
      res.status(201).json({ success: true, ...result })
    } catch (err) {
      next(err)
    }
  }

  listWithholdPayables = async (req, res, next) => {
    try {
      const { limit, offset, status } = req.query
      const result = await this.service.listWithholdPayables({
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
        status: status || null
      })
      res.json({ success: true, ...result })
    } catch (err) {
      next(err)
    }
  }

  createWithholdPayableSettlement = async (req, res, next) => {
    try {
      const result = await this.service.createWithholdPayableSettlement(req.body, req.user)
      res.status(201).json({ success: true, ...result })
    } catch (err) {
      next(err)
    }
  }
}
