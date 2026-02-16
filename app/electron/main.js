import { app, BrowserWindow, nativeImage, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
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
import { FinancialIpcHandlers } from './financial/ipcHandlers.js'
import { FiscalYearsIpcHandlers } from './fiscal-years/ipcHandlers.js'
import { ReportsIpcHandlers } from './reports/ipcHandlers.js'
import LicenseManager from './license/license.js'
import { LicenseIpcHandlers } from './license/ipcHandlers.js'
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
const licenseManager = new LicenseManager()
let runtimeConfig = null

const APP_NAME = 'PharmaSuitLAN'
const DB_FILE_NAME = 'pharmasuit_lan.db'

function getDefaultDbDirectory() {
  if (process.platform === 'win32') {
    const programData = process.env.ProgramData || 'C:\\ProgramData'
    return path.join(programData, APP_NAME, 'data')
  }
  if (process.platform === 'darwin') {
    return path.join(app.getPath('appData'), APP_NAME, 'data')
  }
  return path.join(app.getPath('appData'), APP_NAME, 'data')
}

function getRuntimeConfigPath() {
  return path.join(app.getPath('userData'), 'runtime-config.json')
}

function getDeviceFingerprint() {
  const interfaces = os.networkInterfaces()
  const macs = Object.values(interfaces)
    .flat()
    .filter((i) => i && !i.internal && i.mac && i.mac !== '00:00:00:00:00:00')
    .map((i) => i.mac)
    .sort()
    .join('|')
  const seed = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.release(),
    macs
  ].join('::')
  return crypto.createHash('sha256').update(seed).digest('hex')
}

function normalizeServerUrl(url) {
  if (!url) return null
  const trimmed = String(url).trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(trimmed)) return `http://${trimmed}`
  return trimmed
}

function loadRuntimeConfig() {
  try {
    const cfgPath = getRuntimeConfigPath()
    if (!fs.existsSync(cfgPath)) {
      return { setupCompleted: false }
    }
    const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : { setupCompleted: false }
  } catch (e) {
    return { setupCompleted: false }
  }
}

function saveRuntimeConfig(config) {
  const cfgPath = getRuntimeConfigPath()
  fs.mkdirSync(path.dirname(cfgPath), { recursive: true })
  fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), 'utf8')
}

function applyRuntimeConfig(config) {
  runtimeConfig = config
  if (config?.apiBaseUrl) process.env.API_BASE_URL = config.apiBaseUrl
  if (config?.server?.dbFile) process.env.DB_FILE = config.server.dbFile
}

function getApiRootForHealth() {
  const apiBase = process.env.API_BASE_URL || 'http://localhost:4000/api'
  return apiBase.replace(/\/api\/?$/i, '')
}

function getLanIPv4Addresses() {
  const interfaces = os.networkInterfaces()
  const ips = Object.values(interfaces)
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal && i.address)
    .map((i) => i.address)
  return [...new Set(ips)]
}

function normalizeLicenseActivationFailure(errorMessage) {
  const msg = String(errorMessage || '')
  const lower = msg.toLowerCase()
  if (lower.includes('invalid installation key')) {
    return { code: 'INVALID_INSTALLATION_KEY', error: 'Installation key is invalid.' }
  }
  if (lower.includes('already') && (lower.includes('machine') || lower.includes('fingerprint') || lower.includes('bound'))) {
    return { code: 'LICENSE_ALREADY_BOUND', error: 'This license is already activated on another machine.' }
  }
  if (
    lower.includes('invalid license') ||
    lower.includes('license key') ||
    lower.includes('license not found') ||
    lower.includes('not found')
  ) {
    return { code: 'INVALID_LICENSE_KEY', error: 'License key is invalid.' }
  }
  if (lower.includes('fetch failed') || lower.includes('econnrefused') || lower.includes('network') || lower.includes('license server')) {
    return {
      code: 'SERVER_ERROR',
      error: 'License service is unreachable. Check internet connection and Google Script deployment URL.'
    }
  }
  return { code: 'SERVER_ERROR', error: msg || 'License activation failed' }
}

async function waitForApiReady(apiRoot, timeoutMs = 15000, intervalMs = 300) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const health = await serverManager.checkApiHealth(apiRoot)
    if (health?.success && health?.healthy) return true
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  return false
}

function resolveConfigByDbPresence(initialConfig) {
  const loaded = initialConfig || loadRuntimeConfig()
  if (!loaded?.setupCompleted || loaded?.mode !== 'server') return loaded

  const dbFile = loaded?.server?.dbFile || path.join(getDefaultDbDirectory(), DB_FILE_NAME)
  const hasServerDb = !!(dbFile && fs.existsSync(dbFile))
  if (!hasServerDb) return { ...loaded, setupCompleted: false }
  return loaded
}

