import { getApiUrl } from '../config/apiConfig.js';

/**
 * InventoryManager - Handles all API communication for inventory management
 * Similar to UsersManager, this class manages HTTP requests to the API server
 */
class InventoryManager {
  constructor() {
    // Get auth token from wherever it's stored (could be from main process storage)
    // For now, we'll get it from the request context
    this.getAuthToken = () => {
      // TODO: Get token from secure storage in main process
      // This could be from Electron's safeStorage or a config file
      return null; // Will be passed from renderer via IPC
    }
  }

  /**
   * Mock Products Data (fallback when backend is not available)
   */
  getMockProducts() {
    return [
      { id: 320, product_code: "0004", name: "AFB 3x250ml", description: "", category_id: 61, unit_id: 106, remark: null, created_at: "2025-12-04 14:55:46", last_updated: "2025-12-04 14:55:46", sync_status: "pending", category: "Reagent", unit: "Bottle" },
      { id: 321, product_code: "0005", name: "AFP Fincare 25 tests", description: "", category_id: 62, unit_id: 107, remark: null, created_at: "2025-12-04 14:55:46", last_updated: "2025-12-04 14:55:46", sync_status: "pending", category: "Supplies", unit: "PK" },
      { id: 327, product_code: "0011", name: "AMH Fincare 25 tests", description: "", category_id: 62, unit_id: 107, remark: null, created_at: "2025-12-04 14:55:46", last_updated: "2025-12-04 14:55:46", sync_status: "pending", category: "Supplies", unit: "PK" },
      { id: 334, product_code: "0018", name: "ASO latex 100 tests", description: "", category_id: 61, unit_id: 109, remark: null, created_at: "2025-12-04 14:55:46", last_updated: "2025-12-04 14:55:46", sync_status: "pending", category: "Reagent", unit: "Kit" },
      { id: 318, product_code: "0002", name: "Aceitic acid 5% 1000ml", description: "", category_id: 61, unit_id: 106, remark: null, created_at: "2025-12-04 14:55:46", last_updated: "2025-12-04 14:55:46", sync_status: "pending", category: "Reagent", unit: "Bottle" },
      { id: 317, product_code: "0001", name: "Acetone Alcohol 250ml", description: "", category_id: 61, unit_id: 106, remark: null, created_at: "2025-12-04 14:55:46", last_updated: "2025-12-04 14:55:46", sync_status: "pending", category: "Reagent", unit: "Bottle" },
      { id: 319, product_code: "0003", name: "Acid alcohol 3% 250ml", description: "", category_id: 61, unit_id: 106, remark: null, created_at: "2025-12-04 14:55:46", last_updated: "2025-12-04 14:55:46", sync_status: "pending", category: "Reagent", unit: "Bottle" },
      { id: 322, product_code: "0006", name: "Albendazole 400mg of 10", description: "", category_id: 62, unit_id: 107, remark: null, created_at: "2025-12-04 14:55:46", last_updated: "2025-12-04 14:55:46", sync_status: "pending", category: "Supplies", unit: "PK" },
      { id: 323, product_code: "0007", name: "Alcohol Denatured 70%", description: "", category_id: 62, unit_id: 108, remark: null, created_at: "2025-12-04 14:55:46", last_updated: "2025-12-04 14:55:46", sync_status: "pending", category: "Supplies", unit: "Litter" },
      { id: 324, product_code: "0008", name: "Alkaline Phosphatase - Jouri", description: "", category_id: 61, unit_id: 109, remark: null, created_at: "2025-12-04 14:55:46", last_updated: "2025-12-04 14:55:46", sync_status: "pending", category: "Reagent", unit: "Kit" }
    ];
  }

