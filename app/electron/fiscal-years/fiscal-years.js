import { getApiUrl } from '../config/apiConfig.js'
import { apiFetch } from '../config/apiFetch.js'

/**
 * FiscalYearsManager - API communication for fiscal years
 */
class FiscalYearsManager {
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

  async create({ fiscal_year, start_date, end_date }, token) {
    return this.apiRequest('/fiscal-years', {
      method: 'POST',
      body: JSON.stringify({ fiscal_year, start_date, end_date })
    }, token)
  }

  async list(token) {
    return this.apiRequest('/fiscal-years', { method: 'GET' }, token)
  }

  async getCurrent(token) {
    const url = getApiUrl('/fiscal-years/current')
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const response = await apiFetch(url, { method: 'GET', headers })
    let data
    try {
      data = await response.json()
    } catch (e) {
      const text = await response.text()
      throw new Error(`Invalid JSON: ${text}`)
    }

    if (response.status === 404) {
      return { success: true, fiscal_year: null }
    }

    if (!response.ok) {
      const err = new Error(data.error || data.message || `HTTP ${response.status}`)
      if (data.details) err.details = data.details
      throw err
    }

    return data
  }

  async closeYear(year, token) {
    return this.apiRequest(`/fiscal-years/${year}/close`, {
      method: 'POST'
    }, token)
  }

  async reopenYear(year, token) {
    return this.apiRequest(`/fiscal-years/${year}/reopen`, {
      method: 'POST'
    }, token)
  }

  async deleteYear(year, force = false, token) {
    const url = force ? `/fiscal-years/${year}?force=true` : `/fiscal-years/${year}`
    return this.apiRequest(url, { method: 'DELETE' }, token)
  }

  async getReport(year, token) {
    return this.apiRequest(`/fiscal-years/${year}/report`, { method: 'GET' }, token)
  }
}

export default new FiscalYearsManager()
