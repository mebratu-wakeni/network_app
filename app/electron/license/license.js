import { getApiUrl } from '../config/apiConfig.js'

const LICENSE_REQUEST_TIMEOUT_MS = 15000

class LicenseManager {
  async apiRequest(endpoint, options = {}) {
    const url = getApiUrl(endpoint)
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), options.timeout ?? LICENSE_REQUEST_TIMEOUT_MS)
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body,
      signal: controller.signal
    })
    clearTimeout(timeoutId)

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
      err.code = data?.code || null
      throw err
    }
    return data
  }

  async getStatus(deviceFingerprint = null) {
    const query = deviceFingerprint ? `?device_fingerprint=${encodeURIComponent(deviceFingerprint)}` : ''
    const url = getApiUrl(`/license/status${query}`)
    console.log('[license] getStatus url=', url)
    try {
      const data = await this.apiRequest(`/license/status${query}`, { method: 'GET' })
      console.log('[license] getStatus ok=', data?.ok, 'valid=', data?.valid)
      return {
        success: !!data?.ok,
        valid: !!data?.valid,
        reason: data?.reason || null,
        license: data?.license || null
      }
    } catch (error) {
      console.log('[license] getStatus error=', error.message)
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
        code: error.code || null,
        details: error.details || null
      }
    }
  }
}

export default LicenseManager

