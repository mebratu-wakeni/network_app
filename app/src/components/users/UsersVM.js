const { ViewModel, SharedStateManager } = Liteframe;
import { getApiAsset } from '../../../electron/config/apiConfig.js';
import { navigationVM } from '../navigation/NavigationVM.js';

const DEFAULT_USER_FORM = {
  username: '',
  display_name: '',
  password: 'user1234', 
}


export default class UsersVM extends ViewModel {
  constructor(stateManager = new SharedStateManager()) {
    super(stateManager);
    this.initializeState();
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  initializeState() {
    this.setState('user-list', []);
    this.setState('search-query', '');
    this.setState('loading', false);
    this.setState('details-loading', false);
    this.setState('error', null);
    this.setState('has-more', true);
    this.setState('table-config', {
      limit: 10,
      offset: 0,
      sortBy: 'id',
      orderBy: 'desc',
    });
    this.setState('total-count', 0);
    this.setState('selected-user', null);
    this.setState('selected-user-roles', []);
    this.setState('selected-user-direct-rules', []);
    this.setState('permissions-loading', false);
    this.setState('user-form', DEFAULT_USER_FORM);
    this.setState('creating', false);
    this.setState('avatar-preview', '');
  }

  reload() {
    this.updateState('loading', false);
  }

 
  


  /**
   * Get auth token from storage
   * TODO: Replace with actual token storage mechanism
   */
  getAuthToken() {
    // Prefer token kept in-memory by NavigationVM, fall back to localStorage.
    try {
      const navAuth = navigationVM.getState('auth') || {};
      if (navAuth && navAuth.token) return navAuth.token;
    } catch (e) {
      // ignore - fallback to localStorage
    }
    try {
      return localStorage.getItem('authToken') || null;
    } catch (e) {
      return null;
    }
  }

  updateAvatarPreview(path) {
    if(path === '') return;
    this.updateState('avatar-preview', getApiAsset(path));
  }

  updateUserForm(key, value) {
    const userForm = this.getState('user-form');
    this.updateState('user-form', {
      ...userForm,
      [key]: value,
    })
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
      this.updateState('user-list', []);
    } finally {
      await this.sleep(100);
      this.updateState('loading', false);
    }
  }

  async exportUsersToCsv() {
    this.updateState('loading', true);
    this.updateState('error', null);

    const token = this.getAuthToken();

    try {
      const result = await window.ipcRenderer.invoke('users:export-csv', token);

      if( result.success ) {
        return result.filePath
      }

      throw new Error(result.error || 'Failed to export users');
    } catch (error) {
      console.log('Error exporting users: ', error);
      this.updateState('error', error.message || 'Failed to export users');
    } finally {
      this.updateState('loading', false);
    }
  }

  async updateAvatar(file) {
    this.updateState('loading', true);
    this.updateState('error', null);

    const selectedUser = this.getState('selected-user');
    const token = this.getAuthToken();

    if (!file) {
      this.updateState('error', 'No file selected');
      this.updateState('loading', false);
      return;
    }

    if (!selectedUser || !selectedUser.id) {
      this.updateState('error', 'No user selected');
      this.updateState('loading', false);
      return;
    }

    try {
      // Convert File to ArrayBuffer for IPC transfer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Array.from(new Uint8Array(arrayBuffer));
      
      const payload = {
        buffer: buffer,
        filename: file.name,
        mimetype: file.type,
        size: file.size,
        userId: selectedUser.id // Pass the target user ID
      };

      const result = await window.ipcRenderer.invoke(
        'users:update-avatar',
        payload,
        token
      );


      if (!result.success) {
        throw new Error(result.error || 'Failed to update avatar');
      }

      // Refresh user details so new avatar URL is picked up
      await this.openUserDetails(selectedUser.id);

    } catch (error) {
      console.error('Error updating avatar:', error);
      this.updateState('error', error.message || 'Failed to update avatar');
    } finally {
      this.updateState('loading', false);
    }
  }


  async removeAvatar() {
    this.updateState('loading', true);
    this.updateState('error', null);
    const selectedUser = this.getState('selected-user');
    const token = this.getAuthToken();
    
    
    try {
      const result = await window.ipcRenderer.invoke('users:remove-avatar', selectedUser.id, token); 
      
      if (result.success) {
        // Refresh the user details to show updated avatar
        await this.openUserDetails(selectedUser.id);
      } else {
        console.error('Failed to remove avatar:', result.error);
        const errorMessage = result.error || 'Failed to remove avatar';
        this.updateState('error', errorMessage);
        throw new Error(result.error || 'Failed to remove avatar');
      }
    } catch (error) {
      console.error('Error removing avatar:', error);
      this.updateState('error', error.message || 'Failed to remove avatar');
    } finally {
      this.updateState('loading', false);
    }
  }


