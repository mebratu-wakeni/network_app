import { getApiUrl } from '../config/apiConfig.js'

class LicenseManager {
  async apiRequest(endpoint, options = {}) {
    const url = getApiUrl(endpoint)
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body
    })

    let data = null
    try {
      data = await response.json()
    } catch (e) {
      const text = await response.text()
      throw new Error(`Invalid JSON from license API: ${text}`)
    }

    if (!response.ok) {
      const err = new Error(data?.error || data?.message || `HTTP ${response.status}`)
      err.details = data?.details || null
      throw err
    }
    return data
  }

  async getStatus(deviceFingerprint = null) {
    const query = deviceFingerprint ? `?device_fingerprint=${encodeURIComponent(deviceFingerprint)}` : ''
    try {
      const data = await this.apiRequest(`/license/status${query}`, { method: 'GET' })
      return {
        success: !!data?.ok,
        valid: !!data?.valid,
        reason: data?.reason || null,
        license: data?.license || null
      }
    } catch (error) {
      return { success: false, valid: false, reason: 'api_unavailable', error: error.message }
    }
  }

  async activate(payload) {
    try {
      const data = await this.apiRequest('/license/activate', {
        method: 'POST',
        body: JSON.stringify(payload || {})
      })
      return {
        success: !!data?.ok,
        activated: !!data?.activated,
        license: data?.license || null
      }
    } catch (error) {
      return {
        success: false,
        activated: false,
        error: error.message,
        details: error.details || null
      }
    }
  }
}

export default LicenseManager

