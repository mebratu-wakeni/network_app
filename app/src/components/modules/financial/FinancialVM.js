const { ViewModel, SharedStateManager } = Liteframe

/** Default expense form shape; paid_on is set to today when called. */
function getDefaultExpenseForm() {
  return {
    customer_id: null,
    customer: null,
    customer_search: '',
    show_customer_dropdown: false,
    category: 'utilities',
    invoice_no: '',
    paid_on: new Date().toISOString().split('T')[0],
    amount: '',
    description: '',
    payment_method: 'Cash',
    cheque_number: '',
    cheque_date: '',
    bank_name: '',
    bank_transfer_reference: '',
    apply_withhold: false,
  }
}

export class FinancialVM extends ViewModel {
  constructor(sharedStateManager = new SharedStateManager()) {
    super(sharedStateManager)
    this.initializeState()
    this.loadExpenses() // Load default tab data on mount
  }

  getDefaultExpenseForm() {
    return getDefaultExpenseForm()
  }

  resetExpenseForm() {
    this.updateState('expense-form', getDefaultExpenseForm())
    // Keep expense-customer-list so dropdown has options when modal opens
  }

  initializeState() {
    this.setState('active-tab', 'expense')
    this.setState('receivables-tab', 'trade') // 'trade' | 'loans' | 'withhold'
    this.setState('payables-tab', 'trade') // 'trade' | 'loans' | 'withhold'
    this.setState('expenses', [])
    this.setState('expense-total', 0)
    this.setState('expense-form', getDefaultExpenseForm())
    this.setState('expense-customer-list', [])
    this.setState('expense-search', '')
    this.setState('expense-category-filter', '')
    this.setState('expense-table-config', { limit: 20, offset: 0, sortBy: 'paid_on', orderBy: 'desc' })
    this.setState('selected-expense', null)
    this.setState('expense-drawer-open', false)
    this.setState('deposits', [])
    this.setState('deposit-total', 0)
    this.setState('deposit-form', {
      deposit_date: new Date().toISOString().split('T')[0],
      type: 'contribution',
      amount: '',
      description: '',
      source: '',
      reference_no: ''
    })
    this.setState('create-deposit-modal-open', false)
    this.setState('create-deposit-submitting', false)
    this.setState('edit-deposit-modal-open', false)
    this.setState('editing-deposit', null)
    this.setState('deposit-stats', {})
    this.setState('deposit-table-config', { limit: 20, offset: 0, sortBy: 'deposit_date', orderBy: 'desc' })
    this.setState('deposit-search', '')
    this.setState('deposit-type-filter', '')
    this.setState('deposit-date-from', '')
    this.setState('deposit-date-to', '')
    this.setState('deposit-stat-filter', '')
    this.setState('deposit-stats-collapsed', true)
    this.setState('drawer-deposit-id', null)
    this.setState('show-deposit-drawer', false)
    this.setState('selected-deposit', null)
    this.setState('loans-receivable', { loans: [], total: 0 })
    this.setState('loans-receivable-table-config', { limit: 20, offset: 0, sortBy: 'lent_date', orderBy: 'desc' })
    this.setState('loans-search', '')
    this.setState('loans-status-filter', '')
    this.setState('loan-form', { partner_id: null, partner: null, amount: '', lent_date: new Date().toISOString().split('T')[0], expected_return_date: '', notes: '' })
    this.setState('loan-customer-list', [])
    this.setState('create-loan-modal-open', false)
    this.setState('create-loan-submitting', false)
    this.setState('create-loan-cash-balance', null)
    this.setState('loans-payable', { loans: [], total_outstanding: 0 })
    this.setState('trade-receivables', { orders: [], total_outstanding: 0 })
    this.setState('trade-receivables-table-config', { limit: 20, offset: 0, sortBy: 'order_date', orderBy: 'desc' })
    this.setState('trade-search', '')
    this.setState('trade-payables', { orders: [], total_outstanding: 0 })
    this.setState('trade-payables-table-config', { limit: 20, offset: 0, sortBy: 'order_date', orderBy: 'desc' })
    this.setState('trade-payables-search', '')
    this.setState('loans-payable-table-config', { limit: 20, offset: 0, sortBy: 'borrowed_date', orderBy: 'desc' })
    this.setState('loans-payable-search', '')
    this.setState('loans-payable-status-filter', '')
    this.setState('loan-payable-form', { partner_id: null, partner: null, amount: '', borrowed_date: new Date().toISOString().split('T')[0], expected_repay_date: '', notes: '' })
    this.setState('loan-payable-customer-list', [])
    this.setState('create-loan-payable-modal-open', false)
    this.setState('withhold-payables', { orders: [], total: 0, stats: { total_unsettled: 0, count_unsettled: 0, count_settled: 0 } })
    this.setState('withhold-payables-table-config', { limit: 20, offset: 0, sortBy: 'order_date', orderBy: 'desc' })
    this.setState('withhold-payables-search', '')
    this.setState('withhold-payables-status-filter', 'unsettled')
    this.setState('withhold-payables-date-from', '')
    this.setState('withhold-payables-date-to', '')
    this.setState('withhold-payables-settlement-modal-open', false)
    this.setState('withhold-payables-settlement-submitting', false)
    this.setState('withhold-payables-selected-orders', [])
    this.setState('withhold-receivables', { orders: [], total: 0, stats: { total_unsettled: 0, count_confirmed_unsettled: 0, count_unconfirmed: 0, count_settled: 0 } })
    this.setState('withhold-receivables-table-config', { limit: 20, offset: 0, sortBy: 'order_date', orderBy: 'desc' })
    this.setState('withhold-search', '')
    this.setState('withhold-status-filter', 'confirmed_unsettled')
    this.setState('withhold-date-from', '')
    this.setState('withhold-date-to', '')
    this.setState('withhold-settlement-modal-open', false)
    this.setState('withhold-settlement-submitting', false)
    this.setState('withhold-selected-orders', [])
    this.setState('loading', false)
    this.setState('error', null)
    this.setState('withhold-percentage', null) // Fetched from system_settings when needed
    this.setState('report-type', 'income-statement')
    const today = new Date().toISOString().split('T')[0]
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    this.setState('report-date-from', firstOfMonth)
    this.setState('report-date-to', today)
    this.setState('report-as-of-date', today)
    this.setState('report-data', null)
    this.setState('report-loading', false)
  }

