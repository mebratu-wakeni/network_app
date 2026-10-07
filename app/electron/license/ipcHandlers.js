import { ipcMain } from 'electron'
import LicenseManager from './license.js'

const licenseManager = new LicenseManager()

export function LicenseIpcHandlers() {
  ipcMain.handle('license:get-status', async (_event, deviceFingerprint = null) => {
    return licenseManager.getStatus(deviceFingerprint)
  })

  ipcMain.handle('license:activate', async (_event, payload) => {
    return licenseManager.activate(payload)
  })
}

