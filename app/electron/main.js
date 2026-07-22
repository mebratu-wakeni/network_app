import { app, BrowserWindow, nativeImage, ipcMain, protocol, dialog } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import dgram from 'node:dgram'
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
import { setToken, clearToken } from './config/authManager.js'
import { setOnSessionExpired, setOnServerDown, setOnClientOutdated } from './config/apiFetch.js'
import { setApiBaseUrl } from './config/apiConfig.js'
import { initCloudAutoUpdater, registerCloudUpdaterIpc, handleClientOutdated } from './cloudUpdater.js'

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

// This branch (feature/cloud-multi-tenant) is permanently a tenant-based cloud
// client: there is no self-hosted "server" mode, no LAN discovery, and no local
// license activation. Always true here (kept as a named constant rather than a
// literal so the LAN-specific branches below stay easy to find and reason about).
const IS_CLOUD_BUILD = true

const APP_NAME = 'PharmaSuitLAN'
const DB_FILE_NAME = 'pharmasuit_lan.db'
const DISCOVERY_PORT = 47832
const DISCOVERY_SERVICE = 'masatech-server'
const DISCOVERY_QUERY = 'MASATECH_DISCOVERY_QUERY_V1'
const DISCOVERY_RESPONSE = 'MASATECH_DISCOVERY_RESPONSE_V1'
let discoverySocket = null
let discoveryServerInfo = null

// Ensure userData path is consistent between dev and packaged builds.
app.setName(APP_NAME)

/**
 * Canonical app data root. Uses appData + APP_NAME so dev and packaged
 * always use the same path (app.getName() can differ in dev, causing different userData).
 */
function getAppDataRoot() {
  return path.join(app.getPath('appData'), APP_NAME)
}

// ── Bootstrap: pointer to data directory (survives app upgrades) ────────────
// Lives in app data root (outside app bundle). Created once at first init.
// Config and DB live in dataDirectory (user-chosen, outside app).

function getBootstrapPath() {
  return path.join(getAppDataRoot(), 'bootstrap.json')
}

function loadBootstrap() {
  try {
    const p = getBootstrapPath()
    if (!fs.existsSync(p)) return null
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'))
    const dir = parsed?.dataDirectory
    if (typeof dir === 'string' && dir.trim()) {
      const resolved = path.resolve(dir)
      const parentExists = fs.existsSync(path.dirname(resolved))
      const isUserData = resolved === path.resolve(getAppDataRoot())
      if (parentExists || isUserData) return { dataDirectory: resolved }
    }
    return null
  } catch (_) {
    return null
  }
}

/** Write bootstrap only when user explicitly sets data directory. Never overwrite on upgrade. */
function saveBootstrap(dataDirectory) {
  if (!dataDirectory || typeof dataDirectory !== 'string') return
  const resolved = path.resolve(dataDirectory)
  if (isUnderProtectedPath(resolved)) return
  const p = getBootstrapPath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify({
    dataDirectory: resolved,
    version: 1,
    createdAt: new Date().toISOString()
  }, null, 2), 'utf8')
}

/** True if path is under a read-only system dir (e.g. Program Files). */
function isUnderProtectedPath(dir) {
  if (!dir || typeof dir !== 'string') return false
  const normalized = path.resolve(dir).toLowerCase()
  return (
    normalized.includes('program files') ||
    normalized.includes('program files (x86)') ||
    /^[a-z]:\\windows\\/i.test(normalized)
  )
}

/**
 * Resolve data directory: user-chosen location for config and DB (outside app).
 * Returns null if no bootstrap (first run, needs setup).
 * Never uses Program Files or other protected paths (would cause EPERM on Windows).
 */
