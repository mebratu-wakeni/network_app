/** Generates PHRM-XXXX-XXXX-XXXX (uppercase alphanumeric) */
function generateLicenseKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `PHRM-${seg()}-${seg()}-${seg()}`
}

/**
 * Calculate expires_at from start_date + subscription_type.
 * Returns null for lifetime.
 */
function calcExpiresAt(startDate, subscriptionType) {
  if (subscriptionType === 'lifetime') return null
  const d = new Date(startDate)
  if (subscriptionType === 'monthly') d.setMonth(d.getMonth() + 1)
  if (subscriptionType === 'yearly')  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

function isExpired(expiresAt) {
  if (!expiresAt) return false
  const today = new Date().toISOString().slice(0, 10)
  return expiresAt < today
}

export class LicensesService {
  constructor(repository) {
    this.repository = repository
  }

  // ── Admin operations ────────────────────────────────────────────────────────

  async list(params) {
    return this.repository.list(params)
  }

  async getById(id) {
    const license = await this.repository.getById(id)
    if (!license) {
      const err = new Error('License not found.')
      err.status = 404
      throw err
    }
    return license
  }

  async create({ customer_name, email, subscription_type, start_date, notes }, adminId) {
    if (!customer_name?.trim()) {
      const err = new Error('customer_name is required.')
      err.status = 400
      throw err
    }

    const validTypes = ['monthly', 'yearly', 'lifetime']
    if (!validTypes.includes(subscription_type)) {
      const err = new Error('subscription_type must be monthly, yearly, or lifetime.')
      err.status = 400
      throw err
    }

    // Default start_date to today if not provided
    const resolvedStart = start_date || new Date().toISOString().slice(0, 10)
    const expires_at = calcExpiresAt(resolvedStart, subscription_type)

    // Generate a unique key (retry on collision, extremely unlikely)
    let license_key, attempts = 0
    do {
      license_key = generateLicenseKey()
      const existing = await this.repository.getByKey(license_key)
      if (!existing) break
    } while (++attempts < 5)

    return this.repository.create({
      license_key,
      customer_name: customer_name.trim(),
      email: email?.trim() || null,
      subscription_type,
      start_date: resolvedStart,
      expires_at,
      notes: notes?.trim() || null,
      created_by: adminId || null
    })
  }

  async revoke(id) {
    const lic = await this.repository.getById(id)
    if (!lic) {
      const err = new Error('License not found.')
      err.status = 404
      throw err
    }
    if (lic.status === 'revoked') {
      const err = new Error('License is already revoked.')
      err.status = 400
      throw err
    }
    return this.repository.updateStatus(id, 'revoked')
  }

  async reactivate(id) {
    const lic = await this.repository.getById(id)
    if (!lic) {
      const err = new Error('License not found.')
      err.status = 404
      throw err
    }
    if (lic.status === 'active') {
      const err = new Error('License is already active.')
      err.status = 400
      throw err
    }
    return this.repository.updateStatus(id, 'active')
  }

  /**
   * Reset activation so the customer can activate on a new machine.
   * Deactivates all existing activations for this license.
   */
  async resetActivation(id) {
    const lic = await this.repository.getById(id)
    if (!lic) {
      const err = new Error('License not found.')
      err.status = 404
      throw err
    }
    await this.repository.deactivateAll(id)
    return { ok: true, message: 'Activation reset. Customer can now activate on a new machine.' }
  }

  // ── Public endpoints (called by products) ──────────────────────────────────

  /**
   * Check whether a license_key + device_fingerprint pair is valid.
   * Returns { ok, valid, reason, license? }
   *
   * Reasons:
   *  ok                        — valid and this device is the active installation
   *  key_ok                    — key valid, no fingerprint supplied (just key check)
   *  not_found                 — key doesn't exist
   *  revoked                   — admin revoked the key
   *  expired                   — subscription has expired
   *  not_activated             — key was never activated
   *  already_activated_elsewhere — activated but on a different machine
   */
  async checkStatus(license_key, device_fingerprint) {
    if (!license_key) {
      return { ok: true, valid: false, reason: 'missing_key' }
    }

    const lic = await this.repository.getByKey(license_key)
    if (!lic) return { ok: true, valid: false, reason: 'not_found' }
    if (lic.status === 'revoked') return { ok: true, valid: false, reason: 'revoked', license: safePublicLicense(lic) }
    if (isExpired(lic.expires_at)) return { ok: true, valid: false, reason: 'expired', license: safePublicLicense(lic) }

    // No fingerprint supplied — just confirm the key is valid
    if (!device_fingerprint) {
      return { ok: true, valid: true, reason: 'key_ok', license: safePublicLicense(lic) }
    }

    // Check if this exact device is the active installation
    const activation = await this.repository.findActivation(lic.id, device_fingerprint)
    if (activation && activation.is_active) {
      await this.repository.touchActivation(activation.id)
      return { ok: true, valid: true, reason: 'ok', license: safePublicLicense(lic) }
    }

    // Check if a different device is currently active
    const currentActivation = await this.repository.findCurrentActivation(lic.id)
    if (currentActivation) {
      return { ok: true, valid: false, reason: 'already_activated_elsewhere', license: safePublicLicense(lic) }
    }

    // Key exists but no device has ever activated it
    return { ok: true, valid: false, reason: 'not_activated', license: safePublicLicense(lic) }
  }

  /**
   * Activate a license key on a server installation.
   * Each license can only be active on ONE machine at a time.
   * If the same fingerprint re-activates → just refresh last_seen_at (re-install on same machine).
   * If a different fingerprint tries to activate while one is active → reject.
   * If no activation exists → create one.
   */
  async activate({ license_key, device_fingerprint, device_name, company_name, company_phone }) {
    if (!license_key || !device_fingerprint) {
      const err = new Error('license_key and device_fingerprint are required.')
      err.status = 400
      throw err
    }

    const lic = await this.repository.getByKey(license_key)
    if (!lic) {
      const err = new Error('License key not found. Check the key and try again.')
      err.status = 404
      err.code = 'not_found'
      throw err
    }
    if (lic.status === 'revoked') {
      const err = new Error('This license has been revoked. Contact your vendor.')
      err.status = 403
      err.code = 'revoked'
      throw err
    }
    if (isExpired(lic.expires_at)) {
      const err = new Error(
        `This license expired on ${lic.expires_at}. Please renew to continue using the software.`
      )
      err.status = 403
      err.code = 'expired'
      throw err
    }

    // Case 1: same fingerprint (re-install on same machine or re-activation)
    const existing = await this.repository.findActivation(lic.id, device_fingerprint)
    if (existing) {
      await this.repository.reactivateActivation(existing.id)
      return { ok: true, activated: true, license: safePublicLicense(lic) }
    }

    // Case 2: a different machine is already active — block
    const currentActivation = await this.repository.findCurrentActivation(lic.id)
    if (currentActivation) {
      const err = new Error(
        'This license is already active on another machine. ' +
        'Contact your vendor to reset the activation if you need to move to a new machine.'
      )
      err.status = 403
      err.code = 'already_activated_elsewhere'
      throw err
    }

    // Case 3: first-time activation
    await this.repository.createActivation({
      license_id: lic.id,
      device_fingerprint,
      device_name,
      company_name,
      company_phone
    })

    return { ok: true, activated: true, license: safePublicLicense(lic) }
  }
}

/** Strip admin-only fields before sending to products */
function safePublicLicense(lic) {
  return {
    license_key: lic.license_key,
    customer_name: lic.customer_name,
    status: lic.status,
    subscription_type: lic.subscription_type,
    start_date: lic.start_date,
    expires_at: lic.expires_at,
    activated_at: lic.created_at
  }
}
