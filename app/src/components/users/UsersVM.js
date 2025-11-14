const { ViewModel, SharedStateManager } = Liteframe;

const DEFAULT_USER_FORM = {
  username: '',
  display_name: '',
  email: '',
  password: 'user1234'
}

export default class UsersVM extends ViewModel {
  constructor(stateManager = new SharedStateManager()) {
    super(stateManager);
    this.initializeState();

    this.createUser();
  }

  initializeState() {
    this.setState('user-list', []);
    this.setState('search-query', '');
    this.setState('loading', false);
    this.setState('error', null);
    this.setState('table-config', {
      limit: 10,
      offset: 0,
      sortBy: 'id',
      orderBy: 'asc',
    });
    this.setState('total-count', 0);
    this.setState('selected-user', null);
    this.setState('user-form', DEFAULT_USER_FORM);
  }

  /**
   * Get auth token from storage
   * TODO: Replace with actual token storage mechanism
   */
  getAuthToken() {
    // Get token from localStorage or secure storage
    return localStorage.getItem('authToken') || null;
  }

  /**
   * Load users list with search and pagination
   */
  async loadUsers() {
    

    
    this.updateState('loading', true);
    this.updateState('error', null);
    const searchQuery = this.getState('search-query');
    const tableConfig = this.getState('table-config');
    const token = this.getAuthToken();


    try {
      const result = await window.ipcRenderer.invoke('users:search', {
        searchQuery: searchQuery || '',
        tableConfig: {
          limit: tableConfig.limit,
          offset: tableConfig.offset,
          sortBy: tableConfig.sortBy,
          orderBy: tableConfig.orderBy,
        }
      }, token);

      if (result.success) {
        this.updateState('user-list', result.users);
        this.updateState('total-count', result.total);
      } else {
        throw new Error(result.error || 'Failed to load users');
      }
    } catch (error) {
      console.error('Error loading users:', error);
      this.updateState('error', error.message || 'Failed to load users');
      if (!append) {
        this.updateState('user-list', []);
      }
    } finally {
      this.updateState('loading', false);
    }
  }

  async createUser() {
    const userForm = this.getState('user-form');
    userForm.display_name = 'Abebe Tesema';
    userForm.username = 'abebe';
    const result = window.ipcRenderer.invoke('users:create', userForm); 

    console.log('user create result: ', result);
  }

  async fetchUserById(userId, { useDetailsLoader = false } = {}) {
    const token = this.getAuthToken();
    const loadingKey = useDetailsLoader ? 'details-loading' : 'loading';
    this.updateState(loadingKey, true);
    this.updateState('error', null);

    try {
      const result = await window.ipcRenderer.invoke('users:get-by-id', userId, token);

      if (result.success) {
        return result.user || null;
      }
      throw new Error(result.error || 'Failed to load user');
    } catch (error) {
      console.error('Error loading user:', error);
      this.updateState('error', error.message || 'Failed to load user');
      throw error;
    } finally {
      this.updateState(loadingKey, false);
    }
  }

  async openUserDetails(userId) {
    this.updateState('selected-user-id', userId);
    try {
      const user = await this.fetchUserById(userId, { useDetailsLoader: true });
      this.updateState('selected-user', user);
    } catch (error) {
      this.updateState('selected-user', null);
    }
  }

  closeUserDetails() {
    this.updateState('selected-user-id', null);
    this.updateState('selected-user', null);
  }

  /**
   * Update user
   */
  async updateUser(userId, userData) {
    this.updateState('loading', true);
    this.updateState('error', null);
    const token = this.getAuthToken();

    try {
      const result = await window.ipcRenderer.invoke('users:update', userId, userData, token);

      if (result.success) {
        // Refresh the user list to show updated data
        await this.loadUsers();
        return result.user;
      }
      throw new Error(result.error || 'Failed to update user');
    } catch (error) {
      console.error('Error updating user:', error);
      this.updateState('error', error.message || 'Failed to update user');
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  /**
   * Toggle user active status
   */
  async toggleUserStatus(userId) {
    this.updateState('loading', true);
    this.updateState('error', null);
    const token = this.getAuthToken();

    try {
      const result = await window.ipcRenderer.invoke('users:toggle-status', userId, token);

      if (result.success) {
        // Refresh the user list
        await this.loadUsers();
        return result.user;
      }
      throw new Error(result.error || 'Failed to toggle user status');
    } catch (error) {
      console.error('Error toggling user status:', error);
      this.updateState('error', error.message || 'Failed to toggle user status');
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  /**
   * Update search query and reload users
   */
  async setSearchQuery(query) {
    this.updateState('search-query', query);
    // Reset to first page when searching
    this.updateState('table-config', {
      ...this.getState('table-config'),
      offset: 0,
    });
    await this.loadUsers({ append: false });
  }

  /**
   * Update table pagination/sorting
   */
  async updateTableConfig(config, { append = false } = {}) {
    this.updateState('table-config', {
      ...this.getState('table-config'),
      ...config,
    });
    await this.loadUsers({ append });
  }

  /**
   * Go to next page (append results)
   */
  async nextPage() {
    const config = this.getState('table-config');
    const total = this.getState('total-count');
    const nextOffset = config.offset + config.limit;

    if (nextOffset >= total) return;

    await this.updateTableConfig({
      offset: nextOffset,
    }, { append: true });
  }

  /**
   * Load more users when scrolling
   */
  async loadMoreUsers() {
    const hasMore = this.getState('has-more');
    if (!hasMore) return;
    await this.nextPage();
  }

  /**
   * Go to previous page (replace list)
   */
  async previousPage() {
    const config = this.getState('table-config');
    const prevOffset = Math.max(0, config.offset - config.limit);

    if (prevOffset === config.offset) return;

    await this.updateTableConfig({
      offset: prevOffset,
    }, { append: false });
  }
}
