export class TenantsRepository {
  constructor(knex) {
    this.knex = knex
  }

  async findByClientCode(clientCode) {
    return this.knex('tenants').where({ client_code: clientCode }).first()
  }

  async findById(id) {
    return this.knex('tenants').where({ id }).first()
  }

  async list() {
    return this.knex('tenants').select('*').orderBy('created_at', 'desc')
  }

  async create(data) {
    const [tenant] = await this.knex('tenants').insert(data).returning('*')
    return tenant
  }

  async setStatus(id, status) {
    const [tenant] = await this.knex('tenants')
      .where({ id })
      .update({ status, last_updated: this.knex.fn.now() })
      .returning('*')
    return tenant
  }
}
