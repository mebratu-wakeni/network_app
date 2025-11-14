import { getApiUrl } from '../config/apiConfig.js';

/**
 * UsersManager - Handles all API communication for user management
 * Similar to ServerManager, this class manages HTTP requests to the API server
 */
class UsersManager {
  constructor() {
    // Get auth token from wherever it's stored (could be from main process storage)
    // For now, we'll get it from the request context
    this.getAuthToken = () => {
      // TODO: Get token from secure storage in main process
      // This could be from Electron's safeStorage or a config file
      return null; // Will be passed from renderer via IPC
    }
  }

  /**
   * Helper function to make API requests
   * Handles authentication, error handling, and response parsing
   */
  async apiRequest(endpoint, options = {}, token = null) {
    const url = getApiUrl(endpoint);
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };
    
    // Add Authorization header if token exists
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
    
    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };
    
    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || `HTTP ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error(`[UsersManager] API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * Search users with pagination and filters
   */
  async searchUsers(searchParams, token) {
    try {
      const response = await this.apiRequest('/users/search', {
        method: 'POST',
        body: JSON.stringify(searchParams),
      }, token);

      

      return {
        success: response.ok === true,
        users: response.users || [],
        total: response.total || 0,
        hasMore: response.hasMore ?? false
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to search users'
      };
    }
  }

  async createUser(userForm) {
    try {
      response = await this.apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userForm)
      });

      console.log('user create response: ', response);

      return {
        success: response.ok  === true,
        username: response.username,
        fullname: response.display_name, 
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to save user'
      };
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId, token) {
    try {
      const response = await this.apiRequest(`/users/${userId}`, {
        method: 'GET',
      }, token);

      return {
        success: response.ok === true,
        user: response.user
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to get user'
      };
    }
  }

  /**
   * Update user
   */
  async updateUser(userId, userData, token) {
    try {
      const response = await this.apiRequest(`/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(userData),
      }, token);

      return {
        success: response.ok === true,
        user: response.user
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to update user'
      };
    }
  }

  /**
   * Toggle user active status
   */
  async toggleUserStatus(userId, token) {
    try {
      const response = await this.apiRequest(`/users/${userId}/toggle-status`, {
        method: 'PATCH',
      }, token);

      return {
        success: response.ok === true,
        user: response.user
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to toggle user status'
      };
    }
  }

  /**
   * Get user permissions (roles and rules)
   */
  async getUserPermissions(userId, token) {
    try {
      const response = await this.apiRequest(`/users/${userId}/permissions`, {
        method: 'GET',
      }, token);

      return {
        success: response.ok === true,
        permissions: response.permissions || response.data || null
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to get user permissions'
      };
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(userId, roleData, token) {
    try {
      const response = await this.apiRequest(`/users/${userId}/roles`, {
        method: 'POST',
        body: JSON.stringify(roleData),
      }, token);

      return {
        success: response.ok === true,
        message: response.message,
        user: response.user
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to assign role'
      };
    }
  }

  /**
   * Remove role from user
   */
  async removeRole(userId, roleData, token) {
    try {
      const response = await this.apiRequest(`/users/${userId}/roles`, {
        method: 'DELETE',
        body: JSON.stringify(roleData),
      }, token);

      return {
        success: response.ok === true,
        message: response.message,
        user: response.user
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to remove role'
      };
    }
  }
}

export default UsersManager;
