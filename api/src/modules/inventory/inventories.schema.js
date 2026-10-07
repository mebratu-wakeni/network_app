/**
 * Schema: Validation layer using Zod
 * Defines and validates request/response shapes for inventories/stock
 */
import { z } from 'zod'
import { ddMmYyyyToIso } from '../../utils/ddMmYyyy.js'

const MSG_DDMMYYYY = 'Date must be dd/mm/yyyy (e.g. 31/12/2025)'

/** CSV / import: blank → ''; else strict dd/mm/yyyy → ISO yyyy-mm-dd */
const zDdMmYyyyExpiryImport = z.preprocess(
  (v) => {
    if (v === undefined || v === null || v === '') return ''
    return String(v).trim()
  },
  z.string()
).refine((s) => s === '' || ddMmYyyyToIso(s) !== null, { message: MSG_DDMMYYYY })
  .transform((s) => (s === '' ? '' : ddMmYyyyToIso(s)))

/** Optional body field: omit → undefined; blank → null; dd/mm/yyyy → ISO */
const zOptionalDdMmYyyyToIsoNull = z.preprocess(
  (v) => {
    if (v === undefined) return undefined
    if (v === null || v === '') return ''
    return String(v).trim()
  },
  z.union([z.undefined(), z.string()])
).superRefine((val, ctx) => {
  if (val === undefined || val === '') return
  if (ddMmYyyyToIso(val) === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: MSG_DDMMYYYY })
  }
}).transform((val) => {
  if (val === undefined) return undefined
  if (val === '') return null
  return ddMmYyyyToIso(val)
})

const zDdMmYyyyRequiredIso = z.preprocess(
  (v) => (v == null ? '' : String(v).trim()),
  z.string().min(1, 'Date is required')
).refine((s) => ddMmYyyyToIso(s) !== null, { message: MSG_DDMMYYYY })
  .transform((s) => ddMmYyyyToIso(s))

const zDdMmYyyyOptionalIso = z.preprocess(
  (v) => {
    if (v === undefined || v === null || String(v).trim() === '') return undefined
    return String(v).trim()
  },
  z.union([z.undefined(), z.string().min(1)])
).refine((v) => v === undefined || ddMmYyyyToIso(v) !== null, { message: MSG_DDMMYYYY })
  .transform((v) => (v === undefined ? undefined : ddMmYyyyToIso(v)))

const zDdMmYyyyPurchaseOptional = z.preprocess(
  (v) => {
    if (v === undefined || v === null || String(v).trim() === '') return undefined
    return String(v).trim()
  },
  z.union([z.undefined(), z.string().min(1)])
).refine((v) => v === undefined || ddMmYyyyToIso(v) !== null, { message: MSG_DDMMYYYY })
  .transform((v) => (v === undefined ? undefined : ddMmYyyyToIso(v)))

/**
 * Schema for a single stock item in bulk import
 * Accepts both camelCase (frontend) and snake_case (backend) formats
 */
export const stockItemSchema = z.object({
  // Accept both camelCase and snake_case formats
  productCode: z.string().trim().optional().nullable(),
  product_code: z.string().trim().optional().nullable(),
  productName: z.string().trim().optional(),
  product_name: z.string().trim().optional(),
  category: z.string().trim().optional().nullable(),
  product_category: z.string().trim().optional().nullable(),
  unit: z.string().trim().optional().nullable(),
  product_unit: z.string().trim().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  unitCost: z.number().positive('Unit cost must be a positive number').optional(),
  unit_cost: z.number().positive('Unit cost must be a positive number').optional(),
  expiryDate: zDdMmYyyyExpiryImport.optional().nullable(),
  expiry_date: zDdMmYyyyExpiryImport.optional().nullable(),
  batchNumber: z.string().trim().optional().nullable(),
  batch_number: z.string().trim().optional().nullable(),
  sellingPrice: z.number().positive('Selling price must be a positive number').optional().nullable(),
  selling_price: z.number().positive('Selling price must be a positive number').optional().nullable()
}).refine(
  (data) => {
    const productName = data.productName || data.product_name
    return productName && productName.trim().length > 0
  },
  { message: 'Product name is required', path: ['productName'] }
).refine(
  (data) => {
    const cost = data.unitCost ?? data.unit_cost
    return cost !== undefined && cost !== null && !Number.isNaN(Number(cost)) && Number(cost) > 0
  },
  { message: 'Unit cost (purchase cost) is required and must be positive', path: ['unitCost'] }
)

/**
 * Schema for bulk import stock request body
 */