  /**
   * Load withhold percentage from system_settings (via purchase IPC; same setting key).
   * Stores in state for expense form summary.
   */
  async loadWithholdPercentage() {
    try {
      const result = await window.ipcRenderer.invoke('purchase:get-withhold-percentage')
      if (result && result.success && result.withhold_percentage != null) {
        this.updateState('withhold-percentage', Number(result.withhold_percentage))
        return result.withhold_percentage
      }
      const salesResult = await window.ipcRenderer.invoke('sales:get-withhold-percentage')
      if (salesResult && salesResult.success && salesResult.withhold_percentage != null) {
        this.updateState('withhold-percentage', Number(salesResult.withhold_percentage))
        return salesResult.withhold_percentage
      }
      this.updateState('withhold-percentage', null)
    } catch (e) {
      this.updateState('withhold-percentage', null)
    }
    return null
  }

  setActiveTab(tab) {
    this.updateState('active-tab', tab)
    if (tab === 'expense') {
      this.loadExpenses()
      if (this.getState('withhold-percentage') === null) this.loadWithholdPercentage()
      // Load customers when expense tab is selected (token is available); keeps dropdown populated
      this.loadExpenseCustomers('')
    }
    else if (tab === 'deposits') this.loadDeposits()
    else if (tab === 'receivables') this.loadReceivables()
    else if (tab === 'payables') this.loadPayables()
    else if (tab === 'reports') this.loadReport()

    this.updateState('loading', false)
  }

  setReceivablesTab(tab) {
    this.updateState('receivables-tab', tab)
    if (tab === 'trade') this.loadReceivables()
    else if (tab === 'loans') this.loadLoansReceivables()
    else if (tab === 'withhold') this.loadWithholdReceivables()

    this.updateState('loading', false)
  }

  setPayablesTab(tab) {
    this.updateState('payables-tab', tab)
    if (tab === 'trade' || tab === 'loans') this.loadPayables()
    else if (tab === 'withhold') this.loadWithholdPayables()
    this.updateState('loading', false)

    this.updateState('loading', false)
  }

