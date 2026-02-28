const { ViewModel, SharedStateManager } = Liteframe
import { permissionChecker } from '../utils/PermissionChecker'

const MENU = [
  { title: 'Dashboard', route: '/', icon: "grid-outline" },
  { title: 'Inventory', route: '/inventory', icon: "layers-outline" },
  { title: 'Purchase', route: '/purchase', icon: "cart-outline" },
  { title: 'Sales', route: '/sales', icon: "pricetag-outline" },
  { title: 'Financial', route: '/financial', icon: "wallet-outline" },
  { title: 'Customers', route: '/customers', icon: "business-outline" },
  { title: 'Server', route: '/server', icon: "server-outline" },
  { title: 'Users', route: '/users', icon: "people-outline" },
  { title: 'Settings', route: '/settings', icon: 'settings-outline', requireRule: 'CanEditSettings', showInNav: false },
  { title: 'Profile', route: '/user-profile', icon: 'person-outline', showInNav: false }
]

class NavigationVM extends ViewModel {
  constructor(stateManager = new SharedStateManager()) { // Default to singleton sharedState
    super(stateManager);
    this.menuOptions = MENU;
    this.initializeState();
    this.loadSetupConfig();
    // this.login(); // to test auth on app start
  }

  initializeState() {
    this.setState('active-menu', 'Dashboard');
    this.setState('loading', false);
    // Cross-module: ReceivablesTab -> Sales (View in Sales / Make Payment)
    this.setState('pending-sales-open', null);
    // Cross-module: PayablesTab -> Purchase (View in Purchase / Make Payment)
    this.setState('pending-purchase-open', null);
    // Cross-module: Dashboard -> Sales/Purchase History with date filter
    this.setState('pending-sales-filter', null);
    this.setState('pending-purchase-filter', null);
    this.setState('setup-loading', true);
    this.setState('startup-mode', null);
    this.setState('setup-config', null);
    this.setState('setup-defaults', null);
    this.setState('setup-error', null);

    // Auth state
    this.setState('auth', {
      isAuthenticated: false,
      user: null,
      loading: false,
      error: null,
      token: null,
      // prefill for dev convenience; remove in prod
      loginForm: {
        username: 'admin',
        password: 'adminuser'
      }
    })
  }

  // Update the login form fields
  updateLoginForm(key, value) {
    const auth = this.getState('auth') || {}
    const loginForm = auth.loginForm || { username: '', password: '' }
    this.updateState('auth', {
      ...auth,
      loginForm: {
        ...loginForm,
        [key]: value
      }
    })
  }

  // Attempt to login using IPC (auth:login). Stores token in localStorage on success.
  async login() {
    this.updateState('loading', true);
    const auth = this.getState('auth') || {}
    const loginForm = auth.loginForm || { username: '', password: '' }
    
    this.updateState('auth', { ...auth, loading: true, error: null })
    try {
      const result = await window.ipcRenderer.invoke('auth:login', loginForm)
      if (result && result.success) {
        try { localStorage.setItem('authToken', result.token) } catch (e) { /* ignore */ }
        // Load full user with rules for menu/permission filtering
        let userWithRules = result.user
        try {
          const meResult = await window.ipcRenderer.invoke('users:get-current-user')
          if (meResult && (meResult.success || meResult.ok) && meResult.user) userWithRules = meResult.user
        } catch (e) { /* keep result.user */ }
        this.updateState('auth', { ...auth, isAuthenticated: true, user: userWithRules, token: result.token, loading: false, error: null })
        this.updateState('loading', false)
        permissionChecker.setUserRules(userWithRules?.rules || result?.user?.rules || [])
        return true
      }
      throw new Error(result.error || 'Login failed')
    } catch (err) {
      this.updateState('auth', { ...auth, loading: false, error: err.message || 'Login failed' });
      this.updateState('loading', false);
      return false
    }
  }

  // Logout: clear token and reset auth state
  logout() {
    try { localStorage.removeItem('authToken') } catch (e) {}
    this.updateState('auth', {
      isAuthenticated: false,
      user: null,
      token: null,
      loading: false,
      error: null,
      loginForm: { username: '', password: '' }
    })
    this.updateState('startup-mode', null)
  }

  // Try to restore session from localStorage token (optimistic)
  async tryRestoreAuth() {
    try {
      const token = localStorage.getItem('authToken')
      if (token) {
        const auth = this.getState('auth') || {}
        this.updateState('auth', { ...auth, isAuthenticated: true, token })
        await permissionChecker.loadPermissions()
        return true
      }
    } catch (e) { /* ignore */ }
    return false
  }

