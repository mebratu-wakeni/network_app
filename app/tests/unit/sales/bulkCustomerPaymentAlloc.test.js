import { describe, expect, it } from 'vitest'
import { formatFinanceAmount, waterfillPreview } from '../../../src/components/modules/sales/bulkCustomerPaymentAlloc.js'

describe('bulkCustomerPaymentAlloc', () => {
  describe('formatFinanceAmount', () => {
    it('formats numbers with two decimal places', () => {
      expect(formatFinanceAmount(1234.5)).toMatch(/1,234\.50/)
    })
  })

  describe('waterfillPreview', () => {
    it('returns empty array for invalid payment', () => {
      expect(waterfillPreview([{ id: 1, outstanding_balance: 10 }], 0, 'fifo')).toEqual([])
      expect(waterfillPreview([], 100, 'fifo')).toEqual([])
    })

    it('FIFO orders by date then id ascending', () => {
      const orders = [
        { id: 2, order_date: '2026-01-02', outstanding_balance: 50, receipt_no: 'B' },
        { id: 1, order_date: '2026-01-01', outstanding_balance: 40, receipt_no: 'A' },
        { id: 3, order_date: '2026-01-02', outstanding_balance: 30, receipt_no: /* later id */ 'C' },
      ]
      const lines = waterfillPreview(orders, 100, 'fifo')
      expect(lines.map((l) => l.id)).toEqual([1, 2, 3])
      expect(lines.reduce((s, l) => s + l.applied, 0)).toBeCloseTo(100, 5)
    })

    it('LIFO orders by date descending then id descending', () => {
      const orders = [
        { id: 1, order_date: '2026-01-01', outstanding_balance: 100 },
        { id: 2, order_date: '2026-01-02', outstanding_balance: 100 },
      ]
      const lines = waterfillPreview(orders, 50, 'lifo')
      expect(lines).toHaveLength(1)
      expect(lines[0].id).toBe(2)
      expect(lines[0].applied).toBe(50)
    })

    it('caps each slice at order outstanding', () => {
      const orders = [
        { id: 1, order_date: '2026-01-01', outstanding_balance: 30 },
        { id: 2, order_date: '2026-01-02', outstanding_balance: 70 },
      ]
      const lines = waterfillPreview(orders, 100, 'fifo')
      expect(lines[0].applied).toBe(30)
      expect(lines[1].applied).toBe(70)
    })
  })
})