  async loadExpenseCustomers(search = '') {
    try {
      const res = await window.ipcRenderer.invoke('customers:get-customers', {
        search: search || '',
        limit: 100,
        offset: 0
      })

      // IPC returns { success, customers, total } from electron; handle both shapes
      const list = Array.isArray(res?.customers) ? res.customers : (res?.data?.customers || [])
      this.updateState('expense-customer-list', list)
    } catch (e) {
      this.updateState('expense-customer-list', [])
    }
  }


  updateExpenseForm(updates) {
    const form = this.getState('expense-form') || {}
    this.updateState('expense-form', { ...form, ...updates })
    this.updateState('loading', false)
  }

  selectExpenseCustomer(customer) {
    this.updateExpenseForm({
      customer_id: customer?.id ?? null,
      customer: customer ?? null,
      customer_search: customer ? (customer.name || customer.full_name || '') : '',
      show_customer_dropdown: false
    })
  }

  async loadWithholdReceivables(params = {}) {
    this.updateState('loading', true)
    try {
      const config = this.getState('withhold-receivables-table-config') || { limit: 20, offset: 0 }
      const status = params.status ?? this.getState('withhold-status-filter') ?? undefined
      const payload = {
        limit: params.limit ?? config.limit ?? 20,
        offset: params.offset !== undefined ? params.offset : config.offset
      }
      if (status) payload.status = status
      const res = await window.ipcRenderer.invoke('financial:list-withhold-receivables', payload)
      this.updateState('withhold-receivables', {
        orders: res?.orders || [],
        total: res?.total ?? 0,
        stats: res?.stats || { total_unsettled: 0, count_confirmed_unsettled: 0, count_unconfirmed: 0, count_settled: 0 }
      })
    } catch (e) {
      this.updateState('error', e.message)
    } finally {
      this.updateState('loading', false)
    }
  }

  setWithholdSearch(value) {
    this.updateState('withhold-search', value ?? '')
  }

  setWithholdDateFrom(value) {
    this.updateState('withhold-date-from', value ?? '')
  }

  setWithholdDateTo(value) {
    this.updateState('withhold-date-to', value ?? '')
  }

  setWithholdStatusFilter(status) {
    this.updateState('withhold-status-filter', status ?? '')
    const config = this.getState('withhold-receivables-table-config') || { limit: 20, offset: 0 }
    this.updateState('withhold-receivables-table-config', { ...config, offset: 0 })
    this.loadWithholdReceivables({ status: status || undefined, limit: config.limit, offset: 0 })
  }

  updateWithholdTableConfig(updates) {
    const config = this.getState('withhold-receivables-table-config') || { limit: 20, offset: 0 }
    const next = { ...config, ...updates }
    this.updateState('withhold-receivables-table-config', next)
    const status = this.getState('withhold-status-filter') || undefined
    this.loadWithholdReceivables({ limit: next.limit, offset: next.offset, status })
  }

  setWithholdSort(column) {
    const config = this.getState('withhold-receivables-table-config') || {}
    const nextOrderBy = config.sortBy === column ? (config.orderBy === 'asc' ? 'desc' : 'asc') : 'desc'
    this.updateState('withhold-receivables-table-config', { ...config, sortBy: column, orderBy: nextOrderBy })
  }

  setWithholdSelectedOrders(orders) {
    this.updateState('withhold-selected-orders', Array.isArray(orders) ? orders : [])
  }

  toggleWithholdOrderSelection(order) {
    const selected = this.getState('withhold-selected-orders') || []
    const exists = selected.some((o) => o.id === order.id)
    const next = exists ? selected.filter((o) => o.id !== order.id) : [...selected, order]
    this.updateState('withhold-selected-orders', next)
  }

  async createWithholdReceivableSettlement(data) {
    const res = await window.ipcRenderer.invoke('financial:create-withhold-receivable-settlement', data)
    if (res?.success) {
      this.updateState('withhold-settlement-modal-open', false)
      this.updateState('withhold-selected-orders', [])
      await this.loadWithholdReceivables()
      return res
    }
    throw new Error(res?.error || res?.message || 'Failed to settle withhold')
  }

