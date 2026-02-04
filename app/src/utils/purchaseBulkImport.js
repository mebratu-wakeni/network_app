/**
 * Bulk purchase order import from CSV/spreadsheet.
 * Converts raw rows into an array of order objects (supplier_name, product_name, etc.)
 * per BULK_PURCHASE_IMPORT_SPEC.md.
 */

const PAYMENT_MODES = ['cash', 'credit', 'cheque']

const COLUMN_ALIASES = {
  supplier_name: ['supplier name', 'supplier_name', 'suppliername', 'supplier'],
  order_date: ['order date', 'order_date', 'orderdate', 'date'],
  invoice_number: ['invoice number', 'invoice_number', 'invoicenumber', 'invoice_no', 'invoice'],
  total_amount: ['total amount', 'total_amount', 'totalamount', 'total'],
  amount_paid: ['amount paid', 'amount_paid', 'amountpaid', 'paid'],
  withhold_percentage: ['withhold percentage', 'withhold_percentage', 'withholdpercentage', 'withhold'],
  payment_mode: ['payment mode', 'payment_mode', 'paymentmode', 'mode'],
  product_name: ['product name', 'product_name', 'productname', 'product'],
  batch_number: ['batch number', 'batch_number', 'batchnumber', 'batch'],
  expiry_date: ['expiry date', 'expiry_date', 'expirydate', 'expiry'],
  quantity: ['quantity', 'qty'],
  unit_price: ['unit price', 'unit_price', 'unitprice', 'price'],
  category: ['category'],
  unit: ['unit']
}

function normalizeKey(str) {
  if (str == null || typeof str !== 'string') return ''
  return str.replace(/\s+/g, ' ').trim().toLowerCase()
}

function mapRowToCanonical(row) {
  const lower = {}
  for (const k of Object.keys(row)) {
    lower[normalizeKey(k)] = row[k]
  }

  function get(canonical) {
    const aliases = COLUMN_ALIASES[canonical]
    if (!aliases) return ''
    const raw = (row[canonical] != null ? row[canonical] : '') || (lower[canonical] != null ? lower[canonical] : '')
    if (raw !== '') return String(raw).trim()
    for (const a of aliases) {
      const v = lower[normalizeKey(a)]
      if (v != null && String(v).trim() !== '') return String(v).trim()
    }
    return ''
  }

  return {
    supplier_name: get('supplier_name'),
    order_date: get('order_date'),
    invoice_number: get('invoice_number'),
    total_amount: get('total_amount'),
    amount_paid: get('amount_paid'),
    withhold_percentage: get('withhold_percentage'),
    payment_mode: get('payment_mode'),
    product_name: get('product_name'),
    batch_number: get('batch_number'),
    expiry_date: get('expiry_date'),
    quantity: get('quantity'),
    unit_price: get('unit_price'),
    category: get('category'),
    unit: get('unit')
  }
}

