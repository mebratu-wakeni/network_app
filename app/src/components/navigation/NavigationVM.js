const { ViewModel, SharedStateManager } = Liteframe

const MENU = [
  { title: 'Dashboard', route: '/', icon: "grid-outline" },
  {title: 'Inventory', route: '/inventory', icon: "layers-outline" },
  {title: 'Customers', route: '/customers', icon: "business-outline" },
  {title: 'Server', route: '/server', icon: "server-outline" },
  {title: 'Users', route: '/users', icon: "people-outline"},
  { title: 'Profile', route: '/user-profile', icon: 'person-outline'}
]

class NavigationVM extends ViewModel {
  constructor(stateManager = new SharedStateManager()) { // Default to singleton sharedState
    super(stateManager);
    this.menuOptions = MENU;
    this.initializeState();
    // this.login(); // to test auth on app start
  }

  initializeState() {
    this.setState('active-menu', 'Dashboard');
    this.setState('loading', false);

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
        // store token (persisted by default)
        try { localStorage.setItem('authToken', result.token) } catch (e) { /* ignore */ }
        this.updateState('auth', { ...auth, isAuthenticated: true, user: result.user, token: result.token, loading: false, error: null })
        this.updateState('loading', false);
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
  tryRestoreAuth() {
    try {
      const token = localStorage.getItem('authToken')
      if (token) {
        // Restore token into in-memory auth state. We remain optimistic about authentication;
        // callers can validate the token by calling an auth:me endpoint later.
        const auth = this.getState('auth') || {}
        this.updateState('auth', { ...auth, isAuthenticated: true, token })
        return true
      }
    } catch (e) { /* ignore */ }
    return false
  }

}

const navigationVM = new NavigationVM(); // singleton
export { navigationVM };
export default NavigationVM;