  async loadLoansReceivables(params = {}) {
    this.updateState('loading', true)
    try {
      const config = this.getState('loans-receivable-table-config') || { limit: 20, offset: 0 }
      const status = (params.status ?? this.getState('loans-status-filter')) || undefined
      const payload = {
        limit: params.limit ?? config.limit ?? 20,
        offset: params.offset !== undefined ? params.offset : config.offset
      }
      if (status) payload.status = status
      const res = await window.ipcRenderer.invoke('financial:list-cash-loans-receivable', payload)
      const loans = res?.loans || []
      const totalOutstanding = loans.reduce((s, l) => s + Math.max(0, Number(l.amount || 0) - Number(l.returned_amount || 0)), 0)
      this.updateState('loans-receivable', { loans, total: res?.total ?? loans.length, total_outstanding: totalOutstanding })
    } catch (e) {
      this.updateState('error', e.message)
    } finally {
      this.updateState('loading', false)
    }
  }

  setLoansSearch(value) {
    this.updateState('loans-search', value ?? '')
  }

  setLoansStatusFilter(status) {
    this.updateState('loans-status-filter', status ?? '')
    const config = this.getState('loans-receivable-table-config') || { limit: 20, offset: 0 }
    this.updateState('loans-receivable-table-config', { ...config, offset: 0 })
    this.loadLoansReceivables({ status: status || undefined, limit: config.limit, offset: 0 })
  }

  updateLoansTableConfig(updates) {
    const config = this.getState('loans-receivable-table-config') || { limit: 20, offset: 0 }
    const next = { ...config, ...updates }
    this.updateState('loans-receivable-table-config', next)
    const status = this.getState('loans-status-filter') || undefined
    this.loadLoansReceivables({ limit: next.limit, offset: next.offset, status })
  }

  setLoansSort(column) {
    const config = this.getState('loans-receivable-table-config') || {}
    const nextOrderBy = config.sortBy === column ? (config.orderBy === 'asc' ? 'desc' : 'asc') : 'desc'
    this.updateState('loans-receivable-table-config', { ...config, sortBy: column, orderBy: nextOrderBy })
  }

  async loadLoanCustomers(search = '') {
    try {
      const res = await window.ipcRenderer.invoke('customers:get-customers', {
        search: search || '',
        limit: 100,
        offset: 0
      })
      const list = Array.isArray(res?.customers) ? res.customers : (res?.data?.customers || [])
      this.updateState('loan-customer-list', list)
    } catch (e) {
      this.updateState('loan-customer-list', [])
    }
  }

  updateLoanForm(updates) {
    const form = this.getState('loan-form') || {}
    this.updateState('loan-form', { ...form, ...updates })
  }

  selectLoanPartner(partner) {
    this.updateLoanForm({
      partner_id: partner?.id ?? null,
      partner: partner ?? null,
      partner_search: partner ? (partner.name || partner.full_name || '') : ''
    })
  }

  resetLoanForm() {
    this.updateState('loan-form', {
      partner_id: null,
      partner: null,
      partner_search: '',
      amount: '',
      lent_date: new Date().toISOString().split('T')[0],
      expected_return_date: '',
      notes: '',
      show_partner_dropdown: false
    })
  }

  async recordCashLoanReceivableReturn(loanId, data) {
    const res = await window.ipcRenderer.invoke('financial:record-cash-loan-receivable-return', loanId, {
      amount: data.amount,
      return_date: data.return_date || new Date().toISOString().split('T')[0]
    })
    if (res?.success) {
      await this.loadLoansReceivables()
      return res
    }
    throw new Error(res?.error || 'Failed to record return')
  }

  async loadExpenses(params = {}) {
    this.updateState('loading', true)
    try {
      const config = this.getState('expense-table-config') || { limit: 20, offset: 0 }
      const category = (params.category ?? this.getState('expense-category-filter')) || null
      const payload = {
        limit: params.limit ?? config.limit ?? 20,
        offset: params.offset !== undefined ? params.offset : config.offset
      }
      if (category) payload.category = category
      const res = await window.ipcRenderer.invoke('financial:list-expenses', payload)
      this.updateState('expenses', res?.expenses || [])
      this.updateState('expense-total', res?.total ?? 0)
    } catch (e) {
      this.updateState('error', e.message)
    } finally {
      this.updateState('loading', false)
    }
  }

  setExpenseSearch(value) {
    this.updateState('expense-search', value ?? '')
  }

  setExpenseCategoryFilter(category) {
    this.updateState('expense-category-filter', category ?? '')
    const config = this.getState('expense-table-config') || { limit: 20, offset: 0 }
    this.updateState('expense-table-config', { ...config, offset: 0 })
    this.loadExpenses({ category: category || null, limit: config.limit, offset: 0 })
  }

