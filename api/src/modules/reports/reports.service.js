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

  /** SQLite / drivers may return numeric columns as strings — normalize for tree lookups */
  _coaDbId(value) {
    if (value == null || value === '') return null
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }

  _coaLevel(a) {
    const n = Number(a.level)
    return Number.isFinite(n) ? n : 0
  }

  _accountTypeIs(a, expected) {
    const t = a.account_type == null ? '' : String(a.account_type).trim().toLowerCase()
    return t === String(expected).trim().toLowerCase()
  }

  /**
   * One row per account_code (defensive; DB should already enforce uniqueness).
   * Prefer active row when duplicates ever appear.
   */
  _dedupeCoaByCode(coa) {
    const byCode = new Map()
    for (const row of coa) {
      const code = row.account_code
      if (!code) continue
      const prev = byCode.get(code)
      if (!prev) {
        byCode.set(code, row)
        continue
      }
      const pickNew = row.is_active && !prev.is_active
      if (pickNew) byCode.set(code, row)
    }
    return Array.from(byCode.values())
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
  async getIncomeStatement(tenantId, params) {
    const { date_from, date_to } = params
    const coa = await this.repository.getChartOfAccounts(tenantId)

    const dateFromPrev = new Date(new Date(date_from).getTime() - 86400000).toISOString().split('T')[0]
    const [opening, closing] = await Promise.all([
      this.repository.getClosingBalances(tenantId, dateFromPrev).catch(() => []),
      this.repository.getClosingBalances(tenantId, date_to)
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
   * Children grouped by parent_account_id (COA rows must include `id` from DB).
   */
  _childrenByParentId(coa) {
    const m = new Map()
    for (const a of coa) {
      const pid = this._coaDbId(a.parent_account_id)
      if (pid == null) continue
      if (!m.has(pid)) m.set(pid, [])
      m.get(pid).push(a)
    }
    return m
  }

  _hasDescendantWithBalance(accountDbId, childrenByParent, balanceMap) {
    const id = this._coaDbId(accountDbId)
    if (id == null) return false
    const kids = childrenByParent.get(id) || []
    for (const k of kids) {
      const b = balanceMap[k.account_code] ?? 0
      if (Math.abs(b) > 0.01) return true
      if (this._hasDescendantWithBalance(k.id, childrenByParent, balanceMap)) return true
    }
    return false
  }

  /**
   * Statement rows: level-2 detail, plus level-1 parents with non-zero closing balance when no
   * descendant in the COA tree has activity. Parent-only postings (common misconfiguration)
   * were previously omitted and broke Assets = L + E + NI.
   */
  _statementCoaRowsForType(coa, balanceMap, accountType) {
    const byParent = this._childrenByParentId(coa)
    return coa.filter((a) => {
      if (!this._accountTypeIs(a, accountType)) return false
      const lvl = this._coaLevel(a)
      if (lvl === 2) return true
      if (lvl === 1) {
        const bal = balanceMap[a.account_code] ?? 0
        if (Math.abs(bal) < 0.01) return false
        const selfId = this._coaDbId(a.id)
        if (selfId != null && this._hasDescendantWithBalance(selfId, byParent, balanceMap)) return false
        return true
      }
      return false
    })
  }

  /**
   * Parent COA accounts that have both a balance and descendant balances (double-count risk).
   */
  _coaHierarchyConflicts(coa, balanceMap, accountTypes) {
    const types = new Set(accountTypes.map((t) => String(t).trim().toLowerCase()))
    const byParent = this._childrenByParentId(coa)
    const conflicts = []
    for (const a of coa) {
      const typeKey = a.account_type == null ? '' : String(a.account_type).trim().toLowerCase()
      if (!types.has(typeKey) || this._coaLevel(a) !== 1) continue
      const selfId = this._coaDbId(a.id)
      if (selfId == null) continue
      const bal = balanceMap[a.account_code] ?? 0
      if (Math.abs(bal) < 0.01) continue
      if (!this._hasDescendantWithBalance(selfId, byParent, balanceMap)) continue
      conflicts.push({
        account_code: a.account_code,
        account_name: a.account_name,
        account_type: a.account_type,
        balance: bal,
        note: 'Parent and at least one child both have ledger balances — correct postings or COA so only detail (or only parent) carries the balance.'
      })
    }
    return conflicts
  }

  /**
   * Kept as a thin alias for balance sheet / P&L row selection.
   */
  _balanceSheetCoaRows(coa, balanceMap, accountType) {
    return this._statementCoaRowsForType(coa, balanceMap, accountType)
  }

  _plCoaRows(coa, balanceMap, accountType) {
    return this._statementCoaRowsForType(coa, balanceMap, accountType)
  }

  /**
   * Balance Sheet: Assets, Liabilities, Equity (from closing balances)
   * L&E are credit-normal (stored negative); display as positive.
   * Include Net Income (Revenue - Expenses) in Equity so Assets = L + E.
   *
   * Uses full reporting COA (includes inactive accounts that still have ledger rows).
   * Surfaces ledger codes missing from COA and reconciliation variance when the identity does not hold.
   */
  async getBalanceSheet(tenantId, params) {
    const { as_of_date } = params
    const coaRaw = await this.repository.getChartOfAccountsForReporting(tenantId)
    const coa = this._dedupeCoaByCode(coaRaw)
    const closing = await this.repository.getClosingBalances(tenantId, as_of_date)
    const balanceMap = this._balanceMap(closing)
    const coaHierarchyConflicts = this._coaHierarchyConflicts(coa, balanceMap, [
      'Asset',
      'Liability',
      'Equity',
      'Revenue',
      'Expense'
    ])

    const assetAccounts = this._balanceSheetCoaRows(coa, balanceMap, 'Asset')
    const liabilityAccounts = this._balanceSheetCoaRows(coa, balanceMap, 'Liability')
    const equityAccounts = this._balanceSheetCoaRows(coa, balanceMap, 'Equity')
    const revenueAccounts = this._plCoaRows(coa, balanceMap, 'Revenue')
    const expenseAccounts = this._plCoaRows(coa, balanceMap, 'Expense')

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

    const consumedCodes = new Set([
      ...assetAccounts.map((a) => a.account_code),
      ...liabilityAccounts.map((a) => a.account_code),
      ...equityAccounts.map((a) => a.account_code),
      ...revenueAccounts.map((a) => a.account_code),
      ...expenseAccounts.map((a) => a.account_code)
    ])

    const coaByCode = new Map(coa.map((a) => [a.account_code, a]))
    const unmapped = []
    for (const row of closing) {
      const raw = Number(row.balance || 0)
      if (Math.abs(raw) < 0.01) continue
      if (consumedCodes.has(row.account_code)) continue
      const acc = coaByCode.get(row.account_code)
      if (!acc) {
        unmapped.push({
          account_code: row.account_code,
          account_name: row.account_name || row.account_code,
          balance: raw,
          note: 'Ledger balance with no chart of accounts row — add or map this code so it can be classified.'
        })
        continue
      }
      unmapped.push({
        account_code: row.account_code,
        account_name: acc.account_name,
        balance: raw,
        account_type: acc.account_type,
        note:
          'Not included on balance sheet (e.g. wrong account_type or level > 2). Reactivate the account or fix the COA.'
      })
    }

    const variance = totalAssets - totalLiabEquity
    const balanced = Math.abs(variance) < 0.02
    const ledgerSumCheck = closing.reduce((s, r) => s + Number(r.balance || 0), 0)

    const hints = []
    if (!balanced) {
      if (Math.abs(netIncome) > 0.02 && Math.abs(variance + netIncome) < 0.02) {
        hints.push(
          'The gap equals "Current Year Earnings" (net income). Retained Earnings (4200) may already include the same profit that is still in Revenue (5100) or Expense accounts — correct postings so profit is not counted twice.'
        )
      } else if (
        Math.abs(netIncome) > 0.02 &&
        Math.abs(variance) > 0.02 &&
        unmapped.length === 0 &&
        coaHierarchyConflicts.length === 0 &&
        Math.abs(ledgerSumCheck) < 0.02
      ) {
        hints.push(
          'All accounts are mapped and the ledger balances sum to zero, but the sheet still does not tie. Compare 4200 (Retained Earnings) to open P&L balances — duplicate recognition there is a frequent cause.'
        )
      }
    }

    return {
      as_of_date,
      assets: { lines: assetLines, total: totalAssets },
      liabilities: { lines: liabilityLines, total: totalLiabilities },
      equity: { lines: equityLinesWithNetIncome, total: totalEquity },
      total_liabilities_equity: totalLiabEquity,
      reconciliation: {
        balanced,
        variance,
        ledger_sum_check: ledgerSumCheck,
        hints,
        equation_breakdown: {
          total_assets: totalAssets,
          total_liabilities: totalLiabilities,
          equity_accounts_before_ni: totalEquityFromAccounts,
          net_income_bridged: netIncome,
          total_liabilities_and_equity: totalLiabEquity
        },
        balance_sheet_logic: '2026-05-equity-ni-bridge-v1'
      },
      coa_hierarchy_conflicts: coaHierarchyConflicts,
      unmapped_ledger_accounts: unmapped
    }
  }

  /**
   * Cash Flow: movements in Cash (1100) - simplified operating section
   */
  async getCashFlow(tenantId, params) {
    const { date_from, date_to } = params
    const activity = await this.repository.getPeriodActivity(tenantId, date_from, date_to)
    const cashAct = activity.find((a) => a.account_code === '1100') || {
      total_debit: 0,
      total_credit: 0
    }
    const cashIn = cashAct.total_debit
    const cashOut = cashAct.total_credit
    const netChange = cashIn - cashOut

    const opening = await this.repository.getClosingBalances(
      tenantId,
      new Date(new Date(date_from).getTime() - 86400000).toISOString().split('T')[0]
    ).catch(() => [])
    const closing = await this.repository.getClosingBalances(tenantId, date_to)
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
  async getStatementOfChangesInEquity(tenantId, params) {
    const { date_from, date_to } = params
    const coa = await this.repository.getChartOfAccounts(tenantId)
    const equityAccounts = coa.filter((a) => a.account_type === 'Equity' && a.level === 2)

    const dateFromPrev = new Date(new Date(date_from).getTime() - 86400000).toISOString().split('T')[0]
    const [opening, closing] = await Promise.all([
      this.repository.getClosingBalances(tenantId, dateFromPrev).catch(() => []),
      this.repository.getClosingBalances(tenantId, date_to)
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
