import { ipcMain } from 'electron'
import reportsManager from './reports.js'
import { getToken } from '../config/authManager.js'

export function ReportsIpcHandlers() {
  ipcMain.handle('reports:income-statement', async (_e, params) =>
    reportsManager.getIncomeStatement(params, getToken()))

  ipcMain.handle('reports:balance-sheet', async (_e, params) =>
    reportsManager.getBalanceSheet(params, getToken()))

  ipcMain.handle('reports:cash-flow', async (_e, params) =>
    reportsManager.getCashFlow(params, getToken()))

  ipcMain.handle('reports:equity', async (_e, params) =>
    reportsManager.getStatementOfChangesInEquity(params, getToken()))
}
