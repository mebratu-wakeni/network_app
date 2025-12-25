import { app, BrowserWindow, nativeImage, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ServerManager from './services/serviceManager'
import UsersManager from './users/users.js'

import fs from "fs";
import FormData from "form-data"; // Node FormData

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))




// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')


process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win;
const serverManager = new ServerManager()
const usersManager = new UsersManager()

const iconPath = path.join(__dirname, '..', 'public', 'masatech-logo.png');
const iconImage = nativeImage.createFromPath(iconPath);
app.dock.setIcon(iconImage);
app.dock.bounce();

function createWindow() {
  win = new BrowserWindow({
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
  win.maximize();
}

// IPC Handlers for service management
ipcMain.handle('server:check-docker', async () => {
  return await serverManager.checkDocker()
})

ipcMain.handle('server:start', async (event, mode = 'docker') => {
  if (mode === 'dev') {
    return await serverManager.startDevServer()
  }
  return await serverManager.startServices()
})

ipcMain.handle('server:stop', async (event, mode = 'docker') => {
  if (mode === 'dev') {
    return await serverManager.stopDevServer()
  }
  return await serverManager.stopServices()
})

ipcMain.handle('server:status', async () => {
  return await serverManager.getServiceStatus()
})

ipcMain.handle('server:health', async () => {
  return await serverManager.checkApiHealth()
})



ipcMain.handle('server:logs', async (event, service, lines) => {
  return await serverManager.getLogs(service, lines)
})

ipcMain.handle('server:check-dev-status', async () => {
  return await serverManager.checkDevServerStatus()
})

// IPC Handlers for user management
ipcMain.handle('auth:login', async (event, credentials) => {
  return await usersManager.authenticate(credentials)
})
ipcMain.handle('users:search', async (event, searchParams, token) => {
  return await usersManager.searchUsers(searchParams, token)
})

ipcMain.handle('users:create', async (event, userForm, token) => {
  return await usersManager.createUser(userForm, token);
})


ipcMain.handle('users:get-by-id', async (event, userId, token) => {
  return await usersManager.getUserById(userId, token)
})

ipcMain.handle('users:update', async (event, userId, userData, token) => {
  return await usersManager.updateUser(userId, userData, token)
})

ipcMain.handle('users:toggle-status', async (event, userId, token) => {
  return await usersManager.toggleUserStatus(userId, token)
})

ipcMain.handle('users:get-permissions', async (event, userId, token) => {
  return await usersManager.getUserPermissions(userId, token)
})


ipcMain.handle("users:update-avatar", async (event, payload, token) => {
  try {
    // Convert array of numbers back to Buffer for Node.js FormData
    // payload.buffer is an array of numbers from Uint8Array conversion
    if (!Array.isArray(payload.buffer)) {
      console.error('Invalid payload.buffer type:', typeof payload.buffer, payload.buffer?.constructor?.name);
      throw new Error(`Invalid buffer format: expected array, got ${typeof payload.buffer}`);
    }
    
    const buffer = Buffer.from(payload.buffer);
    console.log('Created buffer, length:', buffer.length, 'filename:', payload.filename, 'userId:', payload.userId);
    
    const formData = new FormData();
    formData.append('avatar', buffer, {
      filename: payload.filename,
      contentType: payload.mimetype
    });

    return await usersManager.updateAvatar(payload.userId, formData, token);
  } catch (error) {
    console.error('Error in users:update-avatar handler:', error);
    return {
      success: false,
      error: error.message || 'Failed to update avatar'
    };
  }
});


ipcMain.handle('users:remove-avatar', async (event, userId, token) => {
  return await usersManager.removeAvatar(userId, token)
})

ipcMain.handle('users:assign-role', async (event, userId, roleData, token) => {
  return await usersManager.assignRole(userId, roleData, token)
})

ipcMain.handle('users:remove-role', async (event, userId, roleData, token) => {
  return await usersManager.removeRole(userId, roleData, token)
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', async () => {
  // Optionally stop services when app quits
  // await serverManager.stopServices()
})

app.whenReady().then(createWindow)