function getDataDirectory() {
  const boot = loadBootstrap()
  if (boot?.dataDirectory) {
    if (isUnderProtectedPath(boot.dataDirectory)) {
      try { fs.unlinkSync(getBootstrapPath()) } catch (_) {}
      return null
    }
    return boot.dataDirectory
  }
  const appDataRoot = getAppDataRoot()
  const legacyDataDir = path.join(appDataRoot, 'data')
  // Migration 1: config in app data root (old packaged layout)
  const legacyConfigInUserData = path.join(appDataRoot, 'runtime-config.json')
  if (fs.existsSync(legacyConfigInUserData)) {
    saveBootstrap(legacyDataDir)
    try {
      fs.mkdirSync(legacyDataDir, { recursive: true })
      const newConfigPath = path.join(legacyDataDir, 'runtime-config.json')
      if (!fs.existsSync(newConfigPath)) fs.copyFileSync(legacyConfigInUserData, newConfigPath)
    } catch (_) {}
    return legacyDataDir
  }
  // Migration 2: config in api/data (old dev layout) — move to userData so packaged finds it
  const legacyDevDir = path.dirname(getLegacyDbPath())
  const legacyDevConfigPath = path.join(legacyDevDir, 'runtime-config.json')
  if (fs.existsSync(legacyDevConfigPath)) {
    try {
      fs.mkdirSync(legacyDataDir, { recursive: true })
      const newDbPath = path.join(legacyDataDir, DB_FILE_NAME)
      const legacyDevDb = path.join(legacyDevDir, DB_FILE_NAME)
      if (fs.existsSync(legacyDevDb) && !fs.existsSync(newDbPath)) {
        fs.copyFileSync(legacyDevDb, newDbPath)
      }
      const newConfigPath = path.join(legacyDataDir, 'runtime-config.json')
      if (!fs.existsSync(newConfigPath)) {
        const cfg = JSON.parse(fs.readFileSync(legacyDevConfigPath, 'utf8'))
        if (cfg?.server) {
          cfg.server = { ...cfg.server, dbDirectory: legacyDataDir, dbFile: newDbPath }
        }
        if (cfg?.profiles?.server?.server) {
          cfg.profiles.server.server = { ...cfg.profiles.server.server, dbDirectory: legacyDataDir, dbFile: newDbPath }
        }
        fs.writeFileSync(newConfigPath, JSON.stringify(cfg, null, 2), 'utf8')
      }
      saveBootstrap(legacyDataDir)
    } catch (_) {}
    return legacyDataDir
  }
  return null
}

/**
 * Fallback data directory: same for dev and packaged so setup in dev
 * carries over seamlessly to packaged.
 */
function getFallbackDataDirectory() {
  return getAppDataRoot()
}

function getDefaultDbDirectory() {
  const dataDir = getDataDirectory()
  if (dataDir) return dataDir // bootstrap dataDirectory is the db folder (user-chosen)
  return path.join(getFallbackDataDirectory(), 'data')
}

function getRuntimeConfigPath() {
  const dataDir = getDataDirectory()
  const fallback = getFallbackDataDirectory()
  const candidate = dataDir ? path.join(dataDir, 'runtime-config.json') : path.join(fallback, 'runtime-config.json')
  // Never write under Program Files etc. (causes EPERM on Windows)
  return isUnderProtectedPath(path.dirname(candidate)) ? path.join(fallback, 'runtime-config.json') : candidate
}

function getMachineFingerprintPath() {
  return path.join(getAppDataRoot(), 'machine-fingerprint.json')
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
  if (!/^https?:\/\//i.test(trimmed)) {
    // Default localhost/LAN IPs to http, everything else to https
    const isLocal = /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(trimmed)
    return isLocal ? `http://${trimmed}` : `https://${trimmed}`
  }
  return trimmed
}

