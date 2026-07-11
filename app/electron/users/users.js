import { getApiUrl } from '../config/apiConfig.js';
import { apiFetch } from '../config/apiFetch.js';
import FormData from 'form-data';
import fs from 'fs/promises';
import path from 'path';
import { stringify } from 'csv/sync';
import { app, shell } from 'electron';

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
    const headers = { ...(options.headers || {}) };
    let body = options.body;

    // If body is a Buffer with multipart headers, use it as-is
    // Otherwise, handle JSON or other content types
    if (Buffer.isBuffer(body) && headers['content-type'] && headers['content-type'].includes('multipart')) {
      // Buffer with multipart headers - use as-is
    } else if (body && typeof body.getHeaders === 'function') {
      // FormData stream - should be converted to buffer before calling this
      const formDataHeaders = body.getHeaders();
      Object.assign(headers, formDataHeaders);
    } else if (body && !(body instanceof FormData) && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
      if (typeof body === 'object' && !Buffer.isBuffer(body)) {
        body = JSON.stringify(body);
      }
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await apiFetch(url, {
      method: options.method || 'GET',
      headers,
      body: body
    });
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || data.message || `HTTP ${response.status}`);
      if (data.details) error.details = data.details;
      throw error;
    }

    return data;
  }




  async updateAvatar(userId, formData, token) {
    try {
      if (!(formData instanceof FormData)) {
        throw new Error("updateAvatar expects FormData");
      }

      // Get headers from FormData (must be called before reading stream)
      const headers = formData.getHeaders();
      
      // Convert FormData readable stream to Buffer
      const streamToBuffer = (stream) => {
        return new Promise((resolve, reject) => {
          const chunks = [];
          let finished = false;
          
          const cleanup = () => {
            if (!finished) {
              finished = true;
              stream.removeAllListeners('data');
              stream.removeAllListeners('end');
              stream.removeAllListeners('error');
            }
          };
          
          stream.on('data', (chunk) => {
            // Ensure chunk is a Buffer (convert string to Buffer if needed)
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          stream.on('end', () => {
            cleanup();
            resolve(Buffer.concat(chunks));
          });
          stream.on('error', (err) => {
            cleanup();
            reject(err);
          });
          
          // Ensure stream starts flowing
          stream.resume();
        });
      };
      
      const buffer = await streamToBuffer(formData);

      const response = await this.apiRequest(
        `/users/${userId}/avatar`,
        {
          method: 'POST',
          body: buffer,
          headers: headers
        },
        token
      );

      return {
        success: response.ok === true,
        user: response.user
      };
    } catch (error) {
      console.error('Error in updateAvatar:', error);
      return {
        success: false,
        error: error.message || 'Failed to update avatar'
      };
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
  async exportToCsv(token) {
    try {
      const response = await this.apiRequest('/users/search', {
        method: 'POST',
        body: JSON.stringify({
          searchQuery: '',
          tableConfig: {
            limit: 10000,
            offset: 0,
            sortBy: 'id',
            orderBy: 'desc'
          }
        })
      }, token);

      const userList = response.users || [];

      const columns = [
        { key: 'id', header: 'ID' },
        { key: 'username', header: 'Username' },
        { key: 'display_name', header: 'Name' },
        { key: 'email', header: 'Email' },
        { key: 'status', header: 'Status' }
      ];

      const records = userList.map((user) => ({
        id: user.id,
        username: user.username ?? '',
        display_name: user.display_name ?? '',
        email: user.email ?? '',
        status: user.is_active ? 'Active' : 'Inactive'
      }));

      const csv = stringify(records, { header: true, columns });
      const outputDir = app.getPath('downloads');
      const fileName = `users_${Date.now()}.csv`;
      const filePath = path.join(outputDir, fileName);

      await fs.writeFile(filePath, csv, 'utf8');

      const apiOk = response.ok === true || response.success === true;
      if (!apiOk) {
        return {
          success: false,
          error: 'Unexpected response from server when loading users for export'
        };
      }
      try {
        shell.showItemInFolder(filePath);
      } catch (_) {
        /* non-fatal — file was written */
      }

      return {
        success: true,
        filePath,
        fileName,
        rowCount: records.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to export users list to csv'
      };
    }
  }

  async createUser(userForm, token) {
    try {
      // Clean up the user form: remove empty email field (schema expects undefined, not empty string)
      const cleanedForm = { ...userForm };
      if (cleanedForm.email === '' || cleanedForm.email === null) {
        delete cleanedForm.email;
      }
      
      const response = await this.apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(cleanedForm)
      }, token);

      return {
        success: response.ok === true,
        user: response.user,
        token: response.token,
        username: response.user?.username,
        fullname: response.user?.display_name, 
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to save user',
        details: error.details || null
      };
    }
  }

  async getProfileData(token) {
    try {
      const response = await this.apiRequest('/auth/me', {
        method: 'GET',
      }, token);

      const userId = response.user.id;

      const userRes = await this.getUserById(userId, token);

      let user;

      if (userRes.success) {
        user = userRes.user;
      } else {
        return userRes;
      }

      const permissionsRes = await this.getUserPermissions(userId, token);

      if(!permissionsRes.success) return permissionsRes;

      return {
        success: true,
        user,
        roles: permissionsRes.permissions.roles,
        rules: permissionsRes.permissions.rules,
      }


    



    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to fetch user profile.' 
      }
    }
  }

  /**
   * Get current authenticated user with permissions
   */
  async getCurrentUser(token) {
    try {
      const response = await this.apiRequest('/users/me', {
        method: 'GET',
      }, token);

      return {
        success: response.ok === true || response.success === true,
        user: response.user || response.data
      };
    } catch (error) {
      console.error('[Get Current User] Error:', error);
      throw error;
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

  async authenticate(credentials) {

    try {
      const response = await this.apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      });

      return {
        success: response.ok === true,
        user: response.user,
        token: response.token
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to authenticate'
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
  async updateProfile(userData, token) {
    try {
      const response = await this.apiRequest(`/auth/me`, {
        method: 'GET',
      }, token);

      const userId = response.user.id;

      const profileRes = await this.apiRequest(`/users/${userId}/profile`, {
        method: 'PUT',
        body: JSON.stringify(userData)
      }, token);

      return {
        success: profileRes.ok,
        user: profileRes.user
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to update profile'
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

      // Normalize API response shape: controller returns { ok: true, ...permissions }
      // where permissions may be top-level `roles` and `directlyAssignedRules`.
      let permissions = null;
      if (response.permissions) {
        permissions = response.permissions;
      } else if (response.roles || response.rules) {
        permissions = {
          roles: response.roles || [],
          rules: response.rules || []
        };
      } else if (response.data) {
        permissions = response.data;
      }

      return {
        success: response.ok === true,
        permissions
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
        role: response.role
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to assign role'
      };
    }
  }

  async assignRule(userId, ruleData, token) {
    try {
      const response = await this.apiRequest(`/users/${userId}/rules`, {
        method: 'POST',
        body: JSON.stringify(ruleData),
      }, token);

      return {
        success: response.ok,
        message: response.message,
        rule: response.rule
      };

    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to assign rule to user'
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

  async removeAvatar(userId, token) {
    try {
      const response = await this.apiRequest(`/users/${userId}/avatar`, {
        method: 'DELETE'
      }, token);

      return {
        success: response.ok,
        user: response.user,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to remove avatar.'
      }
    }
  }

  async changePassword(passwordData, token) {
    try {
      const response = await this.apiRequest(`/users/change-password`, {
        method: 'POST',
        body: JSON.stringify(passwordData)
      }, token)

      return {
        success: response.ok,
        message: response.message
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to update password'
      }
    }
  }

  async removeRule(userId, ruleData, token) {
    try {
      const response = await this.apiRequest(`/users/${userId}/rules`, {
        method: 'DELETE',
        body: JSON.stringify(ruleData),
      }, token);
      return {
        success: response.ok,
        message: response.message,
        rule: response.rule,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to remove rule'
      }
    }
  }

  async deleteUser(userId, token) {
    try {
      const response = await this.apiRequest(
        `/users/${userId}`,
        { method: 'DELETE' },
        token
      );

      return {
        success: response.ok,
        user: response.data,
        message: 'User deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to delete user',
      };
    }
  }

}

export default UsersManager;
