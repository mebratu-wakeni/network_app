import { describe, it, expect } from 'vitest'
import { updateSettingsSchema } from '../../../../src/modules/settings/settings.schema.js'

describe('updateSettingsSchema', () => {
  it('accepts company settings including company_logo_url (payload from desktop Settings form)', () => {
    const result = updateSettingsSchema.safeParse({
      withhold_percentage: 2,
      company_name: 'Acme Pharmacy',
      company_address: 'Main St',
      company_phone: '0911',
      company_email: 'a@example.com',
      company_tin: 'TIN1',
      company_logo_url: null
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown keys under .strict()', () => {
    const result = updateSettingsSchema.safeParse({
      company_name: 'Acme',
      not_a_setting: true
    })
    expect(result.success).toBe(false)
  })
})
