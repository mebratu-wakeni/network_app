/**
 * Header ViewModel
 * Manages header state including health checks and user synchronization
 */
const { ViewModel, SharedStateManager } = Liteframe;
import { navigationVM } from '../navigation/NavigationVM.js';
import { HEALTH_CHECK_INTERVAL } from './headerConfig.js';
import { getApiUrl } from '../../../electron/config/apiConfig.js';

export default class HeaderVM extends ViewModel {
  constructor(stateManager = new SharedStateManager(), options = {}) {
    super(stateManager);
    this.initializeState();
    this.navigationVM = options.navigationVM || navigationVM;
    this.router = options.router || null;
    this.intervalId = null;
    this.checkHealthStatus();
  }

  /**
   * Initialize component state
   */
  initializeState() {
    this.setState('navCollapsed', false);
    this.setState('serverHealth', null);
    this.setState('dbHealth', null);
    this.setState('apiHealth', null);
    this.setState('user', {});
    this.setState('userMenuActionId', null);
  }

  /**
   * Sync user data from navigation VM
   */
  syncUser() {
    const authUser = this.navigationVM.getState('auth')?.user || null;
    
    if (!authUser) {
      const guestUser = {
        name: 'Guest',
        display_name: null,
        avatar_url: null,
        username: null,
        rules: []
      };
      const current = this.getState('user') || {};
      if (
        current.name !== guestUser.name ||
        current.display_name !== guestUser.display_name ||
        current.avatar_url !== guestUser.avatar_url ||
        current.username !== guestUser.username
      ) {
        this.updateState('user', guestUser);
      }
      return;
    }
    
    const nextUser = {
      name: authUser.display_name || 'User',
      avatar_url: authUser.avatar_url || null,
      display_name: authUser.display_name || null,
      username: authUser.username || null,
      rules: Array.isArray(authUser.rules) ? authUser.rules : []
    };

    const current = this.getState('user') || {};
    const currentRules = Array.isArray(current.rules) ? current.rules : [];
    const nextRules = nextUser.rules;
    const sameRules = currentRules.length === nextRules.length && currentRules.every((rule, idx) => rule === nextRules[idx]);
    if (
      current.name !== nextUser.name ||
      current.display_name !== nextUser.display_name ||
      current.avatar_url !== nextUser.avatar_url ||
      current.username !== nextUser.username ||
      !sameRules
    ) {
      this.updateState('user', nextUser);
    }
  }

  /**
   * Start health check interval
   */
  checkHealthStatus() {
    this.checkHealth();
    // Auto-refresh health status at configured interval
    this.intervalId = setInterval(async () => {
      await this.checkHealth(false);
    }, HEALTH_CHECK_INTERVAL);
  }

  /**
   * Check health status of all services
   * @param {boolean} showLoading - Whether to show loading state
   */
  async checkHealth(showLoading = true) {
    try {
      await Promise.allSettled([
        this.checkApiHealth(),
        this.checkDbHealth(),
        this.checkServerHealth()
      ]);
    } catch (error) {
      console.error('[HeaderVM] Error checking health:', error);
      this.updateState('apiHealth', { healthy: false, error: error.message });
    }
  }

  /**
   * Check API health status
   */
  async checkApiHealth() {
    try {
      const apiHealth = await window.ipcRenderer.checkServerHealth();
      this.updateState('apiHealth', apiHealth);
    } catch (error) {
      this.updateState('apiHealth', { healthy: false, error: error.message });
    }
  }

  /**
   * Check database health status
   */
  async checkDbHealth() {
    try {
      const dbHealthResponse = await fetch(getApiUrl('/db-health'));
      if (dbHealthResponse.ok) {
        const dbHealth = await dbHealthResponse.json();
        this.updateState('dbHealth', { healthy: dbHealth.ok === true });
      } else {
        this.updateState('dbHealth', { healthy: false });
      }
    } catch (error) {
      this.updateState('dbHealth', { 
        healthy: false, 
        error: 'Connection failed' 
      });
    }
  }

  /**
   * Check server status (Docker or process)
   */
  async checkServerHealth() {
    try {
      const serverStatus = await window.ipcRenderer.getServerStatus();
      this.updateState('serverHealth', {
        healthy: serverStatus?.success && 
                 serverStatus?.services?.some(s => s.status === 'running')
      });
    } catch (error) {
      this.updateState('serverHealth', { 
        healthy: false, 
        error: error.message 
      });
    }
  }

  /**
   * Toggle navigation collapse state
   */
  toggleNav() {
    const current = this.getState('navCollapsed');
    this.updateState('navCollapsed', !current);
  }

  goToProfile() {
    this.navigationVM.updateState('active-menu', 'Profile');
    if (this.router && typeof this.router.navigate === 'function') {
      this.router.navigate('/user-profile');
    }
  }

  goToSettings() {
    this.navigationVM.updateState('active-menu', 'Settings');
    if (this.router && typeof this.router.navigate === 'function') {
      this.router.navigate('/settings');
    }
  }

  async logout() {
    await this.navigationVM.logout();
  }

  getUserRules() {
    const user = this.getState('user') || {};
    const rules = user.rules || this.navigationVM.getState('auth')?.user?.rules || [];
    return Array.isArray(rules) ? rules : [];
  }

  hasUserRule(ruleKey) {
    const rules = this.getUserRules();
    return rules.includes('admin') || rules.includes(ruleKey);
  }

  getUserMenuOptions() {
    const auth = this.navigationVM.getState('auth') || {};
    if (!auth.isAuthenticated) return [];

    const options = [
      {
        key: 'profile',
        label: 'Profile',
        icon: 'person-circle-outline',
        onClick: () => this.goToProfile()
      }
    ];

    if (this.hasUserRule('CanEditSettings')) {
      options.push({
        key: 'settings',
        label: 'Settings',
        icon: 'settings-outline',
        onClick: () => this.goToSettings()
      });
    }

    options.push({
      key: 'logout',
      label: 'Logout',
      icon: 'log-out-outline',
      danger: true,
      onClick: () => this.logout()
    });

    return options;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
