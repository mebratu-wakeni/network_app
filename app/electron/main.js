import { app, BrowserWindow, nativeImage, ipcMain, protocol } from 'electron'
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

const APP_PROTOCOL = 'app'
const APP_PROTOCOL_HOST = 'local'

if (!VITE_DEV_SERVER_URL) {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_PROTOCOL,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    }
  ])
}

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win; let token;
const serverManager = new ServerManager()
const usersManager = new UsersManager()
const licenseManager = new LicenseManager()
let runtimeConfig = null
let latestBootMessage = null

const APP_NAME = 'PharmaSuitLAN'
const DB_FILE_NAME = 'pharmasuit_lan.db'

// Ensure userData path is consistent between dev (name='app') and packaged
// (productName='YourAppName') builds by locking the app name before any
// app.getPath() call.  Without this, every packaged run is treated as a
// first-time install because the config is in a different directory.
app.setName(APP_NAME)

function getDefaultDbDirectory() {
  if (VITE_DEV_SERVER_URL) {
    return path.dirname(getLegacyDbPath())
  }
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

function getMachineFingerprintPath() {
  return path.join(app.getPath('userData'), 'machine-fingerprint.json')
}

function getLegacyDbPath() {
  // Legacy/dev location used before runtime config-driven dbDirectory.
  return path.join(process.env.APP_ROOT || path.join(__dirname, '..'), '..', 'api', 'data', DB_FILE_NAME)
}

function isValidFingerprint(value) {
  if (typeof value !== 'string') return false
  const legacySha256 = /^[a-f0-9]{64}$/i
  const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return legacySha256.test(value) || uuidV4.test(value)
}

function generateStableFingerprint() {
  return crypto.randomUUID()
}

function readPersistedFingerprint() {
  try {
    const fpPath = getMachineFingerprintPath()
    if (!fs.existsSync(fpPath)) return null
    const parsed = JSON.parse(fs.readFileSync(fpPath, 'utf8'))
    const value = parsed?.fingerprint
    return isValidFingerprint(value) ? value : null
  } catch (_) {
    return null
  }
}

function persistFingerprint(fingerprint) {
  if (!isValidFingerprint(fingerprint)) return
  const fpPath = getMachineFingerprintPath()
  fs.mkdirSync(path.dirname(fpPath), { recursive: true })
  fs.writeFileSync(fpPath, JSON.stringify({
    fingerprint,
    createdAt: new Date().toISOString()
  }, null, 2), 'utf8')
}

function getDeviceFingerprint() {
  const persisted = readPersistedFingerprint()
  if (persisted) return persisted

  const generated = generateStableFingerprint()
  persistFingerprint(generated)
  return generated
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
      // One-time migration: before app.setName() was added, dev builds saved
      // config under the package.json "name" ('app') directory.  Copy it to the
      // canonical location so existing setups survive the upgrade.
      const legacyCfgPath = path.join(app.getPath('appData'), 'app', 'runtime-config.json')
      if (fs.existsSync(legacyCfgPath)) {
        try {
          fs.mkdirSync(path.dirname(cfgPath), { recursive: true })
          fs.copyFileSync(legacyCfgPath, cfgPath)
          const migrated = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
          return normalizeRuntimeConfig(migrated && typeof migrated === 'object' ? migrated : { setupCompleted: false })
        } catch (_) {
          // migration failed — fall through to a fresh config
        }
      }
      return normalizeRuntimeConfig({ setupCompleted: false })
    }
    const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
    return normalizeRuntimeConfig(parsed && typeof parsed === 'object' ? parsed : { setupCompleted: false })
  } catch (e) {
    return normalizeRuntimeConfig({ setupCompleted: false })
  }
}

function saveRuntimeConfig(config) {
  const normalized = normalizeRuntimeConfig(config)
  const cfgPath = getRuntimeConfigPath()
  fs.mkdirSync(path.dirname(cfgPath), { recursive: true })
  fs.writeFileSync(cfgPath, JSON.stringify(normalized, null, 2), 'utf8')
}

