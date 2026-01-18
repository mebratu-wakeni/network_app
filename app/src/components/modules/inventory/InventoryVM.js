const { ViewModel, SharedStateManager } = Liteframe;

export class InventoryVM extends ViewModel {
  constructor(sharedStateManager = new SharedStateManager()) {
    super(sharedStateManager);
    this.initializeState();
    // Load initial data based on active tab
    const activeTab = this.getState('inventory-tab');
    if (activeTab === 'products') {
      this.loadProducts();
    } else if (activeTab === 'stock') {
      this.loadStock();
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
    this.setState('product-search-query', '');
    this.setState('product-form', {
      name: '',
      description: '',
      category: '',
      unit: ''
    });

    // Partners State
    this.setState('partner-list', []);

    // Stock State
    this.setState('stock-list', []);
    this.setState('stock-total-count', 0);
    this.setState('stock-table-config', {
      limit: 10,
      offset: 0,
      sortBy: 'id',
      orderBy: 'desc'
    });
    this.setState('stock-search-query', '');
    this.setState('stock-filter', 'all'); // 'all', 'out-of-stock', 'low-stock', etc.
    
    // Stock Statistics (aggregate data)
    this.setState('stock-stats', {
      total: 0,
      outOfStock: 0,
      lowStock: 0,
      expiringSoon: 0,
      expired: 0,
      borrowedFrom: 0,
      borrowedTo: 0,
      highValue: 0
    });

    // Drawer States (Products)
    this.setState('selected-product', null);
    this.setState('product-drawer-type', null); // 'details', 'bin-card'
    this.setState('product-drawer-open', false);

    // Drawer States (Stock)
    this.setState('selected-stock-item', null);
    this.setState('stock-drawer-type', null); // 'view-details', 'adjust-stock', 'transfer', 'return-borrowed'
    this.setState('stock-drawer-open', false);

    // Product Details Form State
    this.setState('product-details-form', {
      name: '',
      description: '',
      category: '',
      unit: ''
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

    // Import Modal State
    this.setState('import-file', null);
    this.setState('import-parsed-data', []);
    this.setState('import-validation-results', []);
    this.setState('import-results', null);
  }

  // ==================== Partners Methods ====================

  async loadPartners() {
    try {
      this.updateState('loading', true);
      
      const result = await window.ipcRenderer.invoke('inventory:get-partners');
      
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
      
      const result = await window.ipcRenderer.invoke('inventory:get-products', {
        limit: tableConfig.limit,
        offset: tableConfig.offset,
        search: searchQuery,
        sortBy: tableConfig.sortBy,
        orderBy: tableConfig.orderBy
      });

      if (result.success) {
        this.updateState('product-list', result.products || []);
        this.updateState('product-total-count', result.total || 0);
        return result.products;
      }

      throw new Error(result.error || 'Failed to load products');
    } finally {
      this.updateState('loading', false);
    }
  }

  async createBorrowedFromStock(borrowData) {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const result = await window.ipcRenderer.invoke('inventory:create-borrowed-from-stock', borrowData);

      if (result.success) {
        this.updateState('success', { message: 'Borrowed from stock created successfully' });
        await this.loadStock();
        return result;
      }

      throw new Error(result.error || 'Failed to create borrowed from stock');
    } catch (error) {
      console.error('Error creating borrowed from stock:', error);
      this.updateState('error', { message: error.message || 'Failed to create borrowed from stock' });
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
      const result = await window.ipcRenderer.invoke('inventory:create-product', productData);

      if (result.success) {
        this.updateState('success', { message: 'Product created successfully' });
        // Reload products list
        await this.loadProducts();
        return result.product;
      }

      throw new Error(result.error || 'Failed to create product');
    } catch (error) {
      console.error('Error creating product:', error);
      this.updateState('error', { message: error.message || 'Failed to create product' });
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
        // Reload stock list
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
      const tableConfig = this.getState('stock-table-config');
      const searchQuery = this.getState('stock-search-query');
      const filter = this.getState('stock-filter');
      
      const result = await window.ipcRenderer.invoke('inventory:get-stock', {
        limit: tableConfig.limit,
        offset: tableConfig.offset,
        search: searchQuery,
        filter: filter,
        sortBy: tableConfig.sortBy,
        orderBy: tableConfig.orderBy
      });

      if (result.success) {
        this.updateState('stock-list', result.stock || []);
        this.updateState('stock-total-count', result.total || 0);
        // Update statistics (should come from backend)
        if (result.stats) {
          this.updateState('stock-stats', result.stats);
        }
        return result.stock;
      }

      throw new Error(result.error || 'Failed to load stock');
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
        // Reload stock list and stats
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
        // Reload stock list
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
        // Reload stock list
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
    this.updateState('stock-search-query', query);
    // Reset to first page when searching
    this.updateState('stock-table-config', {
      ...this.getState('stock-table-config'),
      offset: 0
    });
  }

  updateStockFilter(filter) {
    this.updateState('stock-filter', filter);
    // Reset to first page when filtering
    this.updateState('stock-table-config', {
      ...this.getState('stock-table-config'),
      offset: 0
    });
  }

  setStockLimit(limit) {
    const tableConfig = this.getState('stock-table-config');
    this.updateState('stock-table-config', {
      ...tableConfig,
      limit: parseInt(limit),
      offset: 0 // Reset to first page
    });
  }

  nextStockPage() {
    const tableConfig = this.getState('stock-table-config');
    const totalCount = this.getState('stock-total-count');
    
    if (tableConfig.offset + tableConfig.limit >= totalCount) return;
    
    this.updateState('stock-table-config', {
      ...tableConfig,
      offset: tableConfig.offset + tableConfig.limit
    });
  }

  previousStockPage() {
    const tableConfig = this.getState('stock-table-config');
    
    if (tableConfig.offset <= 0) return;
    
    this.updateState('stock-table-config', {
      ...tableConfig,
      offset: Math.max(0, tableConfig.offset - tableConfig.limit)
    });
  }

  // ==================== Utility Methods ====================

  getProductList() {
    return this.getState('product-list');
  }

  getStockList() {
    return this.getState('stock-list');
  }

  getPartnerList() {
    return this.getState('partner-list');
  }

  getStockStats() {
    return this.getState('stock-stats');
  }

  getActiveTab() {
    return this.getState('inventory-tab');
  }

  async updateTab(value) {
    this.updateState('inventory-tab', value);
    // Load data for the new tab
    if (value === 'products') {
      await this.loadProducts();
    } else if (value === 'stock') {
      await this.loadStock();
    }
  }

  updateProductForm(key, value) {
    const form = this.getState('product-form');
    this.updateState('product-form', {
      ...form,
      [key]: value
    });
  }

  resetProductForm() {
    this.updateState('product-form', {
      name: '',
      description: '',
      category: '',
      unit: ''
    });
  }

  // ==================== Drawer Management Methods ====================

  // Products Drawer
  openProductDrawer(product, drawerType) {
    this.updateState('selected-product', product);
    this.updateState('product-drawer-type', drawerType);
    this.updateState('product-drawer-open', false);
    this.updateState('loading', true); // Trigger re-render
    // Initialize form with product data if opening details drawer
    if (drawerType === 'details' && product) {
      this.updateState('product-details-form', {
        name: product.name || '',
        description: product.description || '',
        category: product.category || '',
        unit: product.unit || ''
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
      this.updateState('stock-details-form', {
        inventoryCode: stockItem.inventoryCode || stockItem.id?.toString() || '',
        productCode: stockItem.productCode || '',
        quantity: stockItem.quantity || 0,
        batchNo: stockItem.batchNo || '',
        expiryDate: stockItem.expiryDate || null,
        unitCost: stockItem.unitCost || 0,
        sellingPrice: stockItem.sellingPrice || 0
      });
      this.updateState('stock-details-edit-mode', false);
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
        selectedStocks: [],
        notes: ''
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
      // Reset form to original product values
      const product = this.getState('selected-product');
      if (product) {
        this.updateState('product-details-form', {
          name: product.name || '',
          description: product.description || '',
          category: product.category || '',
          unit: product.unit || ''
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

  // Return Borrowed Form
  updateReturnBorrowedForm(key, value) {
    const form = this.getState('return-borrowed-form');
    this.updateState('return-borrowed-form', {
      ...form,
      [key]: value
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
      // Reset form to original stock item values
      const stockItem = this.getState('selected-stock-item');
      if (stockItem) {
        this.updateState('stock-details-form', {
          inventoryCode: stockItem.inventoryCode || stockItem.id?.toString() || '',
          productCode: stockItem.productCode || '',
          quantity: stockItem.quantity || 0,
          batchNo: stockItem.batchNo || '',
          expiryDate: stockItem.expiryDate || null,
          unitCost: stockItem.unitCost || 0,
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

    try {
      const result = await window.ipcRenderer.invoke('inventory:update-stock', { stockId, stockData });

      if (result.success) {
        this.updateState('success', { 
          message: 'Stock item updated successfully' 
        });
        // Reload stock list
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
}