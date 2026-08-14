/**
 * Repository: Data access layer for customers
 * Encapsulates all database queries for customers table
 */

/** In SQL LIKE, `%` and `_` are wildcards; escape so user text matches literally. */
const LIKE_ESCAPE = '\\'
function escapeForSqlLike (s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}

/** Lowercase LIKE substrings (with wildcards outside escaped core) for case-insensitive `LIKE ? ESCAPE '\\'` */
function likeContainsPatterns (raw) {
  const t = String(raw || '').trim()
  if (!t) return null
  const full = `%${escapeForSqlLike(t).toLowerCase()}%`
  const noSpaces = t.replace(/\s+/g, '')
  const compact =
    noSpaces.length > 0 && noSpaces !== t
      ? `%${escapeForSqlLike(noSpaces).toLowerCase()}%`
      : noSpaces.length > 0
        ? full
        : null
  return { full, compact: compact != null && compact !== full ? compact : null }
}

export class CustomersRepository {
  constructor(knex) {
    this.knex = knex
  }

  /**
   * Find customer by ID scoped to tenant
   */
  async findById(tenantId, id) {
    return this.knex('customers').where({ id, tenant_id: tenantId }).first()
  }

  /**
   * Find customer by contact_person (case-insensitive, trimmed). Null/empty contact not matched.
   */
  async findByContactPerson (tenantId, contactPerson) {
    const t = String(contactPerson || '').trim()
    if (!t) return null
    return this.knex('customers')
      .where({ tenant_id: tenantId })
      .whereNotNull('contact_person')
      .whereRaw('LOWER(TRIM(contact_person)) = LOWER(?)', [t])
      .first()
  }

  /**
   * All distinct normalized contact-person keys (lowercased, trimmed) for a tenant.
   * Used for bulk import duplicate checks in O(1) instead of one query per row.
   */
  async getContactPersonKeysLowerSet (tenantId) {
    const rows = await this.knex('customers')
      .where({ tenant_id: tenantId })
      .whereNotNull('contact_person')
      .whereRaw("TRIM(contact_person) <> ''")
      .select(this.knex.raw('LOWER(TRIM(contact_person)) AS k'))
    const set = new Set()
    for (const r of rows) {
      if (r.k != null && String(r.k).length > 0) set.add(String(r.k))
    }
    return set
  }

  /**
   * Find customer by name (case-insensitive) within tenant
   */
  async findByName(tenantId, name) {
    return this.knex('customers')
      .where({ tenant_id: tenantId })
      .whereRaw('LOWER(name) = LOWER(?)', [name])
      .first()
  }

  /**
   * Highest numeric suffix among CUST#### codes for this tenant (for auto-assign on create).
   */
  async getMaxCustomerCodeNumber(tenantId) {
    const rows = await this.knex('customers')
      .where({ tenant_id: tenantId })
      .whereNotNull('customer_code')
      .where('customer_code', 'like', 'CUST%')
      .select('customer_code')
      .orderBy('id', 'desc')
      .limit(1000)

    let maxNum = 0
    for (const row of rows) {
      const code = row.customer_code
      if (code && code.startsWith('CUST')) {
        const num = parseInt(code.substring(4), 10)
        if (!Number.isNaN(num) && num > maxNum) maxNum = num
      }
    }
    return maxNum
  }

  /**
   * Find supplier by name (case-insensitive, customer_type in supplier/both) within tenant
   */
  async findSupplierByName(tenantId, name) {
    if (!name || String(name).trim() === '') return null
    return this.knex('customers')
      .where({ tenant_id: tenantId })
      .whereRaw('LOWER(name) = LOWER(?)', [name.trim()])
      .whereIn('customer_type', ['supplier', 'both'])
      .first()
  }

