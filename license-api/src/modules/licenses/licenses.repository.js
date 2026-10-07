export class LicensesRepository {
  constructor(knex) {
    this.knex = knex
  }

  async list({ search = '', status = '' } = {}) {
    let q = this.knex('licenses')
      .select(
        'licenses.*',
        this.knex.raw(`(
          SELECT COUNT(*) FROM license_activations
          WHERE license_id = licenses.id AND is_active = 1
        ) as active_devices`)
      )
      .orderBy('created_at', 'desc')

    if (status) q = q.where('licenses.status', status)
    if (search) {
      q = q.where((b) =>
        b.whereILike('customer_name', `%${search}%`)
          .orWhereILike('license_key', `%${search}%`)
          .orWhereILike('email', `%${search}%`)
      )
    }
    return q
  }

  async getById(id) {
    const license = await this.knex('licenses').where({ id }).first()
    if (!license) return null
    const activations = await this.knex('license_activations')
      .where({ license_id: id })
      .orderBy('activated_at', 'desc')
    return { ...license, activations }
  }

  async getByKey(license_key) {
    return this.knex('licenses').where({ license_key }).first()
  }

  async create({ license_key, customer_name, email, subscription_type, start_date, expires_at, notes, created_by }) {
    const [row] = await this.knex('licenses')
      .insert({ license_key, customer_name, email, subscription_type, start_date, expires_at, notes, created_by, status: 'active' })
      .returning('*')
    return row
  }

  async updateStatus(id, status) {
    const [row] = await this.knex('licenses')
      .where({ id })
      .update({ status, last_updated: this.knex.fn.now() })
      .returning('*')
    return row
  }

  // ── Activation helpers ──────────────────────────────────────────────────────

  async findActivation(license_id, device_fingerprint) {
    return this.knex('license_activations')
      .where({ license_id, device_fingerprint })
      .first()
  }

  /** Returns the one active (is_active=true) activation for this license, if any */
  async findCurrentActivation(license_id) {
    return this.knex('license_activations')
      .where({ license_id, is_active: true })
      .orderBy('activated_at', 'desc')
      .first()
  }

  async createActivation({ license_id, device_fingerprint, device_name, company_name, company_phone }) {
    const [row] = await this.knex('license_activations')
      .insert({
        license_id,
        device_fingerprint,
        device_name: device_name || null,
        company_name: company_name || null,
        company_phone: company_phone || null,
        is_active: true,
        activated_at: this.knex.fn.now(),
        last_seen_at: this.knex.fn.now()
      })
      .returning('*')
    return row
  }

  async touchActivation(id) {
    return this.knex('license_activations')
      .where({ id })
      .update({ last_seen_at: this.knex.fn.now() })
  }

  /** Deactivate ALL existing activations for a license (called when admin resets) */
  async deactivateAll(license_id) {
    return this.knex('license_activations')
      .where({ license_id })
      .update({ is_active: false })
  }

  /** Reactivate a known fingerprint after a reset */
  async reactivateActivation(id) {
    const [row] = await this.knex('license_activations')
      .where({ id })
      .update({ is_active: true, last_seen_at: this.knex.fn.now() })
      .returning('*')
    return row
  }
}
