const { ViewModel, SharedStateManager } = Liteframe
import { permissionChecker } from '../utils/PermissionChecker'
import { isCloudClient } from '../../config/cloudClient.js'
import { formatUserError } from '../utils/userErrorMessage.js'

/** Filled in dev builds only — avoids typing during local work (non-cloud dev only). */
const DEV_LOGIN_USERNAME = 'admin'
const DEV_LOGIN_PASSWORD = 'adminuser'

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

function buildMenuOptions() {
  if (isCloudClient()) {
    return MENU.filter((item) => item.route !== '/server')
  }
  return MENU
}

class NavigationVM extends ViewModel {
  constructor(stateManager = new SharedStateManager()) { // Default to singleton sharedState
    super(stateManager);
    this.menuOptions = buildMenuOptions();
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
    // startup-error: set when startup:select-mode IPC returns success:false
    this.setState('startup-error', null);
    // startup-progress: label from main-process publishBootProgress during server start
    this.setState('startup-progress', null);
    this.setState('startup-progress-percent', 0);
    this.setState('startup-selected-mode', null);
    this.setState('startup-loading-expanded', false);
    this.setState('startup-error-details-open', false);
    this.setState('server-down', false);
    this.setState('app-update-state', {
      status: 'idle',
      version: null,
      releaseNotes: '',
      mandatory: false,
      percent: 0,
      error: null,
      currentVersion: null,
      simulated: false,
      manualDownloadUrl: null
    });
    this.setState('app-update-dev-panel', { show: false, note: '' });

    this._devAutoLoginDone = false

    // Auth state
    this.setState('auth', {
      isAuthenticated: false,
      user: null,
      loading: false,
      error: null,
      token: null,
      loginForm: import.meta.env.DEV && import.meta.env.VITE_CLOUD_MODE !== 'true'
        ? { username: DEV_LOGIN_USERNAME, password: DEV_LOGIN_PASSWORD }
        : { username: '', password: '' }
    })

    // Listen for boot-progress events pushed by the main process during
    // startup:select-mode so the UI can show real-time server start progress.
    if (window?.ipcRenderer?.on) {
      window.ipcRenderer.on('main-process-message', (_event, message) => {
        if (!message || message.type !== 'boot-progress') return
        const label = typeof message.label === 'string' ? message.label : ''
        if (label) this.updateState('startup-progress', label)
        const percent = Number(message.percent)
        if (!Number.isNaN(percent)) this.updateState('startup-progress-percent', percent)
      })

      // Sent by main process whenever any API call returns HTTP 401.
      // Token has expired or been invalidated — log out and return to login screen.
      window.ipcRenderer.on('session:expired', () => {
        const auth = this.getState('auth') || {}
        if (!auth.isAuthenticated) return // already logged out, ignore
        this.logout()
        const currentAuth = this.getState('auth') || {}
        this.updateState('auth', {
          ...currentAuth,
          error: 'Your session has expired. Please sign in again.'
        })
      })

      // Sent by main process when a network-level fetch error occurs (server unreachable).
      window.ipcRenderer.on('server:down', () => {
        this.updateState('server-down', true)
      })

      // Sent by main process when recovery polling confirms the server is back up.
      window.ipcRenderer.on('server:up', () => {
        this.updateState('server-down', false)
      })
    }
  }

  // Called by the renderer's "Retry Now" button on the server-down overlay.
  async retryServerConnection() {
    try {
      const result = await window.ipcRenderer.invoke('server:retry-health')
      if (result?.healthy) {
        this.updateState('server-down', false)
      }
    } catch (_) {}
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

  /**
   * Dev only: submit login once per visit to the login screen (after refresh or logout).
   * Disabled for cloud builds so the login screen behaves as it will in production.
   */
  async maybeDevAutoLogin () {
    if (!import.meta.env.DEV) return
    if (import.meta.env.VITE_CLOUD_MODE === 'true') return
    if (this._devAutoLoginDone) return
    const auth = this.getState('auth') || {}
    if (auth.isAuthenticated) return

    this._devAutoLoginDone = true
    this.updateState('auth', {
      ...auth,
      loginForm: {
        username: DEV_LOGIN_USERNAME,
        password: DEV_LOGIN_PASSWORD
      },
      error: null
    })
    await this.login()
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
      throw new Error(formatUserError(result.error || 'Sign in failed. Check your username and password.', 'Sign in failed. Check your username and password.'))
    } catch (err) {
      this.updateState('auth', { ...auth, loading: false, error: formatUserError(err, 'Sign in failed. Check your username and password.') });
      this.updateState('loading', false);
      return false
    }
  }

