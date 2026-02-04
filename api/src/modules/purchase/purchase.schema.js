/**
 * Schema: Validation layer for purchase module using Zod
 * Mirrors the API design in PURCHASE_API_DESIGN.md
 */
import { z } from 'zod'

/**
 * Common helpers
 */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')

/**
 * 1. Product & Supplier lookup
 * (no body schemas needed, query handled in controller)
 */

/**
 * 2.1 POST /api/purchases/orders
 * Create/process purchase order
 */
const purchaseItemSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().int().positive(),
  unit_price: z.number().positive(),
  batch_number: z.string().trim().optional().nullable(),
  expiry_date: isoDate.optional().nullable()
})

export const createPurchaseOrderSchema = z.object({
  supplier_id: z.number().int().positive(),
  order_date: isoDate,
  invoice_no: z.string().trim().optional().nullable(),
  items: z.array(purchaseItemSchema).min(1, 'At least one item is required'),
  payment_mode: z.enum(['cash', 'credit', 'cheque']),
  withhold_percentage: z.number().nonnegative().optional().nullable(),
  first_payment: z.number().nonnegative().optional().nullable(),
  cheque_details: z
    .object({
      bank_name: z.string().trim(),
      cheque_number: z.string().trim(),
      cheque_date: isoDate,
      amount: z.number().positive()
    })
    .optional()
    .nullable(),
  notes: z.string().trim().optional().nullable(),
  status: z.enum(['completed', 'archived', 'reversed']).default('completed'),
  hold_order_id: z.number().int().positive().optional().nullable()
}).superRefine((data, ctx) => {
  if (data.payment_mode === 'cheque' && !data.cheque_details) {
    ctx.addIssue({
      path: ['cheque_details'],
      code: z.ZodIssueCode.custom,
      message: 'cheque_details is required when payment_mode is "cheque"'
    })
  }
})

/**
 * 2.7 POST /api/purchases/orders/:id/pay
 */
export const payPurchaseOrderSchema = z.object({
  payment_amount: z.number().positive(),
  payment_mode: z.enum(['cash', 'cheque']),
  payment_date: isoDate,
  cheque_details: z
    .object({
      bank_name: z.string().trim(),
      cheque_number: z.string().trim(),
      cheque_date: isoDate
    })
    .optional()
    .nullable(),
  notes: z.string().trim().optional().nullable()
}).superRefine((data, ctx) => {
  if (data.payment_mode === 'cheque' && !data.cheque_details) {
    ctx.addIssue({
      path: ['cheque_details'],
      code: z.ZodIssueCode.custom,
      message: 'cheque_details is required when payment_mode is "cheque"'
    })
  }
})

/**
 * 2.6 POST /api/purchases/orders/:id/reverse
 */
export const reversePurchaseOrderSchema = z.object({
  reason: z.string().min(1, 'Reason is required').trim(),
  reverse_inventory: z.boolean().default(true),
  reverse_ledger: z.boolean().default(true)
})

/**
 * 3. Hold Orders
 * POST create hold order: full current-order snapshot for UI restore.
 */
const holdOrderItemSchema = z.object({
  product_id: z.number().int().positive(),
  product_name: z.string().optional().nullable(),
  product_code: z.string().optional().nullable(),
  product_category: z.string().optional().nullable(),
  product_unit: z.string().optional().nullable(),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
  batch_number: z.string().trim().optional().nullable(),
  expiry_date: isoDate.optional().nullable()
})

export const createHoldOrderSchema = z.object({
  supplier_id: z.number().int().positive(),
  order_date: isoDate,
  invoice_no: z.string().trim().optional().nullable(),
  remark: z.string().trim().optional().nullable(),
  payment_mode: z.enum(['cash', 'credit', 'cheque']),
  total_amount: z.number().nonnegative(),
  amount_paid: z.number().nonnegative().optional().nullable(),
  withhold_percentage: z.number().nonnegative().optional().nullable(),
  withhold_amount: z.number().nonnegative().optional().nullable(),
  first_payment: z.number().nonnegative().optional().nullable(),
  cheque_details: z
    .object({
      bank_name: z.string().trim(),
      cheque_number: z.string().trim(),
      cheque_date: isoDate.optional().nullable(),
      amount: z.number().positive()
    })
    .optional()
    .nullable(),
  items: z.array(holdOrderItemSchema).min(1, 'At least one item is required')
}).superRefine((data, ctx) => {
  if (data.payment_mode === 'cheque' && !data.cheque_details) {
    ctx.addIssue({
      path: ['cheque_details'],
      code: z.ZodIssueCode.custom,
      message: 'cheque_details is required when payment_mode is "cheque"'
    })
  }
})

/**
 * 4.1 POST /api/purchases/import
 * Bulk import purchases from CSV-style payload
 */
const importStockItemSchema = z.object({
  product_name: z.string().trim(),
  product_code: z.string().trim().optional().nullable(),
  quantity: z.number().int().positive(),
  unit_cost: z.number().positive(),
  batch_number: z.string().trim().optional().nullable(),
  expiry_date: isoDate.optional().nullable()
})

export const importPurchasesSchema = z.object({
  purchase_date: isoDate,
  supplier_id: z.number().int().positive(),
  payment_mode: z.enum(['cash', 'credit', 'cheque']).default('cash'),
  withhold_percentage: z.number().nonnegative().optional().nullable(),
  stock_items: z.array(importStockItemSchema).min(1, 'At least one stock item is required')
})

/**
 * POST /api/purchases/import-from-spreadsheet
 * Bulk import orders from spreadsheet payload (supplier/product names resolved to IDs)
 */
const spreadsheetOrderItemSchema = z.object({
  product_name: z.string().min(1, 'Product name is required').trim(),
  batch_number: z.string().trim().optional().nullable(),
  category: z.string().trim().optional().nullable(),
  unit: z.string().trim().optional().nullable(),
  expiry_date: isoDate.optional().nullable(),
  unit_price: z.number().positive(),
  quantity: z.number().int().positive()
})

const spreadsheetOrderSchema = z.object({
  supplier_name: z.string().min(1, 'Supplier name is required').trim(),
  order_date: isoDate,
  invoice_number: z.string().trim().optional().nullable(),
  total_amount: z.number().nonnegative().optional().nullable(),
  amount_paid: z.number().nonnegative().optional().nullable(),
  withhold_percentage: z.number().nonnegative().max(100).optional().nullable(),
  payment_mode: z.enum(['cash', 'credit', 'cheque']),
  items: z.array(spreadsheetOrderItemSchema).min(1, 'At least one item is required')
})

export const importFromSpreadsheetSchema = z.object({
  orders: z.array(spreadsheetOrderSchema).min(1, 'At least one order is required')
})

/**
 * 5. Stats & Reporting
 * Only query params; no body schema required.
 */

/**
 * 6. Payment History
 * Only route params.
 */

/**
 * Validation middleware factory (same pattern as inventories.schema)
 */
export const validate = (schema) => {
  return (req, _res, next) => {
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

