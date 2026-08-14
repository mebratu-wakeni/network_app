import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ReportsRepository } from '../../../../src/modules/reports/reports.repository.js'
import {
  createReportsSchema,
  createTestDb,
  seedTwoTenantsWithReports
} from '../../../helpers/testDb.js'

describe('ReportsRepository tenant isolation', () => {
  let db
  let repo

  beforeEach(async () => {
    db = createTestDb()
    await createReportsSchema(db)
    await seedTwoTenantsWithReports(db)
    repo = new ReportsRepository(db)
  })

  afterEach(async () => {
    if (db) await db.destroy()
  })

  it('getChartOfAccounts only returns COA for the requested tenant', async () => {
    const t1 = await repo.getChartOfAccounts(1)
    const t2 = await repo.getChartOfAccounts(2)

    expect(t1).toHaveLength(2)
    expect(t2).toHaveLength(2)
    expect(t1.every((r) => r.tenant_id === 1)).toBe(true)
    expect(t2.every((r) => r.tenant_id === 2)).toBe(true)
  })

  it('getClosingBalances is tenant-scoped', async () => {
    const t1 = await repo.getClosingBalances(1, '2026-06-30')
    const t2 = await repo.getClosingBalances(2, '2026-06-30')

    const cash1 = t1.find((b) => b.account_code === '1100')
    const cash2 = t2.find((b) => b.account_code === '1100')

    expect(cash1.balance).toBe(100)
    expect(cash2.balance).toBe(500)
  })

  it('getPeriodActivity is tenant-scoped', async () => {
    const t1 = await repo.getPeriodActivity(1, '2026-06-01', '2026-06-30')
    const t2 = await repo.getPeriodActivity(2, '2026-06-01', '2026-06-30')

    const cash1 = t1.find((a) => a.account_code === '1100')
    const cash2 = t2.find((a) => a.account_code === '1100')

    expect(cash1.total_debit).toBe(100)
    expect(cash2.total_debit).toBe(500)
  })

  it('getChartOfAccountsForReporting includes inactive accounts with ledger activity per tenant', async () => {
    await db('chart_of_accounts').where({ id: 2 }).update({ is_active: false })

    const t1 = await repo.getChartOfAccountsForReporting(1)
    const t2 = await repo.getChartOfAccountsForReporting(2)

    expect(t1.some((r) => r.account_code === '5100')).toBe(true)
    expect(t2.some((r) => r.account_code === '5100')).toBe(true)
    expect(t1.every((r) => r.tenant_id === 1)).toBe(true)
  })
})
