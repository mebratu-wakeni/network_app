/**
 * Schema: Validation for sales module.
 * POST /api/sales/orders creates sales_orders and sales_order_items in one transaction.
 */
import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')

/**
 * POST /api/sales/orders — create sales order with items.
 * Each item must have product_id, inventory_id (required for sales), quantity, unit_price.
 */
const salesOrderItemSchema = z.object({
  product_id: z.number().int().positive(),
  inventory_id: z.number().int().positive(),
  quantity: z.number().int().positive(),
  unit_price: z.number().positive()
})

export const createSalesOrderSchema = z.object({
  customer_id: z.number().int().positive().optional().nullable(), // null = walk-in
  order_date: isoDate,
  invoice_no: z.string().trim().optional().nullable(),
  withhold_ref: z.string().trim().optional().nullable(), // Customer withholding receipt no.; when set, confirmation is enforced server-side
  remark: z.string().trim().optional().nullable(),
  withhold_reference: z.string().trim().optional().nullable(), // Optional note; copied to remark only — does not set withhold_ref or confirm
  payment_type: z.enum(['cash', 'credit', 'cheque']),
  withhold_percentage: z.number().nonnegative().optional().nullable(),
  amount_paid: z.number().nonnegative().optional().nullable(),
  cheque_details: z
    .object({
      bank_name: z.string().trim(),
      cheque_number: z.string().trim(),
      cheque_date: isoDate,
      amount: z.number().positive()
    })
    .optional()
    .nullable(),
  items: z.array(salesOrderItemSchema).min(1, 'At least one item is required'),
  hold_order_id: z.number().int().positive().optional().nullable()
}).superRefine((data, ctx) => {
  if (data.payment_type === 'cheque' && !data.cheque_details) {
    ctx.addIssue({
      path: ['cheque_details'],
      code: z.ZodIssueCode.custom,
      message: 'cheque_details is required when payment_type is "cheque"'
    })
  }
})

/** POST /api/sales/orders/:id/pay */
export const paySalesOrderSchema = z.object({
  payment_amount: z.number().positive(),
  payment_mode: z.enum(['cash', 'cheque']).optional().default('cash'),
  payment_date: z.string().trim().optional(),
  cheque_details: z.object({
    bank_name: z.string().trim().optional(),
    cheque_number: z.string().trim().optional(),
    cheque_date: z.string().trim().optional(),
  }).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
})

/** PATCH /api/sales/orders/:id/withhold-confirmation */
export const confirmWithholdSchema = z.object({
  withhold_ref: z.string().trim().min(1, 'Withhold ref is required')
})

/** POST /api/sales/orders/:id/reverse */
export const reverseSalesOrderSchema = z.object({
  reason: z.string().trim().optional().nullable()
})

const manualAllocationLineSchema = z.object({
  sales_order_id: z.number().int().positive(),
  amount: z.number().positive()
})

/** POST /api/sales/orders/bulk-pay — apply one payment across a customer's outstanding orders (FIFO default). */
export const bulkPayCustomerSalesSchema = z.object({
  customer_id: z.number().int().positive(),
  payment_amount: z.number().positive(),
  allocation: z.enum(['fifo', 'lifo', 'manual']).optional().default('fifo'),
  manual_allocations: z.array(manualAllocationLineSchema).optional().nullable(),
  payment_mode: z.enum(['cash', 'cheque']).optional().default('cash'),
  payment_date: z.string().trim().optional(),
  cheque_details: z.object({
    bank_name: z.string().trim().optional(),
    cheque_number: z.string().trim().optional(),
    cheque_date: z.string().trim().optional()
  }).optional().nullable(),
  notes: z.string().trim().optional().nullable()
}).superRefine((data, ctx) => {
  if (data.allocation === 'manual') {
    if (!data.manual_allocations || data.manual_allocations.length === 0) {
      ctx.addIssue({
        path: ['manual_allocations'],
        code: z.ZodIssueCode.custom,
        message: 'manual_allocations is required when allocation is "manual"'
      })
    }
  }
  if (data.payment_mode === 'cheque') {
    const c = data.cheque_details
    if (!c || !String(c.bank_name || '').trim() || !String(c.cheque_number || '').trim() || !String(c.cheque_date || '').trim()) {
      ctx.addIssue({
        path: ['cheque_details'],
        code: z.ZodIssueCode.custom,
        message: 'cheque_details (bank_name, cheque_number, cheque_date) is required when payment_mode is "cheque"'
      })
    }
  }
})

/** POST /api/sales/hold-orders — snapshot (full current-order state; must include items with inventory_id for restore). */
export const createHoldOrderSchema = z.object({
  customer_id: z.number().int().positive().optional().nullable(),
  sale_date: isoDate.optional(),
  order_date: isoDate.optional(),
  invoice_no: z.string().trim().optional().nullable(),
  payment_mode: z.enum(['cash', 'credit', 'cheque']).optional(),
  payment_type: z.enum(['cash', 'credit', 'cheque']).optional(),
  total_amount: z.number().nonnegative().optional(),
  amount_paid: z.number().nonnegative().optional().nullable(),
  withhold_percentage: z.number().nonnegative().optional().nullable(),
  withhold_amount: z.number().nonnegative().optional().nullable(),
  first_payment: z.number().nonnegative().optional().nullable(),
  cheque_details: z.record(z.unknown()).optional().nullable(),
  items: z.array(z.object({
    product_id: z.number(),
    inventory_id: z.number(),
    product_name: z.string().optional(),
    product_code: z.string().optional(),
    quantity: z.number(),
    unit_price: z.number(),
    batch_number: z.string().optional().nullable(),
    expiry_date: z.string().optional().nullable()
  }).passthrough()).min(1)
}).passthrough()

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
