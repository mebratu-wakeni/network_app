import knex from 'knex'
import { describe, expect, it } from 'vitest'
import {
  effectiveWithholdConfirmed,
  getSalesReverseBlockReason,
  isActiveSalesOrderForStats,
  rawWithholdEffectivelyConfirmed
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

  it('rawWithholdEffectivelyConfirmed uses PG boolean SQL (not integer coalesce)', () => {
    const pg = knex({ client: 'pg' })
    const sql = rawWithholdEffectivelyConfirmed(pg, 'so').toString()
    expect(sql).toContain('IS TRUE')
    expect(sql).not.toMatch(/withhold_confirmation, 0\)/)
    pg.destroy()
  })

  it('rawWithholdEffectivelyConfirmed uses SQLite integer coalesce when client is sqlite3', () => {
    const sqlite = knex({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true })
    const sql = rawWithholdEffectivelyConfirmed(sqlite, 'so').toString()
    expect(sql).toMatch(/withhold_confirmation, 0\)/)
    expect(sql).not.toContain('IS TRUE')
    sqlite.destroy()
  })

  it('isActiveSalesOrderForStats excludes reversed completed orders', () => {
    expect(isActiveSalesOrderForStats({ status: 'completed', is_reversed: false })).toBe(true)
    expect(isActiveSalesOrderForStats({ status: 'completed', is_reversed: 1 })).toBe(false)
    expect(isActiveSalesOrderForStats({ status: 'completed', is_reversed: '1' })).toBe(false)
    expect(isActiveSalesOrderForStats({ status: 'archived', is_reversed: true })).toBe(false)
    expect(isActiveSalesOrderForStats({ status: 'archived', is_reversed: false })).toBe(false)
  })
})
