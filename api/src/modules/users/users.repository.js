
export class UsersRepository {
  constructor(knex) {
    this.knex = knex
  }

  /**
   * Find user by email, scoped to a tenant (email is only unique within a tenant)
   */
  async findByEmail(tenantId, email) {
    return this.knex('users').where({ tenant_id: tenantId, email }).first()
  }

  /**
   * Find user by username, scoped to a tenant (username is only unique within a tenant --
   * different tenants may both have an 'admin' user)
   */
  async findByUsername(tenantId, username) {
    return this.knex('users').where({ tenant_id: tenantId, username }).first()
  }

  /**
   * Find user by id. id is globally unique so no tenant filter is required here,
   * but callers that enforce tenant isolation should still verify user.tenant_id
   * matches the caller's tenant (see middleware/auth.js).
   */
  async findById(id) {
    return this.knex('users').where({ id }).first()
  }

  /**
   * Create a new user. `data` must include tenant_id.
   */
  async create(data) {
    return this.knex('users')
      .insert(data)
      .returning(['id', 'tenant_id', 'email', 'display_name', 'is_active', 'created_at', 'updated_at', 'last_login_at'])
  }

  /**
   * Update user
   */
  async update(id, data) {
    return this.knex('users')
      .where({ id })
      .update(data)
      .returning(['id', 'email', 'display_name', 'is_active', 'avatar_url', 'avatar_key', 'created_at', 'updated_at', 'last_login_at'])
  }

  /**
   * Get user's roles
   */
  async getUserRoles(userId) {

    const roles = await this.knex('roles')

    return this.knex('user_roles')
      .join('roles', 'user_roles.role_id', 'roles.id')
      .where('user_roles.user_id', userId)
      .select('roles.id', 'roles.name', 'roles.description', 'roles.color')
  }

  /**
   * Get user's direct rules (overrides)
   */
  async getUserRules(userId) {
    return this.knex('user_rules')
      .join('rules', 'user_rules.rule_id', 'rules.id')
      .where('user_rules.user_id', userId)
      .select('rules.id', 'rules.key', 'rules.description')
  }

  /**
   * Get rules for a role
   */
  async getRoleRules(roleId) {
    return this.knex('role_rules')
      .join('rules', 'role_rules.rule_id', 'rules.id')
      .where('role_rules.role_id', roleId)
      .select('rules.id', 'rules.key', 'rules.description')
  }

  /**
   * Get roles for a role
   */
  async getRuleRoles(ruleId) {
    return this.knex('role_rules')
      .join('roles', 'role_rules.role_id', 'roles.id')
      .where('role_rules.rule_id', ruleId)
      .select('roles.id', 'roles.name', 'roles.description', 'roles.color')
  }

  /**
   * Find role by name
   */
  async findRoleByName(name) {
    return this.knex('roles').where({ name }).first()
  }

  /**
   * Find role by id
   */
  async findRoleById(id) {
    return this.knex('roles').where({ id }).first()
  }

  /**
   * Assign role to user
   * Inserts into user_roles table, ignores if already exists (ON CONFLICT DO NOTHING)
   * @returns {number} Number of rows inserted (0 if already exists, 1 if new)
   */
  async assignRoleToUser(userId, roleId) {
    // Check if relationship already exists
    const existing = await this.knex('user_roles')
      .where({ user_id: userId, role_id: roleId })
      .first()
    
    if (existing) {
      return 0 // Already assigned
    }
    
    // Insert new relationship
    await this.knex('user_roles')
      .insert({ user_id: userId, role_id: roleId })
    
    return 1 // Newly assigned
  }

  /**
   * Remove role from user
   * Deletes from user_roles table
   * @returns {number} Number of rows deleted (0 if not assigned, 1 if removed)
   */
  async removeRoleFromUser(userId, roleId) {
    const existing = await this.knex('user_roles')
      .where({ user_id: userId, role_id: roleId })
      .first()

    if (!existing) {
      return 0 // Not assigned
    }

    await this.knex('user_roles')
      .where({ user_id: userId, role_id: roleId })
      .delete()

    return 1 // Successfully removed
  }