  updateExpenseTableConfig(updates) {
    const config = this.getState('expense-table-config') || { limit: 20, offset: 0, sortBy: 'paid_on', orderBy: 'desc' }
    const next = { ...config, ...updates }
    this.updateState('expense-table-config', next)
    const category = this.getState('expense-category-filter') || null
    this.loadExpenses({ limit: next.limit, offset: next.offset, category: category || null })
  }

  setExpenseSort(column) {
    const config = this.getState('expense-table-config') || { limit: 20, offset: 0, sortBy: 'paid_on', orderBy: 'desc' }
    const nextOrderBy = config.sortBy === column ? (config.orderBy === 'asc' ? 'desc' : 'asc') : 'desc'
    this.updateState('expense-table-config', { ...config, sortBy: column, orderBy: nextOrderBy })
  }

  openExpenseDrawer(expense) {
    this.updateState('selected-expense', expense)
    this.updateState('expense-drawer-open', true)
  }

  closeExpenseDrawer() {
    this.updateState('expense-drawer-open', false)
    this.updateState('selected-expense', null)
  }

  async loadDeposits() {
    this.updateState('loading', true)
    try {
      const config = this.getState('deposit-table-config') || { limit: 50, offset: 0 }
      const typeFilter = this.getState('deposit-type-filter') || undefined
      const dateFrom = this.getState('deposit-date-from') || undefined
      const dateTo = this.getState('deposit-date-to') || undefined
      const listParams = { limit: config.limit ?? 50, offset: config.offset ?? 0 }
      if (dateFrom) listParams.date_from = dateFrom
      if (dateTo) listParams.date_to = dateTo
      if (typeFilter) listParams.type = typeFilter
      const statsParams = {}
      if (dateFrom) statsParams.date_from = dateFrom
      if (dateTo) statsParams.date_to = dateTo
      const [listRes, statsRes] = await Promise.all([
        window.ipcRenderer.invoke('financial:list-deposits', listParams),
        window.ipcRenderer.invoke('financial:get-deposit-stats', statsParams)
      ])
      this.updateState('deposits', listRes?.deposits || [])
      this.updateState('deposit-total', listRes?.total ?? 0)
      this.updateState('deposit-stats', statsRes?.stats || {})
    } catch (e) {
      this.updateState('error', e.message)
    } finally {
      this.updateState('loading', false)
    }
  }

  setDepositSearch(value) {
    this.updateState('deposit-search', value ?? '')
  }

  setDepositTypeFilter(type) {
    this.updateState('deposit-type-filter', type ?? '')
    const config = this.getState('deposit-table-config') || { limit: 20, offset: 0 }
    this.updateState('deposit-table-config', { ...config, offset: 0 })
    this.loadDeposits()
  }

  setDepositDateFrom(value) {
    this.updateState('deposit-date-from', value ?? '')
    const config = this.getState('deposit-table-config') || { limit: 20, offset: 0 }
    this.updateState('deposit-table-config', { ...config, offset: 0 })
    this.loadDeposits()
  }

  setDepositDateTo(value) {
    this.updateState('deposit-date-to', value ?? '')
    const config = this.getState('deposit-table-config') || { limit: 20, offset: 0 }
    this.updateState('deposit-table-config', { ...config, offset: 0 })
    this.loadDeposits()
  }

  toggleDepositStatsCollapsed() {
    const current = this.getState('deposit-stats-collapsed')
    this.updateState('deposit-stats-collapsed', !current)
  }

  updateDepositTableConfig(updates) {
    const config = this.getState('deposit-table-config') || { limit: 20, offset: 0 }
    const next = { ...config, ...updates }
    this.updateState('deposit-table-config', next)
    this.loadDeposits()
  }

  setDepositSort(column) {
    const config = this.getState('deposit-table-config') || {}
    const nextOrderBy = config.sortBy === column ? (config.orderBy === 'asc' ? 'desc' : 'asc') : 'desc'
    this.updateState('deposit-table-config', { ...config, sortBy: column, orderBy: nextOrderBy })
  }

  openDepositDrawer(deposit) {
    this.updateState('selected-deposit', deposit)
    this.updateState('drawer-deposit-id', deposit?.id ?? null)
    requestAnimationFrame(() => this.updateState('show-deposit-drawer', true))
  }

