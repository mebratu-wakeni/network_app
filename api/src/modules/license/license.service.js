export class LicenseService {
  constructor(repository, settingsRepository) {
    this.repository = repository
    this.settingsRepository = settingsRepository
  }

  getScriptUrl() {
    return process.env.LICENSE_SCRIPT_URL || ''
  }

  normalizeSubscriptionType(value) {
    const t = String(value || '').toLowerCase()
    if (t === 'monthly' || t === 'yearly' || t === 'lifetime') return t
    return null
  }

  isExpired(subscriptionType, expiresAt) {
    if (subscriptionType === 'lifetime') return false
    if (!expiresAt) return true
    const today = new Date().toISOString().slice(0, 10)
    return String(expiresAt).slice(0, 10) < today
  }

  buildLocalStatus(row, expectedFingerprint = null) {
    if (!row) return { valid: false, reason: 'no_license', license: null }
    const subscriptionType = this.normalizeSubscriptionType(row.subscription_type)
    if (!subscriptionType) return { valid: false, reason: 'invalid_subscription_type', license: row }
    if (row.status !== 'active') return { valid: false, reason: 'inactive', license: row }
    if (!row.device_fingerprint) return { valid: false, reason: 'missing_fingerprint', license: row }
    if (expectedFingerprint && row.device_fingerprint !== expectedFingerprint) {
      return { valid: false, reason: 'fingerprint_mismatch', license: row }
    }
    if (this.isExpired(subscriptionType, row.expires_at)) {
      return { valid: false, reason: 'expired', license: row }
    }
    return { valid: true, reason: 'ok', license: row }
  }

  async getLocalStatus(expectedFingerprint = null) {
    const row = await this.repository.getLatestActive()
    const status = this.buildLocalStatus(row, expectedFingerprint)
    if (status.valid && row?.id) {
      await this.repository.touchValidation(row.id)
    }
    return status
  }

  parseScriptResponse(scriptResponse) {
    const status = String(scriptResponse?.status || '').toLowerCase()
    if (status !== 'success') {
      const err = new Error(scriptResponse?.message || 'License activation failed')
      err.status = 400
      err.code = scriptResponse?.code || 'license_activation_failed'
      throw err
    }

    const data = scriptResponse?.data || {}
    const subscriptionType = this.normalizeSubscriptionType(data.licenseType)
    if (!subscriptionType) {
      const err = new Error('Invalid subscription type from license server')
      err.status = 502
      throw err
    }

    return {
      licenseKey: String(data.licenseKey || ''),
      subscriptionType,
      status: String(data.status || 'active').toLowerCase(),
      startDate: data.startDate ? String(data.startDate).slice(0, 10) : null,
      endDate: data.endDate ? String(data.endDate).slice(0, 10) : null,
      companyName: String(data.companyName || ''),
      companyPhone: String(data.companyPhone || ''),
      companyEmail: String(data.companyEmail || ''),
      companyTin: String(data.companyTin || ''),
      machineFingerprint: String(data.machineFingerprint || ''),
      activatedAt: data.activatedAt || null,
      code: scriptResponse?.code || 'ACTIVATED_OR_REVALIDATED'
    }
  }

  async activate(payload) {
    const scriptUrl = this.getScriptUrl()
    if (!scriptUrl) {
      const err = new Error('LICENSE_SCRIPT_URL is not configured')
      err.status = 500
      throw err
    }

    const installationSecret = process.env.LICENSE_INSTALLATION_SECRET
    if (installationSecret) {
      if (!payload.installation_key || payload.installation_key !== installationSecret) {
        const err = new Error('Invalid installation key')
        err.status = 401
        throw err
      }
    }

    const requestBody = {
      action: 'activate',
      licenseKey: payload.license_key,
      machineFingerprint: payload.device_fingerprint,
      companyName: payload.company_name,
      companyPhone: payload.company_phone,
      companyEmail: payload.company_email || '',
      companyTin: payload.company_tin || '',
      installationKey: payload.installation_key || ''
    }

    // Apps Script does not support OPTIONS; Content-Type: application/json triggers
    // a CORS preflight which fails. Use text/plain to skip preflight.
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000)
    const fetchOptions = {
      method: 'POST',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        'User-Agent': 'PharmaSuitLAN/1.0 (License Activation)'
      },
      body: JSON.stringify(requestBody)
    }
    let response
    try {
      response = await fetch(scriptUrl, fetchOptions)
    } catch (err) {
      clearTimeout(timeoutId)
      const msg = err?.message || String(err)
      if (msg.includes('abort') || err?.name === 'AbortError') {
        throw new Error('License server request timed out. Check internet connection and retry.')
      }
      throw new Error(`License server unreachable: ${msg}. Check internet and Google Script URL.`)
    }
    clearTimeout(timeoutId)

    let json
    try {
      json = await response.json()
    } catch (e) {
      const err = new Error('License server returned invalid JSON')
      err.status = 502
      throw err
    }

    if (!response.ok) {
      const err = new Error(json?.message || `License server HTTP ${response.status}`)
      err.status = 502
      throw err
    }

    const parsed = this.parseScriptResponse(json)
    const normalizedStatus = parsed.status === 'active' ? 'active' : 'inactive'

    const saved = await this.repository.knex.transaction(async (trx) => {
      await this.repository.deactivateAll(trx)
      return this.repository.createActive({
        license_key: parsed.licenseKey || payload.license_key,
        subscription_type: parsed.subscriptionType,
        status: normalizedStatus,
        company_name: parsed.companyName || payload.company_name,
        company_phone: parsed.companyPhone || payload.company_phone,
        company_email: parsed.companyEmail || payload.company_email || null,
        company_tin: parsed.companyTin || payload.company_tin || null,
        device_fingerprint: parsed.machineFingerprint || payload.device_fingerprint,
        activated_at: parsed.activatedAt || trx.fn.now(),
        expires_at: parsed.subscriptionType === 'lifetime' ? null : (parsed.endDate || null),
        last_validated_at: trx.fn.now(),
        metadata_json: JSON.stringify({
          provider_code: parsed.code,
          provider_payload: json?.data || null
        })
      }, trx)
    })

    // Save company name and contact phone to system settings for use in receipts, etc.
    if (this.settingsRepository) {
      const companyName = parsed.companyName || payload.company_name || ''
      const companyPhone = parsed.companyPhone || payload.company_phone || ''
      if (companyName || companyPhone) {
        await this.settingsRepository.setMany({
          company_name: companyName,
          company_phone: companyPhone
        })
      }
    }

    return {
      ok: true,
      activated: true,
      license: saved
    }
  }
}