  /**
   * Find rule by key
   */
  async findRuleByKey(key) {
    return this.knex('rules').where({ key }).first()
  }

  /**
   * Find rule by id
   */
  async findRuleById(id) {
    return this.knex('rules').where({ id }).first()
  }

  /**
   * Assign rule to user
   * Inserts into user_rules table
   * @returns {number} Number of rows inserted (0 if already exists, 1 if new)
   */
  async assignRuleToUser(userId, ruleId) {
    // Check if relationship already exists
    const existing = await this.knex('user_rules')
      .where({ user_id: userId, rule_id: ruleId })
      .first()
    
    if (existing) {
      return 0 // Already assigned
    }
    
    // Insert new relationship
    await this.knex('user_rules')
      .insert({ user_id: userId, rule_id: ruleId })
    
    return 1 // Newly assigned
  }

  /**
   * Remove rule from user
   * Deletes from user_rules table
   * @returns {number} Number of rows deleted (0 if not assigned, 1 if removed)
   */
  async removeRuleFromUser(userId, ruleId) {
    const existing = await this.knex('user_rules')
      .where({ user_id: userId, rule_id: ruleId })
      .first()

    if (!existing) {
      return 0 // Not assigned
    }

    await this.knex('user_rules')
      .where({ user_id: userId, rule_id: ruleId })
      .delete()

    return 1 // Successfully removed
  }

  // repository/users.repository.js
  async deleteUser(id) {
    const user = await this.knex('users')
      .where({ id })
      .first();

    if (!user) {
      const error = new Error('User not found');
      error.code = 'USER_NOT_FOUND';
      throw error;
    }

    await this.knex('users')
      .where({ id })
      .delete();

    // Return a controlled subset (important)
    return {
      id: user.id,
      display_name: user.display_name,
      username: user.username
    };
  }


  async getUsersList(tenantId, searchQuery, tableConfig) {
    const query = this.knex('users').select([
      'id', 'username', 'display_name', 'email', 'created_at', 'avatar_url', 'is_active', 'last_login_at'
    ]).where({ tenant_id: tenantId });

    if (searchQuery && searchQuery.trim()) {
      const search = `%${searchQuery.toLowerCase().trim()}%`
      query.where(function() {
        this.whereRaw('LOWER(users.display_name) LIKE ?', [search])              
          .orWhereRaw('LOWER(users.email) LIKE ?', [search])
          .orWhereRaw('LOWER(users.username) LIKE ?', [search])
      })
    }

    return query
      .limit(tableConfig.limit)
      .offset(tableConfig.offset)
      .orderBy(tableConfig.sortBy, tableConfig.orderBy);
  }

  async getUsersListCount(tenantId, searchQuery) {
    const query = this.knex('users').where({ tenant_id: tenantId })

    if (searchQuery && searchQuery.trim()) {
      const search = `%${searchQuery.toLowerCase().trim()}%`
      query.where(function() {
        this.whereRaw('LOWER(users.display_name) LIKE ?', [search])
          .orWhereRaw('LOWER(users.email) LIKE ?', [search])
          .orWhereRaw('LOWER(users.username) LIKE ?', [search])
      })
    }

    const result = await query.count('id as total').first()
    return parseInt(result.total, 10)
  }

  async updateProfile(userId, profileData) {
    // Map camelCase to snake_case for database
    const updateData = {}
    if (profileData.username !== undefined) updateData.username = profileData.username
    if (profileData.email !== undefined) updateData.email = profileData.email
    if (profileData.display_name !== undefined) updateData.display_name = profileData.display_name
    if (profileData.is_active !== undefined) updateData.is_active = profileData.is_active
    
    const [updatedUser] = await this.knex('users')
      .where('id', userId)
      .update({
        ...updateData,
        updated_at: this.knex.fn.now()
      })
      .returning([
        'id', 'username', 'email', 'display_name',
        'avatar_key', 'avatar_url', 'avatar_mime', 'avatar_bytes',
        'avatar_width', 'avatar_height', 'avatar_updated_at',
        'created_at', 'updated_at', 'last_login_at'
      ]);

    return updatedUser
  }

