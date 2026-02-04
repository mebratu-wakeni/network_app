import { ipcMain } from 'electron'
import SettingsManager from './settings.js'
import { getToken } from '../config/authManager.js'

const settingsManager = new SettingsManager()

export function SettingsIpcHandlers() {
  ipcMain.handle('settings:get', async (event) => {
    return await settingsManager.getSettings(getToken())
  })

  ipcMain.handle('settings:update', async (event, payload) => {
    return await settingsManager.updateSettings(payload, getToken())
  })
}
