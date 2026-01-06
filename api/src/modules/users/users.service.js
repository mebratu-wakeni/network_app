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
   * Find user by email
   */
  async findByEmail(email) {
    return this.repository.findByEmail(email)
  }

  /**
   * Find user by id (throws if not found)
   * Excludes password_hash from response
   */
  async getById(id) {
    const user = await this.repository.findById(id)
    if (!user) {
      const error = new Error('User not found')
      error.status = 404
      throw error
    }
    // Remove password hash before returning
    const { password_hash, ...userWithoutPassword } = user
    return userWithoutPassword
  }

  /**
   * Create a new user
   */
  async create(input) {
    const { username, email, password, display_name } = input
    
    // Check if username already exists
    const existingUsername = await this.repository.findByUsername(username)
    if (existingUsername) {
      const error = new Error('Username already taken')
      error.status = 409
      throw error
    }

    // If email provided, ensure it's unique
    if (email) {
      const existingEmail = await this.repository.findByEmail(email)
      if (existingEmail) {
        const error = new Error('Email already registered')
        error.status = 409
        throw error
      }
    }

    // Hash password
    const password_hash = await this.hashPassword(password)

    // Create user
    const [created] = await this.repository.create({
      username,
      email: email || null,
      password_hash,
      display_name: display_name || null,
      is_active: true
    })

    // Don't return password hash
    delete created.password_hash
    return created
  }

  /**
   * Update user (excludes password - use separate endpoint for password change)
   */
  async update(id, input) {

    const updateData = {}
    if (input.display_name !== undefined) updateData.display_name = input.display_name
    if (input.is_active !== undefined) updateData.is_active = input.is_active
    if (input.email !== undefined) updateData.email = input.email;

    const [updated] = await this.repository.update(id, updateData)
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
  async getUserWithPermissions(userId) {
    const user = await this.getById(userId)
    const roles = await this.repository.getUserRoles(userId)
    const directRules = await this.repository.getUserRules(userId)
    
    // Get rules from all roles
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
   * Returns: { roles: { roleName: [ruleKeys] }, directlyAssignedRules: [ruleKeys] }
   */
  async getUserRolesAndRules(userId) {
    // Verify user exists
    await this.getById(userId)

    const allRoles = await this.repository.getAllRoles();
    const allRules = await this.repository.getAllRules();
    // Get user's roles and directly assigned rules in parallel
    const [userRoles, directRules] = await Promise.all([
      this.repository.getUserRoles(userId),
      this.repository.getUserRules(userId)
    ])
    
    // Get rules for each role in parallel
    const roleRulePromises = userRoles.map(role => 
      this.repository.getRoleRules(role.id).then(rules => ({
        roleName: role.name,
        ruleKeys: rules.map(rule => rule.key)
      }))
    )
    const rolesWithRulesArray = await Promise.all(roleRulePromises)

    // Convert array to object format
    const rolesWithRules = {}
    for (const { roleName, ruleKeys } of rolesWithRulesArray) {
      rolesWithRules[roleName] = ruleKeys
    }

    // Get directly assigned rule keys
    const directlyAssignedRules = directRules.map(rule => rule.key)


    const roles = []
    const rules = []

    for ( const role of allRoles ) {
      roles.push({
        role,
        isAssigned: userRoles.map(rl => rl.id).includes(role.id)
      })
    }

    for (const rule of allRules ) {
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
          return roles.filter(r =>  r.isAssigned).map(ar => ar.role.id).includes(rr.id)
        })
      }))
    }
  }

  /**
   * Assign role to user
   * @param {number} userId - User ID
   * @param {Object} input - Either { roleName: string } or { roleId: number }
   * @returns {Object} Assigned role information
   */
  async assignRoleToUser(userId, input) {
    // Verify user exists
    await this.getById(userId)

    // Find role by name or id
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

    // Assign role to user
    const inserted = await this.repository.assignRoleToUser(userId, role.id)
    
    return {
      role: {
        id: role.id,
        name: role.name,
        description: role.description
      },
      assigned: inserted > 0 // true if newly assigned, false if already existed
    }
  }

  /**
   * Remove role from user
   * @param {number} userId - User ID
   * @param {Object} input - Either { roleName: string } or { roleId: number }
   * @returns {Object} Removed role information
   */
  async removeRoleFromUser(userId, input) {
    // Verify user exists
    await this.getById(userId)

    // Find role by name or id
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

    // Remove role from user
    const deleted = await this.repository.removeRoleFromUser(userId, role.id)
    
    return {
      role: {
        id: role.id,
        name: role.name,
        description: role.description
      },
      removed: deleted > 0 // true if removed, false if not assigned
    }
  }

  /**
   * Assign rule to user
   * @param {number} userId - User ID
   * @param {Object} input - Either { ruleKey: string } or { ruleId: number }
   * @returns {Object} Assigned rule information
   */
  async assignRuleToUser(userId, input) {
    // Verify user exists
    await this.getById(userId)

    // Find rule by key or id
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

    // Assign rule to user
    const inserted = await this.repository.assignRuleToUser(userId, rule.id)
    
    return {
      rule: {
        id: rule.id,
        key: rule.key,
        description: rule.description
      },
      assigned: inserted > 0 // true if newly assigned, false if already existed
    }
  }


  // remove user 

  // services/users.service.js
  async deleteUser(id) {
    try {
      return await this.repository.deleteUser(id);
    } catch (error) {
      // Re-throw known domain errors
      if (error.code === 'USER_NOT_FOUND') {
        throw error;
      }

      // Wrap unknown errors
      const wrapped = new Error('Failed to delete user');
      wrapped.cause = error;
      wrapped.code = 'DELETE_USER_FAILED';
      throw wrapped;
    }
  }


  /**
   * Remove rule from user
   * @param {number} userId - User ID
   * @param {Object} input - Either { ruleKey: string } or { ruleId: number }
   * @returns {Object} Removed rule information
   */
  async removeRuleFromUser(userId, input) {
    // Verify user exists
    await this.getById(userId)

    // Find rule by key or id
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

    // Remove rule from user
    const deleted = await this.repository.removeRuleFromUser(userId, rule.id)
    
    return {
      rule: {
        id: rule.id,
        key: rule.key,
        description: rule.description
      },
      removed: deleted > 0 // true if removed, false if not assigned
    }
  }

  async getUsersList(searchQuery, tableConfig) {
    const users = await this.repository.getUsersList(searchQuery || '', tableConfig)
    const total = await this.repository.getUsersListCount(searchQuery || '')
    
    return {
      users,
      total,
      hasMore: (tableConfig.offset + users.length) < total
    }
  }

  async updateProfile(userId, profileData) {
    // Check if username is being updated and if it's unique
    if (profileData.username) {
      const existing = await this.repository.findByUsername(profileData.username)
      if (existing && existing.id !== userId) {
        const error = new Error('Username already taken')
        error.status = 409
        throw error
      }
    }

    // Check if email is being updated and if it's unique
    if (profileData.email) {
      const existing = await this.repository.findByEmail(profileData.email)
      const emailTaken  = existing && parseInt(existing.id) !== userId;
      if (emailTaken) {
        const error = new Error('Email already registered')
        error.status = 409
        throw error
      }
    }
   

    return await this.repository.updateProfile(userId, profileData)
  }

  async updateAvatar(userId, avatarData) {
    return await this.repository.updateAvatar(userId, avatarData)
  }

  /**
   * Remove avatar from user
   * Returns user data and avatar key (for file deletion in controller)
   */
  async removeAvatar(userId) {
    // Verify user exists and get current avatar key
    const user = await this.repository.findById(userId)
    if (!user) {
      const error = new Error('User not found')
      error.status = 404
      throw error
    }

    const avatarKey = user.avatar_key || null
    
    // Remove avatar from database
    const updatedUser = await this.repository.removeAvatar(userId)
    
    return {
      user: updatedUser,
      avatarKey // Return key so controller can delete the file
    }
  }

  async changePassword(userId, passwordData) {
    const { currentPassword, newPassword } = passwordData

    // Get user to verify current password
    const user = await this.repository.findById(userId)
    if (!user) {
      const error = new Error('User not found')
      error.status = 404
      throw error
    }

    // Verify current password
    const isCurrentPasswordValid = await this.verifyPassword(currentPassword, user.password_hash)
    if (!isCurrentPasswordValid) {
      const error = new Error('Current password is incorrect')
      error.status = 401
      throw error
    }

    // Hash new password
    const newPasswordHash = await this.hashPassword(newPassword)

    // Update password
    return await this.repository.changePassword(userId, newPasswordHash)
  }

  /**
   * Toggle user active status
   * @param {number} userId - User ID
   * @returns {Object} Updated user (without password hash)
   */
  async toggleUserStatus(userId) {
    const updatedUser = await this.repository.toggleUserStatus(userId)
    
    // Remove password hash if present
    const { password_hash, ...userWithoutPassword } = updatedUser
    return userWithoutPassword
  }
}

