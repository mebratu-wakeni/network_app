const { ViewModel, SharedStateManager } = Liteframe;
import { permissionChecker } from '../../utils/PermissionChecker';

export class InventoryVM extends ViewModel {
  constructor(sharedStateManager = new SharedStateManager()) {
    super(sharedStateManager);
    this.initializeState();
    // Load user permissions on initialization
    this.loadUserPermissions();
    // Load initial data based on active tab
    const activeTab = this.getState('inventory-tab');
    if (activeTab === 'products') {
      this.loadProducts();
    } else if (activeTab === 'stock') {
      this.loadStock();
    }
  }

  async loadUserPermissions() {
    try {
      await permissionChecker.loadPermissions();
    } catch (error) {
      console.error('Failed to load user permissions:', error);
    }
  }

  initializeState() {
    // UI State
    this.setState('inventory-tab', 'products');
    this.setState('loading', false);
    this.setState('error', null);
    this.setState('success', null);

    // Products State
    this.setState('product-list', []);
    this.setState('product-total-count', 0);
    this.setState('product-table-config', {
      limit: 10,
      offset: 0,
      sortBy: 'id',
      orderBy: 'desc'
    });
    this.setState('product-filter', 'all'); // 'all' | 'out-of-stock' | 'low-stock'
    this.setState('product-stats', { outOfStock: 0, lowStock: 0 });
    this.setState('product-search-query', '');
    this.setState('product-form', {
      name: '',
      description: '',
      category: '',
      unit: '',
      category_id: null,
      unit_id: null,
      remark: '',
      expiry_threshold: 30
    });

    // Partners State
    this.setState('partner-list', []);

    // Categories and Units State
    this.setState('category-list', []);
    this.setState('unit-list', []);

    // Stock State - Consolidated into single object
    // This state contains all stock data and changes based on filters/search
    this.setState('stock-list', {
      items: [], // The actual stock items array
      total: 0, // Total count
      stats: { // Statistics
        total: 0,
        outOfStock: 0,
        lowStock: 0,
        expiringSoon: 0,
        expired: 0,
        borrowedFrom: 0,
        borrowedTo: 0,
        highValue: 0
      },
      config: { // Table configuration
        limit: 10,
        offset: 0,
        sortBy: 'id',
        orderBy: 'desc'
      },
      search: '', // Search query
      filter: 'all' // Filter: 'all', 'out-of-stock', 'low-stock', etc.
    });
    this.setState('inventory-by-product-list', []); // Inventories by product (return-borrowed drawer)

    // Drawer States (Products)
    this.setState('selected-product', null);
    this.setState('product-drawer-type', null); // 'details', 'bin-card'
    this.setState('product-drawer-open', false);
    this.setState('bin-card-transactions', []);
    this.setState('bin-card-total', 0);
    this.setState('bin-card-search-query', '');
    this.setState('bin-card-filter', {
      transactionType: [],
      reason: '',
      dateFrom: '',
      dateTo: '',
      location: ''
    });
    this.setState('bin-card-table-config', {
      limit: 50,
      offset: 0,
      sortBy: 'transaction_date',
      orderBy: 'desc'
    });

    // Drawer States (Stock)
    this.setState('selected-stock-item', null);
    this.setState('stock-drawer-type', null); // 'view-details', 'adjust-stock', 'transfer', 'return-borrowed'
    this.setState('stock-drawer-open', false);

    // Product Details Form State
    this.setState('product-details-form', {
      name: '',
      description: '',
      category: '',
      unit: '',
      expiry_threshold: 30
    });
    this.setState('product-details-edit-mode', false);

    // Stock Details Form State (for editing stock item details)
    this.setState('stock-details-form', {
      inventoryCode: '',
      productCode: '',
      quantity: 0,
      batchNo: '',
      expiryDate: null,
      unitCost: 0,
      sellingPrice: 0
    });
    this.setState('stock-details-edit-mode', false);
    this.setState('stock-pricing-edit-mode', false);

    // Stock Drawer Form States
    this.setState('adjust-stock-form', {
      adjustmentType: 'add', // 'add', 'subtract', 'set'
      amount: 0,
      reason: '',
      notes: '',
      adjustmentDate: new Date().toISOString().split('T')[0], // Default to today
      partnerId: null, // For "Borrow To" reason
      partnerSearchQuery: '',
      showPartnerDropdown: false
    });
    this.setState('transfer-stock-form', {
      quantity: 0,
      fromLocation: '',
      toLocation: '',
      notes: ''
    });
    this.setState('return-borrowed-form', {
      returnDate: new Date().toISOString().split('T')[0],
      returnQuantity: 0,
      selectedStocks: [], // Array of {stockId, quantity}
      notes: ''
    });
    this.setState('return-borrowed-to-form', {
      returnDate: new Date().toISOString().split('T')[0],
      returnItems: [], // Array of {batch_number, expiry_date, quantity_returned, location}
      notes: '',
      returnHistory: [] // Will be loaded when drawer opens
    });

    // Import Modal State
    this.setState('import-file', null);
    this.setState('import-parsed-data', []);
    this.setState('import-validation-results', []);
    this.setState('import-results', null);
  }

  // ==================== Partners Methods ====================

  async loadPartners(customerType = 'supplier') {
    try {
      this.updateState('loading', true);
      
      const result = await window.ipcRenderer.invoke('inventory:get-partners', customerType);
      
      this.updateState('partner-list', result || []);
      this.updateState('loading', false);
      
      return result;
    } catch (error) {
      console.error('Error loading partners:', error);
      this.updateState('error', error.message || 'Failed to load partners');
      this.updateState('loading', false);
      // Return empty array on error
      this.updateState('partner-list', []);
      return [];
    }
  }

  // ==================== Products Methods ====================

