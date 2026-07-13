import bcrypt from 'bcrypt'
import { DEFAULT_CHART_OF_ACCOUNTS } from './defaultChartOfAccounts.js'

const CLIENT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I to avoid confusion
const CLIENT_CODE_LENGTH = 8
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
const TEMP_PASSWORD_LENGTH = 10

function generateClientCode() {
  let code = ''
  for (let i = 0; i < CLIENT_CODE_LENGTH; i++) {
    code += CLIENT_CODE_ALPHABET[Math.floor(Math.random() * CLIENT_CODE_ALPHABET.length)]
  }
  return code
}

function generateTempPassword() {
  let password = ''
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
    password += TEMP_PASSWORD_ALPHABET[Math.floor(Math.random() * TEMP_PASSWORD_ALPHABET.length)]
  }
  return password
}

export class TenantsService {
  constructor(knex, tenantsRepository, usersRepository) {
    this.knex = knex
    this.repository = tenantsRepository
    this.usersRepository = usersRepository
  }

  async list() {
    return this.repository.list()
  }

  async getById(id) {
    const tenant = await this.repository.findById(id)
    if (!tenant) {
      const error = new Error('Tenant not found')
      error.status = 404
      throw error
    }
    return tenant
  }

  /**
   * Provision a brand-new tenant: tenant record, a unique client_code, an initial
   * admin user, default chart of accounts, and a walk-in customer. Everything a
   * fresh installation needs to start from a blank business database.
   */
  async createTenant(input) {
    const { businessName, contactName, phone, email, adminUsername, adminPassword } = input

    if (!businessName) {
      const error = new Error('businessName is required')
      error.status = 400
      throw error
    }
    if (!adminUsername || !adminPassword) {
      const error = new Error('adminUsername and adminPassword are required')
      error.status = 400
      throw error
    }

    // Generate a unique client_code (retry on the rare collision)
    let clientCode
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateClientCode()
      const existing = await this.repository.findByClientCode(candidate)
      if (!existing) {
        clientCode = candidate
        break
      }
    }
    if (!clientCode) {
      const error = new Error('Could not generate a unique client code, please retry')
      error.status = 500
      throw error
    }

    return this.knex.transaction(async (trx) => {
      const [tenant] = await trx('tenants')
        .insert({
          client_code: clientCode,
          business_name: businessName,
          contact_name: contactName || null,
          phone: phone || null,
          email: email || null,
          status: 'active'
        })
        .returning('*')

      const passwordHash = await bcrypt.hash(adminPassword, 10)
      const [adminUser] = await trx('users')
        .insert({
          tenant_id: tenant.id,
          username: adminUsername.trim().toLowerCase(),
          display_name: 'Administrator',
          password_hash: passwordHash,
          is_active: true
        })
        .returning(['id'])

      const adminRole = await trx('roles').where({ name: 'Admin' }).first()
      if (adminRole) {
        await trx('user_roles').insert({ user_id: adminUser.id, role_id: adminRole.id })
      }

      // Default chart of accounts (two-pass insert: parents first, so children can reference parent ids)
      const level1 = DEFAULT_CHART_OF_ACCOUNTS.filter((a) => a.level === 1)
      const level2 = DEFAULT_CHART_OF_ACCOUNTS.filter((a) => a.level === 2)

      const insertedLevel1 = await trx('chart_of_accounts')
        .insert(level1.map(({ parent_account_code, ...acc }) => ({ ...acc, tenant_id: tenant.id })))
        .returning(['id', 'account_code'])
      const codeToId = new Map(insertedLevel1.map((a) => [a.account_code, a.id]))

      await trx('chart_of_accounts').insert(
        level2.map(({ parent_account_code, ...acc }) => ({
          ...acc,
          tenant_id: tenant.id,
          parent_account_id: codeToId.get(parent_account_code)
        }))
      )

      // Default walk-in customer for quick sales/expenses
      await trx('customers').insert({
        tenant_id: tenant.id,
        name: 'Walk-in',
        customer_type: 'other'
      })

      return tenant
    })
  }

  async suspend(id) {
    return this.repository.setStatus(id, 'suspended')
  }

  async reactivate(id) {
    return this.repository.setStatus(id, 'active')
  }

  /**
   * List a tenant's users, for the platform-admin panel (support use only --
   * e.g. confirming who has access, or picking who needs a password reset).
   */
  async listUsers(tenantId) {
    await this.getById(tenantId) // 404s if the tenant doesn't exist
    return this.usersRepository.getUsersList(tenantId, '', {
      limit: 200,
      offset: 0,
      sortBy: 'id',
      orderBy: 'asc'
    })
  }

  /**
   * Platform-admin support action: reset a tenant user's password to a random
   * temp password (returned once, in plaintext, to relay to the tenant) --
   * covers "I lost my password" support requests without needing DB access.
   */
  async resetUserPassword(tenantId, userId) {
    const user = await this.usersRepository.findById(userId)
    if (!user || Number(user.tenant_id) !== Number(tenantId)) {
      const error = new Error('User not found in this tenant')
      error.status = 404
      throw error
    }

    const tempPassword = generateTempPassword()
    const hash = await bcrypt.hash(tempPassword, 10)
    await this.usersRepository.changePassword(userId, hash)

    return { username: user.username, tempPassword }
  }
}
