import { describe, expect, it, vi } from 'vitest'
import { LedgerHelper } from '../../../src/services/ledger.helper.js'

/**
 * Minimal knex mock for postGLTransaction COA validation (before ledger insert).
 */
function makeKnexMock({ activeRows = [], lookupByCode = new Map() }) {
  return vi.fn((table) => {
    if (table === 'chart_of_accounts') {
      const builder = {
        _eq: null,
        _pairs: {},
        whereIn() {
          return builder
        },
        where(a, b) {
          if (typeof a === 'object' && a !== null && b === undefined) {
            builder._eq = a
            return builder
          }
          builder._pairs[a] = b
          return builder
        },
        select() {
          if (builder._pairs.is_active === true) {
            return Promise.resolve(activeRows)
          }
          return Promise.resolve([])
        },
        async first() {
          const code = builder._eq?.account_code
          if (code == null) return null
          return lookupByCode.get(code) ?? null
        }
      }
      return builder
    }
    throw new Error(`Unexpected table in mock: ${table}`)
  })
}

describe('LedgerHelper.postGLTransaction chart of accounts', () => {
  it('rejects codes missing from COA', async () => {
    const knex = makeKnexMock({
      activeRows: [],
      lookupByCode: new Map()
    })
    const helper = new LedgerHelper(knex)

    await expect(
      helper.postGLTransaction({
        transaction_date: '2026-04-30',
        description: 't',
        transaction_type: 'test',
        entries: [
          { account_code: '9999', debit: 10, credit: 0 },
          { account_code: '1100', debit: 0, credit: 10 }
        ]
      })
    ).rejects.toThrow(/not found in chart of accounts/)
  })

  it('rejects inactive COA codes', async () => {
    const knex = makeKnexMock({
      activeRows: [],
      lookupByCode: new Map([
        ['1100', { account_code: '1100', account_name: 'Cash', is_active: false }],
        ['2100', { account_code: '2100', account_name: 'AP', is_active: false }]
      ])
    })
    const helper = new LedgerHelper(knex)

    await expect(
      helper.postGLTransaction({
        transaction_date: '2026-04-30',
        description: 't',
        transaction_type: 'test',
        entries: [
          { account_code: '1100', debit: 10, credit: 0 },
          { account_code: '2100', debit: 0, credit: 10 }
        ]
      })
    ).rejects.toThrow(/inactive/)
  })
})
