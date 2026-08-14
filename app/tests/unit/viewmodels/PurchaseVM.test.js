import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/components/utils/PermissionChecker.js', () => ({
  permissionChecker: {
    loadPermissions: vi.fn().mockResolvedValue(true)
  }
}))

import { PurchaseVM } from '../../../src/components/modules/purchase/PurchaseVM.js'

describe('PurchaseVM', () => {
  beforeEach(() => {
    window.ipcRenderer.invoke.mockReset()
    window.ipcRenderer.invoke.mockImplementation(async (channel, payload) => {
      if (channel === 'purchase:get-withhold-percentage') {
        return { success: true, withhold_percentage: 2 }
      }
      if (channel === 'purchase:create-order') {
        return { success: true, purchase_order: { id: 42, ...payload } }
      }
      return { success: true }
    })
  })

  it('calculates totals for credit mode with withholding', () => {
    const vm = new PurchaseVM()
    vm.updateState('withhold-percentage', 10)
    vm.updateState('current-order', {
      supplier_id: 1,
      payment_mode: 'credit',
      is_withholding: true,
      first_payment: 50,
      items: [{ quantity: 2, unit_price: 100 }]
    })

    const totals = vm.calculateOrderTotals()
    expect(totals.subtotal).toBe(200)
    expect(totals.withhold_amount).toBe(20)
    expect(totals.net_amount).toBe(180)
    expect(totals.amount_paid).toBe(50)
    expect(totals.outstanding_balance).toBe(130)
  })

  it('fails validation when cheque date is missing', () => {
    const vm = new PurchaseVM()
    vm.updateState('current-order', {
      supplier_id: 1,
      payment_mode: 'cheque',
      cheque_details: { amount: 100, bank_name: 'Bank', cheque_number: '123', cheque_date: '' },
      items: [{ product_id: 1, quantity: 1, unit_price: 100 }]
    })

    const valid = vm.validateOrder()
    expect(valid).toBe(false)
    expect(vm.getState('current-order').error).toContain('Cheque date is required')
  })

  it('processes order and sends transformed payload to IPC', async () => {
    const vm = new PurchaseVM()
    vm.updateState('withhold-percentage', 5)
    vm.updateState('current-order', {
      supplier_id: '9',
      order_date: '2026-02-27',
      invoice_no: 'INV-22',
      payment_mode: 'credit',
      is_withholding: true,
      first_payment: '25',
      notes: 'note',
      items: [{ product_id: '3', quantity: '2', unit_price: '10.5', batch_number: 'B1', expiry_date: null }]
    })

    const order = await vm.processOrder()
    expect(order.id).toBe(42)
    expect(window.ipcRenderer.invoke).toHaveBeenCalledWith(
      'purchase:create-order',
      expect.objectContaining({
        supplier_id: 9,
        payment_mode: 'credit',
        withhold_percentage: 5,
        first_payment: 25,
        items: [expect.objectContaining({ product_id: 3, quantity: 2, unit_price: 10.5 })]
      })
    )
  })

  it('blocks duplicate processOrder submissions while loading', async () => {
    let unblock
    const blocker = new Promise((resolve) => { unblock = resolve })
    window.ipcRenderer.invoke.mockImplementation(async (channel) => {
      if (channel === 'purchase:get-withhold-percentage') {
        return { success: true, withhold_percentage: 0 }
      }
      if (channel === 'purchase:create-order') {
        await blocker
        return { success: true, purchase_order: { id: 1 } }
      }
      return { success: true }
    })

    const vm = new PurchaseVM()
    vm.updateState('current-order', {
      supplier_id: '1',
      order_date: '2026-02-27',
      payment_mode: 'cash',
      items: [{ product_id: '3', quantity: '1', unit_price: '10' }]
    })

    const first = vm.processOrder()
    const second = vm.processOrder()
    unblock()
    await first
    await second

    const createOrderCalls = window.ipcRenderer.invoke.mock.calls.filter(([channel]) => channel === 'purchase:create-order')
    expect(createOrderCalls).toHaveLength(1)
  })

  it('blocks duplicate recordPayment submissions while loading', async () => {
    let unblock
    const blocker = new Promise((resolve) => { unblock = resolve })
    window.ipcRenderer.invoke.mockImplementation(async (channel) => {
      if (channel === 'purchase:get-withhold-percentage') return { success: true, withhold_percentage: 0 }
      if (channel === 'purchase:pay-order') {
        await blocker
        return { success: true, payment: { id: 1 } }
      }
      if (channel === 'purchase:get-payment-history') return { success: true, payments: [], total_paid: 10, outstanding_balance: 0 }
      if (channel === 'purchase:get-orders') return { success: true, orders: [], total: 0, stats: {} }
      if (channel === 'purchase:get-order-by-id') return { success: true, order: { id: 5 } }
      return { success: true }
    })

    const vm = new PurchaseVM()
    vm.updateState('selected-order-for-payment', 5)

    const first = vm.recordPayment({ payment_amount: 10, payment_mode: 'cash', payment_date: '2026-02-27' })
    const second = vm.recordPayment({ payment_amount: 10, payment_mode: 'cash', payment_date: '2026-02-27' })
    unblock()
    await first
    await second

    const payCalls = window.ipcRenderer.invoke.mock.calls.filter(([channel]) => channel === 'purchase:pay-order')
    expect(payCalls).toHaveLength(1)
  })

  it('reverses order and reloads order list', async () => {
    window.ipcRenderer.invoke.mockImplementation(async (channel) => {
      if (channel === 'purchase:get-withhold-percentage') return { success: true, withhold_percentage: 0 }
      if (channel === 'purchase:reverse-order') return { success: true, reversed_order: { id: 7, status: 'reversed' } }
      if (channel === 'purchase:get-orders') return { success: true, orders: [{ id: 7, status: 'reversed' }], total: 1, stats: {} }
      return { success: true }
    })

    const vm = new PurchaseVM()
    vm.updateState('order-drawer-open', true)
    vm.updateState('selected-order', { id: 7 })

    const reversed = await vm.reverseOrder(7, 'test reversal')

    expect(reversed).toEqual({ id: 7, status: 'reversed' })
    expect(vm.getState('order-drawer-open')).toBe(false)
    expect(vm.getState('selected-order')).toBe(null)
    expect(window.ipcRenderer.invoke).toHaveBeenCalledWith('purchase:reverse-order', {
      orderId: 7,
      reverseData: {
        reason: 'test reversal',
        reverse_inventory: true,
        reverse_ledger: true
      }
    })
  })

  it('loads hold order and restores current-order state', async () => {
    window.ipcRenderer.invoke.mockImplementation(async (channel) => {
      if (channel === 'purchase:get-withhold-percentage') return { success: true, withhold_percentage: 2 }
      if (channel === 'purchase:get-hold-order-by-id') {
        return {
          success: true,
          hold_order: {
            id: 11,
            supplier_id: 5,
            supplier_name: 'Acme Supplier',
            order_date: '2026-02-27',
            invoice_no: 'INV-77',
            remark: 'restore me',
            payment_mode: 'cheque',
            withhold_percentage: 10,
            first_payment: null,
            cheque_details: JSON.stringify({
              bank_name: 'CBE',
              cheque_number: '1234',
              cheque_date: '2026-02-27',
              amount: 100
            }),
            items: JSON.stringify([
              {
                product_id: '3',
                product_code: 'PRD0003',
                product_name: 'Item 3',
                quantity: '2',
                unit_price: '12.5'
              }
            ])
          }
        }
      }
      return { success: true, suppliers: [], products: [] }
    })

    const vm = new PurchaseVM()
    await vm.loadHoldOrder(11)

    const order = vm.getState('current-order')
    expect(order.supplier_id).toBe(5)
    expect(order.supplier).toMatchObject({ id: 5, name: 'Acme Supplier' })
    expect(order.invoice_no).toBe('INV-77')
    expect(order.notes).toBe('restore me')
    expect(order.is_withholding).toBe(true)
    expect(vm.getState('withhold-percentage')).toBe(2)
    expect(vm.getState('supplier-search-query')).toBe('Acme Supplier')
    expect(order.items[0]).toMatchObject({ product_id: 3, quantity: 2, unit_price: 12.5 })
    expect(vm.getState('filtered-items')).toHaveLength(1)
  })

  it('fetches withhold setting even when loading is true', async () => {
    window.ipcRenderer.invoke.mockImplementation(async (channel) => {
      if (channel === 'purchase:get-withhold-percentage') return { success: true, withhold_percentage: 3 }
      return { success: true }
    })

    const vm = new PurchaseVM()
    vm.updateState('loading', true)
    vm.updateState('withhold-percentage', null)

    const value = await vm.loadWithholdPercentage(true)
    expect(value).toBe(3)
    expect(vm.getState('withhold-percentage')).toBe(3)
  })

  it('does not overwrite withhold setting while restoring hold order', async () => {
    window.ipcRenderer.invoke.mockImplementation(async (channel) => {
      if (channel === 'purchase:get-withhold-percentage') return { success: true, withhold_percentage: 3 }
      if (channel === 'purchase:get-hold-order-by-id') {
        return {
          success: true,
          hold_order: {
            id: 22,
            supplier_id: 1,
            supplier_name: 'Supplier A',
            order_date: '2026-02-27',
            payment_mode: 'cash',
            withhold_percentage: 10,
            items: JSON.stringify([{ product_id: 1, quantity: 1, unit_price: 50 }])
          }
        }
      }
      return { success: true }
    })

    const vm = new PurchaseVM()
    await vm.loadWithholdPercentage(true)
    expect(vm.getState('withhold-percentage')).toBe(3)

    await vm.loadHoldOrder(22)

    expect(vm.getState('withhold-percentage')).toBe(3)
    expect(vm.getState('current-order').is_withholding).toBe(true)
  })
})