export const bulkImportStockSchema = z.object({
  stockItems: z.array(stockItemSchema).min(1, 'At least one stock item is required'),
  purchase_date: zDdMmYyyyPurchaseOptional,
  acquisition_type: z.enum(['purchase', 'cash', 'credit', 'cheque', 'borrow']).optional(),
  reason: z.string().min(1, 'Reason is required').trim(),
  created_by: z.number().int().positive().optional().nullable()
})

/**
 * Schema for updating a stock item
 * All fields are optional to allow partial updates
 * Note: inventoryCode and productCode are read-only system fields and will be ignored
 */
export const updateStockItemSchema = z.object({
  // Read-only fields (ignored but allowed to prevent validation errors)
  inventoryCode: z.string().trim().optional().nullable(),
  inventory_code: z.string().trim().optional().nullable(),
  productCode: z.string().trim().optional().nullable(),
  product_code: z.string().trim().optional().nullable(),
  // Editable fields
  batchNo: z.string().trim().optional().nullable(),
  batch_no: z.string().trim().optional().nullable(),
  expiryDate: zOptionalDdMmYyyyToIsoNull,
  expiry_date: zOptionalDdMmYyyyToIsoNull,
  unitCost: z.number().positive('Unit cost must be a positive number').optional(),
  unit_cost: z.number().positive('Unit cost must be a positive number').optional(),
  sellingPrice: z.number().positive('Selling price must be a positive number').optional().nullable(),
  selling_price: z.number().positive('Selling price must be a positive number').optional().nullable()
})

/**
 * Schema for adjusting stock quantity
 */
export const adjustStockItemSchema = z.object({
  adjustmentType: z.enum(['add', 'subtract', 'set'], {
    errorMap: () => ({ message: 'Adjustment type must be "add", "subtract", or "set"' })
  }),
  amount: z.number().int().nonnegative('Amount must be a non-negative integer'),
  newQuantity: z.number().int().nonnegative('New quantity must be a non-negative integer'),
  reason: z.string().min(1, 'Reason is required').trim(),
  notes: z.string().trim().optional().nullable(),
  adjustmentDate: zDdMmYyyyOptionalIso,
  adjustment_date: zDdMmYyyyOptionalIso,
  partnerId: z.coerce.number().int().positive().optional().nullable(),
  partner_id: z.coerce.number().int().positive().optional().nullable()
})

/**
 * Schema for borrow from stock request
 */
export const borrowFromStockSchema = z.object({
  partnerId: z.number().int().positive('Partner ID is required'),
  partner_id: z.number().int().positive('Partner ID is required').optional(),
  productId: z.number().int().positive('Product ID is required'),
  product_id: z.number().int().positive('Product ID is required').optional(),
  purchasePrice: z.number().positive('Purchase price must be a positive number'),
  purchase_price: z.number().positive('Purchase price must be a positive number').optional(),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  batchNo: z.string().trim().optional().nullable(),
  batch_no: z.string().trim().optional().nullable(),
  expiryDate: zOptionalDdMmYyyyToIsoNull,
  expiry_date: zOptionalDdMmYyyyToIsoNull,
  description: z.string().trim().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable()
}).refine(
  (data) => {
    const partnerId = data.partnerId || data.partner_id
    return partnerId !== undefined && partnerId > 0
  },
  { message: 'Partner ID is required', path: ['partnerId'] }
).refine(
  (data) => {
    const productId = data.productId || data.product_id
    return productId !== undefined && productId > 0
  },
  { message: 'Product ID is required', path: ['productId'] }
).refine(
  (data) => {
    const purchasePrice = data.purchasePrice !== undefined ? data.purchasePrice : data.purchase_price
    return purchasePrice !== undefined && purchasePrice > 0
  },
  { message: 'Purchase price is required and must be positive', path: ['purchasePrice'] }
)

/**
 * Schema for return borrowed to stock request
 */
/**
 * Schema for a single returned item in borrow-to return
 * Each item can have different batch/expiry but must match product_id and unit_cost
 */
const borrowToReturnItemSchema = z.object({
  product_id: z.coerce.number().int().positive('Product ID is required'),
  unit_cost: z.coerce.number().positive('Unit cost is required and must be positive'),
  batch_number: z.string().trim().optional().nullable(),
  batch_no: z.string().trim().optional().nullable(),
  expiry_date: zOptionalDdMmYyyyToIsoNull,
  quantity_returned: z.coerce.number().int().positive('Quantity returned must be a positive integer'),
  quantityReturned: z.coerce.number().int().positive('Quantity returned must be a positive integer').optional().nullable(),
  location: z.string().trim().optional().nullable()
}).refine(
  (data) => {
    const quantity = data.quantity_returned || data.quantityReturned
    return quantity !== undefined && quantity > 0
  },
  { message: 'Quantity returned is required and must be positive', path: ['quantity_returned'] }
)

