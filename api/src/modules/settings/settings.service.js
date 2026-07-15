/**
 * Service: System settings business logic
 */
import { allowedSettingKeys } from './settings.schema.js'

export class SettingsService {
  constructor(repository) {
    this.repository = repository
  }

  async getSettings(tenantId) {
    const raw = await this.repository.getAll(tenantId, allowedSettingKeys)
    const withhold = raw.withhold_percentage
    return {
      withhold_percentage: withhold != null ? Number(raw.withhold_percentage) : null,
      company_name: raw.company_name ?? '',
      company_address: raw.company_address ?? '',
      company_phone: raw.company_phone ?? '',
      company_email: raw.company_email ?? '',
      company_tin: raw.company_tin ?? ''
    }
  }

  async updateSettings(tenantId, input) {
    const updates = {}
    if (input.hasOwnProperty('withhold_percentage')) {
      updates.withhold_percentage = input.withhold_percentage == null ? null : String(input.withhold_percentage)
    }
    if (input.hasOwnProperty('company_name')) updates.company_name = input.company_name ?? ''
    if (input.hasOwnProperty('company_address')) updates.company_address = input.company_address ?? ''
    if (input.hasOwnProperty('company_phone')) updates.company_phone = input.company_phone ?? ''
    if (input.hasOwnProperty('company_email')) updates.company_email = input.company_email ?? ''
    if (input.hasOwnProperty('company_tin')) updates.company_tin = input.company_tin ?? ''
    if (Object.keys(updates).length === 0) return this.getSettings(tenantId)
    await this.repository.setMany(tenantId, updates)
    return this.getSettings(tenantId)
  }
}
