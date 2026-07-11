import { getApiUrl } from '../config/apiConfig.js'
import { apiFetch } from '../config/apiFetch.js'

/**
 * ReportsManager - API communication for financial reports
 */
class ReportsManager {
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

  async getIncomeStatement({ date_from, date_to }, token) {
    const q = new URLSearchParams({ date_from, date_to }).toString()
    return this.apiRequest(`/reports/income-statement?${q}`, { method: 'GET' }, token)
  }

  async getBalanceSheet({ as_of_date }, token) {
    const q = new URLSearchParams({ as_of_date }).toString()
    return this.apiRequest(`/reports/balance-sheet?${q}`, { method: 'GET' }, token)
  }

  async getCashFlow({ date_from, date_to }, token) {
    const q = new URLSearchParams({ date_from, date_to }).toString()
    return this.apiRequest(`/reports/cash-flow?${q}`, { method: 'GET' }, token)
  }

  async getStatementOfChangesInEquity({ date_from, date_to }, token) {
    const q = new URLSearchParams({ date_from, date_to }).toString()
    return this.apiRequest(`/reports/equity?${q}`, { method: 'GET' }, token)
  }
}

export default new ReportsManager()