  async createUser() {
    this.updateState('creating', true);
    this.updateState('error', null);
    const userForm = this.getState('user-form');
    const token = this.getAuthToken();
    userForm.password = 'user1234';
    
    
    try {
      const result = await window.ipcRenderer.invoke('users:create', userForm, token); 
      
      if (result.success) {
        await this.loadUsers();
      } else {
        console.error('Failed to create user:', result.error);
        if (result.details) {
          console.error('Validation errors:', result.details);
        }
        const errorMessage = result.details 
          ? `${result.error}: ${result.details.map(d => `${d.field}: ${d.message}`).join(', ')}`
          : result.error || 'Failed to create user';
        this.updateState('error', errorMessage);
        throw new Error(result.error || 'Failed to load users');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      this.updateState('error', error.message || 'Failed to create user');
    } finally {
      this.updateState('creating', false);
    }
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

  /**
   * Fetch user permissions (roles and directly assigned rules) via main process
   */
  async fetchUserPermissions(userId) {
    const token = this.getAuthToken();
    this.updateState('permissions-loading', true);
    this.updateState('error', null);

    try {
      const result = await window.ipcRenderer.invoke('users:get-permissions', userId, token);
      if (result.success) {
        const permissions = result.permissions || {};
        // API returns { roles: { roleName: [ruleKeys] }, directlyAssignedRules: [] }
        this.updateState('selected-user-roles', permissions.roles || []);
        this.updateState('selected-user-direct-rules', permissions.rules || []);
        return permissions;
      }

      throw new Error(result.error || 'Failed to load permissions');
    } catch (error) {
      console.error('Error fetching permissions:', error);
      this.updateState('error', error.message || 'Failed to load permissions');
      this.updateState('selected-user-roles', []);
      this.updateState('selected-user-direct-rules', []);
      return null;
    } finally {
      this.updateState('permissions-loading', false);
    }
  }

  async openUserDetails(userId) {
    try {
      const user = await this.fetchUserById(userId, { useDetailsLoader: true });
      this.updateState('selected-user', user);
      this.updateAvatarPreview(user.avatar_url);
      this.updateState('user-form', {
        username: user.username || '',
        display_name: user.display_name || '',
        email: user.email,
        password: '',
        status: user.is_active,
        registered_at: user.created_at,
        last_updated: user.updated_at,
      });
      

      // Fetch and attach roles/rules for details panel
      try {
        await this.fetchUserPermissions(userId);
      } catch (e) {
        // ignore - fetchUserPermissions already sets error state
      }

      // console.log('selected  user: ', this.getState('selected-user'));
    } catch (error) {
      this.updateState('selected-user', null);
    }
  }

  closeUserDetails() {
    this.updateState('selected-user-id', null);
    this.updateState('selected-user', null);
  }

  async deleteUser(userId) {
    const token = this.getAuthToken();
    try {
      const result = await window.ipcRenderer.invoke('users:delete-user', userId, token);
      console.log('deleting user result: ', result)

      if ( result.success ) {
        this.loadUsers()
        return result.user
      }
      throw new Error(result.error || 'Failed to delete user');
    } catch (error) {
      console.error('Error deleting user:', error);
      this.updateState('error', error.message || 'Failed to delete user');
      this.updateState('loading', false)
    }
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

  async setLimit(page) {
    const config = this.getState('table-config');

    this.updateState('table-config', {
      ...config,
      limit: page,
      offset: 0,
    });
    this.updateState('search-query', '');

    await this.loadUsers();

  }

  async assignRole(userId, roleData) {
    this.updateState('loading', true);
    this.updateState('error', null);
    const token = this.getAuthToken();

    try {
      const result = await window.ipcRenderer.invoke('users:assign-role', userId, roleData, token);

      if (result.success) {
        // Refresh the user list to show updated data
        await this.fetchUserPermissions(userId);
        return result.role;
      }
      throw new Error(result.error || 'Failed to assign role');
    } catch (error) {
      console.error('Error assigning role:', error);
      this.updateState('error', error.message || 'Failed to assign role');
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async assignRule(userId, ruleData) {
    this.updateState('loading', true);
    this.updateState('error', null);

    const token = this.getAuthToken();

    try {
      const result = await window.ipcRenderer.invoke('users:assign-rule', userId, ruleData, token)

      if( result.success ) {
        await this.fetchUserPermissions(userId);
        return result.rule
      }
      throw new Error(result.error || 'Failed to assign rule');
    } catch (error) {
      console.error('Error: assign rule: ', error);
      this.updateState('error', error.message || 'Failed to assign rule');
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async removeRole(userId, roleData) {
    this.updateState('loading', true);
    this.updateState('error', null);
    const token = this.getAuthToken();

    try {
      const result = await window.ipcRenderer.invoke('users:remove-role', userId, roleData, token);

      if (result.success) {
        // Refresh the user list to show updated data
        await this.fetchUserPermissions(userId);
        return result.role;
      }
      throw new Error(result.error || 'Failed to assign role');
    } catch (error) {
      console.error('Error assigning role:', error);
      this.updateState('error', error.message || 'Failed to assign role');
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async removeRule(userId, ruleData) {
    this.updateState('loading', true);
    this.updateState('error', null);
    const token = this.getAuthToken();

    try {
      const response = await window.ipcRenderer.invoke('users:remove-rule', userId, ruleData, token);

      if( response.success ) {
        this.fetchUserPermissions(userId);
        return response.rule;
      }
      throw new Error(response.error || 'Failed to remove rule')
    } catch (error) {
      console.error('Error assigning rule to user: ', error);
      this.updateState('error', error.message || 'Failed to assign rule');
    } finally {
      this.updateState('loading', false)
    }
  }
}

