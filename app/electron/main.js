import { app, BrowserWindow, nativeImage, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ServerManager from './services/serviceManager'
import UsersManager from './users/users.js'

import fs from "fs";
import FormData from "form-data"; // Node FormData
import { UserIpcHandlers } from './users/ipcHandlers.js'
import { InventoryIpcHandlers } from './inventory/ipcHandlers.js'
import { CustomersIpcHandlers } from './customers/ipcHandlers.js'
import { PurchaseIpcHandlers } from './purchase/ipcHandlers.js'
import { SalesIpcHandlers } from './sales/ipcHandlers.js'
import { SettingsIpcHandlers } from './settings/ipcHandlers.js'
import { DashboardIpcHandlers } from './dashboard/ipcHandlers.js'
import { setToken } from './config/authManager.js'

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

let win; let token;
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


ipcMain.handle('auth:login', async (event, credentials) => {
  const result = await usersManager.authenticate(credentials);

  if (result.success) setToken(result.token);

  return {
    success: result.success,
    user: result.user,
    error: result?.error
  };
})


UserIpcHandlers();
InventoryIpcHandlers();
CustomersIpcHandlers();
PurchaseIpcHandlers();
SalesIpcHandlers();
SettingsIpcHandlers();
DashboardIpcHandlers();

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
