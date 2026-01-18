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
   * Get Partners/Customers (only partner type)
   */
  async getPartners(token) {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/partners?type=partner`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch partners: ${response.statusText}`);
      }

      const data = await response.json();
      return data.partners || [];
    } catch (error) {
      console.error('Error fetching partners, using mock data:', error);
      // Fallback to mock data
      return this.getMockPartners();
    }
  }

  /**
   * Calculate stock statistics from stock list
   */
  calculateStockStats(stockList) {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
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
        } else if (expiry <= thirtyDaysFromNow) {
          stats.expiringSoon++;
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
   * Create a new product
   */
  async createProduct(productData, token) {
    try {
      const response = await this.apiRequest('/products', {
        method: 'POST',
        body: JSON.stringify(productData),
      }, token);

      return {
        success: response.ok === true || response.success === true,
        product: response.product || response.data
      };
    } catch (error) {
      // Fallback to mock response when API is not available
      console.log('API not available, using mock create product response');
      const mockProducts = this.getMockProducts();
      const maxId = Math.max(...mockProducts.map(p => p.id), 0);
      const newProduct = {
        id: maxId + 1,
        product_code: String(maxId + 1).padStart(4, '0'),
        name: productData.name || '',
        description: productData.description || '',
        category: productData.category || '',
        unit: productData.unit || '',
        category_id: 61,
        unit_id: 106,
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        sync_status: 'pending'
      };
      return {
        success: true,
        product: newProduct
      };
    }
  }

  /**
   * Update an existing product
   */
  async updateProduct(productId, productData, token) {
    try {
      const response = await this.apiRequest(`/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify(productData),
      }, token);

      return {
        success: response.ok === true || response.success === true,
        product: response.product || response.data
      };
    } catch (error) {
      // Fallback to mock response when API is not available
      console.log('API not available, using mock update product response');
      const mockProducts = this.getMockProducts();
      const existingProduct = mockProducts.find(p => p.id === productId);
      if (!existingProduct) {
        return {
          success: false,
          error: 'Product not found'
        };
      }
      const updatedProduct = {
        ...existingProduct,
        ...productData,
        last_updated: new Date().toISOString()
      };
      return {
        success: true,
        product: updatedProduct
      };
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
      const response = await this.apiRequest('/stock', {
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
      // Fallback to mock data when API is not available
      console.log('API not available, using mock stock data');
      const mockStock = this.getMockStock();
      const { limit = 10, offset = 0, search = '', filter = 'all' } = searchParams || {};
      
      // Apply filter
      let filtered = mockStock;
      if (filter !== 'all') {
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        const HIGH_VALUE_THRESHOLD = 1000;

        filtered = mockStock.filter(item => {
          if (filter === 'out-of-stock') return item.quantity === 0;
          if (filter === 'low-stock') return item.quantity > 0 && item.quantity < 50;
          if (filter === 'borrowed-from') return item.status === 'borrowed-from' || item.status === 'borrowed';
          if (filter === 'borrowed-to') return item.status === 'borrowed-to';
          if (filter === 'high-value') return item.unitCost >= HIGH_VALUE_THRESHOLD;
          if (filter === 'expiring-soon' && item.expiryDate) {
            const expiry = new Date(item.expiryDate);
            return expiry >= today && expiry <= thirtyDaysFromNow;
          }
          if (filter === 'expired' && item.expiryDate) {
            const expiry = new Date(item.expiryDate);
            return expiry < today;
          }
          return true;
        });
      }
      
      // Apply search filter
      if (search) {
        const query = search.toLowerCase();
        filtered = filtered.filter(item => 
          (item.productCode || '').toLowerCase().includes(query) ||
          (item.name || '').toLowerCase().includes(query) ||
          (item.location || '').toLowerCase().includes(query)
        );
      }
      
      // Calculate stats
      const stats = this.calculateStockStats(mockStock);
      
      // Apply pagination
      const total = filtered.length;
      const paginated = filtered.slice(offset, offset + limit);
      
      return {
        success: true,
        stock: paginated,
        total: total,
        stats: stats
      };
    }
  }

  /**
   * Adjust stock quantity (add, subtract, or set)
   */
  async adjustStock(stockId, adjustmentData, token) {
    try {
      const response = await this.apiRequest(`/stock/${stockId}/adjust`, {
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
      const response = await this.apiRequest('/stock/borrow-from', {
        method: 'POST',
        body: JSON.stringify(borrowData),
      }, token);

      return {
        success: response.ok === true || response.success === true,
        stock: response.stock || response.data
      };
    } catch (error) {
      // Fallback to mock response when API is not available
      console.log('API not available, using mock create borrowed from stock response');
      const mockStock = this.getMockStock();
      const maxId = Math.max(...mockStock.map(s => s.id), 0);
      
      // Generate inventory code
      const inventoryCode = `INV-${String(maxId + 1).padStart(6, '0')}`;
      
      const newStock = {
        id: maxId + 1,
        inventory_code: inventoryCode,
        product_id: borrowData.productId,
        productCode: borrowData.productCode,
        name: borrowData.productName || 'Product',
        category: borrowData.category || '',
        location: borrowData.location || 'A-01',
        quantity: borrowData.quantity || 0,
        unit: borrowData.unit || 'Unit',
        unitCost: borrowData.purchasePrice || 0,
        sellingPrice: borrowData.sellingPrice || null,
        batchNo: borrowData.batchNo || null,
        expiryDate: borrowData.expiryDate || null,
        purchaseDate: new Date().toISOString().split('T')[0],
        acquisitionType: 'borrow',
        status: 'borrowed-from',
        borrowDirection: 'from',
        settlement_status: 'unsettled'
      };
      
      return {
        success: true,
        stock: newStock
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
   * Bulk import stock
   */
  async bulkImportStock(stockItems, token) {
    try {
      const response = await this.apiRequest('/stock/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ stockItems }),
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
      const response = await this.apiRequest(`/stock/${stockId}`, {
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
}

export default InventoryManager;
