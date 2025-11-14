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
    this.setState('docker-status', null);
    this.setState('server-status', null);
    this.setState('api-health', null);
    this.setState('starting', false);
    this.setState('stopping', false);
    this.setState('refreshing', false);
    this.setState('error', null);
    this.setState('success', null);
    this.setState('lastUpdated', null);
    this.setState('mode', 'docker'); // 'docker' or 'dev'
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
    console.log('Destroying ServerManagerVM, clearing intervals and timers');
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
      // Check Docker
      const docker = await window.ipcRenderer.checkDocker()
      this.updateState('docker-status', docker)

      // Check server status
      const status = await window.ipcRenderer.getServerStatus()
      this.updateState('server-status', status)

      // Check API health
      const health = await window.ipcRenderer.checkServerHealth()
      this.updateState('api-health', health)
      
      // Check dev server status if in dev mode
      const mode = this.getState('mode');
      if (mode === 'dev') {
        const devStatus = await window.ipcRenderer.checkDevServerStatus()
        this.updateState('dev-server-status', devStatus)
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
      console.log('start result: ', result);
      
      if (result.success) {
        const modeLabel = mode === 'dev' ? 'Development server' : 'Server';
        this.updateState('success', `${modeLabel} started successfully`);
        // Auto-dismiss success message after 3 seconds
        setTimeout(() => this.updateState('success', null), 3000);
        
        setTimeout(async () => {
          await this.checkStatus(false) // Silent refresh after start
        }, mode === 'dev' ? 3000 : 2000) // Dev server takes a bit longer to start
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
    console.log(`${this.getState('mode')} server is stopping: ${this.getState('stopping')}`);
    try {
      const mode = this.getState('mode');
      const result = await window.ipcRenderer.stopServer(mode)
      console.log('stop result: ', result);
      
      if (result.success) {
        const modeLabel = mode === 'dev' ? 'Development server' : 'Server';
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

  async toggleMode() {
    const currentMode = this.getState('mode');
    const newMode = currentMode === 'docker' ? 'dev' : 'docker';
    
    // Warn user if server is running (they should stop it first)
    const apiHealth = this.getState('api-health');
    if (apiHealth?.healthy) {
      // Server is running - warn but allow switch
      console.warn(`Switching from ${currentMode} to ${newMode} mode while server is running`);
    }
    
    this.updateState('mode', newMode);
    // Refresh status to update UI
    await this.checkStatus(false);
  }
}
