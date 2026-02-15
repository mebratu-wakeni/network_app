import { z } from 'zod'

export const activateLicenseSchema = z.object({
  license_key: z.string().trim().min(1),
  installation_key: z.string().trim().optional().nullable(),
  device_fingerprint: z.string().trim().min(1),
  company_name: z.string().trim().min(1),
  company_phone: z.string().trim().min(1),
  company_email: z.string().trim().optional().nullable(),
  company_tin: z.string().trim().optional().nullable()
})

export const validate = (schema) => async (req, res, next) => {
  try {
    req.validBody = await schema.parseAsync(req.body || {})
    next()
  } catch (error) {
    const formatted = error?.issues?.map((i) => ({
      path: i.path.join('.'),
      message: i.message
    })) || [{ message: error.message }]
    res.status(400).json({ ok: false, error: 'Validation failed', details: formatted })
  }
}

