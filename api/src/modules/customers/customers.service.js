/**
 * Service: Business logic layer for customers
 * Orchestrates use cases and coordinates between repository and business rules
 */
export class CustomersService {
  constructor(repository) {
    this.repository = repository
  }

  /**
   * Get all customers with pagination, search, and sorting
   * @param {Object} params - { limit, offset, search, sortBy, orderBy }
   * @returns {Object} - { customers, total }
   */
  async findAll(params = {}) {
    return this.repository.findAll(params)
  }

  /**
   * Get customer by ID
   * @param {number} id - Customer ID
   * @returns {Object} Customer object
   */
  async findById(id) {
    if (!id || isNaN(parseInt(id, 10))) {
      const error = new Error('Valid customer ID is required')
      error.status = 400
      throw error
    }

    const customer = await this.repository.findById(id)
    
    if (!customer) {
      const error = new Error('Customer not found')
      error.status = 404
      throw error
    }

    return customer
  }

  /**
   * Create a new customer
   * @param {Object} customerData - Customer data
   * @returns {Object} Created customer
   */
  async create(customerData) {
    // Check for duplicate name
    const existing = await this.repository.findByName(customerData.name)
    if (existing) {
      const error = new Error('Customer with this name already exists')
      error.status = 409
      throw error
    }

    // Normalize email: empty string becomes null
    if (customerData.email === '') {
      customerData.email = null
    }

    const customer = await this.repository.create(customerData)
    return customer
  }

  /**
   * Update a customer
   * @param {number} id - Customer ID
   * @param {Object} customerData - Updated customer data
   * @returns {Object} Updated customer
   */
  async update(id, customerData) {
    if (!id || isNaN(parseInt(id, 10))) {
      const error = new Error('Valid customer ID is required')
      error.status = 400
      throw error
    }

    // Check if customer exists
    const existing = await this.repository.findById(id)
    
    if (!existing) {
      const error = new Error('Customer not found')
      error.status = 404
      throw error
    }

    // Check for duplicate name if name is being updated
    if (customerData.name && customerData.name !== existing.name) {
      const duplicate = await this.repository.findByName(customerData.name)
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

    const updated = await this.repository.update(id, customerData)
    return updated
  }

  /**
   * Delete a customer
   * @param {number} id - Customer ID
   * @returns {boolean} True if deleted
   */
  async delete(id) {
    if (!id || isNaN(parseInt(id, 10))) {
      const error = new Error('Valid customer ID is required')
      error.status = 400
      throw error
    }

    // Check if customer exists
    const existing = await this.repository.findById(id)
    if (!existing) {
      const error = new Error('Customer not found')
      error.status = 404
      throw error
    }

    const deleted = await this.repository.delete(id)
    return deleted
  }

  /**
   * Export customers to CSV
   * @param {Object} params - { limit, offset, search, sortBy, orderBy }
   * @returns {string} CSV formatted string
   */
  async exportToCSV(params = {}) {
    // For export, we typically want all matching records, not just one page
    const exportParams = {
      ...params,
      limit: params.limit || 10000, // Large limit for export
      offset: 0
    }
    
    const result = await this.repository.findAll(exportParams)
    const customers = result.customers || []
    
    // CSV Headers
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
      'Customer Type',
      'Created At',
      'Last Updated'
    ]
    
    // Helper function to escape CSV fields
    const escapeCSV = (field) => {
      if (field === null || field === undefined) return ''
      const str = String(field)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }
    
    // Convert customers to CSV rows
    const rows = customers.map(customer => {
      return [
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
    
    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows
    ].join('\n')
    
    return csvContent
  }

  /**
   * Bulk import customers
   * @param {Array} customers - Array of customer objects
   * @returns {Object} Summary with { total, successful, failed, results }
   */
  async bulkImport(customers) {
    if (!Array.isArray(customers) || customers.length === 0) {
      throw new Error('Customers array is required and must not be empty')
    }

    const results = []
    const customersToInsert = []
    const now = new Date()

    // Process each customer
    for (let index = 0; index < customers.length; index++) {
      const customer = customers[index]
      
      try {
        // Validate required fields
        if (!customer.name || !customer.name.trim()) {
          results.push({
            index,
            success: false,
            error: 'Customer name is required',
            customer: customer
          })
          continue
        }

        // Check for duplicate name
        const existing = await this.repository.findByName(customer.name.trim())
        if (existing) {
          results.push({
            index,
            success: false,
            error: `Customer with name "${customer.name}" already exists`,
            customer: customer
          })
          continue
        }

        // Normalize email: empty string becomes null
        const email = customer.email && customer.email.trim() ? customer.email.trim() : null

        // Prepare customer data
        const customerData = {
          name: customer.name.trim(),
          contact_person: customer.contact_person?.trim() || null,
          phone: customer.phone?.trim() || null,
          email: email,
          address: customer.address?.trim() || null,
          license_no: customer.license_no?.trim() || null,
          tin_no: customer.tin_no?.trim() || null,
          website: customer.website?.trim() || null,
          fax: customer.fax?.trim() || null,
          country: customer.country?.trim() || null,
          customer_type: customer.customer_type || 'supplier',
          created_at: now,
          last_updated: now
        }

        customersToInsert.push(customerData)
        results.push({
          index,
          success: true,
          customer: customerData
        })
      } catch (error) {
        results.push({
          index,
          success: false,
          error: error.message || 'Failed to process customer',
          customer: customer
        })
      }
    }

    // Bulk insert successful customers
    let inserted = []
    if (customersToInsert.length > 0) {
      try {
        inserted = await this.repository.bulkCreate(customersToInsert)
      } catch (error) {
        // If bulk insert fails, mark all as failed
        customersToInsert.forEach((_, idx) => {
          const result = results.find(r => r.success && r.index === idx)
          if (result) {
            result.success = false
            result.error = error.message || 'Failed to insert customer'
          }
        })
      }
    }

    // Update results with inserted IDs
    inserted.forEach((insertedCustomer, idx) => {
      const result = results.find(r => r.success && r.customer?.name === insertedCustomer.name)
      if (result) {
        result.customer = insertedCustomer
      }
    })

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return {
      total: customers.length,
      successful,
      failed,
      results
    }
  }
}
