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

  async updateLastSeen(id) {
    return this.knex('admin_users')
      .where({ id })
      .update({ last_updated: this.knex.fn.now() })
  }
}
