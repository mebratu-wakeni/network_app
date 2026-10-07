/**
 * Service: Business logic layer for customers
 * Orchestrates use cases and coordinates between repository and business rules
 */

const BULK_IMPORT_CUSTOMER_TYPES = new Set(['supplier', 'retailer', 'both', 'other'])

function formatCustomerCode(num) {
  return `CUST${String(num).padStart(4, '0')}`
}

/** Fast sanity check for bulk import (no zod). Invalid → store null, do not fail row. */
function normalizeOptionalEmail (raw) {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  if (s.length > 254) return null
  const at = s.indexOf('@')
  if (at <= 0 || at === s.length - 1) return null
  const domain = s.slice(at + 1)
  if (!domain.includes('.') || /\s/.test(s)) return null
  return s
}

export class CustomersService {
  constructor(repository) {
    this.repository = repository
  }

  /**
   * Get all customers with pagination, search, and sorting
   * @param {number} tenantId
   * @param {Object} params - { limit, offset, search, sortBy, orderBy }
   * @returns {Object} - { customers, total }
   */
  async findAll(tenantId, params = {}) {
    return this.repository.findAll(tenantId, params)
  }

  /**
   * Get customer by ID
   * @param {number} tenantId
   * @param {number} id - Customer ID
   * @returns {Object} Customer object
   */
  async findById(tenantId, id) {
    if (!id || isNaN(parseInt(id, 10))) {
      const error = new Error('Valid customer ID is required')
      error.status = 400
      throw error
    }

    const customer = await this.repository.findById(tenantId, id)
    
    if (!customer) {
      const error = new Error('Customer not found')
      error.status = 404
      throw error
    }

    return customer
  }

  /**
   * Create a new customer
   * @param {number} tenantId
   * @param {Object} customerData - Customer data
   * @returns {Object} Created customer
   */
  async create(tenantId, customerData) {
    // Check for duplicate name within tenant
    const existing = await this.repository.findByName(tenantId, customerData.name)
    if (existing) {
      const error = new Error('Customer with this name already exists')
      error.status = 409
      throw error
    }

    // Normalize email: empty string becomes null
    if (customerData.email === '') {
      customerData.email = null
    }

    const nextCodeNum = await this.repository.getMaxCustomerCodeNumber(tenantId)
    const customer = await this.repository.create({
      ...customerData,
      tenant_id: tenantId,
      customer_code: formatCustomerCode(nextCodeNum + 1)
    })
    return customer
  }

  /**
   * Update a customer
   * @param {number} tenantId
   * @param {number} id - Customer ID
   * @param {Object} customerData - Updated customer data
   * @returns {Object} Updated customer
   */
  async update(tenantId, id, customerData) {
    if (!id || isNaN(parseInt(id, 10))) {
      const error = new Error('Valid customer ID is required')
      error.status = 400
      throw error
    }

    const existing = await this.repository.findById(tenantId, id)
    
    if (!existing) {
      const error = new Error('Customer not found')
      error.status = 404
      throw error
    }

    // Check for duplicate name if name is being updated (within tenant)
    if (customerData.name && customerData.name !== existing.name) {
      const duplicate = await this.repository.findByName(tenantId, customerData.name)
      if (duplicate) {
        const error = new Error('Customer with this name already exists')
        error.status = 409
        throw error
      }
    }

    // Normalize email: empty string becomes null
    if (customerData.email === '') {
      customerData.email = null
    }

    // customer_code is system-assigned; never accept client overrides
    const { customer_code: _ignoredCode, ...safeData } = customerData

    const updated = await this.repository.update(tenantId, id, safeData)
    return updated
  }

  /**
   * Delete a customer
   * @param {number} tenantId
   * @param {number} id - Customer ID
   * @returns {boolean} True if deleted
   */
  async delete(tenantId, id) {
    if (!id || isNaN(parseInt(id, 10))) {
      const error = new Error('Valid customer ID is required')
      error.status = 400
      throw error
    }

    const existing = await this.repository.findById(tenantId, id)
    if (!existing) {
      const error = new Error('Customer not found')
      error.status = 404
      throw error
    }

    const deleted = await this.repository.delete(tenantId, id)
    return deleted
  }

  /**
   * Export customers to CSV
   * @param {number} tenantId
   * @param {Object} params - { limit, offset, search, sortBy, orderBy }
   * @returns {string} CSV formatted string
   */
  async exportToCSV(tenantId, params = {}) {
    const exportParams = {
      ...params,
      limit: params.limit || 10000,
      offset: 0
    }
    
    const result = await this.repository.findAll(tenantId, exportParams)
    const customers = result.customers || []
    
    const headers = [
      'Customer Code',
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
      'Customer Type',
      'Created At',
      'Last Updated'
    ]
    
    const escapeCSV = (field) => {
      if (field === null || field === undefined) return ''
      const str = String(field)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }
    
    const rows = customers.map(customer => {
      return [
        escapeCSV(customer.customer_code || ''),
        escapeCSV(customer.name || ''),
        escapeCSV(customer.contact_person || ''),
        escapeCSV(customer.phone || ''),
        escapeCSV(customer.email || ''),
        escapeCSV(customer.address || ''),
        escapeCSV(customer.license_no || ''),
        escapeCSV(customer.tin_no || ''),
        escapeCSV(customer.website || ''),
        escapeCSV(customer.fax || ''),
        escapeCSV(customer.country || ''),
        escapeCSV(customer.customer_type || ''),
        escapeCSV(customer.created_at || ''),
        escapeCSV(customer.last_updated || '')
      ].join(',')
    })
    
    return [headers.join(','), ...rows].join('\n')
  }

