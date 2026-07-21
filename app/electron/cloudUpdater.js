import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { createRequire } from 'node:module'
import { compareVersions } from './versionCompare.js'

const require = createRequire(import.meta.url)
const { version: APP_VERSION } = require('../package.json')

/** Managed Cloud (multi-tenant) update feed — do not point at downloads/lan. */
const DEFAULT_UPDATES_BASE = 'https://server.masatechplc.com/downloads/cloud-multi'

function getUpdatesFeedUrl() {
  const fromEnv = String(process.env.CLOUD_UPDATES_URL || '').trim().replace(/\/+$/, '')
  return fromEnv || DEFAULT_UPDATES_BASE
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
  currentVersion: APP_VERSION,
  simulated: false
}

function broadcast(payload) {
  currentState = { ...currentState, ...payload, currentVersion: APP_VERSION }
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
      minSupportedVersion: data?.minSupportedVersion || null
    }
  } catch (err) {
    console.warn('[cloud-updater] policy fetch failed:', err?.message || err)
    return null
  }
}

function classifyUpdate(policy, availableVersion) {
  const target = availableVersion || policy?.version
  let mandatory = policy?.mandatory === true
  if (policy?.minSupportedVersion && compareVersions(APP_VERSION, policy.minSupportedVersion) < 0) {
    mandatory = true
  }
  return {
    version: target,
    releaseNotes: policy?.releaseNotes || '',
    mandatory
  }
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
  const nextVersion = bumpPatch(APP_VERSION)
  broadcast({
    status: 'available',
    version: nextVersion,
    releaseNotes: mandatory
      ? 'Simulated required update (dev only).'
      : 'Simulated optional update (dev only).',
    mandatory: !!mandatory,
    percent: 0,
    error: null,
    simulated: true
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
  console.log('[cloud-updater] feed:', feedUrl)

  autoUpdater.on('error', (err) => {
    console.warn('[cloud-updater]', err?.message || err)
    broadcast({
      status: 'error',
      error: err?.message || String(err),
      percent: 0,
      simulated: false
    })
  })

  autoUpdater.on('checking-for-update', () => {
    broadcast({ status: 'checking', error: null, simulated: false })
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
      simulated: false
    })
  })

  autoUpdater.on('update-not-available', () => {
    broadcast({
      status: 'up-to-date',
      version: null,
      mandatory: false,
      percent: 0,
      error: null,
      simulated: false
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
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn('[cloud-updater] check failed:', err?.message || err)
      broadcast({ status: 'error', error: err?.message || String(err), simulated: false })
    })
  }, 8000)
}

export function registerCloudUpdaterIpc(ipcMain) {
  ipcMain.handle('updater:get-state', async () => currentState)

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
    try {
      broadcast({ status: 'checking', error: null, simulated: false })
      await autoUpdater.checkForUpdates()
      return { success: true, state: currentState }
    } catch (err) {
      broadcast({ status: 'error', error: err?.message || String(err), simulated: false })
      return { success: false, error: err?.message || String(err) }
    }
  })

  ipcMain.handle('updater:start-download', async () => {
    if (!app.isPackaged || simulateMode || currentState.simulated) {
      return startSimulatedDownload()
    }
    try {
      broadcast({ status: 'downloading', percent: 0, error: null, simulated: false })
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (err) {
      broadcast({ status: 'error', error: err?.message || String(err), simulated: false })
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
        simulated: false
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
        simulated: false
      })
    }
    return { success: true }
  })
}
