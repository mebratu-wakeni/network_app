import { app, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'

/** Default Masatech download feed for multi-tenant cloud desktop. */
const DEFAULT_UPDATES_BASE = 'https://server.masatechplc.com/downloads/cloud-multi'

function getUpdatesFeedUrl() {
  const fromEnv = String(process.env.CLOUD_UPDATES_URL || '').trim().replace(/\/+$/, '')
  return fromEnv || DEFAULT_UPDATES_BASE
}

let updateCheckStarted = false

/**
 * Check for app updates (packaged cloud-multi builds only).
 * Uses electron-updater generic provider — host latest-mac.yml / latest.yml on the feed URL.
 */
export function initCloudAutoUpdater() {
  if (!app.isPackaged) return
  if (updateCheckStarted) return
  updateCheckStarted = true

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  const feedUrl = getUpdatesFeedUrl()
  autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl })

  autoUpdater.on('error', (err) => {
    console.warn('[cloud-updater]', err?.message || err)
  })

  autoUpdater.on('update-available', (info) => {
    const version = info?.version || 'new'
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update available',
        message: `PharmaSuit ${version} is available.`,
        detail: 'Download and install now? You can keep working and update later if you choose "Later".',
        buttons: ['Update now', 'Later'],
        defaultId: 0,
        cancelId: 1
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.downloadUpdate().catch(() => {})
      })
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[cloud-updater] App is up to date.')
  })

  autoUpdater.on('update-downloaded', () => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update ready',
        message: 'The update has been downloaded.',
        detail: 'Restart PharmaSuit to finish installing.',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        cancelId: 1
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall(false, true)
      })
  })

  // Defer check so first paint is not blocked
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.warn('[cloud-updater] check failed:', err?.message || err)
    })
  }, 8000)
}
