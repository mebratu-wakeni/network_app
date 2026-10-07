import { app, BrowserWindow, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { createRequire } from 'node:module'
import { compareVersions } from './versionCompare.js'

const require = createRequire(import.meta.url)
const { version: PACKAGE_VERSION } = require('../package.json')

/** Managed Cloud (multi-tenant) update feed — do not point at downloads/lan. */
const DEFAULT_UPDATES_BASE = 'https://server.masatechplc.com/downloads/cloud-multi'

function getUpdatesFeedUrl() {
  const fromEnv = String(process.env.CLOUD_UPDATES_URL || '').trim().replace(/\/+$/, '')
  return fromEnv || DEFAULT_UPDATES_BASE
}

function installedVersion() {
  try {
    // Packaged builds: Electron reads version from the built app (matches installer filename).
    if (app?.isPackaged) return String(app.getVersion() || PACKAGE_VERSION)
  } catch (_) {}
  return String(PACKAGE_VERSION)
}

let updateCheckStarted = false
let simulateMode = false
let simulateTimer = null
let currentState = {
  status: 'idle', // idle | checking | available | downloading | downloaded | up-to-date | error
  version: null,
  releaseNotes: '',
  mandatory: false,
  percent: 0,
  error: null,
  currentVersion: installedVersion(),
  simulated: false,
  manualDownloadUrl: null
}

function broadcast(payload) {
  currentState = {
    ...currentState,
    ...payload,
    currentVersion: installedVersion()
  }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('updater:state', currentState)
    }
  }
}

function clearSimulateTimer() {
  if (simulateTimer) {
    clearInterval(simulateTimer)
    simulateTimer = null
  }
}

async function fetchUpdatePolicy(feedUrl) {
  const url = `${feedUrl}/latest.json`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`latest.json HTTP ${res.status}`)
    const data = await res.json()
    return {
      version: data?.version || null,
      releaseNotes: data?.releaseNotes || '',
      mandatory: data?.mandatory === true,
      minSupportedVersion: data?.minSupportedVersion || null,
      artifacts: data?.artifacts || null
    }
  } catch (err) {
    console.warn('[cloud-updater] policy fetch failed:', err?.message || err)
    return null
  }
}

function pickManualDownloadUrl(policy) {
  const artifacts = policy?.artifacts || {}
  const platform = process.platform
  if (platform === 'darwin') {
    return artifacts.mac?.url || null
  }
  if (platform === 'win32') {
    return artifacts.win?.url || artifacts.win32?.url || null
  }
  if (platform === 'linux') {
    return artifacts.linux?.url || null
  }
  return artifacts.mac?.url || artifacts.win?.url || artifacts.linux?.url || null
}

function classifyUpdate(policy, availableVersion) {
  const target = availableVersion || policy?.version
  let mandatory = policy?.mandatory === true
  const current = installedVersion()
  if (policy?.minSupportedVersion && compareVersions(current, policy.minSupportedVersion) < 0) {
    mandatory = true
  }
  return {
    version: target,
    releaseNotes: policy?.releaseNotes || '',
    mandatory,
    manualDownloadUrl: pickManualDownloadUrl(policy)
  }
}

/**
 * If electron-updater cannot advertise an update (e.g. macOS feed pointed at DMG only)
 * but latest.json is newer than the installed build, still surface a banner with a
 * manual download link so users know a newer installer exists.
 */
async function maybeOfferPolicyUpdate(feedUrl, { preferManual = false } = {}) {
  const policy = await fetchUpdatePolicy(feedUrl)
  if (!policy?.version) return false
  const current = installedVersion()
  if (compareVersions(current, policy.version) >= 0) return false

  const classified = classifyUpdate(policy, policy.version)
  broadcast({
    status: 'available',
    version: classified.version,
    releaseNotes: classified.releaseNotes,
    mandatory: classified.mandatory,
    percent: 0,
    error: preferManual
      ? 'Automatic update package unavailable — download the installer instead.'
      : null,
    simulated: false,
    manualDownloadUrl: classified.manualDownloadUrl
  })
  return true
}

