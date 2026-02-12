/**
 * Header ViewModel
 * Manages header state including health checks and user synchronization
 */
const { ViewModel, SharedStateManager } = Liteframe;
import { navigationVM } from '../navigation/NavigationVM.js';
import { HEALTH_CHECK_INTERVAL } from './headerConfig.js';

export default class HeaderVM extends ViewModel {
  constructor(stateManager = new SharedStateManager()) {
    super(stateManager);
    this.initializeState();
    this.navigationVM = navigationVM;
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
  }

  /**
   * Sync user data from navigation VM
   */
  syncUser() {
    const authUser = this.navigationVM.getState('auth')?.user || null;
    
    if (!authUser) {
      this.updateState('user', {
        name: 'Guest',
        display_name: null,
        avatar_url: null,
        username: null
      });
      return;
    }
    
    this.updateState('user', {
      name: authUser.display_name || 'User',
      avatar_url: authUser.avatar_url || null,
      display_name: authUser.display_name || null,
      username: authUser.username || null
    });
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
      const dbHealthResponse = await fetch('http://localhost:4000/api/db-health');
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
