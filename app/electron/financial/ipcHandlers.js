import { ipcMain } from 'electron'
import financialManager from './financial.js'
import { getToken } from '../config/authManager.js'

export function FinancialIpcHandlers() {
  ipcMain.handle('financial:create-expense', async (_e, body) =>
    financialManager.createExpense(body, getToken()))

  ipcMain.handle('financial:list-expenses', async (_e, params) =>
    financialManager.listExpenses(params, getToken()))

  ipcMain.handle('financial:get-expense', async (_e, id) =>
    financialManager.getExpenseById(id, getToken()))

  ipcMain.handle('financial:create-deposit', async (_e, body) =>
    financialManager.createDeposit(body, getToken()))

  ipcMain.handle('financial:list-deposits', async (_e, params) =>
    financialManager.listDeposits(params, getToken()))

  ipcMain.handle('financial:get-deposit-stats', async (_e, params) =>
    financialManager.getDepositStats(params, getToken()))

  ipcMain.handle('financial:get-deposit', async (_e, id) =>
    financialManager.getDepositById(id, getToken()))

  ipcMain.handle('financial:update-deposit', async (_e, id, body) =>
    financialManager.updateDeposit(id, body, getToken()))

  ipcMain.handle('financial:reverse-deposit', async (_e, id) =>
    financialManager.reverseDeposit(id, getToken()))

  ipcMain.handle('financial:create-cash-loan-receivable', async (_e, body) =>
    financialManager.createCashLoanReceivable(body, getToken()))

  ipcMain.handle('financial:list-cash-loans-receivable', async (_e, params) =>
    financialManager.listCashLoansReceivable(params, getToken()))

  ipcMain.handle('financial:record-cash-loan-receivable-return', async (_e, loanId, body) =>
    financialManager.recordCashLoanReceivableReturn(loanId, body, getToken()))

  ipcMain.handle('financial:create-cash-loan-payable', async (_e, body) =>
    financialManager.createCashLoanPayable(body, getToken()))

  ipcMain.handle('financial:list-cash-loans-payable', async (_e, params) =>
    financialManager.listCashLoansPayable(params, getToken()))

  ipcMain.handle('financial:record-cash-loan-payable-repayment', async (_e, loanId, body) =>
    financialManager.recordCashLoanPayableRepayment(loanId, body, getToken()))

  ipcMain.handle('financial:get-trade-receivables', async () =>
    financialManager.getTradeReceivablesSummary(getToken()))

  ipcMain.handle('financial:get-trade-payables', async () =>
    financialManager.getTradePayablesSummary(getToken()))

  ipcMain.handle('financial:list-withhold-receivables', async (_e, params) =>
    financialManager.listWithholdReceivables(params, getToken()))

  ipcMain.handle('financial:create-withhold-receivable-settlement', async (_e, body) =>
    financialManager.createWithholdReceivableSettlement(body, getToken()))

  ipcMain.handle('financial:list-withhold-payables', async (_e, params) =>
    financialManager.listWithholdPayables(params, getToken()))

  ipcMain.handle('financial:create-withhold-payable-settlement', async (_e, body) =>
    financialManager.createWithholdPayableSettlement(body, getToken()))
}