function bumpPatch(version) {
  const parts = String(version || '0.0.0').split('.').map((p) => parseInt(p, 10) || 0)
  while (parts.length < 3) parts.push(0)
  parts[2] += 1
  return parts.join('.')
}

/**
 * Dev/cloud UI walkthrough — does not download a real installer.
 * Available in unpackaged builds so `npm run dev:cloud` can exercise the UX.
 */
function startSimulatedUpdate({ mandatory = false } = {}) {
  clearSimulateTimer()
  simulateMode = true
  const nextVersion = bumpPatch(installedVersion())
  broadcast({
    status: 'available',
    version: nextVersion,
    releaseNotes: mandatory
      ? 'Simulated required update (dev only).'
      : 'Simulated optional update (dev only).',
    mandatory: !!mandatory,
    percent: 0,
    error: null,
    simulated: true,
    manualDownloadUrl: null
  })
  return { success: true, state: currentState }
}

function startSimulatedDownload() {
  clearSimulateTimer()
  simulateMode = true
  let percent = 0
  broadcast({ status: 'downloading', percent: 0, error: null, simulated: true })
  simulateTimer = setInterval(() => {
    percent = Math.min(100, percent + 8)
    if (percent >= 100) {
      clearSimulateTimer()
      broadcast({ status: 'downloaded', percent: 100, error: null, simulated: true })
      return
    }
    broadcast({ status: 'downloading', percent, simulated: true })
  }, 120)
  return { success: true }
}

/**
 * Managed Cloud auto-update (packaged cloud builds only).
 * Feed: CLOUD_UPDATES_URL or https://server.masatechplc.com/downloads/cloud-multi
 */
export function initCloudAutoUpdater() {
  if (!app.isPackaged) {
    console.log('[cloud-updater] unpackaged build — use updater:simulate for UX testing')
    return
  }
  if (updateCheckStarted) return
  updateCheckStarted = true

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  const feedUrl = getUpdatesFeedUrl()
  autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl })
  console.log('[cloud-updater] feed:', feedUrl, 'installed:', installedVersion())

  autoUpdater.on('error', async (err) => {
    console.warn('[cloud-updater]', err?.message || err)
    const offered = await maybeOfferPolicyUpdate(feedUrl, { preferManual: true })
    if (offered) return
    broadcast({
      status: 'error',
      error: err?.message || String(err),
      percent: 0,
      simulated: false
    })
  })

  autoUpdater.on('checking-for-update', () => {
    broadcast({ status: 'checking', error: null, simulated: false, manualDownloadUrl: null })
  })

  autoUpdater.on('update-available', async (info) => {
    const policy = await fetchUpdatePolicy(feedUrl)
    const classified = classifyUpdate(policy, info?.version)
    broadcast({
      status: 'available',
      version: classified.version || info?.version || null,
      releaseNotes: classified.releaseNotes,
      mandatory: classified.mandatory,
      percent: 0,
      error: null,
      simulated: false,
      // Keep manual URL as fallback if auto-download later fails (unsigned mac, etc.)
      manualDownloadUrl: classified.manualDownloadUrl
    })
  })

  autoUpdater.on('update-not-available', async () => {
    const offered = await maybeOfferPolicyUpdate(feedUrl, { preferManual: true })
    if (offered) return
    broadcast({
      status: 'up-to-date',
      version: null,
      mandatory: false,
      percent: 0,
      error: null,
      simulated: false,
      manualDownloadUrl: null
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(Number(progress?.percent) || 0)
    broadcast({ status: 'downloading', percent, simulated: false })
  })

  autoUpdater.on('update-downloaded', () => {
    broadcast({ status: 'downloaded', percent: 100, error: null, simulated: false })
  })

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(async (err) => {
      console.warn('[cloud-updater] check failed:', err?.message || err)
      const offered = await maybeOfferPolicyUpdate(feedUrl, { preferManual: true })
      if (offered) return
      broadcast({ status: 'error', error: err?.message || String(err), simulated: false })
    })
  }, 8000)
}

