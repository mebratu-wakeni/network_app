import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/components/utils/PermissionChecker.js', () => ({
  permissionChecker: {
    loadPermissions: vi.fn().mockResolvedValue(true),
    hasRule: vi.fn().mockReturnValue(true)
  }
}))

import { SalesVM } from '../../../src/components/modules/sales/SalesVM.js'

describe('SalesVM', () => {
  beforeEach(() => {
    window.ipcRenderer.invoke.mockReset()
    window.ipcRenderer.invoke.mockImplementation(async (channel) => {
      if (channel === 'sales:get-withhold-percentage') return { success: true, withhold_percentage: 2 }
      return { success: true }
    })
  })

  it('calculates totals for credit sales with withholding', () => {
    const vm = new SalesVM()
    vm.updateState('withhold-percentage', 10)
    vm.updateState('current-sale', {
      payment_mode: 'credit',
      is_withholding: true,
      first_payment: 30,
      items: [{ quantity: 2, unit_price: 100 }]
    })

    const totals = vm.calculateSaleTotals()
    expect(totals.subtotal).toBe(200)
    expect(totals.withhold_amount).toBe(20)
    expect(totals.net_amount).toBe(180)
    expect(totals.amount_paid).toBe(30)
    expect(totals.outstanding_balance).toBe(150)
  })

  it('blocks duplicate processSale submissions while loading', async () => {
    let unblock
    const blocker = new Promise((resolve) => { unblock = resolve })
    window.ipcRenderer.invoke.mockImplementation(async (channel) => {
      if (channel === 'sales:get-withhold-percentage') return { success: true, withhold_percentage: 2 }
      if (channel === 'sales:process-sale') {
        await blocker
        return { success: true }
      }
      return { success: true }
    })

    const vm = new SalesVM()
    vm.updateState('current-sale', {
      payment_mode: 'cash',
      items: [{ product_id: 1, inventory_id: 1, quantity: 1, unit_price: 10 }]
    })

    const first = vm.processSale()
    const second = vm.processSale()
    unblock()
    await first
    await second

    const calls = window.ipcRenderer.invoke.mock.calls.filter(([channel]) => channel === 'sales:process-sale')
    expect(calls).toHaveLength(1)
  })

  it('blocks duplicate payOrder submissions while loading', async () => {
    let unblock
    const blocker = new Promise((resolve) => { unblock = resolve })
    window.ipcRenderer.invoke.mockImplementation(async (channel) => {
      if (channel === 'sales:get-withhold-percentage') return { success: true, withhold_percentage: 2 }
      if (channel === 'sales:pay-order') {
        await blocker
        return { success: true }
      }
      if (channel === 'sales:get-order-by-id') return { success: true, order: { id: 7 }, items: [] }
      if (channel === 'sales:get-orders') return { success: true, orders: [], total: 0, stats: {} }
      return { success: true }
    })

    const vm = new SalesVM()
    const first = vm.payOrder(7, { payment_amount: 20, payment_mode: 'cash', payment_date: '2026-02-27' })
    const second = vm.payOrder(7, { payment_amount: 20, payment_mode: 'cash', payment_date: '2026-02-27' })
    unblock()
    await first
    await second

    const calls = window.ipcRenderer.invoke.mock.calls.filter(([channel]) => channel === 'sales:pay-order')
    expect(calls).toHaveLength(1)
  })

  it('getCustomerOutstandingForPayment returns IPC payload', async () => {
    window.ipcRenderer.invoke.mockImplementation(async (channel) => {
      if (channel === 'sales:get-withhold-percentage') return { success: true, withhold_percentage: 2 }
      if (channel === 'sales:get-customer-outstanding') {
        return {
          success: true,
          orders: [{ id: 3, outstanding_balance: 40, receipt_no: 'S1' }],
          total_outstanding: 40,
        }
      }
      return { success: true }
    })

    const vm = new SalesVM()
    const r = await vm.getCustomerOutstandingForPayment(9)
    expect(r.orders).toHaveLength(1)
    expect(r.orders[0].id).toBe(3)
    expect(r.total_outstanding).toBe(40)
    expect(window.ipcRenderer.invoke).toHaveBeenCalledWith('sales:get-customer-outstanding', 9)
  })

  it('bulkPayCustomerSales calls IPC and reloads sales list', async () => {
    const channels = []
    window.ipcRenderer.invoke.mockImplementation(async (channel) => {
      channels.push(channel)
      if (channel === 'sales:get-withhold-percentage') return { success: true, withhold_percentage: 2 }
      if (channel === 'sales:bulk-pay-customer') return { success: true, total_applied: 50, applied: [] }
      if (channel === 'sales:get-orders') return { success: true, orders: [], total: 0, stats: {} }
      return { success: true }
    })

    const vm = new SalesVM()
    await vm.bulkPayCustomerSales({
      customer_id: 2,
      payment_amount: 50,
      allocation: 'fifo',
      payment_mode: 'cash',
      payment_date: '2026-04-30',
    })

    expect(channels).toContain('sales:bulk-pay-customer')
    expect(channels).toContain('sales:get-orders')
    const bulkCall = window.ipcRenderer.invoke.mock.calls.find(([c]) => c === 'sales:bulk-pay-customer')
    expect(bulkCall[1]).toMatchObject({
      customer_id: 2,
      payment_amount: 50,
      allocation: 'fifo',
    })
  })
})
