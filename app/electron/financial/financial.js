import { getApiUrl } from '../config/apiConfig.js'
import { apiFetch } from '../config/apiFetch.js'

/**
 * FinancialManager - API communication for financial module (expenses, deposits, loans)
 */
class FinancialManager {
  async apiRequest(endpoint, options = {}, token) {
    const url = getApiUrl(endpoint)
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const response = await apiFetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body
    })

    let data
    try {
      data = await response.json()
    } catch (e) {
      const text = await response.text()
      throw new Error(`Invalid JSON: ${text}`)
    }

    if (!response.ok) {
      const err = new Error(data.error || data.message || `HTTP ${response.status}`)
      if (data.details) err.details = data.details
      throw err
    }
    return data
  }

  async createExpense(body, token) {
    return this.apiRequest('/financial/expenses', {
      method: 'POST',
      body: JSON.stringify(body)
    }, token)
  }

  async listExpenses(params, token) {
    const q = new URLSearchParams(params || {}).toString()
    return this.apiRequest(`/financial/expenses?${q}`, { method: 'GET' }, token)
  }

  async getExpenseById(id, token) {
    return this.apiRequest(`/financial/expenses/${id}`, { method: 'GET' }, token)
  }

  async createDeposit(body, token) {
    return this.apiRequest('/financial/deposits', {
      method: 'POST',
      body: JSON.stringify(body)
    }, token)
  }

  async listDeposits(params, token) {
    const q = new URLSearchParams(params || {}).toString()
    return this.apiRequest(`/financial/deposits?${q}`, { method: 'GET' }, token)
  }

  async getDepositStats(params, token) {
    const q = new URLSearchParams(params || {}).toString()
    return this.apiRequest(`/financial/deposits/stats?${q}`, { method: 'GET' }, token)
  }

  async getDepositById(id, token) {
    return this.apiRequest(`/financial/deposits/${id}`, { method: 'GET' }, token)
  }

  async updateDeposit(id, body, token) {
    return this.apiRequest(`/financial/deposits/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    }, token)
  }

  async reverseDeposit(id, token) {
    return this.apiRequest(`/financial/deposits/${id}/reverse`, {
      method: 'POST'
    }, token)
  }

  async createCashLoanReceivable(body, token) {
    return this.apiRequest('/financial/receivables/loans', {
      method: 'POST',
      body: JSON.stringify(body)
    }, token)
  }

  async listCashLoansReceivable(params, token) {
    const q = new URLSearchParams(params || {}).toString()
    return this.apiRequest(`/financial/receivables/loans?${q}`, { method: 'GET' }, token)
  }

  async recordCashLoanReceivableReturn(loanId, body, token) {
    return this.apiRequest(`/financial/receivables/loans/${loanId}/return`, {
      method: 'POST',
      body: JSON.stringify(body)
    }, token)
  }

  async createCashLoanPayable(body, token) {
    return this.apiRequest('/financial/payables/loans', {
      method: 'POST',
      body: JSON.stringify(body)
    }, token)
  }

  async listCashLoansPayable(params, token) {
    const q = new URLSearchParams(params || {}).toString()
    return this.apiRequest(`/financial/payables/loans?${q}`, { method: 'GET' }, token)
  }

  async recordCashLoanPayableRepayment(loanId, body, token) {
    return this.apiRequest(`/financial/payables/loans/${loanId}/repay`, {
      method: 'POST',
      body: JSON.stringify(body)
    }, token)
  }

  async getTradeReceivablesSummary(token) {
    return this.apiRequest('/financial/receivables/trade', { method: 'GET' }, token)
  }

  async getTradePayablesSummary(token) {
    return this.apiRequest('/financial/payables/trade', { method: 'GET' }, token)
  }

  async listWithholdReceivables(params, token) {
    const q = new URLSearchParams(params || {}).toString()
    return this.apiRequest(`/financial/receivables/withhold?${q}`, { method: 'GET' }, token)
  }

  async createWithholdReceivableSettlement(body, token) {
    return this.apiRequest('/financial/receivables/withhold/settle', {
      method: 'POST',
      body: JSON.stringify(body)
    }, token)
  }

  async listWithholdPayables(params, token) {
    const q = new URLSearchParams(params || {}).toString()
    return this.apiRequest(`/financial/payables/withhold?${q}`, { method: 'GET' }, token)
  }

  async createWithholdPayableSettlement(body, token) {
    return this.apiRequest('/financial/payables/withhold/settle', {
      method: 'POST',
      body: JSON.stringify(body)
    }, token)
  }
}

export default new FinancialManager()
