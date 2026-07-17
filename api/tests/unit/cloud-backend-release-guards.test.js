import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AuthService } from '../../src/modules/auth/auth.service.js'
import { loginSchema } from '../../src/modules/auth/auth.schema.js'
import { assertFiscalYearOpen } from '../../src/services/fiscal-year.guard.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API_ROOT = path.resolve(__dirname, '../..')
const APP_ROOT = path.resolve(API_ROOT, '../app')

/**
 * High-level release smoke tests for cloud-backend:
 * prove we did not ship multi-tenant login / tenant UI pollution.
 */
describe('cloud-backend release anti-pollution guards', () => {
  it('AuthService.login is 2-arg (username, password)', () => {
    expect(AuthService.prototype.login.length).toBe(2)
  })

  it('assertFiscalYearOpen is 2-arg (knex, date) — not (knex, tenantId, date)', () => {
    expect(assertFiscalYearOpen.length).toBe(2)
  })

  it('loginSchema shape has no client_code', () => {
    expect(Object.keys(loginSchema.shape).sort()).toEqual(['password', 'username'])
  })

  it('cloud App.js connect UI does not mention Tenant code', () => {
    const appJs = fs.readFileSync(path.join(APP_ROOT, 'src/App.js'), 'utf8')
    expect(appJs).not.toMatch(/Tenant code/)
    expect(appJs).not.toMatch(/client-connect-code/)
    expect(appJs).toMatch(/Server URL|serverUrl|Connect to Server/)
  })

  it('auth service module does not import tenants repository', () => {
    const src = fs.readFileSync(
      path.join(API_ROOT, 'src/modules/auth/auth.service.js'),
      'utf8'
    )
    expect(src).not.toMatch(/tenantsRepository|findByClientCode|client_code/)
  })
})
