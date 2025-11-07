/**
 * Permissions Service: Compute effective rules for a user
 * Combines rules from roles + direct user rules
 */
export class PermissionsService {
  constructor(usersRepository) {
    this.repository = usersRepository
  }

  /**
   * Get all effective rule keys for a user
   * Returns a Set of rule keys (e.g., ['products.read', 'products.write', ...])
   */
  async getEffectiveRules(userId) {
    // Get user's roles
    const roles = await this.repository.getUserRoles(userId)
    
    // Get rules from all roles
    const roleRulePromises = roles.map(role => this.repository.getRoleRules(role.id))
    const roleRulesArrays = await Promise.all(roleRulePromises)
    const roleRules = roleRulesArrays.flat()
    
    // Get direct user rules (overrides)
    const directRules = await this.repository.getUserRules(userId)
    
    // Combine and deduplicate by rule key
    const allRules = [...roleRules, ...directRules]
    const ruleKeys = new Set(allRules.map(rule => rule.key))
    
    return ruleKeys
  }

  /**
   * Check if user has a specific rule
   */
  async hasRule(userId, ruleKey) {
    const rules = await this.getEffectiveRules(userId)
    return rules.has(ruleKey)
  }

  /**
   * Check if user has any of the specified rules
   */
  async hasAnyRule(userId, ruleKeys) {
    const rules = await this.getEffectiveRules(userId)
    return ruleKeys.some(key => rules.has(key))
  }

  /**
   * Check if user has all of the specified rules
   */
  async hasAllRules(userId, ruleKeys) {
    const rules = await this.getEffectiveRules(userId)
    return ruleKeys.every(key => rules.has(key))
  }
}