export const returnBorrowedToStockSchema = z.object({
  borrowToInventoryId: z.coerce.number().int().positive('Borrow To Inventory ID is required'),
  borrow_to_inventory_id: z.coerce.number().int().positive('Borrow To Inventory ID is required').optional().nullable(),
  // Support both old format (single quantity) and new format (multiple items)
  quantityReturned: z.coerce.number().int().positive('Quantity returned must be a positive integer').optional().nullable(),
  quantity_returned: z.coerce.number().int().positive('Quantity returned must be a positive integer').optional().nullable(),
  // New format: array of return items
  returnItems: z.array(borrowToReturnItemSchema).min(1, 'At least one return item is required').optional().nullable(),
  returnedDate: zDdMmYyyyRequiredIso.optional(),
  returned_date: zDdMmYyyyRequiredIso.optional(),
  notes: z.string().trim().optional().nullable(),
  condition: z.enum(['good', 'damaged', 'expired', 'other']).optional().nullable()
}).refine(
  (data) => {
    const borrowToId = data.borrowToInventoryId || data.borrow_to_inventory_id
    return borrowToId !== undefined && borrowToId > 0
  },
  { message: 'Borrow To Inventory ID is required', path: ['borrowToInventoryId'] }
).refine(
  (data) => {
    // Either returnItems (new format) or quantityReturned (old format) must be provided
    const hasReturnItems = data.returnItems && Array.isArray(data.returnItems) && data.returnItems.length > 0
    const hasQuantity = (data.quantityReturned || data.quantity_returned) > 0
    return hasReturnItems || hasQuantity
  },
  { message: 'Either returnItems array or quantityReturned must be provided', path: ['returnItems'] }
).refine(
  (data) => {
    const date = data.returnedDate || data.returned_date
    return date !== undefined && date.trim() !== ''
  },
  { message: 'Returned date is required', path: ['returnedDate'] }
)

/**
 * Schema for return borrowed from stock request
 * Supports multiple return items in a single transaction
 */
const returnItemSchema = z.object({
  // Accept both formats: {inventory_id, quantity} (from frontend) and {returningInventoryId, quantityReturned} (API format)
  inventory_id: z.coerce.number().int().positive('Inventory ID is required').optional().nullable(),
  returningInventoryId: z.coerce.number().int().positive('Returning Inventory ID is required').optional().nullable(),
  returning_inventory_id: z.coerce.number().int().positive('Returning Inventory ID is required').optional().nullable(),
  quantity: z.coerce.number().int().positive('Quantity returned must be a positive integer').optional().nullable(),
  quantityReturned: z.coerce.number().int().positive('Quantity returned must be a positive integer').optional().nullable(),
  quantity_returned: z.coerce.number().int().positive('Quantity returned must be a positive integer').optional().nullable()
}).refine(
  (data) => {
    const returningId = data.inventory_id || data.returningInventoryId || data.returning_inventory_id
    return returningId !== undefined && returningId > 0
  },
  { message: 'Returning Inventory ID is required (use inventory_id or returningInventoryId)', path: ['inventory_id'] }
).refine(
  (data) => {
    const quantity = data.quantity || data.quantityReturned || data.quantity_returned
    return quantity !== undefined && quantity > 0
  },
  { message: 'Quantity returned is required and must be positive (use quantity or quantityReturned)', path: ['quantity'] }
)

export const returnBorrowedFromStockSchema = z.object({
  borrowedInventoryId: z.coerce.number().int().positive('Borrowed Inventory ID is required'),
  borrowed_inventory_id: z.coerce.number().int().positive('Borrowed Inventory ID is required').optional().nullable(),
  returnItems: z.array(returnItemSchema).min(1, 'At least one return item is required'),
  returnedOn: zDdMmYyyyRequiredIso.optional(),
  returned_on: zDdMmYyyyRequiredIso.optional(),
  note: z.string().trim().optional().nullable()
}).refine(
  (data) => {
    const borrowedId = data.borrowedInventoryId || data.borrowed_inventory_id
    return borrowedId !== undefined && borrowedId > 0
  },
  { message: 'Borrowed Inventory ID is required', path: ['borrowedInventoryId'] }
).refine(
  (data) => {
    const date = data.returnedOn || data.returned_on
    return date !== undefined && date.trim() !== ''
  },
  { message: 'Returned date is required', path: ['returnedOn'] }
)

/**
 * Validation middleware factory
 * Creates middleware that validates req.body against a schema
 */
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