  closeDepositDrawer() {
    this.updateState('show-deposit-drawer', false)
    setTimeout(() => {
      this.updateState('drawer-deposit-id', null)
      this.updateState('selected-deposit', null)
    }, 350)
  }

  async loadReceivables() {
    this.updateState('loading', true)
    try {
      const [tradeRes, loansRes] = await Promise.all([
        window.ipcRenderer.invoke('financial:get-trade-receivables'),
        window.ipcRenderer.invoke('financial:list-cash-loans-receivable', { limit: 100 })
      ])
      this.updateState('trade-receivables', { orders: tradeRes?.orders || [], total_outstanding: tradeRes?.total_outstanding ?? 0 })
      const loans = loansRes?.loans || []
      const loansTotalOutstanding = loans.reduce((s, l) => s + Math.max(0, Number(l.amount || 0) - Number(l.returned_amount || 0)), 0)
      this.updateState('loans-receivable', { loans, total: loansRes?.total ?? loans.length, total_outstanding: loansTotalOutstanding })
    } catch (e) {
      this.updateState('error', e.message)
    } finally {
      this.updateState('loading', false)
    }
  }

  setTradeSearch(value) {
    this.updateState('trade-search', value ?? '')
  }

  updateTradeTableConfig(updates) {
    const config = this.getState('trade-receivables-table-config') || { limit: 20, offset: 0 }
    const next = { ...config, ...updates }
    this.updateState('trade-receivables-table-config', next)
  }

  setTradeSort(column) {
    const config = this.getState('trade-receivables-table-config') || {}
    const nextOrderBy = config.sortBy === column ? (config.orderBy === 'asc' ? 'desc' : 'asc') : 'desc'
    this.updateState('trade-receivables-table-config', { ...config, sortBy: column, orderBy: nextOrderBy })
  }

  async loadWithholdPayables(params = {}) {
    this.updateState('loading', true)
    try {
      const config = this.getState('withhold-payables-table-config') || { limit: 20, offset: 0 }
      const status = params.status ?? this.getState('withhold-payables-status-filter') ?? undefined
      const payload = {
        limit: params.limit ?? config.limit ?? 20,
        offset: params.offset !== undefined ? params.offset : config.offset
      }
      if (status) payload.status = status
      const res = await window.ipcRenderer.invoke('financial:list-withhold-payables', payload)
      this.updateState('withhold-payables', {
        orders: res?.orders || [],
        total: res?.total ?? 0,
        stats: res?.stats || { total_unsettled: 0, count_unsettled: 0, count_settled: 0 }
      })
    } catch (e) {
      this.updateState('error', e.message)
    } finally {
      this.updateState('loading', false)
    }
  }

  setWithholdPayablesSearch(value) {
    this.updateState('withhold-payables-search', value ?? '')
  }

  setWithholdPayablesStatusFilter(status) {
    this.updateState('withhold-payables-status-filter', status ?? '')
    const config = this.getState('withhold-payables-table-config') || { limit: 20, offset: 0 }
    this.updateState('withhold-payables-table-config', { ...config, offset: 0 })
    this.loadWithholdPayables({ status: status || undefined, limit: config.limit, offset: 0 })
  }

  setWithholdPayablesDateFrom(value) {
    this.updateState('withhold-payables-date-from', value ?? '')
  }

  setWithholdPayablesDateTo(value) {
    this.updateState('withhold-payables-date-to', value ?? '')
  }

  updateWithholdPayablesTableConfig(updates) {
    const config = this.getState('withhold-payables-table-config') || { limit: 20, offset: 0 }
    const next = { ...config, ...updates }
    this.updateState('withhold-payables-table-config', next)
    const status = this.getState('withhold-payables-status-filter') || undefined
    this.loadWithholdPayables({ limit: next.limit, offset: next.offset, status })
  }

  setWithholdPayablesSort(column) {
    const config = this.getState('withhold-payables-table-config') || {}
    const nextOrderBy = config.sortBy === column ? (config.orderBy === 'asc' ? 'desc' : 'asc') : 'desc'
    this.updateState('withhold-payables-table-config', { ...config, sortBy: column, orderBy: nextOrderBy })
  }

  setWithholdPayablesSelectedOrders(orders) {
    this.updateState('withhold-payables-selected-orders', Array.isArray(orders) ? orders : [])
  }

