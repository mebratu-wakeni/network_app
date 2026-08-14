import { describe, expect, it } from 'vitest'
import { bulkPayCustomerSalesSchema } from '../../../../src/modules/sales/sales.schema.js'

describe('bulkPayCustomerSalesSchema', () => {
  const base = {
    customer_id: 10,
    payment_amount: 100.5,
    payment_mode: 'cash',
    payment_date: '2026-04-30',
    notes: null,
  }

  it('defaults allocation to fifo when omitted', () => {
    const r = bulkPayCustomerSalesSchema.safeParse(base)
    expect(r.success).toBe(true)
    expect(r.data.allocation).toBe('fifo')
  })

  it('accepts fifo with no manual_allocations', () => {
    const r = bulkPayCustomerSalesSchema.safeParse({ ...base, allocation: 'fifo' })
    expect(r.success).toBe(true)
  })

  it('requires manual_allocations when allocation is manual', () => {
    const r = bulkPayCustomerSalesSchema.safeParse({ ...base, allocation: 'manual' })
    expect(r.success).toBe(false)
  })

  it('accepts manual with manual_allocations', () => {
    const r = bulkPayCustomerSalesSchema.safeParse({
      ...base,
      allocation: 'manual',
      manual_allocations: [
        { sales_order_id: 1, amount: 60 },
        { sales_order_id: 2, amount: 40.5 },
      ],
    })
    expect(r.success).toBe(true)
  })

  it('requires cheque_details when payment_mode is cheque', () => {
    const r = bulkPayCustomerSalesSchema.safeParse({
      ...base,
      payment_mode: 'cheque',
      cheque_details: null,
    })
    expect(r.success).toBe(false)
  })

  it('accepts cheque with full cheque_details', () => {
    const r = bulkPayCustomerSalesSchema.safeParse({
      ...base,
      payment_mode: 'cheque',
      cheque_details: {
        bank_name: 'Awash',
        cheque_number: 'CHQ-1',
        cheque_date: '2026-04-30',
      },
    })
    expect(r.success).toBe(true)
  })

  it('rejects invalid customer_id', () => {
    const r = bulkPayCustomerSalesSchema.safeParse({ ...base, customer_id: 0 })
    expect(r.success).toBe(false)
  })
})