function parseDate(value) {
  if (value == null || value === '') return null
  const s = String(value).trim()
  if (!s) return null
  const iso = /^\d{4}-\d{2}-\d{2}$/
  if (iso.test(s)) return s
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseNumber(value) {
  if (value == null || value === '') return null
  const n = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : null
}

/**
 * Validate a single normalized row. Returns { valid, errors, normalized }.
 * Order meta required: supplier_name, total_amount, amount_paid, withhold_percentage, payment_mode.
 * Item required: product_name, quantity, unit_price.
 */
function validateRow(canonical, rowIndex) {
  const errors = []
  const normalized = { ...canonical }

  // Order meta required
  if (!normalized.supplier_name) {
    errors.push(`Row ${rowIndex + 1}: supplier name is required`)
  }
  const totalAmount = parseNumber(normalized.total_amount)
  if (totalAmount == null || totalAmount < 0) {
    errors.push(`Row ${rowIndex + 1}: total amount is required and must be a non-negative number`)
  }
  normalized.total_amount = totalAmount
  const amountPaid = parseNumber(normalized.amount_paid)
  if (amountPaid == null || amountPaid < 0) {
    errors.push(`Row ${rowIndex + 1}: amount paid is required and must be a non-negative number`)
  }
  normalized.amount_paid = amountPaid
  const withholdPct = parseNumber(normalized.withhold_percentage)
  if (withholdPct == null || withholdPct < 0 || withholdPct > 100) {
    errors.push(`Row ${rowIndex + 1}: withhold percentage is required and must be between 0 and 100`)
  }
  normalized.withhold_percentage = withholdPct
  if (!normalized.payment_mode) {
    errors.push(`Row ${rowIndex + 1}: payment mode is required`)
  } else {
    const mode = normalized.payment_mode.toLowerCase()
    if (!PAYMENT_MODES.includes(mode)) {
      errors.push(`Row ${rowIndex + 1}: payment mode must be one of: ${PAYMENT_MODES.join(', ')}`)
    }
    normalized.payment_mode = mode
  }

  // Optional: order_date
  if (normalized.order_date) {
    const d = parseDate(normalized.order_date)
    if (!d) errors.push(`Row ${rowIndex + 1}: order date must be a valid date (YYYY-MM-DD or parseable)`)
    else normalized.order_date = d
  } else {
    normalized.order_date = null
  }

  // Item required
  if (!normalized.product_name) {
    errors.push(`Row ${rowIndex + 1}: product name is required`)
  }
  const qty = parseNumber(normalized.quantity)
  if (qty == null || qty <= 0) {
    errors.push(`Row ${rowIndex + 1}: quantity is required and must be a positive number`)
  }
  normalized.quantity = qty
  const unitPrice = parseNumber(normalized.unit_price)
  if (unitPrice == null || unitPrice < 0) {
    errors.push(`Row ${rowIndex + 1}: unit price is required and must be a non-negative number`)
  }
  normalized.unit_price = unitPrice

  if (normalized.expiry_date) {
    const ed = parseDate(normalized.expiry_date)
    if (!ed) errors.push(`Row ${rowIndex + 1}: expiry date must be a valid date if provided`)
    else normalized.expiry_date = ed
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized
  }
}

/**
 * Parse CSV text into rows (array of objects keyed by normalized header).
 */
export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '')
  if (lines.length === 0) return { headers: [], rows: [] }

  function parseCSVLine(line) {
    const result = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim())
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, '').trim())
    const row = {}
    headers.forEach((header, index) => {
      row[header] = values[index] != null ? values[index] : ''
    })
    rows.push(row)
  }
  return { headers, rows }
}

/**
 * Convert CSV text to an array of order objects (with names, not IDs).
 * Returns { orders, errors } where errors are per-row validation errors.
 */
export function csvToOrderObjects(csvText) {
  const { rows } = parseCSV(csvText)
  const allErrors = []
  const validatedRows = []

  for (let i = 0; i < rows.length; i++) {
    const canonical = mapRowToCanonical(rows[i])
    const { valid, errors, normalized } = validateRow(canonical, i)
    if (!valid) {
      allErrors.push(...errors)
      continue
    }
    validatedRows.push(normalized)
  }

  // Group by: supplier_name, total_amount, withhold_percentage, amount_paid, payment_mode
  const orderKey = (r) => {
    const t = r.total_amount != null ? Number(r.total_amount) : ''
    const w = r.withhold_percentage != null ? Number(r.withhold_percentage) : ''
    const p = r.amount_paid != null ? Number(r.amount_paid) : ''
    const mode = (r.payment_mode || '').toLowerCase()
    return `${normalizeKey(r.supplier_name)}|${t}|${w}|${p}|${mode}`
  }

  const groupMap = new Map()
  for (const r of validatedRows) {
    const key = orderKey(r)
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key).push(r)
  }

  const today = new Date().toISOString().slice(0, 10)

  const orders = []
  for (const [, orderRows] of groupMap) {
    const first = orderRows[0]
    const totalAmount = first.total_amount != null ? Number(first.total_amount) : 0
    const amountPaid = first.amount_paid != null ? Number(first.amount_paid) : 0
    const withholdPct = first.withhold_percentage != null ? Number(first.withhold_percentage) : null
    const orderDate = first.order_date || today
    const paymentMode = first.payment_mode

    orders.push({
      supplier_name: first.supplier_name,
      order_date: orderDate,
      invoice_number: first.invoice_number || '',
      total_amount: totalAmount,
      amount_paid: amountPaid,
      withhold_percentage: withholdPct,
      payment_mode: paymentMode,
      items: orderRows.map(r => ({
        product_name: r.product_name,
        batch_number: r.batch_number || null,
        category: r.category || null,
        unit: r.unit || null,
        expiry_date: r.expiry_date || null,
        unit_price: Number(r.unit_price),
        quantity: Math.max(1, Math.floor(Number(r.quantity) || 0))
      }))
    })
  }

  return { orders, errors: allErrors }
}
