/**
 * Repository: Data access layer for users
 */
export class UsersRepository {
  constructor(knex) {
    this.knex = knex
  }

  /**
   * Find user by email
   */
  async findByEmail(email) {
    return this.knex('users').where({ email }).first()
  }

  /**
   * Find user by username
   */
  async findByUsername(username) {
    return this.knex('users').where({ username }).first()
  }

  /**
   * Find user by id
   */
  async findById(id) {
    return this.knex('users').where({ id }).first()
  }

  /**
   * Create a new user
   */
  async create(data) {
    return this.knex('users')
      .insert(data)
      .returning(['id', 'email', 'display_name', 'is_active', 'created_at', 'updated_at'])
  }

  /**
   * Update user
   */
  async update(id, data) {
    return this.knex('users')
      .where({ id })
      .update(data)
      .returning(['id', 'email', 'display_name', 'is_active', 'avatar_url', 'avatar_key', 'created_at', 'updated_at'])
  }

  /**
   * Get user's roles
   */
  async getUserRoles(userId) {
    return this.knex('user_roles')
      .join('roles', 'user_roles.role_id', 'roles.id')
      .where('user_roles.user_id', userId)
      .select('roles.id', 'roles.name', 'roles.description')
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

  async getUsersList(searchQuery, tableConfig) {
    const query = this.knex('users').select([
      'id', 'username', 'display_name', 'email', 'created_at', 'avatar_url'
    ]);

    if (searchQuery) {
      q.orWhereRaw(`LOWER(users.display_name) LIKE ?`, [`%${searchQuery.toLowerCase()}%`]);
      q.orWhereRaw(`LOWER(users.email) LIKE ?`, [`%${searchQuery.toLowerCase()}%`]);
      q.orWhereRaw(`LOWER(users.username) LIKE ?`, [`%${searchQuery.toLowerCase()}%`]);
    }

    return query
      .limit(tableConfig.limit)
      .offset(tableConfig.offset)
      .orderBy(tableConfig.sortBy, tableConfig.orderBy);
  }
}