function normalizeRuntimeConfig(inputConfig) {
  const source = inputConfig && typeof inputConfig === 'object' ? inputConfig : {}
  const mode = source?.mode === 'client' ? 'client' : 'server'
  const profiles = source?.profiles && typeof source.profiles === 'object' ? source.profiles : {}
  const existingServerProfile = profiles?.server && typeof profiles.server === 'object' ? profiles.server : {}
  const existingClientProfile = profiles?.client && typeof profiles.client === 'object' ? profiles.client : {}

  const migratedServerProfile = {
    ...existingServerProfile,
    ...(source?.server ? { server: source.server } : {}),
    ...(source?.mode === 'server' && typeof source?.setupCompleted === 'boolean'
      ? { setupCompleted: source.setupCompleted }
      : {})
  }

  const migratedClientProfile = {
    ...existingClientProfile,
    ...(source?.client ? { client: source.client } : {}),
    ...(source?.mode === 'client' && typeof source?.setupCompleted === 'boolean'
      ? { setupCompleted: source.setupCompleted }
      : {})
  }

  if (typeof migratedServerProfile.setupCompleted !== 'boolean') {
    migratedServerProfile.setupCompleted = !!(migratedServerProfile?.server?.dbFile || migratedServerProfile?.server?.dbDirectory)
  }
  if (typeof migratedClientProfile.setupCompleted !== 'boolean') {
    migratedClientProfile.setupCompleted = !!migratedClientProfile?.client
  }

  const effectiveServer = migratedServerProfile.server || source?.server || null
  const effectiveClient = migratedClientProfile.client || source?.client || null
  const setupCompleted = mode === 'client'
    ? migratedClientProfile.setupCompleted
    : migratedServerProfile.setupCompleted

  return {
    ...source,
    setupCompleted,
    mode,
    ...(effectiveServer ? { server: effectiveServer } : {}),
    ...(effectiveClient ? { client: effectiveClient } : {}),
    profiles: {
      server: migratedServerProfile,
      client: migratedClientProfile
    }
  }
}

function applyRuntimeConfig(config) {
  runtimeConfig = config
  if (config?.apiBaseUrl) process.env.API_BASE_URL = config.apiBaseUrl
  else delete process.env.API_BASE_URL
  if (config?.server?.dbFile) process.env.DB_FILE = config.server.dbFile
  else delete process.env.DB_FILE
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

async function waitForApiReady(apiRoot, timeoutMs = 30000, intervalMs = 400) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const health = await serverManager.checkApiHealth(apiRoot)
    if (health?.success && health?.healthy) return true
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  return false
}

async function validateClientServerUrl(rawUrl) {
  const serverUrl = normalizeServerUrl(rawUrl)
  if (!serverUrl) {
    return { success: false, error: 'Server URL is required in client mode' }
  }
  const health = await serverManager.checkApiHealth(serverUrl)
  if (!health?.success || !health?.healthy) {
    return { success: false, error: 'Unable to connect to the server URL. Verify the address and server availability.' }
  }
  return {
    success: true,
    serverUrl,
    apiBaseUrl: `${serverUrl}/api`
  }
}

function resolveConfigByDbPresence(initialConfig) {
  const loaded = initialConfig || loadRuntimeConfig()
  const configuredPort = Number(loaded?.server?.port || 4000)
  const configuredDbFile = loaded?.server?.dbFile

  // When setup is done and we have a saved path, use it. Don't substitute with
  // env/legacy/default — that would connect to a different DB or create new ones.
  if (loaded?.setupCompleted && loaded?.mode === 'server' && configuredDbFile) {
    return {
      ...loaded,
      server: {
        dbDirectory: path.dirname(configuredDbFile),
        dbFile: configuredDbFile,
        port: configuredPort
      },
      apiBaseUrl: `http://localhost:${configuredPort}/api`,
      profiles: {
        ...(loaded?.profiles || {}),
        server: {
          ...((loaded?.profiles && loaded.profiles.server) || {}),
          setupCompleted: true,
          server: {
            dbDirectory: path.dirname(configuredDbFile),
            dbFile: configuredDbFile,
            port: configuredPort
          }
        }
      }
    }
  }

  // No saved path or setup not complete: keep as-is (activateModeConfig handles discovery)
  return loaded
}

