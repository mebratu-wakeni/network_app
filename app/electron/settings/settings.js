import { getApiUrl } from '../config/apiConfig.js'

/**
 * SettingsManager - API calls for system settings (withhold, company info)
 */
class SettingsManager {
  async apiRequest(endpoint, options = {}, token) {
    const url = getApiUrl(endpoint)
    const headers = { 'Content-Type': 'application/json', ...options.headers }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const response = await fetch(url, {
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

  async getSettings(token) {
    const data = await this.apiRequest('/settings', { method: 'GET' }, token)
    return {
      success: data.ok === true,
      settings: data.settings || {}
    }
  }

  async updateSettings(payload, token) {
    const data = await this.apiRequest('/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }, token)
    return {
      success: data.ok === true,
      settings: data.settings || {}
    }
  }
}

export default SettingsManager