  /**
   * Mock Stock Data (fallback when backend is not available)
   */
  getMockStock() {
    const getDateInDays = (days) => {
      const date = new Date();
      date.setDate(date.getDate() + days);
      return date.toISOString().split('T')[0];
    };

    return [
      { id: 1, productCode: 'PRD001', name: 'Paracetamol 500mg', category: 'Regent', location: 'A-01', quantity: 150, unit: 'Bottle', unitCost: 15.50, expiryDate: '2025-06-15', status: 'active' },
      { id: 2, productCode: 'PRD002', name: 'Bandages', category: 'Supplies', location: 'B-03', quantity: 0, unit: 'PK', unitCost: 8.00, expiryDate: '2026-12-20', status: 'out-of-stock' },
      { id: 3, productCode: 'PRD003', name: 'Antibiotics', category: 'Regent', location: 'A-05', quantity: 25, unit: 'Bottle', unitCost: 45.00, expiryDate: '2025-03-10', status: 'low-stock' },
      { id: 4, productCode: 'PRD004', name: 'Syringes', category: 'Supplies', location: 'C-02', quantity: 200, unit: 'Kit', unitCost: 12.00, expiryDate: '2025-08-30', status: 'active' },
      { id: 5, productCode: 'PRD005', name: 'Vitamin D', category: 'Regent', location: 'A-02', quantity: 80, unit: 'Bottle', unitCost: 22.50, expiryDate: getDateInDays(15), status: 'active' },
      { id: 6, productCode: 'PRD006', name: 'Gauze Pads', category: 'Supplies', location: 'B-01', quantity: 120, unit: 'PK', unitCost: 6.50, expiryDate: getDateInDays(-5), status: 'active' },
      { id: 7, productCode: 'PRD007', name: 'Aspirin', category: 'Regent', location: 'A-03', quantity: 90, unit: 'Bottle', unitCost: 18.00, expiryDate: getDateInDays(20), status: 'active' },
      { id: 8, productCode: 'PRD008', name: 'MRI Contrast Agent', category: 'Regent', location: 'D-01', quantity: 150, unit: 'Bottle', unitCost: 85.00, expiryDate: '2025-12-31', status: 'active' },
      { id: 9, productCode: 'PRD009', name: 'Surgical Equipment Set', category: 'Supplies', location: 'D-02', quantity: 25, unit: 'Kit', unitCost: 450.00, expiryDate: '2026-06-30', status: 'active' },
      { id: 10, productCode: 'PRD010', name: 'Specialized Medication', category: 'Regent', location: 'D-03', quantity: 80, unit: 'Bottle', unitCost: 125.00, expiryDate: '2025-09-15', status: 'active' },
      { id: 11, productCode: 'PRD011', name: 'Expensive Medical Device', category: 'Supplies', location: 'D-04', quantity: 10, unit: 'Unit', unitCost: 100000.00, expiryDate: '2026-12-31', status: 'active' },
      { id: 12, productCode: 'PRD012', name: 'Premium Surgical Tool', category: 'Supplies', location: 'D-05', quantity: 5, unit: 'Set', unitCost: 50000.00, expiryDate: '2027-06-30', status: 'active' },
      { id: 13, productCode: 'PRD013', name: 'Rare Pharmaceutical', category: 'Regent', location: 'D-06', quantity: 15, unit: 'Bottle', unitCost: 2500.00, expiryDate: '2025-10-20', status: 'active' },
      { id: 14, productCode: 'PRD014', name: 'Lab Equipment', category: 'Supplies', location: 'E-01', quantity: 8, unit: 'Unit', unitCost: 1500.00, expiryDate: '2026-12-31', status: 'borrowed-from', borrowedBy: 'Dr. Smith', borrowedDate: '2025-01-10' },
      { id: 15, productCode: 'PRD015', name: 'Medical Scanner', category: 'Supplies', location: 'E-02', quantity: 3, unit: 'Unit', unitCost: 3500.00, expiryDate: '2027-01-31', status: 'borrowed-from', borrowedBy: 'Department A', borrowedDate: '2025-01-15' },
      { id: 16, productCode: 'PRD016', name: 'Testing Kits', category: 'Regent', location: 'E-03', quantity: 12, unit: 'Kit', unitCost: 120.00, expiryDate: '2025-12-31', status: 'borrowed-to', borrowedBy: 'Research Lab', borrowedDate: '2025-01-20' },
    ];
  }

  /**
   * Mock Partners/Customers Data (fallback when backend is not available)
   */
  getMockPartners() {
    return [
      { id: 1, name: 'ABC Trading Company', code: 'ABC-TRADE', type: 'partner' },
      { id: 2, name: 'XYZ Suppliers Ltd', code: 'XYZ-SUP', type: 'partner' },
      { id: 3, name: 'Global Distributors', code: 'GLB-DIST', type: 'partner' },
      { id: 4, name: 'Regional Wholesale Inc', code: 'REG-WHS', type: 'partner' },
      { id: 5, name: 'City Merchants Group', code: 'CTY-MRG', type: 'partner' },
      { id: 6, name: 'Metro Supply Chain', code: 'MET-SUP', type: 'partner' },
      { id: 7, name: 'National Medical Supplies', code: 'NAT-MED', type: 'partner' },
      { id: 8, name: 'Healthcare Partners Co', code: 'HLT-PRT', type: 'partner' }
    ];
  }

