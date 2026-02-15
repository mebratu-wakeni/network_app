/**
 * Reports service: build financial statements from ledger + COA
 */
export class ReportsService {
  constructor(repository) {
    this.repository = repository
  }

  _finance(num) {
    return (num != null ? Number(num) : 0).toFixed(2)
  }

  /**
   * Build map of account_code -> balance from closing balances
   */
  _balanceMap(closingBalances) {
    const map = {}
    for (const b of closingBalances) {
      map[b.account_code] = b.balance
    }
    return map
  }

  /**
   * Build map of account_code -> { debit, credit } from period activity
   */
  _activityMap(periodActivity) {
    const map = {}
    for (const a of periodActivity) {
      map[a.account_code] = { debit: a.total_debit, credit: a.total_credit }
    }
    return map
  }

  /**
   * Get accounts by type from COA, with balances or activity filled in
   */
  _accountsByType(coa, balanceMap, typeFilter) {
    const filtered = coa.filter((a) => a.account_type === typeFilter && a.level === 2)
    return filtered.map((a) => ({
      account_code: a.account_code,
      account_name: a.account_name,
      balance: balanceMap[a.account_code] ?? 0
    }))
  }

  /**
   * Income Statement: Revenue (5xxx) - Expenses (6xxx)
   * Period amounts derived from ledger balance field: closing_balance - opening_balance.
   * Same account 5100 (Sales Revenue) as Dashboard. Revenue is credit-normal, Expense is debit-normal.
   */
  async getIncomeStatement(params) {
    const { date_from, date_to } = params
    const coa = await this.repository.getChartOfAccounts()

    const dateFromPrev = new Date(new Date(date_from).getTime() - 86400000).toISOString().split('T')[0]
    const [opening, closing] = await Promise.all([
      this.repository.getClosingBalances(dateFromPrev).catch(() => []),
      this.repository.getClosingBalances(date_to)
    ])
    const openingMap = this._balanceMap(opening)
    const closingMap = this._balanceMap(closing)

    const revenueAccounts = coa.filter((a) => a.account_type === 'Revenue' && a.level === 2)
    const expenseAccounts = coa.filter((a) => a.account_type === 'Expense' && a.level === 2)

    let totalRevenue = 0
    const revenueLines = revenueAccounts.map((a) => {
      const openBal = openingMap[a.account_code] ?? 0
      const closeBal = closingMap[a.account_code] ?? 0
      const amt = openBal - closeBal
      totalRevenue += amt
      return { account_code: a.account_code, account_name: a.account_name, amount: amt }
    })

    let totalExpenses = 0
    const expenseLines = expenseAccounts.map((a) => {
      const openBal = openingMap[a.account_code] ?? 0
      const closeBal = closingMap[a.account_code] ?? 0
      const amt = closeBal - openBal
      totalExpenses += amt
      return { account_code: a.account_code, account_name: a.account_name, amount: amt }
    })

    const netIncome = totalRevenue - totalExpenses

    return {
      period: { date_from, date_to },
      revenue: { lines: revenueLines, total: totalRevenue },
      expenses: { lines: expenseLines, total: totalExpenses },
      net_income: netIncome
    }
  }