  async loadSetupConfig() {
    this.updateState('setup-loading', true)
    this.updateState('setup-error', null)
    try {
      const res = await window.ipcRenderer.invoke('setup:get-config')
      if (res?.success) {
        let config = this.normalizeSetupConfig(res.config)
        config = await this.enrichClientConnectionState(config)
        this.updateState('setup-config', config)
        this.updateState('setup-defaults', res.defaults || null)
        try {
          if (config?.apiBaseUrl) localStorage.setItem('apiBaseUrl', config.apiBaseUrl)
        } catch (_) {}
      } else {
        this.updateState('setup-error', res?.error || 'Failed to load setup')
      }
    } catch (e) {
      this.updateState('setup-error', e.message || 'Failed to load setup')
    } finally {
      this.updateState('setup-loading', false)
    }
  }

  async saveSetupConfig(payload) {
    this.updateState('setup-loading', true)
    this.updateState('setup-error', null)
    try {
      const res = await window.ipcRenderer.invoke('setup:save-config', payload)
      if (!res?.success) {
        this.updateState('setup-error', this.normalizeSetupError(res?.error, res?.details, res?.code))
        return false
      }
      const isClientMode = payload?.mode === 'client'
      const config = res.config
        ? {
            ...res.config,
            licenseRequired: false,
            licenseStatus: null,
            clientConnected: !isClientMode,
            clientConnectionError: null,
            clientConnectionMessage: null
          }
        : null
      this.updateState('setup-config', config)
      try {
        if (config?.apiBaseUrl) localStorage.setItem('apiBaseUrl', config.apiBaseUrl)
      } catch (_) {}
      return true
    } catch (e) {
      this.updateState('setup-error', this.normalizeSetupError(e?.message, e?.details, e?.code))
      return false
    } finally {
      this.updateState('setup-loading', false)
    }
  }

  async chooseStartupMode(mode) {
    const selectedMode = mode === 'client' ? 'client' : 'server'
    this.updateState('setup-loading', true)
    this.updateState('setup-error', null)
    this.updateState('startup-mode', selectedMode)
    try {
      const res = await window.ipcRenderer.invoke('startup:select-mode', { mode: selectedMode })
      if (!res?.success) {
        this.updateState('setup-error', res?.error || 'Failed to activate selected mode')
        return
      }

      let config = this.normalizeSetupConfig(res.config)
      config = await this.enrichClientConnectionState(config)

      this.updateState('setup-config', config)
      try {
        if (config?.apiBaseUrl) localStorage.setItem('apiBaseUrl', config.apiBaseUrl)
      } catch (_) {}
    } catch (e) {
      this.updateState('setup-error', e.message || 'Failed to activate selected mode')
    } finally {
      this.updateState('setup-loading', false)
    }
  }

  normalizeSetupConfig(rawConfig) {
    if (!rawConfig) return null
    return {
      ...rawConfig,
      licenseRequired: rawConfig?.licenseRequired === true,
      licenseStatus: rawConfig?.licenseStatus || null,
      clientConnected: false,
      clientConnectionError: null,
      clientConnectionMessage: null
    }
  }

  async enrichClientConnectionState(config) {
    if (!config || config?.mode !== 'client') return config
    const currentUrl = String(config?.client?.serverUrl || '').trim()
    if (!currentUrl) return config

    const probe = await window.ipcRenderer.invoke('client:test-server-url', { serverUrl: currentUrl })
    if (probe?.success) {
      return {
        ...config,
        client: { ...(config.client || {}), serverUrl: probe.serverUrl },
        apiBaseUrl: probe.apiBaseUrl,
        clientConnected: true,
        clientConnectionError: null,
        clientConnectionMessage: `Connected to ${probe.serverUrl}`
      }
    }
    return {
      ...config,
      clientConnected: false,
      clientConnectionError: probe?.error || 'Unable to connect to configured server URL.',
      clientConnectionMessage: null
    }
  }