  toggleWithholdPayablesOrderSelection(order) {
    const selected = this.getState('withhold-payables-selected-orders') || []
    const exists = selected.some((o) => o.id === order.id)
    const next = exists ? selected.filter((o) => o.id !== order.id) : [...selected, order]
    this.updateState('withhold-payables-selected-orders', next)
  }

  async createWithholdPayableSettlement(data) {
    const res = await window.ipcRenderer.invoke('financial:create-withhold-payable-settlement', data)
    if (res?.success) {
      this.updateState('withhold-payables-settlement-modal-open', false)
      this.updateState('withhold-payables-selected-orders', [])
      await this.loadWithholdPayables()
      return res
    }
    throw new Error(res?.error || res?.message || 'Failed to settle withhold')
  }

  setTradePayablesSearch(value) {
    this.updateState('trade-payables-search', value ?? '')
  }

  updateTradePayablesTableConfig(updates) {
    const config = this.getState('trade-payables-table-config') || { limit: 20, offset: 0 }
    const next = { ...config, ...updates }
    this.updateState('trade-payables-table-config', next)
  }

  setTradePayablesSort(column) {
    const config = this.getState('trade-payables-table-config') || {}
    const nextOrderBy = config.sortBy === column ? (config.orderBy === 'asc' ? 'desc' : 'asc') : 'desc'
    this.updateState('trade-payables-table-config', { ...config, sortBy: column, orderBy: nextOrderBy })
  }

  setLoansPayableSearch(value) {
    this.updateState('loans-payable-search', value ?? '')
  }

  setLoansPayableStatusFilter(status) {
    this.updateState('loans-payable-status-filter', status ?? '')
    const config = this.getState('loans-payable-table-config') || { limit: 20, offset: 0 }
    this.updateState('loans-payable-table-config', { ...config, offset: 0 })
    this.loadPayables({ loansStatus: status || undefined })
  }

  updateLoansPayableTableConfig(updates) {
    const config = this.getState('loans-payable-table-config') || { limit: 20, offset: 0 }
    const next = { ...config, ...updates }
    this.updateState('loans-payable-table-config', next)
    this.loadPayables()
  }

  setLoansPayableSort(column) {
    const config = this.getState('loans-payable-table-config') || {}
    const nextOrderBy = config.sortBy === column ? (config.orderBy === 'asc' ? 'desc' : 'asc') : 'desc'
    this.updateState('loans-payable-table-config', { ...config, sortBy: column, orderBy: nextOrderBy })
  }

  async loadPayables(params = {}) {
    this.updateState('loading', true)
    try {
      const loansConfig = this.getState('loans-payable-table-config') || { limit: 100, offset: 0 }
      const loansStatus = params.loansStatus ?? this.getState('loans-payable-status-filter') ?? undefined
      const loansPayload = { limit: loansConfig.limit ?? 100, offset: loansConfig.offset ?? 0 }
      if (loansStatus) loansPayload.status = loansStatus
      const [tradeRes, loansRes] = await Promise.all([
        window.ipcRenderer.invoke('financial:get-trade-payables'),
        window.ipcRenderer.invoke('financial:list-cash-loans-payable', loansPayload)
      ])
      this.updateState('trade-payables', { orders: tradeRes?.orders || [], total_outstanding: tradeRes?.total_outstanding ?? 0 })
      this.updateState('loans-payable', { loans: loansRes?.loans || [], total: loansRes?.total ?? 0 })
    } catch (e) {
      this.updateState('error', e.message)
    } finally {
      this.updateState('loading', false)
    }
  }

  async createExpense(data) {
    const res = await window.ipcRenderer.invoke('financial:create-expense', data)
    if (res?.success) {
      await this.loadExpenses()
      return res
    }
    throw new Error(res?.error || 'Failed to create expense')
  }

  async createDeposit(data) {
    const res = await window.ipcRenderer.invoke('financial:create-deposit', data)
    if (res?.success) {
      await this.loadDeposits()
      return res
    }
    throw new Error(res?.error || 'Failed to create deposit')
  }

  async updateDeposit(id, data) {
    const res = await window.ipcRenderer.invoke('financial:update-deposit', id, data)
    if (res?.deposit) {
      await this.loadDeposits()
      return res
    }
    throw new Error(res?.error || 'Failed to update deposit')
  }

