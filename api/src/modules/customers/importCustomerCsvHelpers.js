import { MAX_UPLOAD_ROWS } from '../inventory/importCsvHelpers.js'

export { MAX_UPLOAD_ROWS }

const IGNORE_HEADERS = new Set([
  'created at',
  'created_at',
  'last updated',
  'last_updated',
  'id',
  'sync_status',
  'sync status'
])

function rowHasMappableContent (row) {
  return Object.keys(row).some((k) => {
    if (IGNORE_HEADERS.has(k)) return false
    const v = row[k]
    return v != null && String(v).trim() !== ''
  })
}

/**
 * Map one CSV row (lowercase keys) to a plain object for CustomersService.bulkImport
 * (light mapping only — validation/normalization happen in the service, like products CSV import).
 */
export function csvRowToCustomerImportPayload (row) {
  const name =
    row.name ||
    row['customer name'] ||
    row.customer_name ||
    row.customername ||
    row.company ||
    row['company name'] ||
    row.company_name ||
    row.companyname ||
    ''
  const contactPerson =
    row['contact person'] ||
    row.contact_person ||
    row.contactperson ||
    row['contact name'] ||
    row.contact_name ||
    row.contact ||
    row['primary contact'] ||
    row.primary_contact ||
    ''

  const emailRaw = row.email
  const customerTypeRaw =
    row['customer type'] ||
    row.customer_type ||
    row.customertype ||
    ''

  const lic = row['license no'] || row.license_no || row.licenseno || ''
  const tin = row['tin no'] || row.tin_no || row.tinno || ''

  return {
    name: String(name || '').trim(),
    contact_person: String(contactPerson || '').trim(),
    phone: row.phone != null && String(row.phone).trim() !== '' ? String(row.phone).trim() : null,
    email:
      emailRaw == null || String(emailRaw).trim() === ''
        ? null
        : String(emailRaw).trim(),
    address: row.address != null && String(row.address).trim() !== '' ? String(row.address).trim() : null,
    license_no: lic != null && String(lic).trim() !== '' ? String(lic).trim() : null,
    tin_no: tin != null && String(tin).trim() !== '' ? String(tin).trim() : null,
    website: row.website != null && String(row.website).trim() !== '' ? String(row.website).trim() : null,
    fax: row.fax != null && String(row.fax).trim() !== '' ? String(row.fax).trim() : null,
    country: row.country != null && String(row.country).trim() !== '' ? String(row.country).trim() : null,
    customer_type: String(customerTypeRaw).trim().toLowerCase()
  }
}

/**
 * Non-empty CSV rows → payloads for {@link CustomersService#bulkImport}, with `_csvRowNumber` (1-based
 * data row index). Per-row validation/normalization happen in the service (same pattern as products).
 */
export function csvRowsToCustomersForBulkImport (parsedRows) {
  const customers = []
  for (let i = 0; i < parsedRows.length; i++) {
    const row = parsedRows[i]
    if (!rowHasMappableContent(row)) continue

    customers.push({
      ...csvRowToCustomerImportPayload(row),
      _csvRowNumber: i + 2
    })
  }
  return customers
}

/** CSV template (UTF-8) aligned with export columns except audit fields */
export function customerImportTemplateCsv () {
  const headers = [
    'Name',
    'Contact Person',
    'Phone',
    'Email',
    'Address',
    'License No',
    'TIN No',
    'Website',
    'Fax',
    'Country',
    'Customer Type'
  ]
  const example = [
    'Example Pharmacy PLC',
    'Jane Buyer',
    '+251911000000',
    'buyer@example.com',
    'Bole, Addis Ababa',
    '',
    '',
    '',
    '',
    'Ethiopia',
    'supplier'
  ]
  const esc = (c) => (String(c).includes(',') ? `"${String(c).replace(/"/g, '""')}"` : String(c))
  return `${headers.join(',')}\r\n${example.map(esc).join(',')}\r\n`
}
