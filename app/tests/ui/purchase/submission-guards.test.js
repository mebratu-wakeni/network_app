import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findButtonsByText } from '../../helpers/vnode.js'

const modalRenderSpy = vi.hoisted(() => vi.fn())
const showAlertSpy = vi.hoisted(() => vi.fn())

vi.mock('../../../src/components/shared/Modal.js', () => ({
  default: (_opts, renderer) => modalRenderSpy(renderer)
}))

vi.mock('../../../src/components/utils/ModalHelpers.js', () => ({
  showAlert: (...args) => showAlertSpy(...args)
}))

vi.mock('../../../src/components/modules/purchase/ReceiptModal.js', () => ({
  openReceiptModal: vi.fn()
}))

import { openCheckoutConfirmationModal } from '../../../src/components/modules/purchase/CheckoutConfirmationModal.js'
import { PaymentModalContent } from '../../../src/components/modules/purchase/PaymentModal.js'

function makeVm(overrides = {}) {
  const state = {
    loading: false,
    'current-order': {
      supplier_id: 1,
      order_date: '2026-02-27',
      invoice_no: 'INV-1',
      payment_mode: 'credit',
      first_payment: 0,
      items: [{ product_name: 'A', quantity: 1, unit_price: 100 }]
    },
    'supplier-list': [{ id: 1, name: 'Supplier' }],
    'selected-order-for-payment': 10,
    'payment-form-order-id': 10,
    'payment-history': { outstanding_balance: 120 },
    'payment-form': { payment_amount: '50', payment_mode: 'cash', payment_date: '2026-02-27', cheque_details: {}, notes: '' }
  }
  return {
    getState: (k) => state[k],
    updateState: (k, v) => { state[k] = v },
    validateOrder: () => true,
    calculateOrderTotals: () => ({ subtotal: 100, net_amount: 100, withhold_amount: 0 }),
    processOrder: vi.fn(async () => {
      state.loading = true
      await Promise.resolve()
      return { id: 99 }
    }),
    saveAsHoldOrder: vi.fn(async () => {
      state.loading = true
      await Promise.resolve()
    }),
    closePaymentModal: vi.fn(),
    getPaymentHistory: () => state['payment-history'],
    setPaymentFormDefaults: vi.fn(),
    resetPaymentForm: vi.fn(),
    updatePaymentForm: vi.fn(),
    recordPayment: vi.fn(async () => {
      state.loading = true
      await Promise.resolve()
    }),
    ...overrides
  }
}

describe('Purchase UI submission guards', () => {
  beforeEach(() => {
    modalRenderSpy.mockReset()
    showAlertSpy.mockReset()
  })

  it('prevents duplicate Complete clicks in checkout modal', async () => {
    const vm = makeVm()
    openCheckoutConfirmationModal({ viewModel: vm })

    const renderer = modalRenderSpy.mock.calls[0][0]
    const vnode = renderer(() => {}, () => {})
    const completeBtn = findButtonsByText(vnode, 'Complete')[0]

    await completeBtn.events.click()
    await completeBtn.events.click()

    expect(vm.processOrder).toHaveBeenCalledTimes(1)
  })

  it('prevents duplicate Hold clicks in checkout modal', async () => {
    const vm = makeVm()
    openCheckoutConfirmationModal({ viewModel: vm })

    const renderer = modalRenderSpy.mock.calls[0][0]
    const vnode = renderer(() => {}, () => {})
    const holdBtn = findButtonsByText(vnode, 'Hold')[0]

    await holdBtn.events.click()
    await holdBtn.events.click()

    expect(vm.saveAsHoldOrder).toHaveBeenCalledTimes(1)
  })

  it('keeps Record Payment disabled while loading', () => {
    const vm = makeVm()
    vm.updateState('loading', true)
    const vnode = PaymentModalContent({ viewModel: vm, embedded: true, handleClose: vi.fn() })
    const payBtn = findButtonsByText(vnode, /Record Payment|Recording/)[0]
    expect(payBtn.attributes.disabled).toBe('disabled')
  })
})
