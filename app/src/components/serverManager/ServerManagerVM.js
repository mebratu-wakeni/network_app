const { ViewModel, SharedStateManager  }  = Liteframe

// Module-level tracker for current ServerManagerVM instance
// This allows cleanup when navigating away from the /server route
let currentServerManagerVM = null;

/**
 * Cleanup function for ServerManagerVM
 * Called when navigating away from the /server route to prevent memory leaks
 */
export function cleanupServerManager() {
  if (currentServerManagerVM && typeof currentServerManagerVM.destroy === 'function') {
    currentServerManagerVM.destroy();
    currentServerManagerVM = null;
  }
}

export default class ServerManagerVM extends ViewModel {
  constructor(stateManager = new SharedStateManager()) { // Default to singleton sharedState
    super(stateManager);
    
    // Cleanup previous instance if it exists
    cleanupServerManager();
    
    // Register this instance as the current one
    currentServerManagerVM = this;
    
    this.initializeState();
    this.intervalId = null;
    this.checkServerStatus();
  }

  initializeState() {
    this.setState('docker-status', { installed: false, running: false, error: 'Not used in sqlite-only mode' });
    this.setState('server-status', null);
    this.setState('api-health', null);
    this.setState('connection-info', null);
    this.setState('license-status', null);
    this.setState('license-expiry-info', null);
    this.setState('starting', false);
    this.setState('stopping', false);
    this.setState('refreshing', false);
    this.setState('error', null);
    this.setState('success', null);
    this.setState('lastUpdated', null);
    this.setState('mode', 'server');
    this.setState('fingerprint', null);
    this.setState('dev-server-status', null);
    this.refreshDebounceTimer = null;
  }

  checkServerStatus() {
    this.checkStatus()
    // Auto-refresh silently in background (no UI feedback)
    this.intervalId = setInterval(async () => {
      await this.checkStatus(false); // Pass false to indicate silent refresh
    }, 5000);
  }

  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.refreshDebounceTimer) {
      clearTimeout(this.refreshDebounceTimer);
      this.refreshDebounceTimer = null;
    }
  }

  async checkStatus(showLoading = true) {
    // Debounce manual refresh clicks - prevent rapid clicking
    if (showLoading) {
      if (this.refreshDebounceTimer) {
        return; // Already a refresh in progress, ignore this click
      }
      this.updateState('refreshing', true);
    }
    
    this.updateState('error', null);
    
    try {
      const setup = await window.ipcRenderer.invoke('setup:get-config')
      const mode = setup?.config?.mode || 'server'
      const fingerprint = setup?.defaults?.deviceFingerprint || null
      this.updateState('mode', mode)
      this.updateState('fingerprint', fingerprint)

      // Check server status
      const status = await window.ipcRenderer.getServerStatus()
      this.updateState('server-status', status)

      // Check API health
      const health = await window.ipcRenderer.checkServerHealth()
      this.updateState('api-health', health)
      
      const devStatus = await window.ipcRenderer.checkDevServerStatus()
      this.updateState('dev-server-status', devStatus)

      const connectionInfo = await window.ipcRenderer.getConnectionInfo()
      this.updateState('connection-info', connectionInfo)

      if (mode === 'server') {
        const licenseStatus = await window.ipcRenderer.invoke('license:get-status', fingerprint)
        this.updateState('license-status', licenseStatus)
        this.updateState('license-expiry-info', this.computeLicenseExpiryInfo(licenseStatus))
      } else {
        this.updateState('license-status', null)
        this.updateState('license-expiry-info', null)
      }
      
      // Update last refreshed timestamp
      this.updateState('lastUpdated', new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Error checking status:', error);
      this.updateState('error', error.message);
    } finally {
      if (showLoading) {
        // Debounce: prevent another refresh for 500ms after this one completes
        this.refreshDebounceTimer = setTimeout(() => {
          this.refreshDebounceTimer = null;
        }, 500);
        this.updateState('refreshing', false);
      }
    }
  }

  async handleStart() {
    this.updateState('starting', true);
    this.updateState('error', null);
    this.updateState('success', null);
    try {
      const mode = this.getState('mode');
      const result = await window.ipcRenderer.startServer(mode)
      if (result.success) {
        const modeLabel = 'Server';
        this.updateState('success', `${modeLabel} started successfully`);
        // Auto-dismiss success message after 3 seconds
        setTimeout(() => this.updateState('success', null), 3000);
        
        setTimeout(async () => {
          await this.checkStatus(false) // Silent refresh after start
        }, 2500)
      } else {
        // Store error in state for UI to display
        console.error('Failed to start server:', result.error);
        this.updateState('error', `Failed to start server: ${result.error}${result.details ? `\n${result.details}` : ''}`);
        // Auto-dismiss error after 5 seconds
        setTimeout(() => this.updateState('error', null), 5000);
      }
    } catch (error) {
      console.error('Error starting server:', error);
      this.updateState('error', `Error starting server: ${error.message}`);
      // Auto-dismiss error after 5 seconds
      setTimeout(() => this.updateState('error', null), 5000);
    } finally {
      this.updateState('starting', false);
    }
  }

  async handleStop() {
    this.updateState('stopping', true);
    this.updateState('error', null);
    this.updateState('success', null);
    try {
      const mode = this.getState('mode');
      const result = await window.ipcRenderer.stopServer(mode)

      if (result.success) {
        const modeLabel = 'Server';
        this.updateState('success', `${modeLabel} stopped successfully`);
        // Auto-dismiss success message after 3 seconds
        setTimeout(() => this.updateState('success', null), 3000);
        
        setTimeout(async () => {
          await this.checkStatus(false) // Silent refresh after stop
        }, 2000)
      } else {
        // Store error in state for UI to display
        console.error('Failed to stop server:', result.error);
        this.updateState('error', `Failed to stop server: ${result.error}${result.details ? `\n${result.details}` : ''}`);
        // Auto-dismiss error after 5 seconds
        setTimeout(() => this.updateState('error', null), 5000);
      }
    } catch (error) {
      console.error('Error stopping server:', error);
      this.updateState('error', `Error stopping server: ${error.message}`);
      // Auto-dismiss error after 5 seconds
      setTimeout(() => this.updateState('error', null), 5000);
    } finally {
      this.updateState('stopping', false);
    }
  }

  async toggleMode() {}

  computeLicenseExpiryInfo(licenseStatus) {
    const license = licenseStatus?.license
    if (!license || !licenseStatus?.valid) {
      return { expiringSoon: false, expired: false, daysLeft: null, label: null }
    }

    const type = String(license.subscription_type || '').toLowerCase()
    if (type === 'lifetime') {
      return { expiringSoon: false, expired: false, daysLeft: null, label: 'Lifetime' }
    }

    if (!license.expires_at) {
      return { expiringSoon: false, expired: false, daysLeft: null, label: 'No expiry date' }
    }

    const now = new Date()
    const expiryDate = new Date(String(license.expires_at).slice(0, 10))
    const msPerDay = 24 * 60 * 60 * 1000
    const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / msPerDay)
    const expired = daysLeft < 0
    const expiringSoon = !expired && daysLeft <= 30
    return {
      expiringSoon,
      expired,
      daysLeft,
      label: expired ? 'Expired' : `${daysLeft} day(s) remaining`
    }
  }
}
