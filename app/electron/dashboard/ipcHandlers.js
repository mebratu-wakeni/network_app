import { ipcMain } from 'electron';
import dashboardManager from './dashboard.js';
import { getToken } from '../config/authManager.js';

export function DashboardIpcHandlers() {
  ipcMain.handle('dashboard:get-ledger-balances', async () => {
    try {
      return await dashboardManager.getLedgerBalances(getToken());
    } catch (error) {
      console.error('[Dashboard IPC] get-ledger-balances:', error);
      return { success: false, balances: {}, error: error.message };
    }
  });
}
