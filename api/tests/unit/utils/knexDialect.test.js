import knex from 'knex'
import { describe, expect, it } from 'vitest'
import { isPostgresKnex, rawExpiringSoonUpperBound } from '../../../src/utils/knexDialect.js'

describe('knexDialect expiring-soon SQL', () => {
  it('uses Postgres date + integer days (not SQLite DATE modifier)', () => {
    const pg = knex({ client: 'pg' })
    const sql = rawExpiringSoonUpperBound(pg, '2026-11-02', 30).toString()
    expect(isPostgresKnex(pg)).toBe(true)
    expect(sql).toContain('::date')
    expect(sql).toContain('::integer')
    expect(sql).not.toMatch(/DATE\(\?, '\+' \|\|/)
    pg.destroy()
  })

  it('uses SQLite DATE modifier when client is sqlite3', () => {
    const sqlite = knex({
      client: 'sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true
    })
    const sql = rawExpiringSoonUpperBound(sqlite, '2026-11-02', 30).toString()
    expect(isPostgresKnex(sqlite)).toBe(false)
    expect(sql).toMatch(/DATE\(inventories\.expiry_date\)/)
    expect(sql).toMatch(/'\+' \|\| COALESCE/)
    sqlite.destroy()
  })
})
