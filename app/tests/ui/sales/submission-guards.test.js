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

import { openCheckoutConfirmationModal } from '../../../src/components/modules/sales/CheckoutConfirmationModal.js'

function makeVm() {
  const state = {
    loading: false,
    'current-sale': {
      customer_id: 1,
      sale_date: '2026-02-27',
      order_date: '2026-02-27',
      payment_mode: 'cash',
      items: [{ product_name: 'A', quantity: 1, unit_price: 100 }]
    },
    'customer-list': [{ id: 1, name: 'Customer' }],
    'withhold-percentage': 2
  }
  return {
    getState: (k) => state[k],
    updateState: (k, v) => { state[k] = v },
    validateSale: () => true,
    calculateSaleTotals: () => ({ subtotal: 100, net_amount: 100, withhold_amount: 0 }),
    processSale: vi.fn(async () => {
      state.loading = true
      await Promise.resolve()
    }),
    saveAsHoldOrder: vi.fn(async () => {
      state.loading = true
      await Promise.resolve()
    })
  }
}

describe('Sales UI submission guards', () => {
  beforeEach(() => {
    modalRenderSpy.mockReset()
    showAlertSpy.mockReset()
  })

  it('prevents duplicate Complete clicks in sales checkout modal', async () => {
    const vm = makeVm()
    openCheckoutConfirmationModal({ viewModel: vm })

    const renderer = modalRenderSpy.mock.calls[0][0]
    const vnode = renderer(() => {}, () => {})
    const completeBtn = findButtonsByText(vnode, 'Complete')[0]

    await completeBtn.events.click()
    await completeBtn.events.click()

    expect(vm.processSale).toHaveBeenCalledTimes(1)
  })

  it('prevents duplicate Hold clicks in sales checkout modal', async () => {
    const vm = makeVm()
    openCheckoutConfirmationModal({ viewModel: vm })

    const renderer = modalRenderSpy.mock.calls[0][0]
    const vnode = renderer(() => {}, () => {})
    const holdBtn = findButtonsByText(vnode, 'Hold')[0]

    await holdBtn.events.click()
    await holdBtn.events.click()

    expect(vm.saveAsHoldOrder).toHaveBeenCalledTimes(1)
  })
})
