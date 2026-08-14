import { ipcMain } from 'electron'
import fiscalYearsManager from './fiscal-years.js'
import { getToken } from '../config/authManager.js'

export function FiscalYearsIpcHandlers() {
  ipcMain.handle('fiscal-years:create', async (_e, payload) =>
    fiscalYearsManager.create(payload, getToken()))

  ipcMain.handle('fiscal-years:list', async () =>
    fiscalYearsManager.list(getToken()))

  ipcMain.handle('fiscal-years:get-current', async () =>
    fiscalYearsManager.getCurrent(getToken()))

  ipcMain.handle('fiscal-years:close-year', async (_e, year) =>
    fiscalYearsManager.closeYear(year, getToken()))

  ipcMain.handle('fiscal-years:reopen-year', async (_e, year) =>
    fiscalYearsManager.reopenYear(year, getToken()))

  ipcMain.handle('fiscal-years:delete-year', async (_e, year, force) =>
    fiscalYearsManager.deleteYear(year, !!force, getToken()))

  ipcMain.handle('fiscal-years:get-report', async (_e, year) =>
    fiscalYearsManager.getReport(year, getToken()))
}