  // Logout: clear token and reset auth state
  async logout() {
    try { localStorage.removeItem('authToken') } catch (e) {}
    try { await window.ipcRenderer?.invoke?.('auth:clear-token') } catch (_) {}
    this._devAutoLoginDone = false
    this.updateState('auth', {
      isAuthenticated: false,
      user: null,
      token: null,
      loading: false,
      error: null,
      loginForm: import.meta.env.DEV && import.meta.env.VITE_CLOUD_MODE !== 'true'
        ? { username: DEV_LOGIN_USERNAME, password: DEV_LOGIN_PASSWORD }
        : { username: '', password: '' }
    })
    this.updateState('startup-mode', null)
  }

  // Try to restore session from localStorage token — only mark authenticated after
  // /users/me succeeds. Optimistic auth left the app on MainLayout while a failed
  // fetch flipped server-down (localhost API base before applyRuntimeConfig).
  async tryRestoreAuth() {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) return false

      try { await window.ipcRenderer?.invoke?.('auth:set-token', token) } catch (_) {}

      let meResult
      try {
        meResult = await window.ipcRenderer.invoke('users:get-current-user')
      } catch (invokeErr) {
        console.error(
          '[tryRestoreAuth] users:get-current-user IPC failed:',
          invokeErr?.message || invokeErr
        )
        this.updateState('server-down', false)
        try { localStorage.removeItem('authToken') } catch (_) {}
        try { await window.ipcRenderer?.invoke?.('auth:clear-token') } catch (_) {}
        return false
      }

      const ok = !!(meResult && (meResult.success || meResult.ok) && meResult.user)
      if (!ok) {
        // Stay on login; clear any server-down flash from a failed restore probe.
        console.warn('[tryRestoreAuth] session restore failed:', meResult?.error || 'no user')
        this.updateState('server-down', false)
        try { localStorage.removeItem('authToken') } catch (_) {}
        try { await window.ipcRenderer?.invoke?.('auth:clear-token') } catch (_) {}
        return false
      }

