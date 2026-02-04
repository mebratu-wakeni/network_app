import { ipcMain } from 'electron'
import SalesManager from './sales.js'
import { getToken } from '../config/authManager.js'

const salesManager = new SalesManager()

function normalizeDate(v) {
  if (v == null || v === '') return new Date().toISOString().split('T')[0]
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  if (typeof v === 'string' && v.includes('T')) return v.split('T')[0]
  if (v instanceof Date) return v.toISOString().split('T')[0]
  return String(v).slice(0, 10)
}

export function SalesIpcHandlers() {
  ipcMain.handle('sales:get-products', async (_event, _searchParams) => {
    return { success: true, products: [] }
  })

  ipcMain.handle('sales:get-customers', async (_event, _searchParams) => {
    return { success: true, customers: [] }
  })

  ipcMain.handle('sales:get-withhold-percentage', async () => {
    try {
      return await salesManager.getWithholdPercentage(getToken())
    } catch (error) {
      console.error('[Sales IPC] get-withhold-percentage:', error)
      return { success: false, withhold_percentage: null, error: error.message }
    }
  })

  ipcMain.handle('sales:get-orders', async (_event, searchParams) => {
    try {
      return await salesManager.getOrders(searchParams, getToken())
    } catch (error) {
      console.error('[Sales IPC] get-orders:', error)
      return { success: false, orders: [], total: 0, stats: {}, error: error.message }
    }
  })

  ipcMain.handle('sales:get-order-by-id', async (_event, orderId) => {
    try {
      const result = await salesManager.getOrderById(orderId, getToken())
      return { success: result.success, order: result.order, items: result.items }
    } catch (error) {
      console.error('[Sales IPC] get-order-by-id:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('sales:get-order-receipt', async (_event, orderId) => {
    try {
      return await salesManager.getOrderReceipt(orderId, getToken())
    } catch (error) {
      console.error('[Sales IPC] get-order-receipt:', error)
      return { success: false, receipt: null, error: error.message }
    }
  })

  ipcMain.handle('sales:get-hold-orders', async (_event, searchParams) => {
    try {
      return await salesManager.getHoldOrders(searchParams, getToken())
    } catch (error) {
      console.error('[Sales IPC] get-hold-orders:', error)
      return { success: false, hold_orders: [], total: 0, error: error.message }
    }
  })

  ipcMain.handle('sales:get-hold-order-by-id', async (_event, holdOrderId) => {
    try {
      return await salesManager.getHoldOrderById(holdOrderId, getToken())
    } catch (error) {
      console.error('[Sales IPC] get-hold-order-by-id:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('sales:create-hold-order', async (_event, snapshot) => {
    try {
      return await salesManager.createHoldOrder(snapshot, getToken())
    } catch (error) {
      console.error('[Sales IPC] create-hold-order:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('sales:archive-hold-order', async (_event, holdOrderId) => {
    try {
      await salesManager.archiveHoldOrder(holdOrderId, getToken())
      return { success: true }
    } catch (error) {
      console.error('[Sales IPC] archive-hold-order:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('sales:process-sale', async (_event, payload) => {
    try {
      const { currentSale, totals } = payload || {}
      if (!currentSale || !currentSale.items || currentSale.items.length === 0) {
        return { success: false, error: 'Customer and at least one item are required' }
      }

      const order_date = normalizeDate(currentSale.sale_date || currentSale.order_date)
      const payment_type = currentSale.payment_mode || currentSale.payment_type || 'cash'
      const withhold_percentage = currentSale.is_withholding && totals?.withhold_percentage != null ? Number(totals.withhold_percentage) : null
      let amount_paid = currentSale.first_payment != null ? Number(currentSale.first_payment) : null
      if (payment_type === 'cash') amount_paid = totals?.net_amount ?? 0
      if (payment_type === 'cheque' && currentSale.cheque_details?.amount != null) amount_paid = Number(currentSale.cheque_details.amount)

      const orderData = {
        customer_id: currentSale.customer_id != null && currentSale.customer_id !== '' ? Number(currentSale.customer_id) : null,
        order_date,
        invoice_no: currentSale.invoice_no || null,
        remark: currentSale.remark || (currentSale.withhold_reference ? `Withhold ref: ${currentSale.withhold_reference}` : null),
        payment_type,
        withhold_percentage,
        amount_paid: amount_paid ?? 0,
        cheque_details: payment_type === 'cheque' && currentSale.cheque_details
          ? {
              bank_name: currentSale.cheque_details.bank_name || '',
              cheque_number: currentSale.cheque_details.cheque_no || currentSale.cheque_details.cheque_number || '',
              cheque_date: normalizeDate(currentSale.cheque_details.cheque_date),
              amount: Number(currentSale.cheque_details.amount)
            }
          : null,
        items: currentSale.items.map((item) => ({
          product_id: Number(item.product_id),
          inventory_id: Number(item.inventory_id),
          quantity: Math.max(1, Math.floor(Number(item.quantity))),
          unit_price: Number(item.unit_price)
        }))
      }

      const result = await salesManager.createOrder(orderData, getToken())
      return result
    } catch (error) {
      console.error('[Sales IPC] process-sale:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('sales:pay-order', async (_event, { orderId, ...paymentData }) => {
    try {
      return await salesManager.payOrder(orderId, paymentData, getToken())
    } catch (error) {
      console.error('[Sales IPC] pay-order:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('sales:confirm-withhold', async (_event, { orderId, sales_invoice_no }) => {
    try {
      return await salesManager.confirmWithhold(orderId, { sales_invoice_no }, getToken())
    } catch (error) {
      console.error('[Sales IPC] confirm-withhold:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('sales:rollback-withhold', async (_event, orderId) => {
    try {
      return await salesManager.rollbackWithhold(orderId, getToken())
    } catch (error) {
      console.error('[Sales IPC] rollback-withhold:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('sales:reverse-order', async (_event, { orderId, reason }) => {
    try {
      return await salesManager.reverseOrder(orderId, { reason }, getToken())
    } catch (error) {
      console.error('[Sales IPC] reverse-order:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('sales:export-sales-order', async (_event) => {
    try {
      return await salesManager.exportSalesOrder(getToken())
    } catch (error) {
      console.error('[Sales IPC] export-sales-order:', error)
      return { success: false, error: error.message }
    }
  })
}