function activateModeConfig(initialConfig, selectedMode) {
  const loaded = initialConfig || loadRuntimeConfig()
  const mode = selectedMode === 'client' ? 'client' : 'server'
  const serverProfile = loaded?.profiles?.server || {}
  const clientProfile = loaded?.profiles?.client || {}

  if (mode === 'client') {
    const clientConfig = clientProfile?.client || loaded?.client || { serverUrl: '' }
    const serverUrl = normalizeServerUrl(clientConfig?.serverUrl || '')
    return {
      ...loaded,
      mode: 'client',
      setupCompleted: clientProfile?.setupCompleted === true,
      client: { serverUrl: serverUrl || '' },
      ...(serverUrl ? { apiBaseUrl: `${serverUrl}/api` } : {}),
      profiles: {
        ...(loaded?.profiles || {}),
        client: {
          ...clientProfile,
          setupCompleted: clientProfile?.setupCompleted === true,
          client: { serverUrl: serverUrl || '' }
        }
      }
    }
  }

  const configuredServer = serverProfile?.server || loaded?.server || null
  const legacyDbFile = getLegacyDbPath()
  const defaultDbFile = path.join(getDefaultDbDirectory(), DB_FILE_NAME)
  const configuredDbFile = configuredServer?.dbFile || null
  const hasSavedConfig = !!(configuredDbFile && (serverProfile?.setupCompleted === true || loaded?.setupCompleted === true))
  // In packaged app, never use legacy path (Resources/api/data) — it's inside the
  // bundle and wrong for persisted data. Use default (userData) instead.
  const dbCandidates = app.isPackaged
    ? [configuredDbFile, defaultDbFile]
    : [configuredDbFile, legacyDbFile, defaultDbFile]
  // When setup is done and configured path exists, use it. Otherwise discover:
  // prefer an existing DB at default path over creating one at a stale configured path.
  const configuredExists = configuredDbFile && (() => { try { return fs.existsSync(configuredDbFile) } catch (_) { return false } })()
  const existingDbFile = (hasSavedConfig && configuredExists)
    ? configuredDbFile
    : (dbCandidates.find((candidate) => {
        if (!candidate) return false
        try {
          return fs.existsSync(candidate)
        } catch (_) {
          return false
        }
      }) || defaultDbFile)
  const serverPort = Number(configuredServer?.port || 4000)
  const serverConfig = existingDbFile
    ? {
        dbDirectory: path.dirname(existingDbFile),
        dbFile: existingDbFile,
        port: serverPort
      }
    : configuredServer
  const serverBaseConfig = {
    ...loaded,
    mode: 'server',
    setupCompleted: serverProfile?.setupCompleted === true && !!serverConfig?.dbFile,
    ...(serverConfig ? { server: serverConfig } : {}),
    ...(serverConfig ? { apiBaseUrl: `http://localhost:${serverPort}/api` } : {}),
    profiles: {
      ...(loaded?.profiles || {}),
      server: {
        ...serverProfile,
        setupCompleted: serverProfile?.setupCompleted === true && !!serverConfig?.dbFile,
        ...(serverConfig ? { server: serverConfig } : {})
      }
    }
  }
  return resolveConfigByDbPresence(serverBaseConfig)
}

async function resolveLicenseState(initialConfig) {
  const loaded = initialConfig || loadRuntimeConfig()
  if (!loaded?.setupCompleted || loaded?.mode !== 'server') {
    return { ...loaded, licenseRequired: false, licenseStatus: null }
  }

  const status = await licenseManager.getStatus(getDeviceFingerprint())
  if (status?.success === true && status?.valid === false) {
    return { ...loaded, licenseRequired: true, licenseStatus: status }
  }
  return { ...loaded, licenseRequired: false, licenseStatus: status || null }
}

const iconPath = path.join(__dirname, '..', 'public', 'masatech-logo.png');
const iconImage = nativeImage.createFromPath(iconPath);
if (process.platform === 'darwin' && app.dock) {
  app.dock.setIcon(iconImage);
  app.dock.bounce();
}