function loadRuntimeConfig() {
  try {
    const cfgPath = getRuntimeConfigPath()
    if (!fs.existsSync(cfgPath)) {
      // One-time migration: dev/packaged may have saved config under different app names.
      // Copy to canonical getAppDataRoot() so all modes use the same DB and config.
      const appData = app.getPath('appData')
      const legacyPaths = [
        path.join(appData, 'app', 'runtime-config.json'),
        path.join(appData, 'Electron', 'runtime-config.json')
      ]
      const canonicalDataDir = path.join(getAppDataRoot(), 'data')
      const canonicalDbFile = path.join(canonicalDataDir, DB_FILE_NAME)
      for (const legacyCfgPath of legacyPaths) {
        if (!fs.existsSync(legacyCfgPath)) continue
        try {
          fs.mkdirSync(path.dirname(cfgPath), { recursive: true })
          fs.mkdirSync(canonicalDataDir, { recursive: true })
          const migrated = JSON.parse(fs.readFileSync(legacyCfgPath, 'utf8'))
          const oldDbFile = migrated?.server?.dbFile || path.join(path.dirname(legacyCfgPath), 'data', DB_FILE_NAME)
          if (typeof oldDbFile === 'string' && fs.existsSync(oldDbFile) && !fs.existsSync(canonicalDbFile)) {
            fs.copyFileSync(oldDbFile, canonicalDbFile)
          }
          const updated = migrated && typeof migrated === 'object' ? { ...migrated } : {}
          if (updated.server) {
            updated.server = { ...updated.server, dbDirectory: canonicalDataDir, dbFile: canonicalDbFile }
          }
          if (updated.profiles?.server?.server) {
            updated.profiles.server.server = { ...updated.profiles.server.server, dbDirectory: canonicalDataDir, dbFile: canonicalDbFile }
          }
          fs.writeFileSync(cfgPath, JSON.stringify(updated, null, 2), 'utf8')
          saveBootstrap(canonicalDataDir)
          return normalizeRuntimeConfig(updated)
        } catch (_) {
          // migration failed — try next legacy path
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
  const mode = IS_CLOUD_BUILD
    ? 'client'
    : (source?.mode === 'client' ? 'client' : 'server')
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
  const apiBase =
    config?.apiBaseUrl ||
    (config?.client?.serverUrl
      ? `${normalizeServerUrl(config.client.serverUrl)}/api`
      : null)
  setApiBaseUrl(apiBase)
  if (config?.server?.dbFile) process.env.DB_FILE = config.server.dbFile
  else delete process.env.DB_FILE
}

function getApiRootForHealth() {
  // Prefer live runtime config over env — env can be stale after HMR / partial setup.
  const fromConfig =
    runtimeConfig?.apiBaseUrl ||
    (runtimeConfig?.client?.serverUrl
      ? `${normalizeServerUrl(runtimeConfig.client.serverUrl)}/api`
      : null)
  const apiBase = fromConfig || process.env.API_BASE_URL || 'http://localhost:4000/api'
  return String(apiBase).replace(/\/api\/?$/i, '')
}

const IPv4_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
function isValidIPv4(addr) {
  if (!addr || typeof addr !== 'string') return false
  if (!IPv4_REGEX.test(addr)) return false
  return addr.split('.').every((octet) => parseInt(octet, 10) <= 255)
}

function getLanIPv4Addresses() {
  const interfaces = os.networkInterfaces()
  const ips = Object.values(interfaces)
    .flat()
    .filter((i) => i && (i.family === 'IPv4' || i.family === 4) && !i.internal && i.address)
    .map((i) => i.address)
    .filter(isValidIPv4)
  return [...new Set(ips)]
}

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, octet) => ((acc << 8) + Number(octet)) >>> 0, 0)
}

function intToIPv4(value) {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.')
}

function getLanBroadcastAddresses() {
  const interfaces = os.networkInterfaces()
  const broadcasts = new Set(['255.255.255.255'])
  for (const entries of Object.values(interfaces)) {
    for (const iface of entries || []) {
      const isIPv4 = iface?.family === 'IPv4' || iface?.family === 4
      if (!iface || iface.internal || !isIPv4 || !iface.address || !iface.netmask) continue
      if (!isValidIPv4(iface.address) || !isValidIPv4(iface.netmask)) continue
      const address = ipv4ToInt(iface.address)
      const netmask = ipv4ToInt(iface.netmask)
      broadcasts.add(intToIPv4((address | (~netmask >>> 0)) >>> 0))
    }
  }
  return [...broadcasts]
}

function getDiscoveryServerInfo(port) {
  const lanIps = getLanIPv4Addresses()
  const primaryIp = lanIps[0] || '127.0.0.1'
  const serverUrl = `http://${primaryIp}:${port}`
  return {
    service: DISCOVERY_SERVICE,
    serverId: getDeviceFingerprint(),
    machineName: os.hostname(),
    port,
    serverUrl,
    apiBaseUrl: `${serverUrl}/api`,
    lanIps,
    appName: APP_NAME,
    version: 1
  }
}

function sendDiscoveryResponse(socket, remote) {
  if (!discoveryServerInfo) return
  const payload = Buffer.from(JSON.stringify({
    type: DISCOVERY_RESPONSE,
    ...discoveryServerInfo,
    timestamp: Date.now()
  }))
  socket.send(payload, 0, payload.length, remote.port, remote.address)
}

function stopDiscoveryResponder() {
  if (!discoverySocket) return
  try {
    discoverySocket.close()
  } catch (_) {}
  discoverySocket = null
  discoveryServerInfo = null
}

function startDiscoveryResponder(port) {
  if (IS_CLOUD_BUILD) return // LAN discovery disabled in cloud builds
  stopDiscoveryResponder()
  discoveryServerInfo = getDiscoveryServerInfo(port)
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
  discoverySocket = socket

  socket.on('message', (message, remote) => {
    let parsed = null
    try {
      parsed = JSON.parse(String(message))
    } catch (_) {
      return
    }
    if (parsed?.type !== DISCOVERY_QUERY || parsed?.service !== DISCOVERY_SERVICE) return
    if (parsed?.clientId && parsed.clientId === discoveryServerInfo.serverId) return
    sendDiscoveryResponse(socket, remote)
  })

  socket.on('error', (error) => {
    console.error('[discovery] responder error:', error)
    stopDiscoveryResponder()
  })

  socket.bind(DISCOVERY_PORT, '0.0.0.0', () => {
    try {
      socket.setBroadcast(true)
    } catch (_) {}
    console.log('[discovery] advertising', discoveryServerInfo.serverUrl, 'on UDP', DISCOVERY_PORT)
  })
}

function normalizeDiscoveryServer(raw) {
  if (!raw || raw.type !== DISCOVERY_RESPONSE || raw.service !== DISCOVERY_SERVICE) return null
  const serverUrl = normalizeServerUrl(raw.serverUrl || '')
  if (!serverUrl) return null
  return {
    serverId: String(raw.serverId || ''),
    machineName: String(raw.machineName || 'Unknown server'),
    port: Number(raw.port || 4000),
    serverUrl,
    apiBaseUrl: `${serverUrl}/api`,
    lanIps: Array.isArray(raw.lanIps) ? raw.lanIps.filter(Boolean) : [],
    appName: raw.appName || APP_NAME,
    lastSeenAt: Date.now()
  }
}

async function discoverMasatechServers(timeoutMs = 1400) {
  if (IS_CLOUD_BUILD) {
    return { success: false, error: 'LAN discovery is not available in cloud mode.', servers: [] }
  }
  return await new Promise((resolve) => {
    const socket = dgram.createSocket('udp4')
    const clientId = getDeviceFingerprint()
    const seen = new Map()
    let settled = false

    const finish = () => {
      if (settled) return
      settled = true
      try {
        socket.close()
      } catch (_) {}
      const servers = Array.from(seen.values())
      if (servers.length === 0) {
        resolve({ success: false, error: 'No Masatech server found on this network.', servers: [] })
        return
      }
      if (servers.length > 1) {
        resolve({
          success: false,
          code: 'DUPLICATE_SERVERS',
          error: 'Multiple Masatech servers were found on this network. Stop all but one server and try again.',
          servers
        })
        return
      }
      resolve({ success: true, server: servers[0], servers })
    }

    socket.on('message', (message) => {
      let parsed = null
      try {
        parsed = JSON.parse(String(message))
      } catch (_) {
        return
      }
      const server = normalizeDiscoveryServer(parsed)
      if (!server || !server.serverId) return
      seen.set(server.serverId, server)
    })

    socket.on('error', (error) => {
      if (settled) return
      settled = true
      try {
        socket.close()
      } catch (_) {}
      resolve({ success: false, error: error.message || 'Unable to scan for Masatech server.', servers: [] })
    })

    socket.bind(0, '0.0.0.0', () => {
      try {
        socket.setBroadcast(true)
      } catch (_) {}
      const payload = Buffer.from(JSON.stringify({
        type: DISCOVERY_QUERY,
        service: DISCOVERY_SERVICE,
        clientId,
        timestamp: Date.now()
      }))
      for (const broadcastAddress of getLanBroadcastAddresses()) {
        socket.send(payload, 0, payload.length, DISCOVERY_PORT, broadcastAddress)
      }
    })

    setTimeout(finish, timeoutMs)
  })
}

async function ensureSingleMasatechServer() {
  if (IS_CLOUD_BUILD) return { success: true } // no LAN conflict check needed
  const discovery = await discoverMasatechServers(900)
  if (!discovery?.success) {
    return discovery?.code === 'DUPLICATE_SERVERS' ? discovery : { success: true }
  }
  const ownId = getDeviceFingerprint()
  const otherServers = (discovery.servers || []).filter((server) => server.serverId && server.serverId !== ownId)
  if (otherServers.length === 0) return { success: true }
  return {
    success: false,
    code: 'DUPLICATE_SERVERS',
    error: 'Another Masatech server is already running on this network. Stop it before starting this server.',
    servers: otherServers
  }
}

function normalizeLicenseActivationFailure(errorMessage, apiCode = null) {
  if (apiCode === 'INVALID_INSTALLATION_KEY') {
    return { code: 'INVALID_INSTALLATION_KEY', error: 'Installation key is invalid. Provide the key you received from your administrator.' }
  }
  if (apiCode === 'LICENSE_SERVER_TIMEOUT') {
    return { code: 'LICENSE_SERVER_TIMEOUT', error: 'License service timed out. Check internet connection and retry.' }
  }
  if (apiCode === 'LICENSE_SERVER_UNREACHABLE') {
    return { code: 'LICENSE_SERVER_UNREACHABLE', error: 'License service is unreachable. Check internet and firewall/proxy settings.' }
  }
  if (apiCode === 'LICENSE_SCRIPT_URL_NOT_CONFIGURED') {
    return { code: 'LICENSE_SCRIPT_URL_NOT_CONFIGURED', error: 'License service is not configured on this server.' }
  }
  const msg = String(errorMessage || '')
  const lower = msg.toLowerCase()
  if (lower.includes('invalid installation key')) {
    return { code: 'INVALID_INSTALLATION_KEY', error: 'Installation key is invalid. Provide the key you received from your administrator.' }
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
  if (
    lower.includes('fetch failed') ||
    lower.includes('econnrefused') ||
    lower.includes('network') ||
    lower.includes('license server') ||
    lower.includes('abort') ||
    lower.includes('timed out')
  ) {
    return {
      code: 'LICENSE_SERVER_UNREACHABLE',
      error: 'License service is unreachable. Check internet connection, firewall, and that script.google.com is reachable.'
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
  const defaultDbFile = path.join(getDefaultDbDirectory(), DB_FILE_NAME)
  const configuredDbFile = configuredServer?.dbFile || null
  const hasSavedConfig = !!(configuredDbFile && (serverProfile?.setupCompleted === true || loaded?.setupCompleted === true))
  // Dev and packaged use same candidates: configured path or default (userData). No legacy api/data.
  const dbCandidates = [configuredDbFile, defaultDbFile]
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

// ── Server-down recovery polling ─────────────────────────────────────────────
// When apiFetch detects a network-level failure it calls setOnServerDown().
// We then poll the health endpoint every SERVER_DOWN_POLL_MS until the server
// responds, then send 'server:up' to the renderer.
const SERVER_DOWN_POLL_MS = 15_000
let _serverDownPollTimer = null

function startServerRecoveryPolling() {
  if (_serverDownPollTimer) return // already polling — don't stack
  _serverDownPollTimer = setInterval(async () => {
    try {
      const apiRoot = getApiRootForHealth()
      if (!apiRoot) return
      const health = await serverManager.checkApiHealth(apiRoot, 10_000)
      if (health?.success && health?.healthy) {
        clearInterval(_serverDownPollTimer)
        _serverDownPollTimer = null
        if (win && !win.isDestroyed()) {
          try { win.webContents.send('server:up') } catch (_) {}
        }
      }
    } catch (_) {}
  }, SERVER_DOWN_POLL_MS)
}

function stopServerRecoveryPolling() {
  if (_serverDownPollTimer) {
    clearInterval(_serverDownPollTimer)
    _serverDownPollTimer = null
  }
}
// ─────────────────────────────────────────────────────────────────────────────

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
  // Wire up the 401 session-expired notifier so any API call returning 401
  // (expired/invalid token) sends an event to the renderer to show login.
  setOnSessionExpired(() => {
    if (win && !win.isDestroyed()) {
      try { win.webContents.send('session:expired') } catch (_) {}
    }
  })

  setOnClientOutdated((info) => {
    handleClientOutdated(info).catch((err) => {
      console.warn('[cloud-updater] client-outdated handler failed:', err?.message || err)
    })
  })

  // Wire up the network-failure notifier: any fetch() throw (connection refused,
  // timeout, DNS error) triggers the server-down overlay in the renderer and
  // starts background polling until the server is reachable again.
  setOnServerDown(() => {
    if (win && !win.isDestroyed()) {
      try { win.webContents.send('server:down') } catch (_) {}
    }
    startServerRecoveryPolling()
  })

  loadRenderer(win)
}

async function bootstrapRuntimeConfig() {
  publishBootProgress('resolve-config', 'Resolving runtime configuration...', 20)
  let effectiveCfg = resolveConfigByDbPresence(runtimeConfig || loadRuntimeConfig())

  // This branch never self-hosts a local API/server, even if a previous build
  // (pre cloud-multi-tenant pivot) left mode:'server' persisted on this machine.
  // Force client mode so we never auto-spawn a local server or license flow.
  if (IS_CLOUD_BUILD && effectiveCfg?.mode === 'server') {
    effectiveCfg = { ...effectiveCfg, mode: 'client' }
  }
  if (IS_CLOUD_BUILD && effectiveCfg?.mode !== 'client') {
    effectiveCfg = { ...effectiveCfg, mode: 'client' }
  }
  const serverUrl = normalizeServerUrl(effectiveCfg?.client?.serverUrl || '')
  if (serverUrl && !effectiveCfg?.apiBaseUrl) {
    effectiveCfg = { ...effectiveCfg, apiBaseUrl: `${serverUrl}/api` }
  }
  applyRuntimeConfig(effectiveCfg)
  console.log('[bootstrap] API_BASE_URL=', process.env.API_BASE_URL || '(unset)')

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
  const duplicateCheck = await ensureSingleMasatechServer()
  if (!duplicateCheck?.success) return duplicateCheck
  const result = await serverManager.startServer({ port, dbFile, mode })
  if (result?.success) startDiscoveryResponder(port)
  return result
})

ipcMain.handle('server:stop', async (event, mode = 'docker') => {
  stopDiscoveryResponder()
  return await serverManager.stopServer()
})

ipcMain.handle('server:status', async () => {
  return await serverManager.getServiceStatus()
})

ipcMain.handle('server:health', async () => {
  return await serverManager.checkApiHealth(getApiRootForHealth())
})

// Immediate health re-check requested by the renderer's "Retry Now" button.
// If healthy, also clears the background polling timer and notifies the renderer.
ipcMain.handle('server:retry-health', async () => {
  const health = await serverManager.checkApiHealth(getApiRootForHealth(), 10_000)
  if (health?.success && health?.healthy) {
    stopServerRecoveryPolling()
    if (win && !win.isDestroyed()) {
      try { win.webContents.send('server:up') } catch (_) {}
    }
  }
  return health
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
  const discoveryInfo = discoveryServerInfo || getDiscoveryServerInfo(port)
  return {
    success: true,
    mode,
    port,
    localhostUrl,
    apiRoot: `${localhostUrl}/api`,
    lanUrls,
    discovery: {
      service: DISCOVERY_SERVICE,
      serverName: 'Masatech Server',
      serverId: discoveryInfo.serverId,
      machineName: discoveryInfo.machineName,
      serverUrl: discoveryInfo.serverUrl,
      apiBaseUrl: discoveryInfo.apiBaseUrl,
      advertising: !!discoverySocket
    },
    publicUrl: null,
    tunnelActive: false
  }
})

ipcMain.handle('server:logs', async (event, service, lines) => {
  return await serverManager.getLogs(service, lines)
})

ipcMain.handle('server:check-dev-status', async () => {
  return await serverManager.checkDevServerStatus()
})

ipcMain.handle('setup:choose-data-directory', async () => {
  const result = await dialog.showOpenDialog(win || null, {
    properties: ['openDirectory'],
    title: 'Choose data directory',
    message: 'Select a folder for config and database storage. This folder should persist across app updates.'
  })
  if (result.canceled || !result.filePaths?.length) return { success: false, path: null }
  return { success: true, path: result.filePaths[0] }
})

ipcMain.handle('setup:get-config', async () => {
  const loaded = runtimeConfig || loadRuntimeConfig()
  const defaultDir = getDefaultDbDirectory()
  try { fs.mkdirSync(defaultDir, { recursive: true }) } catch (_) {}
  let normalizedConfig = resolveConfigByDbPresence(loaded)

  // Cloud builds are client-only; never leave main process on localhost defaults.
  if (IS_CLOUD_BUILD && normalizedConfig?.mode === 'server') {
    normalizedConfig = { ...normalizedConfig, mode: 'client' }
  }
  if (IS_CLOUD_BUILD && normalizedConfig?.mode !== 'client') {
    normalizedConfig = { ...normalizedConfig, mode: 'client' }
  }

  // Always sync API base for main-process fetch (users/me, health, etc.)
  const serverUrl = normalizeServerUrl(normalizedConfig?.client?.serverUrl || '')
  if (serverUrl && !normalizedConfig?.apiBaseUrl) {
    normalizedConfig = { ...normalizedConfig, apiBaseUrl: `${serverUrl}/api` }
  }
  applyRuntimeConfig(normalizedConfig)

  // Pass through persisted license status when available (e.g. after setup).
  // Avoid blocking on network calls — license state is resolved in setup/startup flows.
  const effectiveConfig = {
    ...normalizedConfig,
    licenseRequired: normalizedConfig?.licenseRequired === true,
    licenseStatus: normalizedConfig?.licenseStatus ?? null
  }
  const fingerprint = getDeviceFingerprint()
  // Persist normalized setup paths so restart behavior is deterministic.
  if (
    normalizedConfig?.setupCompleted &&
    normalizedConfig?.mode === 'server' &&
    (!loaded?.setupCompleted || loaded?.server?.dbFile !== normalizedConfig?.server?.dbFile)
  ) {
    saveRuntimeConfig(normalizedConfig)
  }
  return {
    success: true,
    config: effectiveConfig,
    defaults: {
      mode: IS_CLOUD_BUILD ? 'client' : 'server',
      defaultServerUrl: IS_CLOUD_BUILD
        ? (process.env.CLOUD_DEFAULT_SERVER_URL || 'https://server.masatechplc.com').replace(/\/+$/, '')
        : null,
      dbDirectory: defaultDir,
      dbFileName: DB_FILE_NAME,
      port: 4000,
      deviceFingerprint: fingerprint
    }
  }
})

ipcMain.handle('startup:select-mode', async (_event, payload) => {
  const selectedMode = payload?.mode === 'client' ? 'client' : 'server'
  if (IS_CLOUD_BUILD && selectedMode === 'server') {
    return {
      success: false,
      code: 'CLOUD_CLIENT_ONLY',
      error: 'This app connects to the cloud service only. Local server mode is not available.'
    }
  }
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
      const duplicateCheck = await ensureSingleMasatechServer()
      if (!duplicateCheck?.success) {
        return {
          success: false,
          code: duplicateCheck?.code || 'DUPLICATE_SERVERS',
          error: duplicateCheck?.error || 'Another Masatech server is already running on this network.'
        }
      }
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
      startDiscoveryResponder(port)

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
    stopDiscoveryResponder()
    effectiveConfig = { ...effectiveConfig, licenseRequired: false, licenseStatus: null }
  }

  saveRuntimeConfig(effectiveConfig)
  applyRuntimeConfig(effectiveConfig)
  publishBootProgress('init-complete', 'Ready', 100)

  return { success: true, config: effectiveConfig }
})

ipcMain.handle('app:quit', async () => {
  stopDiscoveryResponder()
  app.quit()
  return { success: true }
})

ipcMain.handle('app:is-packaged', async () => app.isPackaged)

ipcMain.handle('setup:save-config', async (_event, payload) => {
  const mode = payload?.mode === 'client' ? 'client' : 'server'
  if (IS_CLOUD_BUILD && mode === 'server') {
    return {
      success: false,
      code: 'CLOUD_CLIENT_ONLY',
      error: 'Local server setup is not available in the cloud client.'
    }
  }
  const base = { setupCompleted: true, mode }
  const loaded = runtimeConfig || loadRuntimeConfig()
  if (mode === 'server') {
    const dbDirectory = path.resolve(payload?.dbDirectory || getDefaultDbDirectory())
    fs.mkdirSync(dbDirectory, { recursive: true })
    // Persist data directory in bootstrap (survives app upgrades, never overwritten)
    saveBootstrap(dbDirectory)
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
    const duplicateCheck = await ensureSingleMasatechServer()
    if (!duplicateCheck?.success) {
      return {
        success: false,
        code: duplicateCheck?.code || 'DUPLICATE_SERVERS',
        error: duplicateCheck?.error || 'Another Masatech server is already running on this network.'
      }
    }
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
    startDiscoveryResponder(port)

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
        const normalizedFailure = normalizeLicenseActivationFailure(activation?.error, activation?.code)
        return {
          success: false,
          code: normalizedFailure.code,
          error: normalizedFailure.error,
          details: activation?.details || null
        }
      }
    }

    // Re-fetch license status to confirm it's in the DB and include in config
    const verifiedStatus = await licenseManager.getStatus(deviceFingerprint)
    config.licenseRequired = !verifiedStatus?.valid
    config.licenseStatus = verifiedStatus || null

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
  stopDiscoveryResponder()
  return { success: true, config }
})

ipcMain.handle('client:test-server-url', async (_event, payload) => {
  return await validateClientServerUrl(payload?.serverUrl)
})

ipcMain.handle('client:discover-server', async () => {
  if (IS_CLOUD_BUILD) {
    return { success: false, error: 'Auto-Discover is not available in cloud mode.' }
  }
  return await discoverMasatechServers()
})

ipcMain.handle('client:connect', async (_event, payload) => {
  const validation = await validateClientServerUrl(payload?.serverUrl)
  if (!validation?.success) return validation

  // client_code identifies which tenant this installation belongs to on a multi-tenant
  // server. Saved once here, then injected silently into every login request below --
  // the user never has to re-enter it.
  const clientCode = String(payload?.clientCode || '').trim().toUpperCase()

  const loaded = runtimeConfig || loadRuntimeConfig()
  const config = {
    ...loaded,
    setupCompleted: true,
    mode: 'client',
    client: { serverUrl: validation.serverUrl, clientCode },
    apiBaseUrl: validation.apiBaseUrl,
    profiles: {
      ...(loaded?.profiles || {}),
      client: {
        ...((loaded?.profiles && loaded.profiles.client) || {}),
        setupCompleted: true,
        client: { serverUrl: validation.serverUrl, clientCode }
      }
    }
  }
  saveRuntimeConfig(config)
  applyRuntimeConfig(config)
  await serverManager.stopServer()
  return { success: true, config }
})


ipcMain.handle('auth:set-token', async (_event, token) => {
  if (token) setToken(String(token))
  return { success: true }
})

ipcMain.handle('auth:clear-token', async () => {
  clearToken()
  return { success: true }
})

ipcMain.handle('auth:login', async (event, credentials) => {
  // Silently attach this installation's client_code (tenant identifier) for
  // client-mode connections to a multi-tenant server. Not needed in server mode
  // (self-hosted single-tenant, no client_code concept).
  const loaded = runtimeConfig || loadRuntimeConfig()
  const clientCode = loaded?.mode === 'client' ? String(loaded?.client?.clientCode || '').trim() : ''
  const payload = clientCode ? { ...credentials, client_code: clientCode } : credentials

  const result = await usersManager.authenticate(payload);

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
  await serverManager.stopServer()
})

app.whenReady().then(async () => {
  registerRendererProtocol()
  registerCloudUpdaterIpc(ipcMain)
  // Apply saved client/server API base BEFORE any window/IPC API traffic.
  await bootstrapRuntimeConfig()
  createMainWindow()
  if (IS_CLOUD_BUILD) initCloudAutoUpdater()
})
