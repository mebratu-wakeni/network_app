const { ViewModel, SharedStateManager } = Liteframe;

export default class HeaderVM extends ViewModel {
  constructor(stateManager = new SharedStateManager()) {
    super(stateManager);
    this.initializeState();
    this.intervalId = null;
    this.checkHealthStatus();
  }

  initializeState() {
    this.setState('navCollapsed', false); // false = 300px, true = 80px
    this.setState('serverHealth', null);
    this.setState('dbHealth', null);
    this.setState('apiHealth', null);
    this.setState('user', {
      name: 'Admin User', // TODO: Get from auth context
      avatar: null, // TODO: Get from user profile
      initials: 'AU'
    });
  }

  checkHealthStatus() {
    this.checkHealth();
    // Auto-refresh health status every 10 seconds
    this.intervalId = setInterval(async () => {
      await this.checkHealth(false);
    }, 10000);
  }

  async checkHealth(showLoading = true) {
    try {
      // Check API health
      const apiHealth = await window.ipcRenderer.checkServerHealth();
      this.updateState('apiHealth', apiHealth);

      // Check DB health (if endpoint exists)
      try {
        const dbHealthResponse = await fetch('http://localhost:4000/api/db-health');
        if (dbHealthResponse.ok) {
          const dbHealth = await dbHealthResponse.json();
          this.updateState('dbHealth', { healthy: dbHealth.ok === true });
        } else {
          this.updateState('dbHealth', { healthy: false });
        }
      } catch (error) {
        // If fetch fails, API might not be running
        this.updateState('dbHealth', { healthy: false, error: 'Connection failed' });
      }

      // Check server status (Docker or process)
      try {
        const serverStatus = await window.ipcRenderer.getServerStatus();
        this.updateState('serverHealth', { 
          healthy: serverStatus?.success && serverStatus?.services?.some(s => s.status === 'running')
        });
      } catch (error) {
        this.updateState('serverHealth', { healthy: false, error: error.message });
      }
    } catch (error) {
      console.error('Error checking health:', error);
      this.updateState('apiHealth', { healthy: false, error: error.message });
    }
  }

  toggleNav() {
    const current = this.getState('navCollapsed');
    const newState = !current;
    this.updateState('navCollapsed', newState);
    // State update will trigger UI re-render, UI component handles DOM manipulation
  }

  destroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