  /**
   * Get Partners/Customers
   * @param {string} token - Auth token
   * @param {string} customerType - Optional: 'supplier' (default for borrow-from), 'all' (for borrow-to), or any specific customer type
   */
  async getPartners(token, customerType = 'supplier') {
    try {
      // For borrow-to operations, we need all customers, not just suppliers
      const url = customerType === 'all' 
        ? `${getApiUrl('/customers')}?limit=1000&offset=0`
        : `${getApiUrl('/customers')}?customer_type=${customerType}&limit=1000&offset=0`;
      console.log('[InventoryManager] getPartners - API URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('[InventoryManager] getPartners - Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[InventoryManager] getPartners - Error response:', errorText);
        throw new Error(`Failed to fetch partners: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[InventoryManager] getPartners - Success, customers count:', data.customers?.length || 0);
      
      // Transform customers to partners format - include all relevant fields
      const partners = (data.customers || []).map(customer => ({
        id: customer.id,
        name: customer.name,
        code: `CUST${String(customer.id).padStart(4, '0')}`, // Generate code if not present
        type: 'partner',
        contact_person: customer.contact_person || null,
        customer_type: customer.customer_type || 'supplier',
        phone: customer.phone || null,
        email: customer.email || null
      }));
      
      return partners;
    } catch (error) {
      console.error('[InventoryManager] getPartners - Error:', error);
      console.error('[InventoryManager] getPartners - Error details:', {
        message: error.message,
        stack: error.stack
      });
      throw error; // Don't use mock data, throw error instead
    }
  }

  /**
   * Calculate stock statistics from stock list
   * Uses product-specific expiry_threshold if available, otherwise defaults to 30 days
   */
  calculateStockStats(stockList) {
    const today = new Date();
    const DEFAULT_EXPIRY_THRESHOLD = 30;
    const HIGH_VALUE_THRESHOLD = 1000;

    const stats = {
      total: stockList.length,
      outOfStock: 0,
      lowStock: 0,
      expiringSoon: 0,
      expired: 0,
      borrowedFrom: 0,
      borrowedTo: 0,
      highValue: 0
    };

    stockList.forEach(item => {
      if (item.quantity === 0) stats.outOfStock++;
      if (item.quantity > 0 && item.quantity < 50) stats.lowStock++;
      if (item.status === 'borrowed-from' || item.status === 'borrowed') stats.borrowedFrom++;
      if (item.status === 'borrowed-to') stats.borrowedTo++;
      if (item.unitCost >= HIGH_VALUE_THRESHOLD) stats.highValue++;
      
      if (item.expiryDate) {
        const expiry = new Date(item.expiryDate);
        if (expiry < today) {
          stats.expired++;
        } else {
          // Use product-specific expiry_threshold if available, otherwise default to 30 days
          const expiryThreshold = item.expiry_threshold || item.product?.expiry_threshold || DEFAULT_EXPIRY_THRESHOLD;
          const thresholdDate = new Date();
          thresholdDate.setDate(today.getDate() + expiryThreshold);
          
          if (expiry <= thresholdDate) {
            stats.expiringSoon++;
          }
        }
      }
    });

    return stats;
  }

  /**
   * Helper function to make API requests
   * Handles authentication, error handling, and response parsing
   */
  async apiRequest(endpoint, options = {}, token = null) {
    const url = getApiUrl(endpoint);
    const headers = { ...(options.headers || {}) };
    let body = options.body;

    // Handle JSON body
    if (body && !headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
      if (typeof body === 'object' && !Buffer.isBuffer(body)) {
        body = JSON.stringify(body);
      }
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log(`[API Request] ${options.method || 'GET'} ${url}`, {
      hasToken: !!token,
      bodyLength: body?.length
    });

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: body
    });

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('[API Request] Failed to parse JSON response:', parseError);
      const text = await response.text();
      console.error('[API Request] Response text:', text);
      throw new Error(`Invalid JSON response: ${parseError.message}`);
    }

    if (!response.ok) {
      console.error(`[API Request] Error response (${response.status}):`, data);
      const error = new Error(data.error || data.message || `HTTP ${response.status}`);
      if (data.details) error.details = data.details;
      throw error;
    }

    console.log('[API Request] Success:', { ok: data.ok, success: data.success });
    return data;
  }

  /**
   * Get products with pagination and filters
   */
  async getProducts(searchParams, token) {
    try {
      const response = await this.apiRequest('/products', {
        method: 'POST',
        body: JSON.stringify(searchParams),
      }, token);

      return {
        success: response.ok === true || response.success === true,
        products: response.products || response.data || [],
        total: response.total || 0
      };
    } catch (error) {
      // Fallback to mock data when API is not available
      console.log('API not available, using mock products data');
      const mockProducts = this.getMockProducts();
      const { limit = 10, offset = 0, search = '' } = searchParams || {};
      
      // Apply search filter
      let filtered = mockProducts;
      if (search) {
        const query = search.toLowerCase();
        filtered = mockProducts.filter(p => 
          (p.name || '').toLowerCase().includes(query) ||
          (p.product_code || '').toLowerCase().includes(query) ||
          (p.category || '').toLowerCase().includes(query)
        );
      }
      
      // Apply pagination
      const total = filtered.length;
      const paginated = filtered.slice(offset, offset + limit);
      
      return {
        success: true,
        products: paginated,
        total: total
      };
    }
  }

  /**
   * Create a new category
   */
  async createCategory(categoryData, token) {
    try {
      const response = await this.apiRequest('/products/categories', {
        method: 'POST',
        body: JSON.stringify(categoryData),
      }, token);

      return {
        success: response.ok === true || response.success === true,
        category: response.category || response.data
      };
    } catch (error) {
      console.error('[Create Category] Error:', error);
      throw error;
    }
  }

  /**
   * Create a new unit
   */
  async createUnit(unitData, token) {
    try {
      const response = await this.apiRequest('/products/units', {
        method: 'POST',
        body: JSON.stringify(unitData),
      }, token);

      return {
        success: response.ok === true || response.success === true,
        unit: response.unit || response.data
      };
    } catch (error) {
      console.error('[Create Unit] Error:', error);
      throw error;
    }
  }

  /**
   * Get all categories
   */
  async getAllCategories(token) {
    try {
      const response = await this.apiRequest('/products/categories', {
        method: 'GET',
      }, token);

      return {
        success: response.ok === true || response.success === true,
        categories: response.categories || response.data || []
      };
    } catch (error) {
      console.error('[Get All Categories] Error:', error);
      throw error;
    }
  }

  /**
   * Get all units
   */
  async getAllUnits(token) {
    try {
      const response = await this.apiRequest('/products/units', {
        method: 'GET',
      }, token);

      return {
        success: response.ok === true || response.success === true,
        units: response.units || response.data || []
      };
    } catch (error) {
      console.error('[Get All Units] Error:', error);
      throw error;
    }
  }

  /**
   * Find category by name
   */
  async findCategoryByName(name, token) {
    try {
      const encodedName = encodeURIComponent(name);
      const response = await this.apiRequest(`/products/categories/${encodedName}`, {
        method: 'GET',
      }, token);

      return {
        success: response.ok === true || response.success === true,
        category: response.category || response.data
      };
    } catch (error) {
      console.error('[Find Category] Error:', error);
      throw error;
    }
  }

  /**
   * Find unit by name
   */
  async findUnitByName(name, token) {
    try {
      const encodedName = encodeURIComponent(name);
      const response = await this.apiRequest(`/products/units/${encodedName}`, {
        method: 'GET',
      }, token);

      return {
        success: response.ok === true || response.success === true,
        unit: response.unit || response.data
      };
    } catch (error) {
      console.error('[Find Unit] Error:', error);
      throw error;
    }
  }

  /**
   * Create a new product with auto-generated product code
   */
  async createProduct(productData, token) {
    try {
      console.log('[Create Product] Sending request with data:', JSON.stringify(productData, null, 2));
      
      const response = await this.apiRequest('/products/create', {
        method: 'POST',
        body: JSON.stringify(productData),
      }, token);

      if (!response.ok && !response.success) {
        const errorMessage = response.error || 'Failed to create product';
        const error = new Error(errorMessage);
        if (response.details) {
          error.details = response.details;
        }
        throw error;
      }

      if (!response.product && !response.data) {
        throw new Error('Product creation succeeded but no product data returned');
      }

      return {
        success: true,
        product: response.product || response.data
      };
    } catch (error) {
      console.error('[Create Product] Error:', error.message);
      if (error.details) {
        console.error('[Create Product] Validation details:', error.details);
      }
      // Re-throw the error instead of falling back to mock data
      // This ensures the frontend knows the product wasn't actually created
      throw error;
    }
  }

  /**
   * Update an existing product
   */
  async updateProduct(productId, productData, token) {
    try {
      console.log('[Update Product] Sending request with data:', JSON.stringify(productData, null, 2));
      
      const response = await this.apiRequest(`/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify(productData),
      }, token);

      if (!response.ok && !response.success) {
        const errorMessage = response.error || 'Failed to update product';
        const error = new Error(errorMessage);
        if (response.details) {
          error.details = response.details;
        }
        throw error;
      }

      if (!response.product && !response.data) {
        throw new Error('Product update succeeded but no product data returned');
      }

      return {
        success: true,
        product: response.product || response.data
      };
    } catch (error) {
      console.error('[Update Product] Error:', error.message);
      if (error.details) {
        console.error('[Update Product] Validation details:', error.details);
      }
      throw error;
    }
  }