  /**
   * Balance Sheet: Assets, Liabilities, Equity (from closing balances)
   * L&E are credit-normal (stored negative); display as positive.
   * Include Net Income (Revenue - Expenses) in Equity so Assets = L + E.
   */
  async getBalanceSheet(params) {
    const { as_of_date } = params
    const coa = await this.repository.getChartOfAccounts()
    const closing = await this.repository.getClosingBalances(as_of_date)
    const balanceMap = this._balanceMap(closing)

    const assetAccounts = coa.filter((a) => a.account_type === 'Asset' && a.level === 2)
    const liabilityAccounts = coa.filter((a) => a.account_type === 'Liability' && a.level === 2)
    const equityAccounts = coa.filter((a) => a.account_type === 'Equity' && a.level === 2)
    const revenueAccounts = coa.filter((a) => a.account_type === 'Revenue' && a.level === 2)
    const expenseAccounts = coa.filter((a) => a.account_type === 'Expense' && a.level === 2)

    // Assets: debit-normal, balance stored positive
    const assetLines = assetAccounts.map((a) => {
      const raw = balanceMap[a.account_code] ?? 0
      return { account_code: a.account_code, account_name: a.account_name, balance: raw }
    })
    const totalAssets = assetLines.reduce((s, l) => s + l.balance, 0)

    // Liabilities: credit-normal (stored negative); display as positive
    const liabilityLines = liabilityAccounts.map((a) => {
      const raw = balanceMap[a.account_code] ?? 0
      const display = raw <= 0 ? -raw : raw // credit balance = negative stored
      return { account_code: a.account_code, account_name: a.account_name, balance: display }
    })
    const totalLiabilities = liabilityLines.reduce((s, l) => s + l.balance, 0)

    // Equity: credit-normal (stored negative); display as positive
    const equityLines = equityAccounts.map((a) => {
      const raw = balanceMap[a.account_code] ?? 0
      const display = raw <= 0 ? -raw : raw
      return { account_code: a.account_code, account_name: a.account_name, balance: display }
    })

    // Net Income = Revenue (credit, stored neg) - Expenses (debit, stored pos)
    let netIncome = 0
    for (const a of revenueAccounts) {
      const b = balanceMap[a.account_code] ?? 0
      netIncome += -b // Revenue: credit balance stored negative; -raw = positive amount
    }
    for (const a of expenseAccounts) {
      const b = balanceMap[a.account_code] ?? 0
      netIncome -= b // Expense: debit balance stored positive
    }

    const totalEquityFromAccounts = equityLines.reduce((s, l) => s + l.balance, 0)
    const totalEquity = totalEquityFromAccounts + netIncome

    const totalLiabEquity = totalLiabilities + totalEquity

    // Add "Current Year Earnings" line to equity if netIncome !== 0
    const equityLinesWithNetIncome =
      Math.abs(netIncome) > 0.01
        ? [
            ...equityLines,
            {
              account_code: 'NI',
              account_name: 'Current Year Earnings (Net Income)',
              balance: netIncome
            }
          ]
        : equityLines

    return {
      as_of_date,
      assets: { lines: assetLines, total: totalAssets },
      liabilities: { lines: liabilityLines, total: totalLiabilities },
      equity: { lines: equityLinesWithNetIncome, total: totalEquity },
      total_liabilities_equity: totalLiabEquity
    }
  }

  /**
   * Cash Flow: movements in Cash (1100) - simplified operating section
   */
  async getCashFlow(params) {
    const { date_from, date_to } = params
    const activity = await this.repository.getPeriodActivity(date_from, date_to)
    const cashAct = activity.find((a) => a.account_code === '1100') || {
      total_debit: 0,
      total_credit: 0
    }
    const cashIn = cashAct.total_debit
    const cashOut = cashAct.total_credit
    const netChange = cashIn - cashOut

    const opening = await this.repository.getClosingBalances(
      new Date(new Date(date_from).getTime() - 86400000).toISOString().split('T')[0]
    ).catch(() => [])
    const closing = await this.repository.getClosingBalances(date_to)
    const openingCash = opening.find((b) => b.account_code === '1100')?.balance ?? 0
    const closingCash = closing.find((b) => b.account_code === '1100')?.balance ?? 0

    return {
      period: { date_from, date_to },
      operating: {
        cash_received: cashIn,
        cash_paid: cashOut,
        net_cash_from_operating: netChange
      },
      opening_cash: openingCash,
      closing_cash: closingCash,
      net_change: closingCash - openingCash
    }
  }

  /**
   * Statement of Changes in Equity: movements in Equity accounts (4xxx)
   * Changes derived from ledger balance: opening - closing (equity is credit-normal)
   */
  async getStatementOfChangesInEquity(params) {
    const { date_from, date_to } = params
    const coa = await this.repository.getChartOfAccounts()
    const equityAccounts = coa.filter((a) => a.account_type === 'Equity' && a.level === 2)

    const dateFromPrev = new Date(new Date(date_from).getTime() - 86400000).toISOString().split('T')[0]
    const [opening, closing] = await Promise.all([
      this.repository.getClosingBalances(dateFromPrev).catch(() => []),
      this.repository.getClosingBalances(date_to)
    ])
    const openingMap = this._balanceMap(opening)
    const closingMap = this._balanceMap(closing)

    const lines = equityAccounts.map((a) => {
      const openBal = openingMap[a.account_code] ?? 0
      const closeBal = closingMap[a.account_code] ?? 0
      const changes = openBal - closeBal
      return {
        account_code: a.account_code,
        account_name: a.account_name,
        opening_balance: openBal,
        changes,
        closing_balance: closeBal
      }
    })

    const totalOpening = lines.reduce((s, l) => s + l.opening_balance, 0)
    const totalChanges = lines.reduce((s, l) => s + l.changes, 0)
    const totalClosing = lines.reduce((s, l) => s + l.closing_balance, 0)

    return {
      period: { date_from, date_to },
      lines,
      total_opening: totalOpening,
      total_changes: totalChanges,
      total_closing: totalClosing
    }
  }
}
