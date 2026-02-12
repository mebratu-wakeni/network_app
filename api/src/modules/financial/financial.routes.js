/**
 * Financial routes: expenses, deposits, receivables, payables
 */
import { Router } from 'express'
import knex from '../../db/knex.js'
import { authenticate } from '../../middleware/auth.js'
import { FinancialRepository } from './financial.repository.js'
import { FinancialService } from './financial.service.js'
import { FinancialController } from './financial.controller.js'

const repository = new FinancialRepository(knex)
const service = new FinancialService(repository)
const controller = new FinancialController(service)

const router = Router()
router.use(authenticate)

// Expenses
router.post('/expenses', controller.createExpense)
router.get('/expenses', controller.listExpenses)
router.get('/expenses/:id', controller.getExpenseById)

// Deposits
router.post('/deposits', controller.createDeposit)
router.get('/deposits/stats', controller.getDepositStats)
router.get('/deposits', controller.listDeposits)
router.get('/deposits/:id', controller.getDepositById)
router.patch('/deposits/:id', controller.updateDeposit)
router.post('/deposits/:id/reverse', controller.reverseDeposit) // Must be before :id for correct matching

// Cash Loans Receivable
router.post('/receivables/loans', controller.createCashLoanReceivable)
router.get('/receivables/loans', controller.listCashLoansReceivable)
router.post('/receivables/loans/:id/return', controller.recordCashLoanReceivableReturn)

// Cash Loans Payable
router.post('/payables/loans', controller.createCashLoanPayable)
router.get('/payables/loans', controller.listCashLoansPayable)
router.post('/payables/loans/:id/repay', controller.recordCashLoanPayableRepayment)

// Trade summaries (read-only)
router.get('/receivables/trade', controller.getTradeReceivablesSummary)
router.get('/payables/trade', controller.getTradePayablesSummary)

// Withhold receivables (from sales)
router.get('/receivables/withhold', controller.listWithholdReceivables)
router.post('/receivables/withhold/settle', controller.createWithholdReceivableSettlement)

// Withhold payables (from purchases)
router.get('/payables/withhold', controller.listWithholdPayables)
router.post('/payables/withhold/settle', controller.createWithholdPayableSettlement)

export default router
