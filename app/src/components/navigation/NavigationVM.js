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
  { title: 'Settings', route: '/settings', icon: 'settings-outline', requireRule: 'CanEditSettings' },
  { title: 'Profile', route: '/user-profile', icon: 'person-outline' }
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
    console.log('updateLoginForm called with: ', key, value);
    const auth = this.getState('auth') || {}
    const loginForm = auth.loginForm || { username: '', password: '' }
    this.updateState('auth', {
      ...auth,
      loginForm: {
        ...loginForm,
        [key]: value
      }
    })
    console.log('updateLoginForm - auth state: ', this.getState('auth'));
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
    this.setState('auth', {
      isAuthenticated: false,
      user: null,
      token: null,
      loading: false,
      error: null,
      loginForm: { username: '', password: '' }
    })
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
        this.updateState('setup-config', res.config || null)
        this.updateState('setup-defaults', res.defaults || null)
        try {
          if (res?.config?.apiBaseUrl) localStorage.setItem('apiBaseUrl', res.config.apiBaseUrl)
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
        this.updateState('setup-error', res?.error || 'Failed to save setup')
        return false
      }
      this.updateState('setup-config', res.config || null)
      try {
        if (res.config?.apiBaseUrl) localStorage.setItem('apiBaseUrl', res.config.apiBaseUrl)
      } catch (_) {}
      return true
    } catch (e) {
      this.updateState('setup-error', e.message || 'Failed to save setup')
      return false
    } finally {
      this.updateState('setup-loading', false)
    }
  }

}

const navigationVM = new NavigationVM(); // singleton
export { navigationVM };
export default NavigationVM;