  normalizeSetupError(errorMessage, details = null, code = null) {
    if (code === 'INVALID_INSTALLATION_KEY') {
      return 'Installation key is invalid. Please verify and try again.'
    }
    if (code === 'INVALID_LICENSE_KEY') {
      return 'License key is invalid. Please verify the key and try again.'
    }
    if (code === 'LICENSE_ALREADY_BOUND') {
      return 'This license is already activated on another machine. Contact admin for a manual reset.'
    }
    if (code === 'SERVER_ERROR') {
      return 'Unable to reach the license validation service right now. Check internet and Google Script URL, then retry.'
    }

    const msg = String(errorMessage || '').toLowerCase()

    if (msg.includes('invalid installation key')) {
      return 'Installation key is invalid. Please verify and try again.'
    }
    if (msg.includes('license activation failed') || msg.includes('invalid license') || msg.includes('license key')) {
      return String(errorMessage || 'License activation failed. Please verify the license key and try again.')
    }
    if (
      msg.includes('fetch failed') ||
      msg.includes('api_unavailable') ||
      msg.includes('econnrefused') ||
      msg.includes('networkerror') ||
      msg.includes('license server') ||
      msg.includes('timed out')
    ) {
      return 'Unable to reach the license validation service. Check internet and Google Script URL, then try again.'
    }
    if (msg.includes('license_script_url')) {
      return 'License service URL is not configured on this machine. Please contact the administrator.'
    }

    if (details?.message) return String(details.message)
    return String(errorMessage || 'Failed to save setup')
  }

  markClientDisconnected() {
    const config = this.getState('setup-config') || null
    if (!config || config.mode !== 'client') return
    this.updateState('setup-config', {
      ...config,
      clientConnected: false,
      clientConnectionError: null,
      clientConnectionMessage: null
    })
  }

  async testClientServerUrl(serverUrl) {
    const currentConfig = this.getState('setup-config') || null
    const normalizedUrl = String(serverUrl || '').trim()
    if (!normalizedUrl) {
      const next = currentConfig
        ? {
            ...currentConfig,
            clientConnected: false,
            clientConnectionError: 'Server URL is required.',
            clientConnectionMessage: null
          }
        : currentConfig
      if (next) this.updateState('setup-config', next)
      return { success: false, error: 'Server URL is required.' }
    }

    const result = await window.ipcRenderer.invoke('client:test-server-url', { serverUrl: normalizedUrl })
    if (!result?.success) {
      const error = result?.error || 'Unable to connect to server.'
      const next = currentConfig
        ? {
            ...currentConfig,
            clientConnected: false,
            clientConnectionError: error,
            clientConnectionMessage: null
          }
        : currentConfig
      if (next) this.updateState('setup-config', next)
      return { success: false, error }
    }

    const next = currentConfig
      ? {
          ...currentConfig,
          client: { ...(currentConfig.client || {}), serverUrl: result.serverUrl },
          apiBaseUrl: result.apiBaseUrl || currentConfig.apiBaseUrl,
          clientConnected: true,
          clientConnectionError: null,
          clientConnectionMessage: `Connection check passed for ${result.serverUrl}`
        }
      : currentConfig
    if (next) this.updateState('setup-config', next)
    return { success: true, serverUrl: result.serverUrl }
  }

  async connectClientServerUrl(serverUrl) {
    const currentConfig = this.getState('setup-config') || null
    const normalizedUrl = String(serverUrl || '').trim()
    if (!normalizedUrl) {
      const next = currentConfig
        ? {
            ...currentConfig,
            clientConnected: false,
            clientConnectionError: 'Server URL is required.',
            clientConnectionMessage: null
          }
        : currentConfig
      if (next) this.updateState('setup-config', next)
      return { success: false, error: 'Server URL is required.' }
    }

    const probe = await this.testClientServerUrl(normalizedUrl)
    if (!probe?.success) {
      return probe
    }

    const result = await window.ipcRenderer.invoke('client:connect', { serverUrl: normalizedUrl })
    if (!result?.success) {
      const error = result?.error || 'Unable to connect to server.'
      const next = currentConfig
        ? {
            ...currentConfig,
            clientConnected: false,
            clientConnectionError: error,
            clientConnectionMessage: null
          }
        : currentConfig
      if (next) this.updateState('setup-config', next)
      return { success: false, error }
    }

    const config = result.config
      ? {
          ...result.config,
          licenseRequired: false,
          licenseStatus: null,
          clientConnected: true,
          clientConnectionError: null,
          clientConnectionMessage: `Connected to ${result?.config?.client?.serverUrl || normalizedUrl}`
        }
      : null
    this.updateState('setup-config', config)
    try {
      if (config?.apiBaseUrl) localStorage.setItem('apiBaseUrl', config.apiBaseUrl)
    } catch (_) {}
    return { success: true }
  }

}

const navigationVM = new NavigationVM(); // singleton
export { navigationVM };
export default NavigationVM;