function loadRenderer(targetWindow) {
  // Push startup progress state to renderer once it is ready.
  targetWindow.webContents.on('did-finish-load', () => {
    targetWindow?.webContents.send('main-process-message', latestBootMessage || {
      type: 'boot-progress',
      step: 'renderer-ready',
      label: 'Renderer ready',
      percent: 20,
      ts: Date.now()
    })
  })

  if (VITE_DEV_SERVER_URL) {
    targetWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    targetWindow.loadURL(`${APP_PROTOCOL}://${APP_PROTOCOL_HOST}/index.html`)
  }
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

function registerRendererProtocol() {
  if (VITE_DEV_SERVER_URL) return

  // protocol.handle is the Electron 25+ replacement for registerFileProtocol.
  // It uses the Fetch API interface, which means fetch() calls from the renderer
  // (e.g. Ionicons loading SVGs) are properly handled.
  protocol.handle(APP_PROTOCOL, (request) => {
    try {
      const { pathname } = new URL(request.url)
      const relative = !pathname || pathname === '/' ? 'index.html' : pathname.slice(1)
      const filePath = path.join(RENDERER_DIST, decodeURIComponent(relative))
      const ext = path.extname(filePath).toLowerCase()
      const contentType = MIME_TYPES[ext] || 'application/octet-stream'

      try {
        const data = fs.readFileSync(filePath)
        return new Response(data, { headers: { 'Content-Type': contentType } })
      } catch (_) {
        const html = fs.readFileSync(path.join(RENDERER_DIST, 'index.html'))
        return new Response(html, { headers: { 'Content-Type': 'text/html' } })
      }
    } catch (_) {
      return new Response('Not found', { status: 404 })
    }
  })
}

function publishBootProgress(step, label, percent) {
  const payload = {
    type: 'boot-progress',
    step: String(step || ''),
    label: String(label || ''),
    percent: Math.max(0, Math.min(100, Number(percent) || 0)),
    ts: Date.now()
  }
  latestBootMessage = payload
  if (win && !win.isDestroyed()) {
    try {
      win.webContents.send('main-process-message', payload)
    } catch (_) {
      // Renderer not ready yet; latestBootMessage will be sent on did-finish-load.
    }
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

async function bootstrapRuntimeConfig() {
  publishBootProgress('resolve-config', 'Resolving runtime configuration...', 20)
  let effectiveCfg = resolveConfigByDbPresence(runtimeConfig || loadRuntimeConfig())
  applyRuntimeConfig(effectiveCfg)

  if (effectiveCfg?.setupCompleted && effectiveCfg?.mode === 'server') {
    publishBootProgress('start-api', 'Starting local API server...', 45)
    const dbFile = effectiveCfg?.server?.dbFile || path.join(getDefaultDbDirectory(), DB_FILE_NAME)
    const port = Number(effectiveCfg?.server?.port || 4000)
    await serverManager.startServer({ port, dbFile })
    publishBootProgress('wait-api-health', 'Waiting for API health check...', 60)
    const apiReady = await waitForApiReady(`http://localhost:${port}`)
    if (apiReady) {
      publishBootProgress('validate-license', 'Validating license state...', 80)
      effectiveCfg = await resolveLicenseState(effectiveCfg)
      applyRuntimeConfig(effectiveCfg)
      saveRuntimeConfig(effectiveCfg)
    }
  }

  publishBootProgress('init-complete', 'Initialization complete', 100)

  return effectiveCfg
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
  const normalizedConfig = resolveConfigByDbPresence(loaded)
  // Avoid blocking initial renderer mount on network-dependent license checks.
  // License state can still be resolved later by explicit setup/startup flows.
  const effectiveConfig = {
    ...normalizedConfig,
    licenseRequired: false,
    licenseStatus: null
  }
  const fingerprint = getDeviceFingerprint()
  // Persist normalized setup paths so restart behavior is deterministic.
  if (
    normalizedConfig?.setupCompleted &&
    normalizedConfig?.mode === 'server' &&
    (!loaded?.setupCompleted || loaded?.server?.dbFile !== normalizedConfig?.server?.dbFile)
  ) {
    saveRuntimeConfig(normalizedConfig)
    applyRuntimeConfig(normalizedConfig)
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

ipcMain.handle('startup:select-mode', async (_event, payload) => {
  const selectedMode = payload?.mode === 'client' ? 'client' : 'server'
  console.log('[startup] select-mode', selectedMode)

  const loaded = runtimeConfig || loadRuntimeConfig()
  let effectiveConfig = activateModeConfig(loaded, selectedMode)
  console.log('[startup] setupCompleted=', effectiveConfig?.setupCompleted, 'dbFile=', effectiveConfig?.server?.dbFile)

  if (selectedMode === 'server') {
    if (effectiveConfig?.setupCompleted && effectiveConfig?.server?.dbFile) {
      const dbFile = effectiveConfig.server.dbFile
      const port = Number(effectiveConfig?.server?.port || 4000)
      console.log('[startup] starting server port=', port, 'dbFile=', dbFile)

      publishBootProgress('start-api', 'Starting local API server...', 30)
      const serverStart = await serverManager.startServer({ port, dbFile })
      console.log('[startup] serverStart=', serverStart?.success, serverStart?.error || '')
      if (!serverStart?.success) {
        return {
          success: false,
          code: 'SERVER_START_FAILED',
          error: serverStart?.error || 'Failed to start the local API server.'
        }
      }

      console.log('[startup] waiting for API ready...')
      publishBootProgress('wait-api-health', 'Waiting for API to be ready...', 60)
      const apiReady = await waitForApiReady(`http://localhost:${port}`)
      console.log('[startup] apiReady=', apiReady)
      if (!apiReady) {
        return {
          success: false,
          code: 'API_NOT_READY',
          error: 'Server process started but the API did not respond in time. Check server logs for errors.'
        }
      }

      // Apply config BEFORE resolveLicenseState so license manager fetches from the
      // local API we just started, not a stale client-mode URL from a previous run.
      applyRuntimeConfig(effectiveConfig)

      console.log('[startup] validating license...')
      publishBootProgress('validate-license', 'Validating license...', 85)
      effectiveConfig = await resolveLicenseState(effectiveConfig)
      console.log('[startup] license done, licenseRequired=', effectiveConfig?.licenseRequired)
    }
    // If setupCompleted is false the renderer will show SetupWizard — that is intentional.
  } else {
    publishBootProgress('client-connect', 'Connecting in client mode...', 50)
    await serverManager.stopServer()
    effectiveConfig = { ...effectiveConfig, licenseRequired: false, licenseStatus: null }
  }

  saveRuntimeConfig(effectiveConfig)
  applyRuntimeConfig(effectiveConfig)
  publishBootProgress('init-complete', 'Ready', 100)

  return { success: true, config: effectiveConfig }
})

ipcMain.handle('app:quit', async () => {
  app.quit()
  return { success: true }
})

ipcMain.handle('setup:save-config', async (_event, payload) => {
  const mode = payload?.mode === 'client' ? 'client' : 'server'
  const base = { setupCompleted: true, mode }
  const loaded = runtimeConfig || loadRuntimeConfig()
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
      apiBaseUrl: `http://localhost:${port}/api`,
      profiles: {
        ...(loaded?.profiles || {}),
        server: {
          ...((loaded?.profiles && loaded.profiles.server) || {}),
          setupCompleted: true,
          server: { dbDirectory, dbFile, port }
        }
      }
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
  const serverUrl = normalizeServerUrl(payload?.serverUrl || '')
  const config = {
    ...loaded,
    ...base,
    client: { serverUrl: serverUrl || '' },
    ...(serverUrl ? { apiBaseUrl: `${serverUrl}/api` } : {}),
    profiles: {
      ...(loaded?.profiles || {}),
      client: {
        ...((loaded?.profiles && loaded.profiles.client) || {}),
        setupCompleted: true,
        client: { serverUrl: serverUrl || '' }
      }
    }
  }
  saveRuntimeConfig(config)
  applyRuntimeConfig(config)
  await serverManager.stopServer()
  return { success: true, config }
})

ipcMain.handle('client:test-server-url', async (_event, payload) => {
  return await validateClientServerUrl(payload?.serverUrl)
})

ipcMain.handle('client:connect', async (_event, payload) => {
  const validation = await validateClientServerUrl(payload?.serverUrl)
  if (!validation?.success) return validation

  const loaded = runtimeConfig || loadRuntimeConfig()
  const config = {
    ...loaded,
    setupCompleted: true,
    mode: 'client',
    client: { serverUrl: validation.serverUrl },
    apiBaseUrl: validation.apiBaseUrl,
    profiles: {
      ...(loaded?.profiles || {}),
      client: {
        ...((loaded?.profiles && loaded.profiles.client) || {}),
        setupCompleted: true,
        client: { serverUrl: validation.serverUrl }
      }
    }
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
    token: result.token,
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
    createMainWindow()
  }
})

app.on('before-quit', async () => {
  // Optionally stop services when app quits
  // await serverManager.stopServices()
})

app.whenReady().then(() => {
  registerRendererProtocol()
  createMainWindow()
})
