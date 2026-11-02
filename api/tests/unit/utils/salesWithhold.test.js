import { describe, expect, it } from 'vitest'
import {
  effectiveWithholdConfirmed,
  getSalesReverseBlockReason,
  isActiveSalesOrderForStats
} from '../../../src/utils/salesWithhold.js'

describe('salesWithhold reverse rules', () => {
  it('blocks reverse when withhold is settled', () => {
    const reason = getSalesReverseBlockReason({
      is_reversed: false,
      withhold_amount: 100,
      withhold_settled: true,
      withhold_confirmation: true,
      withhold_ref: 'WH-1'
    })
    expect(reason).toMatch(/cannot be reversed/i)
    expect(reason).toMatch(/settled/i)
  })

  it('blocks reverse when withhold_settled even if withhold_amount is zero', () => {
    const reason = getSalesReverseBlockReason({
      is_reversed: false,
      withhold_amount: 0,
      withhold_settled: true
    })
    expect(reason).toMatch(/settled/i)
  })

  it('blocks reverse when withhold is confirmed but not settled', () => {
    const reason = getSalesReverseBlockReason({
      is_reversed: false,
      withhold_amount: 50,
      withhold_settled: false,
      withhold_ref: 'WH-2'
    })
    expect(reason).toMatch(/roll back/i)
    expect(effectiveWithholdConfirmed({ withhold_amount: 50, withhold_ref: 'WH-2' })).toBe(true)
  })

  it('allows reverse when withhold exists but is not confirmed', () => {
    const reason = getSalesReverseBlockReason({
      is_reversed: false,
      withhold_amount: 50,
      withhold_settled: false,
      withhold_confirmation: false,
      withhold_ref: null
    })
    expect(reason).toBeNull()
  })

  it('isActiveSalesOrderForStats excludes reversed completed orders', () => {
    expect(isActiveSalesOrderForStats({ status: 'completed', is_reversed: false })).toBe(true)
    expect(isActiveSalesOrderForStats({ status: 'archived', is_reversed: true })).toBe(false)
    expect(isActiveSalesOrderForStats({ status: 'archived', is_reversed: false })).toBe(false)
  })
})