  async updateUserProfile(userId, profileData) {
    // Map camelCase to snake_case for database
    const updateData = {}
    if (profileData.email !== undefined) updateData.email = profileData.email
    if (profileData.display_name !== undefined) updateData.display_name = profileData.display_name
    if (profileData.phone !== undefined) updateData.phone = profileData.phone

    const [updatedUser] = await this.knex('users')
      .where('id', userId)
      .update({
        ...updateData,
        updated_at: this.knex.fn.now()
      })
      .returning([
        'id', 'username', 'email', 'display_name',
        'avatar_key', 'avatar_url', 'avatar_mime', 'avatar_bytes',
        'avatar_width', 'avatar_height', 'avatar_updated_at',
        'created_at', 'updated_at', 'last_login_at'
      ]);

    return updatedUser
  }

  async updateAvatar(userId, avatarData) {
    const [updatedUser] = await this.knex('users')
      .where('id', userId)
      .update({
        ...avatarData,
        avatar_updated_at: this.knex.fn.now(),
        updated_at: this.knex.fn.now()
      })
      .returning([
        'id', 'username', 'email', 'display_name',
        'avatar_key', 'avatar_url', 'avatar_mime', 'avatar_bytes',
        'avatar_width', 'avatar_height', 'avatar_updated_at',
        'created_at', 'updated_at', 'last_login_at'
      ])

    return updatedUser
  }

  /**
   * Remove avatar from user (set all avatar fields to null)
   */
  async removeAvatar(userId) {
    const [updatedUser] = await this.knex('users')
      .where('id', userId)
      .update({
        avatar_key: null,
        avatar_url: null,
        avatar_mime: null,
        avatar_bytes: null,
        avatar_width: null,
        avatar_height: null,
        avatar_updated_at: null,
        updated_at: this.knex.fn.now()
      })
      .returning([
        'id', 'username', 'email', 'display_name', 'is_active',
        'avatar_key', 'avatar_url', 'avatar_mime', 'avatar_bytes',
        'avatar_width', 'avatar_height', 'avatar_updated_at',
        'created_at', 'updated_at', 'last_login_at'
      ])

    return updatedUser
  }

  async changePassword(userId, hashedPassword) {
    await this.knex('users')
      .where('id', userId)
      .update({
        password_hash: hashedPassword,
        updated_at: this.knex.fn.now(),
        last_password_changed_at: this.knex.fn.now()
      })

    return { message: 'Password updated successfully' }
  }

  async getUserById(userId) {
    return await this.knex('users')
      .select([
        'id', 'username', 'email', 'display_name',
        'avatar_key', 'avatar_url', 'avatar_mime', 'avatar_bytes',
        'avatar_width', 'avatar_height', 'avatar_updated_at',
        'created_at', 'updated_at', 'last_login_at'
      ])
      .where('id', userId)
      .first()
  }

  /**
   * Toggle user active status
   * @param {number} userId - User ID
   * @returns {Object} Updated user
   */
  async toggleUserStatus(userId) {
    // Get current user status
    const user = await this.findById(userId)
    if (!user) {
      const error = new Error('User not found')
      error.status = 404
      throw error
    }

    const newStatus = !user.is_active

    // Update user status
    const [updatedUser] = await this.knex('users')
      .where('id', userId)
      .update({
        is_active: newStatus,
        updated_at: this.knex.fn.now()
      })
      .returning([
        'id', 'username', 'email', 'display_name', 'is_active',
        'avatar_key', 'avatar_url', 'avatar_mime', 'avatar_bytes',
        'avatar_width', 'avatar_height', 'avatar_updated_at',
        'created_at', 'updated_at', 'last_login_at'
      ])

    return updatedUser
  }

  async updateLoginTime(tenantId, username) {
    const user = await this.knex('users')
      .where({ tenant_id: tenantId, username })
      .update({ last_login_at: this.knex.fn.now() }).returning([
        'id', 'username', 'email', 'display_name', 'is_active', 'last_login_at'
      ]);
    return user;
  }
  async getAllRoles() {
    return this.knex('roles').select('id', 'name', 'description', 'color');
  }

  async getAllRules() {
    return this.knex('rules').select('id', 'key', 'description')
  }

}

