import { ipcMain } from "electron";
import UsersManager from "./users";
import { getToken } from "../config/authManager";
import FormData from "form-data"; // Node FormData

const usersManager = new UsersManager()

export function UserIpcHandlers() {
  

  

  ipcMain.handle('users:search', async (event, searchParams) => {
    return await usersManager.searchUsers(searchParams, getToken())
  })

  ipcMain.handle('users:create', async (event, userForm) => {
    return await usersManager.createUser(userForm, getToken());
  })

  // ipcMain.handle('users:remove-avatar', async (event, userId) => {
  //   return await usersManager.removeAvatar(userId, getToken());
  // })

  ipcMain.handle('users:change-password', async (event, passwordData) => {
    return await usersManager.changePassword(passwordData, getToken());
  })

  ipcMain.handle('users:get-by-id', async (event, userId) => {
    return await usersManager.getUserById(userId, getToken())
  })

  ipcMain.handle('users:update', async (event, userId, userData) => {
    return await usersManager.updateUser(userId, userData, getToken())
  })

  ipcMain.handle('users:update-profile', async (event, userData) => {
    return await usersManager.updateProfile(userData, getToken())
  })

  ipcMain.handle('users:toggle-status', async (event, userId) => {
    return await usersManager.toggleUserStatus(userId, getToken())
  })

  ipcMain.handle('users:get-permissions', async (event, userId) => {
    return await usersManager.getUserPermissions(userId, getToken())
  })

  ipcMain.handle('users:export-csv', async (event) => {
    const response = await usersManager.exportToCsv(getToken());

    return response;
  })

  ipcMain.handle('users:get-profile', async (event) => {
    return await usersManager.getProfileData(getToken())
  })

  ipcMain.handle('users:get-current-user', async (event) => {
    try {
      return await usersManager.getCurrentUser(getToken())
    } catch (error) {
      console.error('[users:get-current-user]', error?.message || error)
      return { success: false, error: error?.message || 'Failed to get current user' }
    }
  })

  ipcMain.handle("users:update-avatar", async (event, payload) => {
    try {
      // Convert array of numbers back to Buffer for Node.js FormData
      // payload.buffer is an array of numbers from Uint8Array conversion
      if (!Array.isArray(payload.buffer)) {
        console.error('Invalid payload.buffer type:', typeof payload.buffer, payload.buffer?.constructor?.name);
        throw new Error(`Invalid buffer format: expected array, got ${typeof payload.buffer}`);
      }

      const buffer = Buffer.from(payload.buffer);

      const formData = new FormData();
      formData.append('avatar', buffer, {
        filename: payload.filename,
        contentType: payload.mimetype
      });

      return await usersManager.updateAvatar(payload.userId, formData, getToken());
    } catch (error) {
      console.error('Error in users:update-avatar handler:', error);
      return {
        success: false,
        error: error.message || 'Failed to update avatar'
      };
    }
  });


  ipcMain.handle('users:remove-avatar', async (event, userId) => {
    return await usersManager.removeAvatar(userId, getToken())
  })

  ipcMain.handle('users:delete-user', async (event, userId) => {
    return await usersManager.deleteUser(userId, getToken())
  })

  ipcMain.handle('users:assign-role', async (event, userId, roleData) => {
    return await usersManager.assignRole(userId, roleData, getToken())
  })

  ipcMain.handle('users:remove-role', async (event, userId, roleData) => {
    return await usersManager.removeRole(userId, roleData, getToken())
  })

  ipcMain.handle('users:assign-rule', async (event, userId, ruleData) => {
    return await usersManager.assignRule(userId, ruleData, getToken())
  })

  ipcMain.handle('users:remove-rule', async (event, userId, ruleData) => {
    return await usersManager.removeRule(userId, ruleData, getToken());
  })
}