  async loadProducts() {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const tableConfig = this.getState('product-table-config');
      const searchQuery = this.getState('product-search-query');
      
      const productFilter = this.getState('product-filter') || 'all';
      const result = await window.ipcRenderer.invoke('inventory:get-products', {
        limit: tableConfig.limit,
        offset: tableConfig.offset,
        search: searchQuery,
        sortBy: tableConfig.sortBy,
        orderBy: tableConfig.orderBy,
        filter: productFilter
      });

      if (result.success) {
        this.updateState('product-list', result.products || []);
        this.updateState('product-total-count', result.total || 0);
        if (result.stats) {
          this.updateState('product-stats', result.stats);
        }
        return result.products;
      }

      throw new Error(result.error || 'Failed to load products');
    } finally {
      this.updateState('loading', false);
    }
  }

  /**
   * Load all products (for dropdowns/modals) - loads all products without pagination
   */
  async loadAllProducts() {
    try {
      console.log('[InventoryVM] loadAllProducts - Loading all products...');
      this.updateState('loading', true);
      
      const result = await window.ipcRenderer.invoke('inventory:get-products', {
        limit: 10000, // Large limit to get all products
        offset: 0,
        search: '',
        sortBy: 'name',
        orderBy: 'asc'
      });

      console.log('[InventoryVM] loadAllProducts - Result:', result);

      if (result.success) {
        const products = result.products || [];
        console.log('[InventoryVM] loadAllProducts - Loaded', products.length, 'products');
        this.updateState('product-list', products);
        this.updateState('product-total-count', result.total || 0);
        return products;
      }

      throw new Error(result.error || 'Failed to load products');
    } catch (error) {
      console.error('[InventoryVM] loadAllProducts - Error:', error);
      this.updateState('error', { message: error.message || 'Failed to load products' });
      return [];
    } finally {
      this.updateState('loading', false);
    }
  }

  async exportProducts() {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const tableConfig = this.getState('product-table-config');
      const searchQuery = this.getState('product-search-query');
      
      const result = await window.ipcRenderer.invoke('inventory:export-products', {
        limit: 10000, // Export all matching records
        offset: 0,
        search: searchQuery,
        sortBy: tableConfig.sortBy,
        orderBy: tableConfig.orderBy
      });

      if (result.success && result.csvContent) {
        // Create a blob and download
        const blob = new Blob([result.csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `products_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        this.updateState('success', { message: 'Products exported successfully' });
        return result;
      }

      throw new Error(result.error || 'Failed to export products');
    } catch (error) {
      console.error('Error exporting products:', error);
      this.updateState('error', { message: error.message || 'Failed to export products' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async createBorrowedFromStock(borrowData) {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    console.log('[InventoryVM] createBorrowedFromStock - Payload:', JSON.stringify(borrowData, null, 2));

    try {
      const result = await window.ipcRenderer.invoke('inventory:create-borrowed-from-stock', borrowData);

      console.log('[InventoryVM] createBorrowedFromStock - Result:', JSON.stringify(result, null, 2));

      if (result.success) {
        this.updateState('success', { message: 'Borrowed from stock created successfully' });
        this.updateState('loading', false);
        await this.loadStock();
        return result;
      }

      const errorMessage = result.error || 'Failed to create borrowed from stock';
      console.error('[InventoryVM] createBorrowedFromStock - Failed:', errorMessage);
      console.error('[InventoryVM] createBorrowedFromStock - Payload:', JSON.stringify(borrowData, null, 2));
      console.error('[InventoryVM] createBorrowedFromStock - Result:', JSON.stringify(result, null, 2));
      throw new Error(errorMessage);
    } catch (error) {
      console.error('[InventoryVM] createBorrowedFromStock - Error:', error);
      console.error('[InventoryVM] createBorrowedFromStock - Payload:', JSON.stringify(borrowData, null, 2));
      console.error('[InventoryVM] createBorrowedFromStock - Error details:', {
        message: error.message,
        stack: error.stack
      });
      this.updateState('error', { message: error.message || 'Failed to create borrowed from stock' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async loadCategories() {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);

    try {
      const result = await window.ipcRenderer.invoke('inventory:get-all-categories');

      if (result.success) {
        this.updateState('category-list', result.categories || []);
        return result.categories || [];
      }

      throw new Error(result.error || 'Failed to load categories');
    } catch (error) {
      console.error('Error loading categories:', error);
      this.updateState('error', { message: error.message || 'Failed to load categories' });
      // Don't throw, just log - we can continue with empty list
      return [];
    } finally {
      this.updateState('loading', false);
    }
  }

  async loadUnits() {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);

    try {
      const result = await window.ipcRenderer.invoke('inventory:get-all-units');

      if (result.success) {
        this.updateState('unit-list', result.units || []);
        return result.units || [];
      }

      throw new Error(result.error || 'Failed to load units');
    } catch (error) {
      console.error('Error loading units:', error);
      this.updateState('error', { message: error.message || 'Failed to load units' });
      // Don't throw, just log - we can continue with empty list
      return [];
    } finally {
      this.updateState('loading', false);
    }
  }

  getCategoryList() {
    return this.getState('category-list') || [];
  }

  getUnitList() {
    return this.getState('unit-list') || [];
  }

  async createCategory(categoryData) {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const result = await window.ipcRenderer.invoke('inventory:create-category', categoryData);

      if (result.success) {
        this.updateState('success', { message: 'Category created successfully' });
        // Reload categories list to include the new one
        await this.loadCategories();
        return result.category;
      }

      throw new Error(result.error || 'Failed to create category');
    } catch (error) {
      console.error('Error creating category:', error);
      this.updateState('error', { message: error.message || 'Failed to create category' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async createUnit(unitData) {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const result = await window.ipcRenderer.invoke('inventory:create-unit', unitData);

      if (result.success) {
        this.updateState('success', { message: 'Unit created successfully' });
        // Reload units list to include the new one
        await this.loadUnits();
        return result.unit;
      }

      throw new Error(result.error || 'Failed to create unit');
    } catch (error) {
      console.error('Error creating unit:', error);
      this.updateState('error', { message: error.message || 'Failed to create unit' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async createProduct(productData) {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      // Prepare product data with category_id and unit_id
      const productPayload = {
        name: productData.name,
        description: productData.description || null,
        remark: productData.remark || null,
        expiry_threshold: productData.expiry_threshold || 30
      };

      // Handle category_id - use existing ID or look up by name
      if (productData.category_id) {
        // Ensure category_id is a number
        productPayload.category_id = parseInt(productData.category_id, 10);
        if (isNaN(productPayload.category_id) || productPayload.category_id <= 0) {
          throw new Error('Invalid category ID');
        }
      } else if (productData.category && productData.category.trim() !== '') {
        // Category name provided - look it up by name
        try {
          const result = await window.ipcRenderer.invoke('inventory:find-category-by-name', productData.category);
          if (result.success && result.category && result.category.id) {
            productPayload.category_id = parseInt(result.category.id, 10);
            if (isNaN(productPayload.category_id) || productPayload.category_id <= 0) {
              throw new Error(`Invalid category ID returned for "${productData.category}"`);
            }
          } else {
            throw new Error(`Category "${productData.category}" not found. Please create it using the "+ New" button.`);
          }
        } catch (error) {
          if (error.message && error.message.includes('not found')) {
            throw error;
          }
          throw new Error(`Failed to find category "${productData.category}": ${error.message || 'Unknown error'}`);
        }
      } else {
        throw new Error('Category is required');
      }

      // Handle unit_id - use existing ID or look up by name
      if (productData.unit_id) {
        // Ensure unit_id is a number
        productPayload.unit_id = parseInt(productData.unit_id, 10);
        if (isNaN(productPayload.unit_id) || productPayload.unit_id <= 0) {
          throw new Error('Invalid unit ID');
        }
      } else if (productData.unit && productData.unit.trim() !== '') {
        // Unit name provided - look it up by name
        try {
          const result = await window.ipcRenderer.invoke('inventory:find-unit-by-name', productData.unit);
          if (result.success && result.unit && result.unit.id) {
            productPayload.unit_id = parseInt(result.unit.id, 10);
            if (isNaN(productPayload.unit_id) || productPayload.unit_id <= 0) {
              throw new Error(`Invalid unit ID returned for "${productData.unit}"`);
            }
          } else {
            throw new Error(`Unit "${productData.unit}" not found. Please create it using the "+ New" button.`);
          }
        } catch (error) {
          if (error.message && error.message.includes('not found')) {
            throw error;
          }
          throw new Error(`Failed to find unit "${productData.unit}": ${error.message || 'Unknown error'}`);
        }
      } else {
        throw new Error('Unit is required');
      }

      // Log the payload before sending to debug validation issues
      console.log('[InventoryVM] Product payload before API call:', productPayload);

      const result = await window.ipcRenderer.invoke('inventory:create-product', productPayload);

      if (result.success) {
        this.updateState('success', { message: 'Product created successfully' });
        // Set loading to false so loadProducts() can run
        this.updateState('loading', false);
        // Reload products list
        await this.loadProducts();
        return result.product;
      }

      throw new Error(result.error || 'Failed to create product');
    } catch (error) {
      console.error('Error creating product:', error);
      
      // Build a detailed error message
      let errorMessage = error.message || 'Failed to create product';
      if (error.details && Array.isArray(error.details)) {
        const validationErrors = error.details.map(d => `${d.field}: ${d.message}`).join(', ');
        errorMessage = `Validation failed: ${validationErrors}`;
      }
      
      this.updateState('error', { message: errorMessage });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async updateProduct(productId, productData) {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const result = await window.ipcRenderer.invoke('inventory:update-product', {
        id: productId,
        ...productData
      });

      if (result.success) {
        this.updateState('success', { message: 'Product updated successfully' });
        // Update selected product and form with saved data so the drawer shows DB values (e.g. expiry_threshold)
        const updated = result.product || result.data;
        if (updated) {
          const prev = this.getState('selected-product');
          if (prev && prev.id === productId) {
            this.updateState('selected-product', { ...prev, ...updated });
          }
          const form = this.getState('product-details-form');
          const expiryThreshold = updated.expiry_threshold ?? updated.expiryThreshold;
          this.updateState('product-details-form', {
            ...form,
            name: updated.name ?? form.name,
            description: updated.description ?? form.description,
            category: updated.category ?? form.category,
            category_id: updated.category_id ?? form.category_id,
            unit: updated.unit ?? form.unit,
            unit_id: updated.unit_id ?? form.unit_id,
            remark: updated.remark ?? form.remark,
            expiry_threshold: expiryThreshold != null ? expiryThreshold : (form.expiry_threshold ?? 30)
          });
        }
        // Set loading to false so loadProducts() can run
        this.updateState('loading', false);
        // Reload products list
        await this.loadProducts();
        return result.product;
      }

      throw new Error(result.error || 'Failed to update product');
    } catch (error) {
      console.error('Error updating product:', error);
      this.updateState('error', { message: error.message || 'Failed to update product' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async deleteProduct(productId) {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const result = await window.ipcRenderer.invoke('inventory:delete-product', productId);

      if (result.success) {
        this.updateState('success', { message: 'Product deleted successfully' });
        // Set loading to false so loadProducts() can run
        this.updateState('loading', false);
        // Reload products list
        await this.loadProducts();
        return true;
      }

      throw new Error(result.error || 'Failed to delete product');
    } catch (error) {
      console.error('Error deleting product:', error);
      this.updateState('error', { message: error.message || 'Failed to delete product' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async bulkImportProducts(products) {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const result = await window.ipcRenderer.invoke('inventory:bulk-import-products', { products });

      if (result.success) {
        this.updateState('success', { 
          message: `Successfully imported ${result.summary?.successful || 0} product(s)` 
        });
        // Reload products list
        await this.loadProducts();
        return result;
      }

      throw new Error(result.error || 'Failed to import products');
    } catch (error) {
      console.error('Error importing products:', error);
      this.updateState('error', { message: error.message || 'Failed to import products' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async bulkImportStock(stockItems, reason = 'Initial Stock') {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const result = await window.ipcRenderer.invoke('inventory:bulk-import-stock', { stockItems, reason });

      if (result.success) {
        this.updateState('success', { 
          message: `Successfully imported ${result.summary?.successful || 0} stock item(s)` 
        });
        this.updateState('loading', false);
        await this.loadStock();
        return result;
      }

      throw new Error(result.error || 'Failed to import stock');
    } catch (error) {
      console.error('Error importing stock:', error);
      this.updateState('error', { message: error.message || 'Failed to import stock' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  updateProductSearchQuery(query) {
    this.updateState('product-search-query', query);
    // Reset to first page when searching
    this.updateState('product-table-config', {
      ...this.getState('product-table-config'),
      offset: 0
    });
  }

  setProductLimit(limit) {
    const tableConfig = this.getState('product-table-config');
    console.log('setProductLimit called:', limit, 'current config:', tableConfig);
    this.updateState('product-table-config', {
      ...tableConfig,
      limit: parseInt(limit),
      offset: 0 // Reset to first page
    });
    console.log('Updated config:', this.getState('product-table-config'));
  }

  nextProductPage() {
    const tableConfig = this.getState('product-table-config');
    const totalCount = this.getState('product-total-count');
    
    if (tableConfig.offset + tableConfig.limit >= totalCount) return;
    
    this.updateState('product-table-config', {
      ...tableConfig,
      offset: tableConfig.offset + tableConfig.limit
    });
  }

  previousProductPage() {
    const tableConfig = this.getState('product-table-config');
    
    if (tableConfig.offset <= 0) return;
    
    this.updateState('product-table-config', {
      ...tableConfig,
      offset: Math.max(0, tableConfig.offset - tableConfig.limit)
    });
  }

  // ==================== Stock Methods ====================

  async loadStock() {
    if (this.getState('loading')) return;

    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const raw = this.getState('stock-list');
      const stockList = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
      const config = (stockList.config && typeof stockList.config === 'object' && !Array.isArray(stockList.config)) 
        ? stockList.config 
        : { limit: 10, offset: 0, sortBy: 'id', orderBy: 'desc' };
      const search = typeof stockList.search === 'string' ? stockList.search : '';
      const filter = typeof stockList.filter === 'string' ? stockList.filter : 'all';

      console.log('[InventoryVM] loadStock - Filter:', filter, 'Full state:', stockList);

      const result = await window.ipcRenderer.invoke('inventory:get-stock', {
        limit: config.limit,
        offset: config.offset,
        search: search,
        filter: filter,
        sortBy: config.sortBy,
        orderBy: config.orderBy
      });

      console.log('[InventoryVM] loadStock - Result:', {
        success: result.success,
        stockCount: result.stock?.length || 0,
        total: result.total,
        filter: filter
      });

      if (result.success) {
        const statsFallback = {
          total: 0,
          outOfStock: 0,
          lowStock: 0,
          expiringSoon: 0,
          expired: 0,
          borrowedFrom: 0,
          borrowedTo: 0,
          highValue: 0,
          totalCost: 0,
          itemsWithStock: 0,
          totalQuantity: 0
        };
        const safeStats = (result.stats && typeof result.stats === 'object' && !Array.isArray(result.stats))
          ? result.stats
          : (stockList.stats && typeof stockList.stats === 'object' && !Array.isArray(stockList.stats))
            ? stockList.stats
            : statsFallback;
        this.updateState('stock-list', {
          ...stockList,
          items: Array.isArray(result.stock) ? result.stock : [],
          total: typeof result.total === 'number' ? result.total : 0,
          filter: filter,
          search: search,
          stats: safeStats,
          dataType: result.dataType || null
        });
        return result.stock;
      }

      throw new Error(result.error || 'Failed to load stock');
    } finally {
      this.updateState('loading', false);
    }
  }

  async exportStock() {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const stockList = this.getState('stock-list');
      const config = stockList.config || { sortBy: 'id', orderBy: 'desc' };
      const search = stockList.search || '';
      const filter = stockList.filter || 'all';
      
      const result = await window.ipcRenderer.invoke('inventory:export-stock', {
        limit: 10000, // Export all matching records
        offset: 0,
        search: search,
        filter: filter,
        sortBy: config.sortBy,
        orderBy: config.orderBy
      });

      if (result.success && result.csvContent) {
        // Create a blob and download
        const blob = new Blob([result.csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `stock_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        this.updateState('success', { message: 'Stock exported successfully' });
        return result;
      }

      throw new Error(result.error || 'Failed to export stock');
    } catch (error) {
      console.error('Error exporting stock:', error);
      this.updateState('error', { message: error.message || 'Failed to export stock' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async adjustStock(stockId, adjustmentData) {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const result = await window.ipcRenderer.invoke('inventory:adjust-stock', {
        stockId,
        ...adjustmentData
      });

      if (result.success) {
        this.updateState('success', { message: 'Stock adjusted successfully' });
        // Allow loadStock to run (it early-returns when loading is true)
        this.updateState('loading', false);
        await this.loadStock();
        return result.stock;
      }

      throw new Error(result.error || 'Failed to adjust stock');
    } catch (error) {
      console.error('Error adjusting stock:', error);
      this.updateState('error', { message: error.message || 'Failed to adjust stock' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async transferStock(stockId, transferData) {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const result = await window.ipcRenderer.invoke('inventory:transfer-stock', {
        stockId,
        ...transferData
      });

      if (result.success) {
        this.updateState('success', { message: 'Stock transferred successfully' });
        this.updateState('loading', false);
        await this.loadStock();
        return result;
      }

      throw new Error(result.error || 'Failed to transfer stock');
    } catch (error) {
      console.error('Error transferring stock:', error);
      this.updateState('error', { message: error.message || 'Failed to transfer stock' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async returnBorrowedStock(stockId, returnData) {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const result = await window.ipcRenderer.invoke('inventory:return-borrowed-stock', {
        stockId,
        ...returnData
      });

      if (result.success) {
        this.updateState('success', { message: 'Borrowed stock returned successfully' });
        this.updateState('loading', false);
        await this.loadStock();
        return result;
      }

      throw new Error(result.error || 'Failed to return borrowed stock');
    } catch (error) {
      console.error('Error returning borrowed stock:', error);
      this.updateState('error', { message: error.message || 'Failed to return borrowed stock' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  updateStockSearchQuery(query) {
    const stockList = this.getState('stock-list');
    this.updateState('stock-list', {
      ...stockList,
      search: query,
      config: {
        ...stockList.config,
        offset: 0 // Reset to first page when searching
      }
    });
  }

  updateStockFilter(filter) {
    const stockList = this.getState('stock-list');
    this.updateState('stock-list', {
      ...stockList,
      filter: filter,
      config: {
        ...stockList.config,
        offset: 0 // Reset to first page when filtering
      }
    });
  }

  setStockLimit(limit) {
    const stockList = this.getState('stock-list');
    this.updateState('stock-list', {
      ...stockList,
      config: {
        ...stockList.config,
        limit: parseInt(limit),
        offset: 0 // Reset to first page
      }
    });
  }

  nextStockPage() {
    const stockList = this.getState('stock-list');
    const config = stockList.config || { limit: 10, offset: 0 };
    const total = stockList.total || 0;
    
    if (config.offset + config.limit >= total) return;
    
    this.updateState('stock-list', {
      ...stockList,
      config: {
        ...config,
        offset: config.offset + config.limit
      }
    });
  }

  previousStockPage() {
    const stockList = this.getState('stock-list');
    const config = stockList.config || { limit: 10, offset: 0 };
    
    if (config.offset <= 0) return;
    
    this.updateState('stock-list', {
      ...stockList,
      config: {
        ...config,
        offset: Math.max(0, config.offset - config.limit)
      }
    });
  }

  // ==================== Utility Methods ====================

  getProductList() {
    return this.getState('product-list');
  }

  getStockList() {
    const stockList = this.getState('stock-list');
    return stockList?.items || [];
  }

  getInventoriesByProductList() {
    return this.getState('inventory-by-product-list') || [];
  }

  getPartnerList() {
    return this.getState('partner-list');
  }

  getStockStats() {
    const stockList = this.getState('stock-list');
    return stockList?.stats || {
      total: 0,
      outOfStock: 0,
      lowStock: 0,
      expiringSoon: 0,
      expired: 0,
      borrowedFrom: 0,
      borrowedTo: 0,
      highValue: 0,
      totalCost: 0,
      itemsWithStock: 0,
      totalQuantity: 0
    };
  }

  getActiveTab() {
    return this.getState('inventory-tab');
  }

  async updateTab(tabKey) {
    this.updateState('inventory-tab', tabKey);
    // Fetch data for the active tab
    if (tabKey === 'products') {
      await this.loadProducts();
    } else if (tabKey === 'stock') {
      await this.loadStock();
    }
  }

  updateProductForm(key, value) {
    const form = this.getState('product-form');
    this.updateState('product-form', {
      ...form,
      [key]: value
    });
    // Trigger re-render by updating loading state
    this.updateState('loading', true);
    setTimeout(() => {
      this.updateState('loading', false);
    }, 0);
  }

  resetProductForm() {
    this.updateState('product-form', {
      name: '',
      description: '',
      category: '',
      unit: '',
      category_id: null,
      unit_id: null,
      remark: '',
      expiry_threshold: 30
    });
    // Trigger re-render
    this.updateState('loading', true);
    setTimeout(() => {
    this.updateState('loading', false);
    }, 0);
  }

  // ==================== Drawer Management Methods ====================

  // Products Drawer
  async openProductDrawer(product, drawerType) {
    this.updateState('selected-product', product);
    this.updateState('product-drawer-type', drawerType);
    this.updateState('loading', true); // Trigger re-render
    
    // Load bin card transactions if opening bin-card drawer
    if (drawerType === 'bin-card' && product && product.id) {
      await this.loadBinCards(product.id);
    }
    
    // Open drawer after data is loaded
    this.updateState('product-drawer-open', true);
    
    // Initialize form with product data if opening details drawer
    if (drawerType === 'details' && product) {
      // Try to resolve category_id and unit_id from names if not present
      let categoryId = product.category_id || null;
      let unitId = product.unit_id || null;
      
      // If we have category/unit names but not IDs, try to look them up
      if (!categoryId && product.category) {
        try {
          const result = await window.ipcRenderer.invoke('inventory:find-category-by-name', product.category);
          if (result.success && result.category) {
            categoryId = result.category.id;
          }
        } catch (error) {
          console.warn('Could not find category ID for:', product.category);
        }
      }
      
      if (!unitId && product.unit) {
        try {
          const result = await window.ipcRenderer.invoke('inventory:find-unit-by-name', product.unit);
          if (result.success && result.unit) {
            unitId = result.unit.id;
          }
        } catch (error) {
          console.warn('Could not find unit ID for:', product.unit);
        }
      }
      
      this.updateState('product-details-form', {
        name: product.name || '',
        description: product.description || '',
        category: product.category || '',
        category_id: categoryId,
        unit: product.unit || '',
        unit_id: unitId,
        remark: product.remark || '',
        expiry_threshold: product.expiry_threshold || 30
      });
      this.updateState('product-details-edit-mode', false);
    }
    // Trigger slide animation
    setTimeout(() => {
      this.updateState('product-drawer-open', true);
      this.updateState('loading', false); // Trigger re-render after animation starts
    }, 10);
  }

  closeProductDrawer() {
    // First: Set openSlide to false (triggers slide-out animation)
    this.updateState('product-drawer-open', false);
    this.updateState('loading', true); // Trigger re-render to start slide-out animation
    
    // After animation completes, remove drawer from DOM
    setTimeout(() => {
      this.updateState('selected-product', null);
      this.updateState('product-drawer-type', null);
      this.updateState('product-details-edit-mode', false);
      this.updateState('loading', false); // Trigger re-render to remove drawer from DOM
    }, 300);
  }

  // Stock Drawer
  openStockDrawer(stockItem, drawerType) {
    // First: Set drawer type and item (drawer appears in DOM with openSlide: false)
    this.updateState('selected-stock-item', stockItem);
    this.updateState('stock-drawer-type', drawerType);
    this.updateState('stock-drawer-open', false);
    this.updateState('loading', true); // Trigger re-render to mount drawer in DOM
    
    // Initialize form based on drawer type
    if (drawerType === 'view-details' && stockItem) {
      let expiryForInput = null;
      if (stockItem.expiryDate != null && stockItem.expiryDate !== '') {
        try {
          const d = new Date(stockItem.expiryDate);
          if (!isNaN(d.getTime())) expiryForInput = d.toISOString().split('T')[0];
        } catch (_) { /* leave null */ }
      }
      this.updateState('stock-details-form', {
        inventoryCode: stockItem.inventoryCode || stockItem.id?.toString() || '',
        productCode: stockItem.productCode || '',
        quantity: stockItem.quantity || 0,
        batchNo: stockItem.batchNumber || stockItem.batchNo || '',
        expiryDate: expiryForInput,
        unitCost: stockItem.unitCost || 0,
        sellingPrice: stockItem.sellingPrice || 0
      });
      this.updateState('stock-details-edit-mode', false);
      this.updateState('stock-pricing-edit-mode', false);
    } else if (drawerType === 'adjust-stock' && stockItem) {
      this.updateState('adjust-stock-form', {
        adjustmentType: 'add',
        amount: 0,
        reason: '',
        notes: '',
        adjustmentDate: new Date().toISOString().split('T')[0],
        partnerId: null,
        partnerSearchQuery: '',
        showPartnerDropdown: false
      });
      // Load all customers for adjust stock drawer (needed for borrow-to operations)
      // This ensures customers with type 'both', 'retailer', 'other' are available
      this.loadPartners('all');
    } else if (drawerType === 'transfer' && stockItem) {
      this.updateState('transfer-stock-form', {
        quantity: 0,
        fromLocation: stockItem.location || '',
        toLocation: '',
        notes: ''
      });
    } else if (drawerType === 'return-borrowed' && stockItem) {
      this.updateState('return-borrowed-form', {
        returnDate: new Date().toISOString().split('T')[0],
        returnQuantity: 0,
        selectedStocks: [], // Array of {inventory_id, quantity}
        notes: '',
        returnStatus: null, // { totalBorrowed, totalReturned, remaining }
        availableStocks: [] // Array of inventory items from inventories table
      });
    } else if (drawerType === 'return-borrowed-to' && stockItem) {
      // Initialize return-borrowed-to form state
      this.updateState('return-borrowed-to-form', {
        returnDate: new Date().toISOString().split('T')[0],
        returnQuantity: 0,
        notes: '',
        returnHistory: [] // Will be loaded when drawer opens
      });
    }
    
    // After drawer is in DOM, trigger slide animation
    setTimeout(() => {
      this.updateState('stock-drawer-open', true);
      this.updateState('loading', false); // Trigger re-render to show slide animation
    }, 10);
  }

  closeStockDrawer() {
    // First: Set openSlide to false (triggers slide-out animation)
    this.updateState('stock-drawer-open', false);
    this.updateState('loading', true); // Trigger re-render to start slide-out animation
    
    // After animation completes, remove drawer from DOM
    setTimeout(() => {
      this.updateState('selected-stock-item', null);
      this.updateState('stock-drawer-type', null);
      this.updateState('stock-details-edit-mode', false);
      this.updateState('stock-pricing-edit-mode', false);
      this.updateState('loading', false); // Trigger re-render to remove drawer from DOM
    }, 300);
  }

  // ==================== Form Management Methods ====================

  // Product Details Form
  updateProductDetailsForm(key, value) {
    const form = this.getState('product-details-form');
    this.updateState('product-details-form', {
      ...form,
      [key]: value
    });
  }

  setProductDetailsEditMode(editMode) {
    this.updateState('product-details-edit-mode', editMode);
    this.updateState('loading', true); // Trigger re-render
    if (!editMode) {
      // Reset form to current selected product (including expiry_threshold so it doesn't revert to 30)
      const product = this.getState('selected-product');
      if (product) {
        const expiryThreshold = product.expiry_threshold ?? product.expiryThreshold;
        this.updateState('product-details-form', {
          name: product.name || '',
          description: product.description || '',
          category: product.category || '',
          category_id: product.category_id ?? null,
          unit: product.unit || '',
          unit_id: product.unit_id ?? null,
          remark: product.remark || '',
          expiry_threshold: expiryThreshold != null ? expiryThreshold : 30
        });
      }
    }
    this.updateState('loading', false); // Complete re-render
  }

  // Adjust Stock Form
  updateAdjustStockForm(key, value) {
    const form = this.getState('adjust-stock-form');
    const isAdjustmentTypeChange = key === 'adjustmentType';
    const isReasonChange = key === 'reason';
    const isPartnerDropdownChange = key === 'showPartnerDropdown';
    
    // If changing adjustment type, reason, or partner dropdown visibility, trigger a re-render
    if (isAdjustmentTypeChange || isReasonChange || isPartnerDropdownChange) {
      this.updateState('loading', true);
    }
    
    this.updateState('adjust-stock-form', {
      ...form,
      [key]: value
    });
    
    // Reset loading after state update to trigger re-render
    if (isAdjustmentTypeChange || isReasonChange || isPartnerDropdownChange) {
      setTimeout(() => {
    this.updateState('loading', false);
      }, 0);
    }
  }

  resetAdjustStockForm() {
    this.updateState('adjust-stock-form', {
      adjustmentType: 'add',
      amount: 0,
      reason: '',
      notes: '',
      adjustmentDate: new Date().toISOString().split('T')[0],
      partnerId: null,
      partnerSearchQuery: '',
      showPartnerDropdown: false
    });
  }

  // Transfer Stock Form
  updateTransferStockForm(key, value) {
    const form = this.getState('transfer-stock-form');
    this.updateState('transfer-stock-form', {
      ...form,
      [key]: value
    });
  }

  resetTransferStockForm() {
    const stockItem = this.getState('selected-stock-item');
    this.updateState('transfer-stock-form', {
      quantity: 0,
      fromLocation: stockItem?.location || '',
      toLocation: '',
      notes: ''
    });
  }

  updateReturnBorrowedSelectedStocks(stocks) {
    this.updateState('return-borrowed-form', {
      ...this.getState('return-borrowed-form'),
      selectedStocks: stocks
    });
    // Auto-calculate total quantity
    const totalQuantity = stocks.reduce((sum, stock) => sum + (stock.quantity || 0), 0);
    this.updateReturnBorrowedForm('returnQuantity', totalQuantity);
  }

  resetReturnBorrowedForm() {
    this.updateState('return-borrowed-form', {
      returnDate: new Date().toISOString().split('T')[0],
      returnQuantity: 0,
      selectedStocks: [],
      notes: ''
    });
  }

  /**
   * Get return history for a borrow_to_inventory record
   */
  async getBorrowToReturnHistory(borrowToInventoryId) {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);

    try {
      const result = await window.ipcRenderer.invoke('inventory:get-borrow-to-return-history', borrowToInventoryId);

      if (result.success) {
        return result.history || [];
      }

      throw new Error(result.error || 'Failed to get return history');
    } catch (error) {
      console.error('Error getting return history:', error);
      this.updateState('error', { message: error.message || 'Failed to get return history' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  /**
   * Process return of borrowed-to items
   */
  async processBorrowToReturn(returnData) {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const result = await window.ipcRenderer.invoke('inventory:process-borrow-to-return', returnData);

      if (result.success) {
        this.updateState('success', { message: 'Return processed successfully' });
        // Reset form after successful return
        this.updateState('return-borrowed-to-form', {
          returnDate: new Date().toISOString().split('T')[0],
          returnItems: [],
          notes: '',
          returnHistory: []
        });
        this.updateState('loading', false);
        // Reload stock list to reflect updated inventory
        try {
          console.log('[InventoryVM] processBorrowToReturn calling loadStock');
          await this.loadStock();
          console.log('[InventoryVM] processBorrowToReturn loadStock done');
        } catch (loadError) {
          console.error('Error reloading stock after return:', loadError);
        }
        return result.return;
      }

      throw new Error(result.error || 'Failed to process return');
    } catch (error) {
      console.error('Error processing return:', error);
      this.updateState('error', { message: error.message || 'Failed to process return' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  /**
   * Get return status for a borrowed-from item (remaining to return, etc.).
   * Pass { borrowFromId } when row is from borrowed-from list, or { borrowedInventoryId } when by inventory.
   * Updates viewModel state with return status.
   */
  async getBorrowFromReturnStatus(opts = {}) {
    try {
      console.log('[InventoryVM] getBorrowFromReturnStatus called with opts:', opts);
      const result = await window.ipcRenderer.invoke('inventory:get-borrow-from-return-status', opts);
      console.log('[InventoryVM] getBorrowFromReturnStatus raw result:', JSON.stringify(result, null, 2));
      
      if (result && (result.success || result.ok)) {
        const returnStatus = {
          totalBorrowed: Number(result.totalBorrowed) || 0,
          totalReturned: Number(result.totalReturned) || 0,
          remaining: Number(result.remaining) || 0
        };
        console.log('[InventoryVM] Parsed returnStatus:', returnStatus);
        
        // Update viewModel state and trigger re-render
        const form = this.getState('return-borrowed-form') || {};
        this.updateState('loading', true);
        this.updateState('return-borrowed-form', {
          ...form,
          returnStatus
        });
        
        // Verify state was updated
        const updatedForm = this.getState('return-borrowed-form');
        console.log('[InventoryVM] State after update:', {
          returnStatus: updatedForm?.returnStatus,
          remaining: updatedForm?.returnStatus?.remaining
        });
        
        // Complete re-render trigger
        setTimeout(() => {
          this.updateState('loading', false);
        }, 0);
        
        return returnStatus;
      }
      
      const errorMsg = result?.error || 'Failed to get return status';
      console.error('[InventoryVM] getBorrowFromReturnStatus failed:', errorMsg, result);
      throw new Error(errorMsg);
    } catch (error) {
      console.error('[InventoryVM] Error getting borrow from return status:', error);
      const defaultStatus = { totalBorrowed: 0, totalReturned: 0, remaining: 0 };
      const form = this.getState('return-borrowed-form') || {};
      this.updateState('return-borrowed-form', {
        ...form,
        returnStatus: defaultStatus
      });
      // Trigger re-render even on error
      setTimeout(() => {
        this.updateState('loading', false);
      }, 0);
      return defaultStatus;
    }
  }

  /**
   * Load inventories by product_id (inventories table only). All have valid inventory id.
   * Used by return-borrowed drawer for available stock.
   * Updates viewModel state with available stocks.
   */
  async loadInventoriesByProduct(productId) {
    try {
      console.log('[InventoryVM] loadInventoriesByProduct called with productId:', productId);
      // Trigger re-render by updating loading state
      this.updateState('loading', true);
      
      const result = await window.ipcRenderer.invoke('inventory:get-inventories-by-product', productId);
      console.log('[InventoryVM] loadInventoriesByProduct result:', result);
      const items = (result.success || result.ok) ? (result.items || []) : [];
      console.log('[InventoryVM] loadInventoriesByProduct items:', items.length, items);
      
      // Update both the old state (for backward compatibility) and new form state
      this.updateState('inventory-by-product-list', items);
      const form = this.getState('return-borrowed-form') || {};
      this.updateState('return-borrowed-form', {
        ...form,
        availableStocks: items
      });
      
      // Complete re-render trigger
      setTimeout(() => {
        this.updateState('loading', false);
      }, 0);
      
      return items;
    } catch (error) {
      console.error('Error loading inventories by product:', error);
      this.updateState('inventory-by-product-list', []);
      const form = this.getState('return-borrowed-form') || {};
      this.updateState('return-borrowed-form', {
        ...form,
        availableStocks: []
      });
      // Complete re-render trigger even on error
      setTimeout(() => {
        this.updateState('loading', false);
      }, 0);
      return [];
    }
  }

  /**
   * Process return of borrowed-from items (with GL adjustments)
   * Accepts returnItems as array of {inventory_id, quantity}
   * Backend accepts both {inventory_id, quantity} and {returningInventoryId, quantityReturned} formats
   */
  async processBorrowFromReturn(returnData) {
    if (this.getState('loading')) return;

    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      // Send data directly - backend handles both formats
      // Frontend sends: {inventory_id, quantity}
      // Backend accepts: {inventory_id, quantity} OR {returningInventoryId, quantityReturned}
      const result = await window.ipcRenderer.invoke('inventory:process-borrow-from-return', returnData);
      console.log('[InventoryVM] processBorrowFromReturn IPC result:', typeof result, Array.isArray(result), result && typeof result === 'object' ? Object.keys(result) : 'n/a');
      const ok = result && (result.success === true || result.ok === true);

      if (ok) {
        this.updateState('success', { message: 'Borrow from return processed successfully' });
        // Reset form after successful return
        this.updateState('return-borrowed-form', {
          returnDate: new Date().toISOString().split('T')[0],
          returnQuantity: 0,
          selectedStocks: [],
          notes: '',
          returnStatus: null,
          availableStocks: []
        });
        this.updateState('loading', false);
        try {
          console.log('[InventoryVM] processBorrowFromReturn calling loadStock');
          await this.loadStock();
          console.log('[InventoryVM] processBorrowFromReturn loadStock done');
        } catch (loadError) {
          console.error('Error reloading stock after return:', loadError);
        }
        return;
      }

      const errMsg = (result && (result.error || result.message)) || 'Failed to process borrow from return';
      const errStr = typeof errMsg === 'string' ? errMsg : (errMsg && errMsg.toString ? errMsg.toString() : 'Failed to process borrow from return');
      throw new Error(errStr);
    } catch (error) {
      console.error('Error processing borrow from return:', error);
      console.error('[InventoryVM] processBorrowFromReturn catch - error.message:', error?.message, 'error.stack:', error?.stack);
      const errMessage = (error && error.message && typeof error.message === 'string') ? error.message : 'Failed to process borrow from return';
      this.updateState('error', { message: errMessage });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  /**
   * Update return-borrowed-to form data (for complex data types)
   * Triggers re-render by updating loading state
   */
  updateReturnBorrowedToForm(updates) {
    this.updateState('return-borrowed-to-form', {
      ...this.getState('return-borrowed-to-form'),
      ...updates
    });
    // Trigger re-render
    this.updateState('loading', true);
    setTimeout(() => this.updateState('loading', false), 0);
  }

  /**
   * Update return-borrowed form data (for complex data types)
   * Triggers re-render by updating loading state
   */
  updateReturnBorrowedForm(key, value) {
    const form = this.getState('return-borrowed-form') || {};
    // Trigger re-render by updating loading state
    this.updateState('loading', true);
    this.updateState('return-borrowed-form', {
      ...form,
      [key]: value
    });
    // Complete re-render trigger
    setTimeout(() => {
      this.updateState('loading', false);
    }, 0);
  }

  // Stock Details Form (for editing stock item details)
  updateStockDetailsForm(key, value) {
    const form = this.getState('stock-details-form');
    this.updateState('stock-details-form', {
      ...form,
      [key]: value
    });
  }

  setStockDetailsEditMode(editMode) {
    this.updateState('stock-details-edit-mode', editMode);
    this.updateState('loading', true); // Trigger re-render
    if (!editMode) {
      // Reset form to original stock item values (expiryDate as YYYY-MM-DD for date input)
      const stockItem = this.getState('selected-stock-item');
      if (stockItem) {
        let expiryForInput = null;
        if (stockItem.expiryDate != null && stockItem.expiryDate !== '') {
          try {
            const d = new Date(stockItem.expiryDate);
            if (!isNaN(d.getTime())) expiryForInput = d.toISOString().split('T')[0];
          } catch (_) { /* leave null */ }
        }
        this.updateState('stock-details-form', {
          inventoryCode: stockItem.inventoryCode || stockItem.id?.toString() || '',
          productCode: stockItem.productCode || '',
          quantity: stockItem.quantity || 0,
          batchNo: stockItem.batchNumber || stockItem.batchNo || '',
          expiryDate: expiryForInput,
          unitCost: stockItem.unitCost || 0,
          sellingPrice: stockItem.sellingPrice || 0
        });
      }
    }
    this.updateState('loading', false); // Complete re-render
  }

  setStockPricingEditMode(editMode) {
    this.updateState('stock-pricing-edit-mode', editMode);
    this.updateState('loading', true); // Trigger re-render
    if (!editMode) {
      // Reset selling price to original stock item value
      const stockItem = this.getState('selected-stock-item');
      if (stockItem) {
        const form = this.getState('stock-details-form');
        this.updateState('stock-details-form', {
          ...form,
          sellingPrice: stockItem.sellingPrice || 0
        });
      }
    }
    this.updateState('loading', false); // Complete re-render
  }

  async updateStock(stockId, stockData) {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    console.log('[InventoryVM] updateStock - Request payload:', {
      stockId,
      stockData: JSON.stringify(stockData, null, 2)
    });

    try {
      const result = await window.ipcRenderer.invoke('inventory:update-stock', { stockId, stockData });

      console.log('[InventoryVM] updateStock - Response:', JSON.stringify(result, null, 2));

      if (result.success) {
        this.updateState('success', { 
          message: 'Stock item updated successfully' 
        });
        // Update the selected stock item with the updated data
        const currentStockItem = this.getState('selected-stock-item');
        if (currentStockItem && currentStockItem.id === stockId && result.stock) {
          this.updateState('selected-stock-item', {
            ...currentStockItem,
            ...result.stock
          });
          // Also update the form with the new values (expiryDate as YYYY-MM-DD for date input)
          const form = this.getState('stock-details-form');
          let expiryForInput = form.expiryDate ?? null;
          if (result.stock.expiryDate != null && result.stock.expiryDate !== '') {
            try {
              const d = new Date(result.stock.expiryDate);
              if (!isNaN(d.getTime())) expiryForInput = d.toISOString().split('T')[0];
            } catch (_) { /* keep form value */ }
          }
          this.updateState('stock-details-form', {
            ...form,
            ...result.stock,
            batchNo: result.stock.batchNumber || result.stock.batchNo || form.batchNo,
            expiryDate: result.stock.expiryDate !== undefined ? expiryForInput : form.expiryDate
          });
        }
        // Allow loadStock to run (it early-returns when loading is true)
        this.updateState('loading', false);
        await this.loadStock();
        return result;
      }

      throw new Error(result.error || 'Failed to update stock');
    } catch (error) {
      console.error('Error updating stock:', error);
      this.updateState('error', { message: error.message || 'Failed to update stock' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }
  setProductSort(column) {
    console.log('setProductSort called:', column);
    const tableConfig = this.getState('product-table-config');
    this.updateState('product-table-config', {
      ...tableConfig,
      sortBy: column,
      orderBy: tableConfig.orderBy === 'asc' ? 'desc' : 'asc'
    });
    this.loadProducts();
  }

  setProductFilter(filter) {
    this.updateState('product-filter', filter);
    const tableConfig = this.getState('product-table-config');
    this.updateState('product-table-config', { ...tableConfig, offset: 0 });
    this.loadProducts();
  }

  setStockSort(column) {
    const stockList = this.getState('stock-list');
    const currentOrderBy = stockList.config?.orderBy || 'desc';
    this.updateState('stock-list', {
      ...stockList,
      config: {
        ...stockList.config,
        sortBy: column,
        orderBy: currentOrderBy === 'asc' ? 'desc' : 'asc'
      }
    });
    this.loadStock();
  }

  // ==================== Import Modal State Management ====================

  setImportFile(file) {
    this.updateState('import-file', file);
    this.updateState('import-results', null);
  }

  setImportParsedData(data) {
    this.updateState('import-parsed-data', data);
  }

  setImportValidationResults(results) {
    this.updateState('import-validation-results', results);
  }

  setImportResults(results) {
    this.updateState('import-results', results);
  }

  clearImportState() {
    this.updateState('import-file', null);
    this.updateState('import-parsed-data', []);
    this.updateState('import-validation-results', []);
    this.updateState('import-results', null);
  }

  /**
   * Load bin card transactions for a product
   * @param {number} productId - Product ID
   */
  async loadBinCards(productId) {
    if (!productId) {
      console.error('loadBinCards: productId is required');
      this.updateState('bin-card-transactions', []);
      this.updateState('bin-card-total', 0);
      return;
    }
    
    this.updateState('loading', true);
    this.updateState('error', null);

    try {
      const tableConfig = this.getState('bin-card-table-config');
      const searchQuery = this.getState('bin-card-search-query');
      const filter = this.getState('bin-card-filter');

      const result = await window.ipcRenderer.invoke('inventory:get-bin-cards', productId, {
        limit: tableConfig.limit,
        offset: tableConfig.offset,
        sortBy: tableConfig.sortBy,
        orderBy: tableConfig.orderBy,
        search: searchQuery,
        filter: filter
      });

      if (result && result.success) {
        this.updateState('bin-card-transactions', result.transactions || []);
        this.updateState('bin-card-total', result.total || 0);
      } else {
        throw new Error(result?.error || 'Failed to load bin card transactions');
      }
    } catch (error) {
      console.error('Error loading bin cards:', error);
      this.updateState('error', { message: error.message || 'Failed to load bin card transactions' });
      this.updateState('bin-card-transactions', []);
      this.updateState('bin-card-total', 0);
    } finally {
      this.updateState('loading', false);
    }
  }

  updateBinCardSearchQuery(query) {
    this.updateState('bin-card-search-query', query);
    // Reset to first page when searching
    this.updateState('bin-card-table-config', {
      ...this.getState('bin-card-table-config'),
      offset: 0
    });
  }

  updateBinCardFilter(filter) {
    this.updateState('bin-card-filter', filter);
    // Reset to first page when filtering
    this.updateState('bin-card-table-config', {
      ...this.getState('bin-card-table-config'),
      offset: 0
    });
  }

  updateBinCardSort(sortBy, orderBy) {
    this.updateState('bin-card-table-config', {
      ...this.getState('bin-card-table-config'),
      sortBy,
      orderBy,
      offset: 0 // Reset to first page when sorting
    });
  }

  nextBinCardPage() {
    const tableConfig = this.getState('bin-card-table-config');
    const totalCount = this.getState('bin-card-total');
    
    if (tableConfig.offset + tableConfig.limit >= totalCount) return;
    
    this.updateState('bin-card-table-config', {
      ...tableConfig,
      offset: tableConfig.offset + tableConfig.limit
    });
  }

  previousBinCardPage() {
    const tableConfig = this.getState('bin-card-table-config');
    
    if (tableConfig.offset <= 0) return;
    
    this.updateState('bin-card-table-config', {
      ...tableConfig,
      offset: Math.max(0, tableConfig.offset - tableConfig.limit)
    });
  }

  /**
   * Get bin card transactions
   */
  getBinCardTransactions() {
    return this.getState('bin-card-transactions') || [];
  }

  /**
   * Get bin card total count
   */
  getBinCardTotal() {
    return this.getState('bin-card-total') || 0;
  }

  /**
   * Export bin card transactions to CSV
   */
  async exportBinCards(productId) {
    if (this.getState('loading')) return;
    
    if (!productId) {
      const selectedProduct = this.getState('selected-product');
      if (!selectedProduct || !selectedProduct.id) {
        this.updateState('error', { message: 'No product selected for bin card export' });
        return;
      }
      productId = selectedProduct.id;
    }
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const tableConfig = this.getState('bin-card-table-config');
      const searchQuery = this.getState('bin-card-search-query');
      const filter = this.getState('bin-card-filter');
      
      const result = await window.ipcRenderer.invoke('inventory:export-bin-cards', productId, {
        limit: 10000, // Export all matching records
        offset: 0,
        search: searchQuery,
        filter: filter,
        sortBy: tableConfig.sortBy,
        orderBy: tableConfig.orderBy
      });

      if (result.success && result.csvContent) {
        // Create a blob and download
        const blob = new Blob([result.csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        const selectedProduct = this.getState('selected-product');
        const productCode = selectedProduct?.product_code || productId;
        link.download = `bin_card_export_${productCode}_${new Date().toISOString().split('T')[0]}.csv`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        this.updateState('success', { message: 'Bin card exported successfully' });
        return result;
      }

      throw new Error(result.error || 'Failed to export bin card');
    } catch (error) {
      console.error('Error exporting bin card:', error);
      this.updateState('error', { message: error.message || 'Failed to export bin card' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }
}