import { describe, expect, it } from 'vitest'
import { deriveBorrowObligationStatus } from '../../../src/utils/borrowObligationStatus.js'

describe('deriveBorrowObligationStatus', () => {
  it('returns active when nothing returned', () => {
    expect(deriveBorrowObligationStatus(10, 0)).toBe('active')
  })

  it('returns partially_returned when some quantity remains', () => {
    expect(deriveBorrowObligationStatus(10, 3)).toBe('partially_returned')
    expect(deriveBorrowObligationStatus(10, 9)).toBe('partially_returned')
  })

  it('returns returned when fully settled by quantity', () => {
    expect(deriveBorrowObligationStatus(10, 10)).toBe('returned')
    expect(deriveBorrowObligationStatus(10, 15)).toBe('returned')
  })

  it('coerces string quantities', () => {
    expect(deriveBorrowObligationStatus('5', '2')).toBe('partially_returned')
  })
})
