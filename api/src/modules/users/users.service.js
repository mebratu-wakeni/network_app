/**
 * Service: Business logic for users
 */
import bcrypt from 'bcrypt'

export class UsersService {
  constructor(repository) {
    this.repository = repository
  }

  /**
   * Hash a password
   */
  async hashPassword(password) {
    const saltRounds = 10
    return bcrypt.hash(password, saltRounds)
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash)
  }

  /**
   * Find user by email, scoped to a tenant
   */
  async findByEmail(tenantId, email) {
    return this.repository.findByEmail(tenantId, email)
  }

  /**
   * Find user by id within tenant (throws if not found)
   * Excludes password_hash from response
   */
  async getById(tenantId, id) {
    const user = await this.repository.findByIdForTenant(tenantId, id)
    if (!user) {
      const error = new Error('User not found')
      error.status = 404
      throw error
    }
    const { password_hash, ...userWithoutPassword } = user
    return userWithoutPassword
  }

  /**
   * Create a new user within the given tenant.
   */
  async create(tenantId, input) {
    const { username, email, password, display_name } = input

    const existingUsername = await this.repository.findByUsername(tenantId, username)
    if (existingUsername) {
      const error = new Error('Username already taken')
      error.status = 409
      throw error
    }

    if (email) {
      const existingEmail = await this.repository.findByEmail(tenantId, email)
      if (existingEmail) {
        const error = new Error('Email already registered')
        error.status = 409
        throw error
      }
    }

    const password_hash = await this.hashPassword(password)

    const [created] = await this.repository.create({
      tenant_id: tenantId,
      username,
      email: email || null,
      password_hash,
      display_name: display_name || null,
      is_active: true
    })

    delete created.password_hash
    return created
  }

  /**
   * Update user (excludes password - use separate endpoint for password change)
   */
  async update(tenantId, id, input) {
    const updateData = {}
    if (input.display_name !== undefined) updateData.display_name = input.display_name
    if (input.is_active !== undefined) updateData.is_active = input.is_active
    if (input.email !== undefined) updateData.email = input.email

    const [updated] = await this.repository.update(tenantId, id, updateData)
    if (!updated) {
      const error = new Error('User not found')
      error.status = 404
      throw error
    }
    return updated
  }

  /**
   * Get user with roles and rules
   */
  async getUserWithPermissions(tenantId, userId) {
    const user = await this.getById(tenantId, userId)
    const roles = await this.repository.getUserRoles(userId)
    const directRules = await this.repository.getUserRules(userId)

    const roleRulePromises = roles.map(role => this.repository.getRoleRules(role.id))
    const roleRulesArrays = await Promise.all(roleRulePromises)
    const roleRules = roleRulesArrays.flat()

    return {
      ...user,
      roles,
      directRules,
      roleRules
    }
  }

  /**
   * Get user's roles and rules formatted as requested
   */
  async getUserRolesAndRules(tenantId, userId) {
    await this.getById(tenantId, userId)

    const allRoles = await this.repository.getAllRoles()
    const allRules = await this.repository.getAllRules()
    const [userRoles, directRules] = await Promise.all([
      this.repository.getUserRoles(userId),
      this.repository.getUserRules(userId)
    ])

    const roleRulePromises = userRoles.map(role =>
      this.repository.getRoleRules(role.id).then(rules => ({
        roleName: role.name,
        ruleKeys: rules.map(rule => rule.key)
      }))
    )
    const rolesWithRulesArray = await Promise.all(roleRulePromises)

    const rolesWithRules = {}
    for (const { roleName, ruleKeys } of rolesWithRulesArray) {
      rolesWithRules[roleName] = ruleKeys
    }

    const roles = []
    const rules = []

    for (const role of allRoles) {
      roles.push({
        role,
        isAssigned: userRoles.map(rl => rl.id).includes(role.id)
      })
    }

    for (const rule of allRules) {
      rules.push({
        rule,
        roles: await this.repository.getRuleRoles(rule.id),
        isDirect: directRules.map(rl => rl.id).includes(rule.id)
      })
    }

    return {
      roles,
      rules: rules.map(rt => ({
        ...rt,
        roles: rt.roles.filter(rr => {
          return roles.filter(r => r.isAssigned).map(ar => ar.role.id).includes(rr.id)
        })
      }))
    }
  }

  async assignRoleToUser(tenantId, userId, input) {
    await this.getById(tenantId, userId)

    let role
    if (input.roleName) {
      role = await this.repository.findRoleByName(input.roleName)
      if (!role) {
        const error = new Error(`Role '${input.roleName}' not found`)
        error.status = 404
        throw error
      }
    } else if (input.roleId) {
      role = await this.repository.findRoleById(input.roleId)
      if (!role) {
        const error = new Error(`Role with id ${input.roleId} not found`)
        error.status = 404
        throw error
      }
    } else {
      const error = new Error('Either roleName or roleId must be provided')
      error.status = 400
      throw error
    }

    const inserted = await this.repository.assignRoleToUser(userId, role.id)

    return {
      role: {
        id: role.id,
        name: role.name,
        description: role.description
      },
      assigned: inserted > 0
    }
  }

  async removeRoleFromUser(tenantId, userId, input) {
    await this.getById(tenantId, userId)

    let role
    if (input.roleName) {
      role = await this.repository.findRoleByName(input.roleName)
      if (!role) {
        const error = new Error(`Role '${input.roleName}' not found`)
        error.status = 404
        throw error
      }
    } else if (input.roleId) {
      role = await this.repository.findRoleById(input.roleId)
      if (!role) {
        const error = new Error(`Role with id ${input.roleId} not found`)
        error.status = 404
        throw error
      }
    } else {
      const error = new Error('Either roleName or roleId must be provided')
      error.status = 400
      throw error
    }

    const deleted = await this.repository.removeRoleFromUser(userId, role.id)

    return {
      role: {
        id: role.id,
        name: role.name,
        description: role.description
      },
      removed: deleted > 0
    }
  }

  async assignRuleToUser(tenantId, userId, input) {
    await this.getById(tenantId, userId)

    let rule
    if (input.ruleKey) {
      rule = await this.repository.findRuleByKey(input.ruleKey)
      if (!rule) {
        const error = new Error(`Rule '${input.ruleKey}' not found`)
        error.status = 404
        throw error
      }
    } else if (input.ruleId) {
      rule = await this.repository.findRuleById(input.ruleId)
      if (!rule) {
        const error = new Error(`Rule with id ${input.ruleId} not found`)
        error.status = 404
        throw error
      }
    } else {
      const error = new Error('Either ruleKey or ruleId must be provided')
      error.status = 400
      throw error
    }

    const inserted = await this.repository.assignRuleToUser(userId, rule.id)

    return {
      rule: {
        id: rule.id,
        key: rule.key,
        description: rule.description
      },
      assigned: inserted > 0
    }
  }

  async deleteUser(tenantId, id) {
    try {
      return await this.repository.deleteUser(tenantId, id)
    } catch (error) {
      if (error.code === 'USER_NOT_FOUND') {
        throw error
      }

      const wrapped = new Error('Failed to delete user')
      wrapped.cause = error
      wrapped.code = 'DELETE_USER_FAILED'
      throw wrapped
    }
  }

  async removeRuleFromUser(tenantId, userId, input) {
    await this.getById(tenantId, userId)

    let rule
    if (input.ruleKey) {
      rule = await this.repository.findRuleByKey(input.ruleKey)
      if (!rule) {
        const error = new Error(`Rule '${input.ruleKey}' not found`)
        error.status = 404
        throw error
      }
    } else if (input.ruleId) {
      rule = await this.repository.findRuleById(input.ruleId)
      if (!rule) {
        const error = new Error(`Rule with id ${input.ruleId} not found`)
        error.status = 404
        throw error
      }
    } else {
      const error = new Error('Either ruleKey or ruleId must be provided')
      error.status = 400
      throw error
    }

    const deleted = await this.repository.removeRuleFromUser(userId, rule.id)

    return {
      rule: {
        id: rule.id,
        key: rule.key,
        description: rule.description
      },
      removed: deleted > 0
    }
  }

  async getUsersList(tenantId, searchQuery, tableConfig) {
    const users = await this.repository.getUsersList(tenantId, searchQuery || '', tableConfig)
    const total = await this.repository.getUsersListCount(tenantId, searchQuery || '')

    return {
      users,
      total,
      hasMore: (tableConfig.offset + users.length) < total
    }
  }

  async updateProfile(tenantId, userId, profileData) {
    if (profileData.username) {
      const existing = await this.repository.findByUsername(tenantId, profileData.username)
      if (existing && existing.id !== userId) {
        const error = new Error('Username already taken')
        error.status = 409
        throw error
      }
    }

    if (profileData.email) {
      const existing = await this.repository.findByEmail(tenantId, profileData.email)
      const emailTaken = existing && parseInt(existing.id) !== userId
      if (emailTaken) {
        const error = new Error('Email already registered')
        error.status = 409
        throw error
      }
    }

    const updated = await this.repository.updateProfile(tenantId, userId, profileData)
    if (!updated) {
      const error = new Error('User not found')
      error.status = 404
      throw error
    }
    return updated
  }

  async updateUserProfile(tenantId, userId, userData) {
    const updated = await this.repository.updateUserProfile(tenantId, userId, userData)
    if (!updated) {
      const error = new Error('User not found')
      error.status = 404
      throw error
    }
    return updated
  }

  async updateAvatar(tenantId, userId, avatarData) {
    const updated = await this.repository.updateAvatar(tenantId, userId, avatarData)
    if (!updated) {
      const error = new Error('User not found')
      error.status = 404
      throw error
    }
    return updated
  }

  async removeAvatar(tenantId, userId) {
    const user = await this.repository.findByIdForTenant(tenantId, userId)
    if (!user) {
      const error = new Error('User not found')
      error.status = 404
      throw error
    }

    const avatarKey = user.avatar_key || null
    const updatedUser = await this.repository.removeAvatar(tenantId, userId)

    return {
      user: updatedUser,
      avatarKey
    }
  }

  async changePassword(tenantId, userId, passwordData) {
    const { currentPassword, newPassword } = passwordData

    const user = await this.repository.findByIdForTenant(tenantId, userId)
    if (!user) {
      const error = new Error('User not found')
      error.status = 404
      throw error
    }

    const isCurrentPasswordValid = await this.verifyPassword(currentPassword, user.password_hash)
    if (!isCurrentPasswordValid) {
      const error = new Error('Current password is incorrect')
      error.status = 401
      throw error
    }

    const newPasswordHash = await this.hashPassword(newPassword)
    return await this.repository.changePassword(tenantId, userId, newPasswordHash)
  }

  async toggleUserStatus(tenantId, userId) {
    const updatedUser = await this.repository.toggleUserStatus(tenantId, userId)
    const { password_hash, ...userWithoutPassword } = updatedUser
    return userWithoutPassword
  }
}