  /**
   * Delete a product
   */
  async deleteProduct(productId, token) {
    try {
      console.log('[Delete Product] Deleting product:', productId);
      
      const response = await this.apiRequest(`/products/${productId}`, {
        method: 'DELETE',
      }, token);

      if (!response.ok && !response.success) {
        throw new Error(response.error || 'Failed to delete product');
      }

      return {
        success: true,
        message: response.message || 'Product deleted successfully'
      };
    } catch (error) {
      console.error('[Delete Product] Error:', error.message);
      throw error;
    }
  }

  /**
   * Export products to CSV
   */
  async exportProducts(searchParams, token) {
    try {
      const params = new URLSearchParams({
        limit: searchParams.limit || 10000,
        offset: searchParams.offset || 0,
        search: searchParams.search || '',
        sortBy: searchParams.sortBy || 'id',
        orderBy: searchParams.orderBy || 'desc'
      });
      
      const url = `${getApiUrl('/products/export')}?${params.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'text/csv'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to export products: ${response.statusText}`);
      }

      const csvContent = await response.text();
      
      return {
        success: true,
        csvContent: csvContent
      };
    } catch (error) {
      console.error('[Export Products] Error:', error);
      throw error;
    }
  }

  /**
   * Export stock/inventories to CSV
   */
  async exportStock(searchParams, token) {
    try {
      const params = new URLSearchParams({
        limit: searchParams.limit || 10000,
        offset: searchParams.offset || 0,
        search: searchParams.search || '',
        filter: searchParams.filter || 'all',
        sortBy: searchParams.sortBy || 'id',
        orderBy: searchParams.orderBy || 'desc'
      });
      
      const url = `${getApiUrl('/inventories/export')}?${params.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'text/csv'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to export stock: ${response.statusText}`);
      }

      const csvContent = await response.text();
      
      return {
        success: true,
        csvContent: csvContent
      };
    } catch (error) {
      console.error('[Export Stock] Error:', error);
      throw error;
    }
  }

  /**
   * Bulk import products
   */
  async bulkImportProducts(products, token) {
    try {
      const response = await this.apiRequest('/products/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ products }),
      }, token);

      console.log('[Bulk Import] API Response:', JSON.stringify(response, null, 2));

      // Log failed results for debugging
      if (response.results && response.results.length > 0) {
        const failed = response.results.filter(r => !r.success);
        if (failed.length > 0) {
          console.error('[Bulk Import] Failed products:');
          failed.forEach(f => {
            console.error(`  Row ${f.index}: ${f.error || 'Unknown error'}`);
            if (f.product) {
              console.error(`    Product: ${JSON.stringify(f.product)}`);
            }
          });
        }
      }

      return {
        success: response.ok === true || response.success === true,
        summary: response.summary || {
          total: products.length,
          successful: response.results?.filter(r => r.success).length || 0,
          failed: response.results?.filter(r => !r.success).length || 0
        },
        results: response.results || []
      };
    } catch (error) {
      // Log the actual error for debugging
      console.error('Error bulk importing products:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        stack: error.stack
      });
      // Re-throw the error instead of returning mock data
      throw error;
    }
  }

  /**
   * Get stock with pagination, filters, and search
   */
  async getStock(searchParams, token) {
    try {
      const response = await this.apiRequest('/inventories', {
        method: 'POST',
        body: JSON.stringify(searchParams),
      }, token);

      return {
        success: response.ok === true || response.success === true,
        stock: response.stock || response.data || [],
        total: response.total || 0,
        stats: response.stats || null
      };
    } catch (error) {
      console.error('[InventoryManager] Error fetching stock:', error);
      // Return empty result instead of mock data
      return {
        success: false,
        stock: [],
        total: 0,
        stats: {
          total: 0,
          outOfStock: 0,
          lowStock: 0,
          expiringSoon: 0,
          expired: 0,
          borrowedFrom: 0,
          borrowedTo: 0,
          highValue: 0
        },
        error: error.message || 'Failed to fetch stock'
      };
    }
  }

  /**
   * Adjust stock quantity (add, subtract, or set)
   */
  async adjustStock(stockId, adjustmentData, token) {
    try {
      const response = await this.apiRequest(`/inventories/${stockId}/adjust`, {
        method: 'POST',
        body: JSON.stringify(adjustmentData),
      }, token);

      return {
        success: response.ok === true || response.success === true,
        stock: response.stock || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to adjust stock',
        details: error.details || null
      };
    }
  }

  /**
   * Create borrowed from stock (received from partner)
   */
  async createBorrowedFromStock(borrowData, token) {
    try {
      console.log('[InventoryManager] createBorrowedFromStock - Payload:', JSON.stringify(borrowData, null, 2));
      
      const response = await this.apiRequest('/inventories/borrow-from', {
        method: 'POST',
        body: JSON.stringify(borrowData),
      }, token);

      console.log('[InventoryManager] createBorrowedFromStock - Response:', JSON.stringify(response, null, 2));

      return {
        success: response.ok === true || response.success === true,
        borrowFrom: response.borrowFrom || response.data
      };
    } catch (error) {
      console.error('[InventoryManager] createBorrowedFromStock - Error:', error);
      console.error('[InventoryManager] createBorrowedFromStock - Payload:', JSON.stringify(borrowData, null, 2));
      console.error('[InventoryManager] createBorrowedFromStock - Error details:', {
        message: error.message,
        stack: error.stack
      });
      
      return {
        success: false,
        error: error.message || 'Failed to create borrowed from stock',
        details: error.details || null
      };
    }
  }

  /**
   * Transfer stock between locations
   */
  async transferStock(stockId, transferData, token) {
    try {
      const response = await this.apiRequest(`/stock/${stockId}/transfer`, {
        method: 'POST',
        body: JSON.stringify(transferData),
      }, token);

      return {
        success: response.ok === true || response.success === true,
        stock: response.stock || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to transfer stock',
        details: error.details || null
      };
    }
  }

  /**
   * Return borrowed stock
   */
  async returnBorrowedStock(stockId, returnData, token) {
    try {
      const response = await this.apiRequest(`/stock/${stockId}/return-borrowed`, {
        method: 'POST',
        body: JSON.stringify(returnData),
      }, token);

      return {
        success: response.ok === true || response.success === true,
        stock: response.stock || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to return borrowed stock',
        details: error.details || null
      };
    }
  }

  /**
   * Get return history for a borrow_to_inventory record
   */
  async getBorrowToReturnHistory(borrowToInventoryId, token) {
    try {
      const response = await this.apiRequest(`/inventories/borrow-to/${borrowToInventoryId}/returns`, {
        method: 'GET',
      }, token);

      return {
        success: response.ok === true || response.success === true,
        history: response.history || [],
        error: response.error || null
      };
    } catch (error) {
      console.error('[InventoryManager] Error getting borrow to return history:', error);
      return {
        success: false,
        history: [],
        error: error.message || 'Failed to get return history'
      };
    }
  }

  /**
   * Process return of borrowed-to items
   */
  async processBorrowToReturn(returnData, token) {
    try {
      const response = await this.apiRequest('/inventories/borrow-to/return', {
        method: 'POST',
        body: JSON.stringify(returnData),
      }, token);

      return {
        success: response.ok === true || response.success === true,
        return: response.return || response.data || null,
        error: response.error || null
      };
    } catch (error) {
      console.error('[InventoryManager] Error processing borrow to return:', error);
      return {
        success: false,
        return: null,
        error: error.message || 'Failed to process return'
      };
    }
  }

  /**
   * Get return status for a borrowed-from item (remaining to return, etc.).
   * Pass { borrowFromId } when row is from borrowed-from list, or { borrowedInventoryId } when by inventory.
   */
  async getBorrowFromReturnStatus(opts, token) {
    try {
      // Always use borrowFromId endpoint, but pass borrowedInventoryId as query param if available
      const borrowFromId = opts?.borrowFromId;
      if (!borrowFromId) {
        throw new Error('borrowFromId is required');
      }
      
      const borrowedInventoryId = opts?.borrowedInventoryId;
      let url = `/inventories/borrow-from/by-borrow/${borrowFromId}/return-status`;
      
      // Add borrowedInventoryId as query parameter if provided
      if (borrowedInventoryId) {
        url += `?borrowedInventoryId=${borrowedInventoryId}`;
      }
      
      const response = await this.apiRequest(url, { method: 'GET' }, token);

      return {
        success: response.ok === true || response.success === true,
        totalBorrowed: response.totalBorrowed ?? 0,
        totalReturned: response.totalReturned ?? 0,
        remaining: response.remaining ?? 0,
        error: response.error || null
      };
    } catch (error) {
      console.error('[InventoryManager] Error getting borrow from return status:', error);
      return {
        success: false,
        totalBorrowed: 0,
        totalReturned: 0,
        remaining: 0,
        error: error.message || 'Failed to get return status'
      };
    }
  }

  /**
   * Get inventories by product_id (inventories table only). All have valid inventory id.
   */
  async getInventoriesByProduct(productId, token) {
    try {
      const response = await this.apiRequest(`/inventories/by-product/${productId}`, { method: 'GET' }, token);
      return {
        success: response.ok === true || response.success === true,
        items: response.items || [],
        error: response.error || null
      };
    } catch (error) {
      console.error('[InventoryManager] Error getting inventories by product:', error);
      return { success: false, items: [], error: error.message || 'Failed to get inventories by product' };
    }
  }

  /**
   * Process return of borrowed-from items (with GL adjustments)
   * 
   * @param {Object} returnData - Return data from frontend
   * @param {number} returnData.borrowedInventoryId - ID of the borrowed inventory
   * @param {Array} returnData.returnItems - Array of {inventory_id: number, quantity: number}
   *   Backend also accepts {returningInventoryId, quantityReturned} format for backward compatibility
   * @param {string} returnData.returnedOn - Return date (YYYY-MM-DD)
   * @param {string} [returnData.note] - Optional note
   * @param {string} token - Authentication token
   * @returns {Promise<Object>} Result with success status and return details
   */
  async processBorrowFromReturn(returnData, token) {
    try {
      console.log('[InventoryManager] processBorrowFromReturn input:', typeof returnData, Array.isArray(returnData), JSON.stringify(returnData));
      const response = await this.apiRequest('/inventories/borrow-from/return', {
        method: 'POST',
        body: JSON.stringify(returnData),
      }, token);

      const out = {
        success: response.ok === true || response.success === true,
        result: response.result || response.data || null,
        error: response.error || null
      };
      console.log('[InventoryManager] processBorrowFromReturn response success:', out.success, 'result type:', typeof out.result, Array.isArray(out.result));
      return out;
    } catch (error) {
      console.error('[InventoryManager] Error processing borrow from return:', error);
      console.error('[InventoryManager] error.message:', error?.message);
      console.error('[InventoryManager] error.stack:', error?.stack);
      return {
        success: false,
        result: null,
        error: error.message || 'Failed to process borrow from return'
      };
    }
  }

  /**
   * Bulk import stock
   */
  async bulkImportStock(stockItems, reason, token) {
    try {
      const response = await this.apiRequest('/inventories/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ 
          stockItems,
          reason: reason || 'Bulk Import'
        }),
      }, token);

      return {
        success: response.ok === true || response.success === true,
        summary: response.summary || {
          total: stockItems.length,
          successful: response.results?.filter(r => r.success).length || 0,
          failed: response.results?.filter(r => !r.success).length || 0
        },
        results: response.results || []
      };
    } catch (error) {
      // Fallback to mock response when API is not available
      console.log('API not available, using mock bulk import stock response');
      const successful = stockItems.length;
      return {
        success: true,
        summary: {
          total: successful,
          successful: successful,
          failed: 0
        },
        results: stockItems.map((item, index) => ({
          index: index,
          success: true,
          data: item
        }))
      };
    }
  }

  /**
   * Update stock item details
   */
  async updateStock(stockId, stockData, token) {
    try {
      const response = await this.apiRequest(`/inventories/${stockId}`, {
        method: 'PUT',
        body: JSON.stringify(stockData),
      }, token);

      return {
        success: response.ok === true || response.success === true,
        stock: response.stock || response.data
      };
    } catch (error) {
      // Fallback to mock response when API is not available
      console.log('API not available, using mock update stock response');
      return {
        success: true,
        stock: { id: stockId, ...stockData }
      };
    }
  }

  /**
   * Get bin card transactions for a product
   * @param {number} productId - Product ID
   * @param {Object} params - Query parameters (limit, offset, sortBy, orderBy, search, filter)
   * @param {string} token - Auth token
   * @returns {Object} - { success, transactions, total }
   */
  async getBinCardsByProductId(productId, params = {}, token) {
    try {
      const queryParams = new URLSearchParams();
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.offset) queryParams.append('offset', params.offset);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.orderBy) queryParams.append('orderBy', params.orderBy);
      if (params.search) queryParams.append('search', params.search);
      
      // Add filter parameters
      if (params.filter) {
        if (params.filter.transactionType && params.filter.transactionType.length > 0) {
          queryParams.append('transactionType', params.filter.transactionType.join(','));
        }
        if (params.filter.reason) queryParams.append('reason', params.filter.reason);
        if (params.filter.dateFrom) queryParams.append('dateFrom', params.filter.dateFrom);
        if (params.filter.dateTo) queryParams.append('dateTo', params.filter.dateTo);
        if (params.filter.location) queryParams.append('location', params.filter.location);
      }

      const queryString = queryParams.toString();
      const url = `/bin-cards/product/${productId}${queryString ? `?${queryString}` : ''}`;

      const response = await this.apiRequest(url, {
        method: 'GET',
      }, token);

      return {
        success: response.ok === true || response.success === true,
        transactions: response.transactions || [],
        total: response.total || 0
      };
    } catch (error) {
      console.error('[Get Bin Cards] Error:', error);
      throw error;
    }
  }

  /**
   * Export bin card transactions to CSV
   * @param {number} productId - Product ID
   * @param {Object} params - Query parameters (limit, offset, sortBy, orderBy, search, filter)
   * @param {string} token - Auth token
   * @returns {Object} - { success, csvContent }
   */
  async exportBinCards(productId, params = {}, token) {
    try {
      const queryParams = new URLSearchParams();
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.offset) queryParams.append('offset', params.offset);
      if (params.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params.orderBy) queryParams.append('orderBy', params.orderBy);
      if (params.search) queryParams.append('search', params.search);
      
      // Add filter parameters
      if (params.filter) {
        if (params.filter.transactionType && params.filter.transactionType.length > 0) {
          queryParams.append('transactionType', params.filter.transactionType.join(','));
        }
        if (params.filter.reason) queryParams.append('reason', params.filter.reason);
        if (params.filter.dateFrom) queryParams.append('dateFrom', params.filter.dateFrom);
        if (params.filter.dateTo) queryParams.append('dateTo', params.filter.dateTo);
        if (params.filter.location) queryParams.append('location', params.filter.location);
      }

      const queryString = queryParams.toString();
      const url = `/bin-cards/product/${productId}/export${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(getApiUrl(url), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `HTTP ${response.status}` };
        }
        const error = new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
        if (errorData.details) error.details = errorData.details;
        throw error;
      }

      const csvContent = await response.text();

      return {
        success: true,
        csvContent
      };
    } catch (error) {
      console.error('[Export Bin Cards] Error:', error);
      throw error;
    }
  }
}

export default InventoryManager;