  /**
   * Get all customers with pagination, search, and sorting
   * @param {number} tenantId
   * @param {Object} params - { limit, offset, search, sortBy, orderBy }
   * @returns {Object} - { customers, total }
   */
  async findAll(tenantId, params = {}) {
    const {
      limit = 10,
      offset = 0,
      search = '',
      sortBy = 'customer_code',
      orderBy = 'desc',
      customer_type = null,
      customer_types = null,
      prefer_walk_in: preferWalkIn = false
    } = params

    let query = this.knex('customers').where({ tenant_id: tenantId })

    if (customer_types != null && Array.isArray(customer_types) && customer_types.length > 0) {
      query = query.whereIn('customer_type', customer_types)
    } else if (customer_type && customer_type.trim()) {
      query = query.where('customer_type', customer_type.trim())
    }

    // Apply search filter (LIKE + ESCAPE: '_' and '%' in user input are literal; avoids underscore wildcard surprises)
    const likePats = likeContainsPatterns(search)
    if (likePats) {
      const { full, compact } = likePats
      query = query.where(function () {
        this.whereRaw(`LOWER(COALESCE(name, '')) LIKE ? ESCAPE ?`, [full, LIKE_ESCAPE])
        if (compact) {
          this.orWhereRaw(
            `REPLACE(LOWER(COALESCE(name, '')), ' ', '') LIKE ? ESCAPE ?`,
            [compact, LIKE_ESCAPE]
          )
        }
        this.orWhereRaw(`LOWER(COALESCE(customer_code, '')) LIKE ? ESCAPE ?`, [full, LIKE_ESCAPE])
        this.orWhereRaw(`LOWER(COALESCE(contact_person, '')) LIKE ? ESCAPE ?`, [full, LIKE_ESCAPE])
          .orWhereRaw(`LOWER(COALESCE(phone, '')) LIKE ? ESCAPE ?`, [full, LIKE_ESCAPE])
          .orWhereRaw(`LOWER(COALESCE(email, '')) LIKE ? ESCAPE ?`, [full, LIKE_ESCAPE])
          .orWhereRaw(`LOWER(COALESCE(address, '')) LIKE ? ESCAPE ?`, [full, LIKE_ESCAPE])
          .orWhereRaw(`LOWER(COALESCE(license_no, '')) LIKE ? ESCAPE ?`, [full, LIKE_ESCAPE])
          .orWhereRaw(`LOWER(COALESCE(tin_no, '')) LIKE ? ESCAPE ?`, [full, LIKE_ESCAPE])
      })
    }

    // Get total count before pagination
    const totalQuery = query.clone()
    const totalResult = await totalQuery.count('id as total').first()
    const total = parseInt(totalResult?.total || 0, 10)

    // Apply sorting
    const validSortFields = ['customer_code', 'name', 'contact_person', 'phone', 'email', 'customer_type', 'created_at', 'last_updated']
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'customer_code'
    const sortOrder = orderBy.toLowerCase() === 'asc' ? 'asc' : 'desc'

    if (preferWalkIn) {
      query = query.orderByRaw("CASE WHEN LOWER(TRIM(COALESCE(name, ''))) = 'walk-in' THEN 0 ELSE 1 END")
    }

    query = query.orderBy(sortField, sortOrder)

    // Apply pagination
    const customers = await query.limit(limit).offset(offset)

    return {
      customers,
      total
    }
  }

  /**
   * Create a new customer. `customerData` must include tenant_id.
   */
  async create(customerData) {
    const [customer] = await this.knex('customers')
      .insert({
        ...customerData,
        created_at: this.knex.fn.now(),
        last_updated: this.knex.fn.now()
      })
      .returning('*')
    
    return customer
  }

  /**
   * Bulk create customers (chunked for SQLite SQLITE_MAX_VARIABLE_NUMBER and large payloads).
   */
  async bulkCreate (customers) {
    if (!Array.isArray(customers) || customers.length === 0) {
      return []
    }

    const now = this.knex.fn.now()
    /** ~12 bound columns per row; stay under typical 999 SQLite variable cap */
    const CHUNK = 75
    const insertedAll = []

    for (let i = 0; i < customers.length; i += CHUNK) {
      const slice = customers.slice(i, i + CHUNK).map((customer) => ({
        ...customer,
        created_at: now,
        last_updated: now
      }))

      const inserted = await this.knex('customers').insert(slice).returning('*')
      insertedAll.push(...inserted)

      if (i + CHUNK < customers.length) {
        await new Promise((resolve) => setImmediate(resolve))
      }
    }

    return insertedAll
  }

  /**
   * Update a customer scoped to tenant
   */
  async update(tenantId, id, customerData) {
    const [updated] = await this.knex('customers')
      .where({ id, tenant_id: tenantId })
      .update({
        ...customerData,
        last_updated: this.knex.fn.now()
      })
      .returning('*')
    
    return updated
  }

  /**
   * Delete a customer scoped to tenant
   */
  async delete(tenantId, id) {
    const deleted = await this.knex('customers')
      .where({ id, tenant_id: tenantId })
      .del()
    
    return deleted > 0
  }
}
