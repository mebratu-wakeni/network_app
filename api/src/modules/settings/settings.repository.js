/**
 * Repository: Data access for system_settings (key-value, per tenant)
 */
export class SettingsRepository {
  constructor(knex) {
    this.knex = knex
  }

  async getByKey(tenantId, key) {
    const row = await this.knex('system_settings')
      .where({ tenant_id: tenantId, setting_key: key })
      .first()
    return row ? row.setting_value : null
  }

  async getAll(tenantId, keys = null) {
    let q = this.knex('system_settings')
      .where({ tenant_id: tenantId })
      .select('setting_key', 'setting_value')
    if (keys && keys.length > 0) {
      q = q.whereIn('setting_key', keys)
    }
    const rows = await q
    const out = {}
    rows.forEach(r => {
      out[r.setting_key] = r.setting_value
    })
    return out
  }

  async set(tenantId, key, value) {
    const val = value == null ? null : String(value)
    const client = this.knex.client.config.client
    if (client === 'pg' || client === 'postgres') {
      await this.knex('system_settings')
        .insert({
          tenant_id: tenantId,
          setting_key: key,
          setting_value: val,
          created_at: this.knex.fn.now(),
          updated_at: this.knex.fn.now()
        })
        .onConflict(['tenant_id', 'setting_key'])
        .merge({
          setting_value: val,
          updated_at: this.knex.fn.now()
        })
    } else {
      const existing = await this.knex('system_settings')
        .where({ tenant_id: tenantId, setting_key: key })
        .first()
      if (existing) {
        await this.knex('system_settings')
          .where({ tenant_id: tenantId, setting_key: key })
          .update({ setting_value: val, updated_at: this.knex.fn.now() })
      } else {
        await this.knex('system_settings').insert({
          tenant_id: tenantId,
          setting_key: key,
          setting_value: val,
          created_at: this.knex.fn.now(),
          updated_at: this.knex.fn.now()
        })
      }
    }
    return val
  }

  async setMany(tenantId, obj) {
    for (const [key, value] of Object.entries(obj)) {
      await this.set(tenantId, key, value)
    }
    return this.getAll(tenantId, Object.keys(obj))
  }
}