  /**
   * Bulk import customers — partial success: insert valid rows; skip invalid, duplicate contact person (DB or same file).
   * Requires **name**, **contact_person**, and **customer_type** per row. Duplicate = same contact_person as existing row (case-insensitive) or earlier row in file.
   * @param {number} tenantId
   * @param {Array} customers - Rows; optional `_csvRowNumber` from CSV pipeline (stripped before insert)
   * @returns {Object} { total, successful, failed, results }
   */
  async bulkImport (tenantId, customers) {
    if (!Array.isArray(customers) || customers.length === 0) {
      throw new Error('Customers array is required and must not be empty')
    }

    const failureResults = []
    const pendingInserts = []
    const seenContactLower = new Set()
    const existingDbContactLower = await this.repository.getContactPersonKeysLowerSet(tenantId)

    for (let index = 0; index < customers.length; index++) {
      const raw = customers[index]
      const csvRowNumber = raw._csvRowNumber != null ? raw._csvRowNumber : index + 1
      const { _csvRowNumber, ...customer } = raw

      if (!customer.name || !String(customer.name).trim()) {
        failureResults.push({
          index,
          csvRowNumber,
          success: false,
          error: 'Customer name is required',
          validationFailed: true
        })
        continue
      }
      if (!customer.contact_person || !String(customer.contact_person).trim()) {
        failureResults.push({
          index,
          csvRowNumber,
          success: false,
          error: 'Contact person is required',
          validationFailed: true
        })
        continue
      }

      const name = String(customer.name).trim()
      const cp = String(customer.contact_person).trim()
      const cpKey = cp.toLowerCase()

      const emailCandidate = normalizeOptionalEmail(customer.email)

      const typeRaw =
        customer.customer_type == null ? '' : String(customer.customer_type).trim().toLowerCase()
      if (!typeRaw) {
        failureResults.push({
          index,
          csvRowNumber,
          success: false,
          error: 'Customer type is required',
          validationFailed: true
        })
        continue
      }
      if (!BULK_IMPORT_CUSTOMER_TYPES.has(typeRaw)) {
        failureResults.push({
          index,
          csvRowNumber,
          success: false,
          error: 'Invalid customer type (use supplier, retailer, both, or other)',
          validationFailed: true
        })
        continue
      }
      const typeNorm = typeRaw

      if (seenContactLower.has(cpKey)) {
        failureResults.push({
          index,
          csvRowNumber,
          success: false,
          error: 'Skipped — duplicate contact person in this import file',
          skipped: true
        })
        continue
      }

      if (existingDbContactLower.has(cpKey)) {
        failureResults.push({
          index,
          csvRowNumber,
          success: false,
          error: 'Skipped — contact person already exists',
          skipped: true
        })
        continue
      }

      seenContactLower.add(cpKey)

      const customerData = {
        tenant_id: tenantId,
        name,
        contact_person: cp,
        phone: customer.phone != null && String(customer.phone).trim() !== '' ? String(customer.phone).trim() : null,
        email: emailCandidate,
        address: customer.address != null && String(customer.address).trim() !== '' ? String(customer.address).trim() : null,
        license_no:
          customer.license_no != null && String(customer.license_no).trim() !== ''
            ? String(customer.license_no).trim()
            : null,
        tin_no:
          customer.tin_no != null && String(customer.tin_no).trim() !== '' ? String(customer.tin_no).trim() : null,
        website:
          customer.website != null && String(customer.website).trim() !== '' ? String(customer.website).trim() : null,
        fax: customer.fax != null && String(customer.fax).trim() !== '' ? String(customer.fax).trim() : null,
        country:
          customer.country != null && String(customer.country).trim() !== '' ? String(customer.country).trim() : null,
        customer_type: typeNorm
      }

      pendingInserts.push({ index, csvRowNumber, customerData })
    }

    const successResults = []
    if (pendingInserts.length > 0) {
      try {
        let nextCodeNum = await this.repository.getMaxCustomerCodeNumber(tenantId)
        const rowsWithCodes = pendingInserts.map((p) => {
          nextCodeNum += 1
          return {
            ...p,
            customerData: {
              ...p.customerData,
              customer_code: formatCustomerCode(nextCodeNum)
            }
          }
        })
        const inserted = await this.repository.bulkCreate(
          rowsWithCodes.map((p) => p.customerData)
        )
        inserted.forEach((insertedRow, k) => {
          const p = rowsWithCodes[k]
          successResults.push({
            index: p.index,
            csvRowNumber: p.csvRowNumber,
            success: true,
            customer: insertedRow
          })
        })
      } catch (error) {
        pendingInserts.forEach((p) => {
          successResults.push({
            index: p.index,
            csvRowNumber: p.csvRowNumber,
            success: false,
            error: error.message || 'Failed to insert customer'
          })
        })
      }
    }

    const results = [...failureResults, ...successResults].sort(
      (a, b) => (a.csvRowNumber ?? 0) - (b.csvRowNumber ?? 0)
    )

    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    return {
      total: customers.length,
      successful,
      failed,
      results
    }
  }
}
