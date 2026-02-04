import { z } from 'zod'

const settingKeys = [
  'withhold_percentage',
  'company_name',
  'company_address',
  'company_phone',
  'company_email',
  'company_tin'
]

export const updateSettingsSchema = z.object({
  withhold_percentage: z.number().min(0).max(100).optional().nullable(),
  company_name: z.string().max(500).optional().nullable(),
  company_address: z.string().max(1000).optional().nullable(),
  company_phone: z.string().max(100).optional().nullable(),
  company_email: z.union([z.string().email().max(255), z.literal('')]).optional().nullable(),
  company_tin: z.string().max(100).optional().nullable()
}).strict()

export const allowedSettingKeys = settingKeys

export const validate = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const error = new Error('Validation failed')
      error.status = 400
      error.details = result.error.issues.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }))
      return next(error)
    }
    req.validBody = result.data
    next()
  }
}