      const auth = this.getState('auth') || {}
      this.updateState('auth', {
        ...auth,
        isAuthenticated: true,
        token,
        user: meResult.user,
        loading: false,
        error: null
      })
      permissionChecker.setUserRules(meResult.user?.rules || [])
      this.updateState('server-down', false)
      return true
    } catch (e) {
      this.updateState('server-down', false)
      try { localStorage.removeItem('authToken') } catch (_) {}
      try { await window.ipcRenderer?.invoke?.('auth:clear-token') } catch (_) {}
      return false
    }
  }

  async loadSetupConfig() {
    this.updateState('setup-loading', true)
    this.updateState('setup-error', null)
    try {
      const res = await window.ipcRenderer.invoke('setup:get-config')
      if (res?.success) {
        let config = this.normalizeSetupConfig(res.config)
        config = await this.enrichClientConnectionState(config)
        // Ensure main-process fetch uses the probed Managed URL before any /users/me call.
        const serverUrl = String(config?.client?.serverUrl || '').trim()
        const apiBaseUrl = String(config?.apiBaseUrl || '').trim()
        if (serverUrl || apiBaseUrl) {
          try {
            const applied = await window.ipcRenderer.invoke('runtime:set-api-base', {
              serverUrl,
              apiBaseUrl
            })
            if (applied?.apiBaseUrl) {
              config = { ...config, apiBaseUrl: applied.apiBaseUrl }
            }
          } catch (err) {
            console.warn('[loadSetupConfig] runtime:set-api-base failed:', err?.message || err)
          }
        }
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
      const config = this.getState('setup-config')
      if (config?.clientConnected) {
        await this.tryRestoreAuth()
      }
    }
  }

  // Returns the last saved mode from setup-config (used to pre-select in the dialog).
  getLastUsedMode() {
    const config = this.getState('setup-config')
    const m = config?.mode
    return m === 'client' || m === 'server' ? m : null
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
    this.updateState('startup-error', null)
    this.updateState('startup-error-details-open', false)
    this.updateState('startup-progress', null)
    this.updateState('startup-progress-percent', 0)
    this.updateState('startup-selected-mode', selectedMode)
    // Server startup can take several seconds — show full loading immediately.
    // Client is usually fast — show compact loading for 400ms, then expand.
    if (selectedMode === 'server') {
      this.updateState('startup-loading-expanded', true)
    } else {
      this.updateState('startup-loading-expanded', false)
      setTimeout(() => {
        if (this.getState('setup-loading')) this.updateState('startup-loading-expanded', true)
      }, 400)
    }
    // Do NOT set startup-mode here — only advance it on success so that
    // StartupModeLayout stays visible and can display loading/error states.
    try {
      const res = await window.ipcRenderer.invoke('startup:select-mode', { mode: selectedMode })
      if (!res?.success) {
        this.updateState('startup-error', {
          message: res?.error || 'Failed to activate selected mode',
          code: res?.code || 'UNKNOWN',
          mode: selectedMode
        })
        return
      }

      let config = this.normalizeSetupConfig(res.config)
      config = await this.enrichClientConnectionState(config)

      this.updateState('setup-config', config)
      try {
        if (config?.apiBaseUrl) localStorage.setItem('apiBaseUrl', config.apiBaseUrl)
      } catch (_) {}

      // Advance to the next screen only after everything is confirmed OK.
      this.updateState('startup-mode', selectedMode)
    } catch (e) {
      this.updateState('startup-error', {
        message: e.message || 'Failed to activate selected mode',
        code: 'EXCEPTION',
        mode: selectedMode
      })
    } finally {
      this.updateState('setup-loading', false)
      this.updateState('startup-progress', null)
      this.updateState('startup-progress-percent', 0)
      this.updateState('startup-loading-expanded', false)
    }
  }

  async retryStartupMode() {
    const err = this.getState('startup-error')
    const mode = err?.mode
    if (!mode) return
    this.updateState('startup-error', null)
    await this.chooseStartupMode(mode)
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
    if (!config) return config

    const mode = isCloudClient() ? 'client' : config?.mode
    if (mode !== 'client') return config

    const currentUrl = String(config?.client?.serverUrl || '').trim()
    const clientCode = String(config?.client?.clientCode || '').trim()

    if (!currentUrl) {
      return {
        ...config,
        mode: 'client',
        clientConnected: false,
        clientConnectionError: null,
        clientConnectionMessage: null
      }
    }

    const probe = await window.ipcRenderer.invoke('client:test-server-url', { serverUrl: currentUrl })
    if (!probe?.success) {
      return {
        ...config,
        mode: 'client',
        client: { ...(config.client || {}), serverUrl: currentUrl, clientCode },
        clientConnected: false,
        clientConnectionError: probe?.error || 'Unable to reach the server. Check the URL and try again.',
        clientConnectionMessage: null
      }
    }

    const hasSavedSession = config.setupCompleted === true && clientCode.length > 0
    return {
      ...config,
      mode: 'client',
      client: { ...(config.client || {}), serverUrl: probe.serverUrl, clientCode },
      apiBaseUrl: probe.apiBaseUrl || config.apiBaseUrl,
      clientConnected: hasSavedSession,
      clientConnectionError: null,
      clientConnectionMessage: hasSavedSession
        ? `Connected to ${probe.serverUrl}`
        : null
    }
  }

  normalizeSetupError(errorMessage, details = null, code = null) {
    if (code === 'DUPLICATE_SERVERS') {
      return 'Another Masatech Server is already running on this network. Stop the other server before starting this one.'
    }
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

  async connectClientServerUrl(serverUrl, clientCode) {
    const currentConfig = this.getState('setup-config') || null
    const normalizedUrl = String(serverUrl || '').trim()
    const tenantCode = String(clientCode || '').trim()

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

    if (!tenantCode) {
      const next = currentConfig
        ? {
            ...currentConfig,
            clientConnected: false,
            clientConnectionError: 'Tenant code is required.',
            clientConnectionMessage: null
          }
        : currentConfig
      if (next) this.updateState('setup-config', next)
      return { success: false, error: 'Tenant code is required.' }
    }

    const probe = await this.testClientServerUrl(normalizedUrl)
    if (!probe?.success) {
      return probe
    }

    const result = await window.ipcRenderer.invoke('client:connect', {
      serverUrl: normalizedUrl,
      clientCode: tenantCode
    })
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

  async discoverClientServer() {
    try {
      const discovery = await window.ipcRenderer.invoke('client:discover-server')
      if (!discovery?.success) {
        return {
          success: false,
          code: discovery?.code || null,
          error: discovery?.error || 'No Masatech server found on this network.',
          servers: discovery?.servers || []
        }
      }
      return {
        success: true,
        server: discovery.server,
        servers: discovery.servers || []
      }
    } catch (error) {
      return {
        success: false,
        error: error?.message || 'Unable to scan for Masatech server.',
        servers: []
      }
    }
  }

}

const navigationVM = new NavigationVM(); // singleton
export { navigationVM };
export default NavigationVM;