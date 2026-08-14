export class LicenseRepository {
  constructor(knex) {
    this.knex = knex
  }

  async hasTable() {
    return this.knex.schema.hasTable('licenses')
  }

  async getLatest() {
    const exists = await this.hasTable()
    if (!exists) return null
    return this.knex('licenses').orderBy('id', 'desc').first()
  }

  async getLatestActive() {
    const exists = await this.hasTable()
    if (!exists) return null
    return this.knex('licenses')
      .where({ status: 'active' })
      .orderBy('id', 'desc')
      .first()
  }

  async deactivateAll(trx = null) {
    const db = trx || this.knex
    const exists = await db.schema.hasTable('licenses')
    if (!exists) return
    await db('licenses').update({ status: 'inactive', last_updated: db.fn.now() })
  }

  async createActive(record, trx = null) {
    const db = trx || this.knex
    const payload = {
      ...record,
      status: 'active',
      created_at: db.fn.now(),
      last_updated: db.fn.now()
    }
    const inserted = await db('licenses').insert(payload).returning('*')
    return inserted?.[0] || inserted
  }

  async touchValidation(id) {
    return this.knex('licenses')
      .where({ id })
      .update({ last_validated_at: this.knex.fn.now(), last_updated: this.knex.fn.now() })
  }
}

