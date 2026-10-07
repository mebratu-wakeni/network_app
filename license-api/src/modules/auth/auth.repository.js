export class AuthRepository {
  constructor(knex) {
    this.knex = knex
  }

  async findByUsername(username) {
    return this.knex('admin_users')
      .where({ username: String(username).toLowerCase().trim() })
      .where('is_active', true)
      .first()
  }

  async findById(id) {
    return this.knex('admin_users').where({ id, is_active: true }).first()
  }

  async updatePassword(id, password_hash) {
    return this.knex('admin_users')
      .where({ id })
      .update({ password_hash, last_updated: this.knex.fn.now() })
  }

  async updateLastSeen(id) {
    return this.knex('admin_users')
      .where({ id })
      .update({ last_updated: this.knex.fn.now() })
  }
}
