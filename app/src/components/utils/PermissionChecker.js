/**
 * PermissionChecker - Utility for checking user permissions in the frontend
 * Provides methods to check if user has required permissions and show helpful alerts
 */

import { showAlert } from './ModalHelpers';

class PermissionChecker {
  constructor() {
    this.userRules = [];
    this.isLoaded = false;
  }

  /**
   * Load current user permissions from API
   */
  async loadPermissions() {
    try {
      const result = await window.ipcRenderer.invoke('users:get-current-user');
      if (result.success && result.user) {
        this.userRules = result.user.rules || [];
        this.isLoaded = true;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error loading user permissions:', error);
      // In development, allow all permissions if API fails
      if (process.env.NODE_ENV !== 'production') {
        this.userRules = ['admin']; // Grant all permissions in dev
        this.isLoaded = true;
        return true;
      }
      return false;
    }
  }

  /**
   * Set user rules directly (useful when user data is already available)
   */
  setUserRules(rules) {
    this.userRules = rules || [];
    this.isLoaded = true;
  }

  /**
   * Check if user has a specific rule
   * @param {string} ruleKey - The rule key to check (e.g., 'CanAddProduct')
   * @returns {boolean}
   */
  hasRule(ruleKey) {
    if (!this.isLoaded) {
      console.warn('Permissions not loaded yet. Call loadPermissions() first.');
      return false;
    }
    
    // Admin has all permissions
    if (this.userRules.includes('admin')) {
      return true;
    }
    
    return this.userRules.includes(ruleKey);
  }

  /**
   * Check if user has any of the specified rules
   * @param {string[]} ruleKeys - Array of rule keys to check
   * @returns {boolean}
   */
  hasAnyRule(ruleKeys) {
    if (!this.isLoaded) {
      console.warn('Permissions not loaded yet. Call loadPermissions() first.');
      return false;
    }
    
    // Admin has all permissions
    if (this.userRules.includes('admin')) {
      return true;
    }
    
    return ruleKeys.some(rule => this.userRules.includes(rule));
  }

  /**
   * Check if user has all of the specified rules
   * @param {string[]} ruleKeys - Array of rule keys to check
   * @returns {boolean}
   */
  hasAllRules(ruleKeys) {
    if (!this.isLoaded) {
      console.warn('Permissions not loaded yet. Call loadPermissions() first.');
      return false;
    }
    
    // Admin has all permissions
    if (this.userRules.includes('admin')) {
      return true;
    }
    
    return ruleKeys.every(rule => this.userRules.includes(rule));
  }

  /**
   * Check permission and show alert if missing
   * @param {string|string[]} requiredRule - Single rule or array of rules
   * @param {Object} options - { actionName, showAlert }
   * @returns {boolean} - True if has permission, false otherwise
   */
  async checkPermission(requiredRule, options = {}) {
    const { actionName = 'perform this action', showAlert: shouldShowAlert = true } = options;
    
    const rules = Array.isArray(requiredRule) ? requiredRule : [requiredRule];
    const hasPermission = this.hasAnyRule(rules);
    
    if (!hasPermission && shouldShowAlert) {
      const ruleNames = rules.map(r => r.replace(/([A-Z])/g, ' $1').trim()).join(' or ');
      await showAlert({
        title: 'Permission Denied',
        message: `You don't have permission to ${actionName}.\n\nRequired permission: ${ruleNames}\n\nPlease contact your administrator if you need access to this feature.`,
        variant: 'error',
        icon: 'lock-closed-outline'
      });
    }
    
    return hasPermission;
  }

  /**
   * Get user-friendly rule name
   */
  getRuleDisplayName(ruleKey) {
    // Convert "CanAddProduct" to "Add Product"
    return ruleKey
      .replace(/^Can/, '')
      .replace(/([A-Z])/g, ' $1')
      .trim();
  }
}

// Export singleton instance
export const permissionChecker = new PermissionChecker();

// Export class for testing
export default PermissionChecker;