async function resolveLicenseState(initialConfig) {
  const loaded = initialConfig || loadRuntimeConfig()
  if (!loaded?.setupCompleted || loaded?.mode !== 'server') return loaded

  const fingerprint = getDeviceFingerprint()
  const status = await licenseManager.getStatus(fingerprint)
  // Only force setup if license is definitively invalid.
  // Transient API unavailability should not trigger setup wizard repeatedly.
  if (status?.success === true && status?.valid === false) {
    return { ...loaded, setupCompleted: false, licenseRequired: true, licenseStatus: status }
  }
  return { ...loaded, licenseStatus: status }
}

const iconPath = path.join(__dirname, '..', 'public', 'masatech-logo.png');
const iconImage = nativeImage.createFromPath(iconPath);
if (process.platform === 'darwin' && app.dock) {
  app.dock.setIcon(iconImage);
  app.dock.bounce();
}

function loadRenderer(targetWindow) {
  // Test active push message to Renderer-process.
  targetWindow.webContents.on('did-finish-load', () => {
    targetWindow?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    targetWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    targetWindow.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

function createWizardWindow() {
  const wizardWidth = 720
  const wizardHeight = 540
  win = new BrowserWindow({
    icon: iconPath,
    width: wizardWidth,
    height: wizardHeight,
    minWidth: wizardWidth,
    minHeight: wizardHeight,
    maxWidth: wizardWidth,
    maxHeight: wizardHeight,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreen: false,
    fullscreenable: false,
    frame: false,
    autoHideMenuBar: true,
    thickFrame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })
  win.setMenuBarVisibility(false)
  loadRenderer(win)
}

function createMainWindow() {
  win = new BrowserWindow({
    icon: iconPath,
    width: 1200,
    height: 820,
    minWidth: 1000,
    minHeight: 700,
    resizable: true,
    maximizable: true,
    minimizable: true,
    fullscreen: false,
    fullscreenable: true,
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })
  loadRenderer(win)
}

// IPC Handlers for service management
ipcMain.handle('server:check-docker', async () => {
  return await serverManager.checkDocker()
})

ipcMain.handle('server:start', async (event, mode = 'docker') => {
  const cfg = runtimeConfig || loadRuntimeConfig()
  if (cfg?.mode === 'client') {
    return { success: false, error: 'Client mode does not start local server' }
  }
  const port = Number(cfg?.server?.port || process.env.PORT || 4000)
  const dbFile = cfg?.server?.dbFile || process.env.DB_FILE
  return await serverManager.startServer({ port, dbFile, mode })
})

ipcMain.handle('server:stop', async (event, mode = 'docker') => {
  return await serverManager.stopServer()
})

ipcMain.handle('server:status', async () => {
  return await serverManager.getServiceStatus()
})

ipcMain.handle('server:health', async () => {
  return await serverManager.checkApiHealth(getApiRootForHealth())
})

ipcMain.handle('server:connection-info', async () => {
  const cfg = runtimeConfig || loadRuntimeConfig()
  const mode = cfg?.mode || 'server'
  if (mode === 'client') {
    const serverUrl = normalizeServerUrl(cfg?.client?.serverUrl || '')
    return {
      success: true,
      mode,
      port: null,
      localhostUrl: null,
      apiRoot: serverUrl || null,
      lanUrls: []
    }
  }

  const port = Number(cfg?.server?.port || process.env.PORT || 4000)
  const localhostUrl = `http://localhost:${port}`
  const lanUrls = getLanIPv4Addresses().map((ip) => `http://${ip}:${port}`)
  return {
    success: true,
    mode,
    port,
    localhostUrl,
    apiRoot: `${localhostUrl}/api`,
    lanUrls
  }
})



ipcMain.handle('server:logs', async (event, service, lines) => {
  return await serverManager.getLogs(service, lines)
})

ipcMain.handle('server:check-dev-status', async () => {
  return await serverManager.checkDevServerStatus()
})

ipcMain.handle('setup:get-config', async () => {
  const loaded = runtimeConfig || loadRuntimeConfig()
  const defaultDir = getDefaultDbDirectory()
  try { fs.mkdirSync(defaultDir, { recursive: true }) } catch (_) {}
  const fingerprint = getDeviceFingerprint()
  let effectiveConfig = resolveConfigByDbPresence(loaded)
  if (effectiveConfig?.setupCompleted && effectiveConfig?.mode === 'server') {
    const status = await licenseManager.getStatus(fingerprint)
    if (status?.success === true && status?.valid === false) {
      effectiveConfig = { ...effectiveConfig, setupCompleted: false, licenseRequired: true, licenseStatus: status }
    } else {
      effectiveConfig = { ...effectiveConfig, licenseStatus: status }
    }
  }
  return {
    success: true,
    config: effectiveConfig,
    defaults: {
      mode: 'server',
      dbDirectory: defaultDir,
      dbFileName: DB_FILE_NAME,
      port: 4000,
      deviceFingerprint: fingerprint
    }
  }
})

ipcMain.handle('app:quit', async () => {
  app.quit()
  return { success: true }
})

ipcMain.handle('setup:save-config', async (_event, payload) => {
  const mode = payload?.mode === 'client' ? 'client' : 'server'
  const base = { setupCompleted: true, mode }
  if (mode === 'server') {
    const dbDirectory = path.resolve(payload?.dbDirectory || getDefaultDbDirectory())
    fs.mkdirSync(dbDirectory, { recursive: true })
    const dbFile = path.join(dbDirectory, DB_FILE_NAME)
    const port = Number(payload?.port || 4000)
    const deviceFingerprint = getDeviceFingerprint()
    const installationKey = String(payload?.installationKey || '').trim()
    const licenseKey = String(payload?.licenseKey || '').trim()
    const companyName = String(payload?.companyName || '').trim()
    const companyPhone = String(payload?.companyPhone || '').trim()
    const config = {
      ...base,
      server: { dbDirectory, dbFile, port },
      apiBaseUrl: `http://localhost:${port}/api`
    }
    applyRuntimeConfig(config)
    const serverStart = await serverManager.startServer({ port, dbFile })
    if (!serverStart?.success) {
      return {
        success: false,
        code: 'SERVER_ERROR',
        error: serverStart?.error || 'Failed to start server during setup'
      }
    }
    const apiReady = await waitForApiReady(`http://localhost:${port}`)
    if (!apiReady) {
      return {
        success: false,
        code: 'SERVER_ERROR',
        error: 'Server started but API is not ready yet. Please retry in a moment.'
      }
    }

    const currentStatus = await licenseManager.getStatus(deviceFingerprint)
    if (!currentStatus?.valid) {
      if (!licenseKey || !companyName || !companyPhone) {
        return { success: false, error: 'License key, company name, and company phone are required for server setup' }
      }
      const activation = await licenseManager.activate({
        installation_key: installationKey || null,
        license_key: licenseKey,
        device_fingerprint: deviceFingerprint,
        company_name: companyName,
        company_phone: companyPhone
      })
      if (!activation?.success) {
        const normalizedFailure = normalizeLicenseActivationFailure(activation?.error)
        return {
          success: false,
          code: normalizedFailure.code,
          error: normalizedFailure.error,
          details: activation?.details || null
        }
      }
    }

    saveRuntimeConfig(config)
    applyRuntimeConfig(config)
    const previousWindow = win
    setTimeout(() => {
      if (previousWindow && !previousWindow.isDestroyed()) {
        previousWindow.destroy()
      }
      createMainWindow()
    }, 80)
    return { success: true, config }
  }
  const serverUrl = normalizeServerUrl(payload?.serverUrl)
  if (!serverUrl) return { success: false, error: 'Server URL is required in client mode' }
  const config = {
    ...base,
    client: { serverUrl },
    apiBaseUrl: `${serverUrl}/api`
  }
  saveRuntimeConfig(config)
  applyRuntimeConfig(config)
  await serverManager.stopServer()
  return { success: true, config }
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
FinancialIpcHandlers();
FiscalYearsIpcHandlers();
ReportsIpcHandlers();
LicenseIpcHandlers();

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', async () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    let effectiveCfg = resolveConfigByDbPresence(runtimeConfig || loadRuntimeConfig())
    applyRuntimeConfig(effectiveCfg)

    if (effectiveCfg?.setupCompleted && effectiveCfg?.mode === 'server') {
      const dbFile = effectiveCfg?.server?.dbFile || path.join(getDefaultDbDirectory(), DB_FILE_NAME)
      const port = Number(effectiveCfg?.server?.port || 4000)
      await serverManager.startServer({ port, dbFile })
      const apiReady = await waitForApiReady(`http://localhost:${port}`)
      if (apiReady) {
        effectiveCfg = await resolveLicenseState(effectiveCfg)
        applyRuntimeConfig(effectiveCfg)
      }
    }

    if (effectiveCfg?.setupCompleted) createMainWindow()
    else createWizardWindow()
  }
})

app.on('before-quit', async () => {
  // Optionally stop services when app quits
  // await serverManager.stopServices()
})

app.whenReady().then(async () => {
  const cfg = loadRuntimeConfig()
  let effectiveCfg = resolveConfigByDbPresence(cfg)
  applyRuntimeConfig(effectiveCfg)

  if (effectiveCfg?.setupCompleted && effectiveCfg?.mode === 'server') {
    const dbFile = effectiveCfg?.server?.dbFile || path.join(getDefaultDbDirectory(), DB_FILE_NAME)
    const port = Number(effectiveCfg?.server?.port || 4000)
    await serverManager.startServer({ port, dbFile })
    const apiReady = await waitForApiReady(`http://localhost:${port}`)
    if (apiReady) {
      effectiveCfg = await resolveLicenseState(effectiveCfg)
      applyRuntimeConfig(effectiveCfg)
    }
  }
  if (effectiveCfg?.setupCompleted) createMainWindow()
  else createWizardWindow()
})