  async reverseDeposit(id) {
    const res = await window.ipcRenderer.invoke('financial:reverse-deposit', id)
    if (res?.deposit) {
      await this.loadDeposits()
      return res
    }
    throw new Error(res?.error || 'Failed to reverse deposit')
  }

  async createCashLoanReceivable(data) {
    const res = await window.ipcRenderer.invoke('financial:create-cash-loan-receivable', data)
    if (res?.success) {
      await this.loadLoansReceivables()
      return res
    }
    throw new Error(res?.error || 'Failed to create loan')
  }

  async createCashLoanPayable(data) {
    const res = await window.ipcRenderer.invoke('financial:create-cash-loan-payable', data)
    if (res?.success) {
      await this.loadPayables()
      return res
    }
    throw new Error(res?.error || 'Failed to create loan')
  }

  async loadLoanPayablePartners(search = '') {
    try {
      const res = await window.ipcRenderer.invoke('customers:get-customers', { search: search || '', limit: 100, offset: 0 })
      const list = Array.isArray(res?.customers) ? res.customers : (res?.data?.customers || [])
      this.updateState('loan-payable-customer-list', list)
    } catch {
      this.updateState('loan-payable-customer-list', [])
    }
  }

  updateLoanPayableForm(updates) {
    const form = this.getState('loan-payable-form') || {}
    this.updateState('loan-payable-form', { ...form, ...updates })
  }

  selectLoanPayablePartner(partner) {
    this.updateLoanPayableForm({ partner_id: partner?.id ?? null, partner: partner ?? null, partner_search: partner ? (partner.name || partner.full_name || '') : '', show_partner_dropdown: false })
  }

  resetLoanPayableForm() {
    this.updateState('loan-payable-form', { partner_id: null, partner: null, partner_search: '', amount: '', borrowed_date: new Date().toISOString().split('T')[0], expected_repay_date: '', notes: '', show_partner_dropdown: false })
  }

  async recordCashLoanPayableRepayment(loanId, data) {
    const res = await window.ipcRenderer.invoke('financial:record-cash-loan-payable-repayment', loanId, {
      amount: data.amount,
      repay_date: data.repay_date || new Date().toISOString().split('T')[0]
    })
    if (res?.success) {
      await this.loadPayables()
      return res
    }
    throw new Error(res?.error || 'Failed to record repayment')
  }

  getActiveTab() {
    return this.getState('active-tab') || 'expense'
  }

  setReportType(type) {
    this.updateState('report-type', type || 'income-statement')
  }

  setReportDateFrom(value) {
    this.updateState('report-date-from', value ?? '')
  }

  setReportDateTo(value) {
    this.updateState('report-date-to', value ?? '')
  }

  setReportAsOfDate(value) {
    this.updateState('report-as-of-date', value ?? '')
  }

  async loadReport() {
    const type = this.getState('report-type') || 'income-statement'
    const dateFrom = this.getState('report-date-from')
    const dateTo = this.getState('report-date-to')
    const asOfDate = this.getState('report-as-of-date')

    this.updateState('report-loading', true)
    this.updateState('report-data', null)
    this.updateState('error', null)

    try {
      if (type === 'balance-sheet') {
        if (!asOfDate) {
          this.updateState('error', 'As of date is required for Balance Sheet.')
          return
        }
        const res = await window.ipcRenderer.invoke('reports:balance-sheet', { as_of_date: asOfDate })
        this.updateState('report-data', res?.report ?? null)
      } else {
        if (!dateFrom || !dateTo) {
          this.updateState('error', 'Date range is required.')
          return
        }
        if (type === 'income-statement') {
          const res = await window.ipcRenderer.invoke('reports:income-statement', { date_from: dateFrom, date_to: dateTo })
          this.updateState('report-data', res?.report ?? null)
        } else if (type === 'cash-flow') {
          const res = await window.ipcRenderer.invoke('reports:cash-flow', { date_from: dateFrom, date_to: dateTo })
          this.updateState('report-data', res?.report ?? null)
        } else if (type === 'equity') {
          const res = await window.ipcRenderer.invoke('reports:equity', { date_from: dateFrom, date_to: dateTo })
          this.updateState('report-data', res?.report ?? null)
        }
      }
    } catch (e) {
      this.updateState('error', e.message || 'Failed to load report.')
    } finally {
      this.updateState('report-loading', false)
    }
  }
}
