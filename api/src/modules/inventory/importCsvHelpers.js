import { stockItemSchema } from './inventories.schema.js'

export const MAX_UPLOAD_ROWS = 100000

/** When CSV `location` is empty, stock rows are stored under this label (string column on `inventories`). */
export const DEFAULT_STOCK_IMPORT_LOCATION = 'Main Store'

/**
 * Example CSV for bulk stock import (UTF-8). Header keys match {@link csvRowToStockPayload} aliases after lowercasing.
 * **Expiry date** must be **dd/mm/yyyy** when present (e.g. 31/12/2026).
 */
export function stockImportTemplateCsv () {
  const headers = [
    'product name',
    'unit',
    'unit cost',
    'quantity',
    'category',
    'location',
    'expiry date',
    'batch number',
    'selling price',
    'product code'
  ]
  const example = [
    'Example Paracetamol 500mg',
    'Box',
    '125.50',
    '24',
    'Analgesics',
    DEFAULT_STOCK_IMPORT_LOCATION,
    '',
    '',
    '',
    ''
  ]
  return `${headers.join(',')}\r\n${example.join(',')}\r\n`
}

/**
 * Map CSV row objects to product payloads for ProductsService.bulkImport.
 *
 * **Required:** a non-empty product name (column aliases below). All other mapped fields are optional.
 * **Product code:** any `product code` / `product_code` column in the file is ignored on import — codes are
 * always assigned by the server (sequential PRD####). External spreadsheets often omit code; that is fine.
 *
 * Name column aliases: name, product name, product_name, productname
 */
export function csvRowsToProducts (rows) {
  const products = []
  for (const row of rows) {
    const name =
      row.name ||
      row['product name'] ||
      row.product_name ||
      row.productname ||
      ''
    if (!String(name).trim()) {
      const hasAny = Object.values(row).some(v => v != null && String(v).trim() !== '')
      if (!hasAny) continue
    }

    const description = row.description || row.desc || row['product description'] || ''
    const category = row.category || row.cat || row['product category'] || ''
    const unit =
      row.unit ||
      row['unit of measure'] ||
      row.unit_of_measure ||
      row.unitofmeasure ||
      ''

    products.push({
      name: String(name || '').trim(),
      description: String(description || '').trim() || undefined,
      category: String(category || '').trim() || undefined,
      unit: String(unit || '').trim() || undefined
    })
  }
  return products.filter(p => p.name.length > 0)
}

function parseQuantity (raw) {
  const n = parseInt(String(raw).trim(), 10)
  return Number.isFinite(n) ? n : NaN
}

function parseMoney (raw) {
  const n = parseFloat(String(raw).trim())
  return Number.isFinite(n) ? n : NaN
}

/**
 * Build payload for stockItemSchema from one CSV row (lowercase keys).
 * Expiry values are passed through as strings; validation expects **dd/mm/yyyy** (strict).
 */
export function csvRowToStockPayload (row) {
  const productCode =
    row['product code'] || row.product_code || row.productcode || row.code || ''
  const productName =
    row['product name'] || row.product_name || row.productname || row.name || ''
  const location = row.location || row.loc || row['stock location'] || ''
  const quantityRaw = row.quantity || row.qty || row['stock quantity'] || ''
  const unitCostRaw =
    row['unit cost'] ||
    row.unit_cost ||
    row.unitcost ||
    row.cost ||
    row['purchase cost'] ||
    row.purchase_cost ||
    row['unit purchase cost'] ||
    row['purchase price'] ||
    row.purchase_price ||
    ''
  const expiryDate =
    row['expiry date'] || row.expiry_date || row.expirydate || row.expiry || ''
  const batchNumber =
    row['batch number'] || row.batch_number || row.batchnumber || row.batch || ''
  const sellingPriceRaw =
    row['selling price'] ||
    row.selling_price ||
    row.sellingprice ||
    row.price ||
    ''
  const category = row.category || row['product category'] || row.product_category || ''
  const unit = row.unit || row['product unit'] || row.product_unit || ''

  const qty = parseQuantity(quantityRaw)
  const unitCost = parseMoney(unitCostRaw)
  const sellingPrice =
    sellingPriceRaw === '' || sellingPriceRaw == null
      ? null
      : parseMoney(sellingPriceRaw)

  return {
    productCode: String(productCode || '').trim() || null,
    productName: String(productName || '').trim(),
    category: String(category || '').trim() || null,
    unit: String(unit || '').trim() || null,
    location: String(location || '').trim() || null,
    quantity: qty,
    unitCost: Number.isFinite(unitCost) ? unitCost : undefined,
    expiryDate: expiryDate ? String(expiryDate).trim() || null : null,
    batchNumber: String(batchNumber || '').trim() || null,
    sellingPrice:
      sellingPrice != null && Number.isFinite(sellingPrice) ? sellingPrice : null
  }
}

/** @returns {{ validItems: object[], errors: { rowNumber: number, error: string, issueKind: 'error' }[] }} */
export function validateStockRowsForUpload (rows) {
  const errors = []
  const validItems = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const hasAny = Object.values(row).some(v => v != null && String(v).trim() !== '')
    if (!hasAny) continue

    const payload = csvRowToStockPayload(row)
    const parsed = stockItemSchema.safeParse(payload)
    if (!parsed.success) {
      const msg = parsed.error.issues.map(iss => iss.message).join('; ')
      errors.push({ rowNumber: i + 2, error: msg, issueKind: 'error' })
    } else {
      const d = parsed.data
      const loc = (d.location && String(d.location).trim()) || DEFAULT_STOCK_IMPORT_LOCATION
      validItems.push({
        product_code: d.productCode || d.product_code || null,
        product_name: (d.productName || d.product_name || '').trim(),
        category: d.category || d.product_category || null,
        unit: d.unit || d.product_unit || null,
        location: loc,
        quantity: d.quantity,
        unit_cost: d.unitCost ?? d.unit_cost,
        expiry_date: d.expiryDate || d.expiry_date || null,
        batch_number: d.batchNumber || d.batch_number || null,
        selling_price:
          d.sellingPrice ?? d.selling_price ?? null,
        _csvRowNumber: i + 2
      })
    }
  }

  return { validItems, errors }
}