export function registerCloudUpdaterIpc(ipcMain) {
  ipcMain.handle('updater:get-state', async () => {
    currentState = { ...currentState, currentVersion: installedVersion() }
    return currentState
  })

  ipcMain.handle('updater:simulate', async (_event, payload = {}) => {
    if (app.isPackaged) {
      return { success: false, error: 'Simulation is only available in development builds.' }
    }
    return startSimulatedUpdate({ mandatory: payload?.mandatory === true })
  })

  ipcMain.handle('updater:check-now', async () => {
    if (!app.isPackaged) {
      return startSimulatedUpdate({ mandatory: false })
    }
    const feedUrl = getUpdatesFeedUrl()
    try {
      broadcast({ status: 'checking', error: null, simulated: false })
      await autoUpdater.checkForUpdates()
      return { success: true, state: currentState }
    } catch (err) {
      const offered = await maybeOfferPolicyUpdate(feedUrl, { preferManual: true })
      if (offered) return { success: true, state: currentState, manual: true }
      broadcast({ status: 'error', error: err?.message || String(err), simulated: false })
      return { success: false, error: err?.message || String(err) }
    }
  })

  ipcMain.handle('updater:start-download', async () => {
    if (!app.isPackaged || simulateMode || currentState.simulated) {
      return startSimulatedDownload()
    }
    // Manual path when auto package is missing (e.g. macOS DMG-only feed / unsigned)
    if (currentState.manualDownloadUrl && currentState.error) {
      try {
        await shell.openExternal(currentState.manualDownloadUrl)
        return { success: true, manual: true }
      } catch (err) {
        broadcast({ status: 'error', error: err?.message || String(err), simulated: false })
        return { success: false, error: err?.message || String(err) }
      }
    }
    try {
      broadcast({ status: 'downloading', percent: 0, error: null, simulated: false })
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (err) {
      const url = currentState.manualDownloadUrl
      if (url) {
        try {
          await shell.openExternal(url)
          broadcast({
            status: 'available',
            error: 'Opened installer download in your browser. Install manually, then restart PharmaSuit.',
            simulated: false
          })
          return { success: true, manual: true }
        } catch (_) {}
      }
      broadcast({ status: 'error', error: err?.message || String(err), simulated: false })
      return { success: false, error: err?.message || String(err) }
    }
  })

  ipcMain.handle('updater:open-download', async () => {
    const url = currentState.manualDownloadUrl
    if (!url) return { success: false, error: 'No download URL available.' }
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (err) {
      return { success: false, error: err?.message || String(err) }
    }
  })

  ipcMain.handle('updater:install', async () => {
    if (!app.isPackaged || simulateMode || currentState.simulated) {
      clearSimulateTimer()
      simulateMode = false
      broadcast({
        status: 'idle',
        version: null,
        releaseNotes: '',
        mandatory: false,
        percent: 0,
        error: null,
        simulated: false,
        manualDownloadUrl: null
      })
      return {
        success: true,
        simulated: true,
        message: 'Simulated install complete (dev only — app was not restarted).'
      }
    }
    setImmediate(() => autoUpdater.quitAndInstall(false, true))
    return { success: true }
  })

  ipcMain.handle('updater:dismiss', async () => {
    if (currentState.mandatory && (currentState.status === 'available' || currentState.status === 'downloaded')) {
      return { success: false, error: 'This update is required.' }
    }
    clearSimulateTimer()
    if (currentState.status === 'available' || currentState.status === 'downloading' || currentState.status === 'error') {
      simulateMode = false
      broadcast({
        status: 'idle',
        version: null,
        releaseNotes: '',
        mandatory: false,
        percent: 0,
        error: null,
        simulated: false,
        manualDownloadUrl: null
      })
    }
    return { success: true }
  })
}
