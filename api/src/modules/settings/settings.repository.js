/**
 * Repository: Data access for system_settings (key-value)
 */
export class SettingsRepository {
  constructor(knex) {
    this.knex = knex
  }

  async getByKey(key) {
    const row = await this.knex('system_settings')
      .where({ setting_key: key })
      .first()
    return row ? row.setting_value : null
  }

  async getAll(keys = null) {
    let q = this.knex('system_settings').select('setting_key', 'setting_value')
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

  async set(key, value) {
    const val = value == null ? null : String(value)
    // Upsert by setting_key so we avoid duplicate key (pkey or unique) and race conditions
    const client = this.knex.client.config.client
    if (client === 'pg' || client === 'postgres') {
      await this.knex('system_settings')
        .insert({
          setting_key: key,
          setting_value: val,
          created_at: this.knex.fn.now(),
          updated_at: this.knex.fn.now()
        })
        .onConflict('setting_key')
        .merge({
          setting_value: val,
          updated_at: this.knex.fn.now()
        })
    } else {
      const existing = await this.knex('system_settings').where({ setting_key: key }).first()
      if (existing) {
        await this.knex('system_settings')
          .where({ setting_key: key })
          .update({ setting_value: val, updated_at: this.knex.fn.now() })
      } else {
        await this.knex('system_settings').insert({
          setting_key: key,
          setting_value: val,
          created_at: this.knex.fn.now(),
          updated_at: this.knex.fn.now()
        })
      }
    }
    return val
  }

  async setMany(obj) {
    for (const [key, value] of Object.entries(obj)) {
      await this.set(key, value)
    }
    return this.getAll(Object.keys(obj))
  }
}
