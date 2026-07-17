import { describe, expect, it } from 'vitest'
import { loginSchema, registerSchema } from '../../../../src/modules/auth/auth.schema.js'

/**
 * Release guards: cloud-backend must stay single-tenant.
 * Multi-tenant login requires client_code — that must NOT appear here.
 */
describe('auth.schema (single-tenant cloud-backend)', () => {
  it('accepts username + password only (no client_code)', () => {
    const result = loginSchema.safeParse({
      username: 'Admin',
      password: 'secret'
    })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      username: 'admin',
      password: 'secret'
    })
    expect(result.data).not.toHaveProperty('client_code')
  })

  it('strips unknown client_code instead of requiring it', () => {
    const result = loginSchema.safeParse({
      username: 'admin',
      password: 'secret',
      client_code: 'ACME01'
    })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      username: 'admin',
      password: 'secret'
    })
    expect(result.data.client_code).toBeUndefined()
  })

  it('rejects empty username or password', () => {
    expect(loginSchema.safeParse({ username: '', password: 'x' }).success).toBe(false)
    expect(loginSchema.safeParse({ username: 'admin', password: '' }).success).toBe(false)
  })

  it('register schema does not include client_code or tenant fields', () => {
    const shape = registerSchema.shape
    expect(shape).not.toHaveProperty('client_code')
    expect(shape).not.toHaveProperty('tenant_id')
    expect(shape).toHaveProperty('username')
    expect(shape).toHaveProperty('password')
  })
})
