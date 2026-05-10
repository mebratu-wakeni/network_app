const { ViewModel, SharedStateManager } = Liteframe;
import { permissionChecker } from '../../utils/PermissionChecker';
import { DROPDOWN_SEARCH_DEBOUNCE_MS, DROPDOWN_SEARCH_LIMIT } from '../../utils/dropdownSearchConfig';

/** Normalize date to YYYY-MM-DD for API (handles ISO strings and Date objects from DB). */
function normalizeOrderDate(value) {
  if (value == null || value === '') return new Date().toISOString().split('T')[0];
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (typeof value === 'string' && value.includes('T')) return value.split('T')[0];
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return String(value).split('T')[0].slice(0, 10);
}

const DEFAULT_CURRENT_ORDER = {
  supplier_id: null,
  supplier: null,
  order_date: new Date().toISOString().split('T')[0],
  invoice_no: '',
  payment_mode: 'cash',
  is_withholding: false,
  first_payment: null,
  cheque_details: null,
  items: [],
  error: null
}

export class PurchaseVM extends ViewModel {
  constructor(sharedStateManager = new SharedStateManager()) {
    super(sharedStateManager);
    this._supplierSearchSeq = 0;
    this._purchaseProductSearchSeq = 0;
    this.purchaseProductSearchTimeout = null;
    this.supplierSearchTimeout = null;
    this.initializeState();
    this.loadUserPermissions();
    this.loadWithholdPercentage();
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
    this.setState('purchase-tab', 'current-order');
    this.setState('loading', false);
    this.setState('error', null);
    this.setState('success', null);
    this.setState('left-panel-collapsed', false);

    // Product & Supplier State (Left Panel)
    this.setState('product-list', []);
    this.setState('product-search-query', '');
    this.setState('supplier-list', []);
    this.setState('supplier-dropdown-loading', false);
    this.setState('product-dropdown-loading', false);
    this.setState('selected-supplier', null);
    this.setState('withhold-percentage', null);

    this.setState('supplier-search-query', '');

    this.setState('product-form', {
      product: null,
      quantity: null,
      unit_price: null,
      batch_number: null,
      expiry_date: null,
      error: null,
    });

    this.setState('product-form-errors', {});
    this.setState('order-item-list', []);

    // Current Order State (Right Panel - Current Order Tab)
    this.setState('current-order', DEFAULT_CURRENT_ORDER);

    // Order History State (Right Panel - Order History Tab)
    this.setState('order-list', {
      orders: [],
      total: 0,
      stats: {
        total_orders: { count: 0, value: 0 },
        cash_orders: { count: 0, value: 0 },
        credit_orders: { count: 0, value: 0 },
        cheque_orders: { count: 0, value: 0 },
        outstanding_balance: { count: 0, value: 0 },
        total_withhold_amount: { count: 0, value: 0 },
        reversed_orders: { count: 0, value: 0 }
      }
    });
    this.setState('filtered-items', []);
    this.setState('order-table-config', {
      limit: 20,
      offset: 0,
      search: '',
      status: 'completed',
      supplier_id: null,
      payment_mode: null,
      date_from: null,
      date_to: null,
      has_outstanding_balance: null,
      stat_filter: 'all',
      sort_by: 'order_date',
      order_by: 'desc'
    });

    // Hold Orders State (Right Panel - Hold Orders Tab)
    this.setState('hold-order-list', {
      hold_orders: [],
      total: 0
    });
    this.setState('hold-order-table-config', {
      limit: 20,
      offset: 0,
      search: '',
      sort_by: 'created_at',
      order_by: 'desc',
      filter: 'active' // 'active' | 'archived' | 'all' (Option B: Load does not archive)
    });

    // Payments State (Right Panel - Payments Tab)
    this.setState('selected-order-for-payment', null);
    this.setState('payment-history', {
      payments: [],
      total_paid: 0,
      outstanding_balance: 0
    });
    const today = new Date().toISOString().split('T')[0];
    this.setState('payment-form', {
      payment_amount: '',
      payment_mode: 'cash',
      payment_date: today,
      cheque_details: { bank_name: '', cheque_number: '', cheque_date: '' },
      notes: ''
    });
    this.setState('payment-form-order-id', null);

    // Drawer/Modal States
    this.setState('selected-order', null);
    this.setState('order-drawer-open', false);
    this.setState('selected-hold-order', null);
    this.setState('hold-drawer-open', false);
    this.setState('payment-modal-open', false);
    this.setState('reverse-modal-open', false);
  }

  updateProductForm(field, value) {
    const productForm = this.getState('product-form') || {};
    this.updateState('product-form', {
      ...productForm,
      [field]: value
    });
    this.updateState('loading', true);
    setTimeout(() => {
      this.updateState('loading', false);
    }, 0);
  }

  validateProductForm() {
    const productForm = this.getState('product-form') || {};
    
    if(!productForm.product) {
      this.updateState('product-form', { ...productForm, error: 'Product is required' });
      return false;
    }
    if(!productForm.quantity) {
      this.updateState('product-form', { ...productForm, error: 'Quantity is required' });
      return false;
    }
    if(!productForm.unit_price) {
      this.updateState('product-form', { ...productForm, error: 'Unit price is required' });
      return false;
    }
    
    

    this.updateState('product-form', { ...productForm, error: null });

    return true;
  }

  addItemToOrder() {
    const selectedProductDetails = this.getState('product-form');

    const validationResult = this.validateProductForm();
    if(!validationResult) {
      this.updateState('loading', false);
      return;
    }


    const item = {
      product_id: selectedProductDetails.product.id,
      product_code: selectedProductDetails.product.product_code,
      product_name: selectedProductDetails.product.name,
      product_category: selectedProductDetails.product.category,
      product_unit: selectedProductDetails.product.unit,
      quantity: selectedProductDetails.quantity,
      unit_price: selectedProductDetails.unit_price,
      batch_number: selectedProductDetails.batch_number,
      expiry_date: selectedProductDetails.expiry_date
    }
    const currentOrder = this.getState('current-order') || {};
    const items = currentOrder.items || [];
    items.push(item);
    this.updateState('current-order', {
      ...currentOrder,
      items
    });
    this.resetProductForm();
    this.filterOrderItems()
  }

  removeItemsFromOrder(itemIds) {
    const currentOrder = this.getState('current-order') || {};
    const items = currentOrder.items || [];
    const updatedItems = items.filter(item => !itemIds.includes(item.product_id));
    this.updateState('current-order', {
      ...currentOrder,
      items: updatedItems
    });
  }

  updateOrderItem(itemId, field, value) {
    const currentOrder = this.getState('current-order') || {};
    const items = currentOrder.items || [];
    const updatedItems = items.map(item => {
      if (item.product_id === itemId) {
        return { ...item, [field]: value };
      }
      return item;
    });
    this.updateState('current-order', {
      ...currentOrder,
      items: updatedItems
    });
    this.updateState('loading', false);
  }

  saveOrderItem(editedItem) {
    const currentOrder = this.getState('current-order') || {};
    const items = currentOrder.items || [];
    const updatedItems = items.map(item => {
      if (item.product_id === editedItem.product_id) {
        return { ...item, ...editedItem };
      }
      return item;
    });

    this.updateState('current-order', {
      ...currentOrder,
      items: updatedItems
    });

    this.filterOrderItems();
  }

  addSupplierToOrder(supplier) {
    const currentOrder = this.getState('current-order') || {};
    this.updateState('current-order', {
      ...currentOrder,
      supplier_id: supplier.id
    });
    this.updateState('selected-supplier', supplier);
  }

  async toggleWithholding() {
    const currentOrder = this.getState('current-order') || {};
    const isWithholding = !currentOrder.is_withholding;
    this.updateState('current-order', {
      ...currentOrder,
      is_withholding: isWithholding
    });

    // Always refresh from DB setting when user turns withholding on.
    // This avoids stale zero/null values carried from previously loaded hold orders.
    if (isWithholding) {
      await this.loadWithholdPercentage(true);
    }

    this.updateState('loading', true);
    setTimeout(() => {
      this.updateState('loading', false);
    }, 0);
  }

  resetProductForm() {
    this.updateState('product-form', {
      product: null,
      quantity: null,
      unit_price: null,
      batch_number: null,
      expiry_date: null
    });
  }

  async loadPurchaseProductsForDropdown(query = '') {
    const gen = ++this._purchaseProductSearchSeq;
    this.updateState('product-dropdown-loading', true);
    try {
      const result = await window.ipcRenderer.invoke('inventory:get-products', {
        limit: DROPDOWN_SEARCH_LIMIT,
        offset: 0,
        search: (query || '').trim(),
        sortBy: 'id',
        orderBy: 'desc',
      });
      if (gen !== this._purchaseProductSearchSeq) return [];
      if (result.success) {
        const products = result.products || [];
        this.updateState('product-list', products);
        return products;
      }
      throw new Error(result.error || 'failed to fetch products');
    } catch (error) {
      if (gen === this._purchaseProductSearchSeq) {
        console.error('Error fetching products: ', error);
        this.updateState('product-list', []);
      }
      return [];
    } finally {
      if (gen === this._purchaseProductSearchSeq) {
        this.updateState('product-dropdown-loading', false);
      }
    }
  }

  updatePurchaseProductDropdownSearch(query) {
    clearTimeout(this.purchaseProductSearchTimeout);
    this.purchaseProductSearchTimeout = setTimeout(() => this.loadPurchaseProductsForDropdown(query), DROPDOWN_SEARCH_DEBOUNCE_MS);
  }

  async getSuppliers() {
    try {
      this.updateState('loading', true);

      const customerType = 'supplier';

      const result = await window.ipcRenderer.invoke('inventory:get-partners', customerType);


      this.updateState('supplier-list', result || []);
      this.updateState('loading', false);

      return result;
    } catch (error) {
      console.error('Error loading partners:', error);
      this.updateState('error', error.message || 'Failed to load partners');
      this.updateState('loading', false);
      // Return empty array on error
      this.updateState('supplier-list', []);
      return [];
    }
  }

  getActiveTab() {
    return this.getState('purchase-tab') || 'current-order';
  }

  updateTab(tabKey) {
    this.updateState('purchase-tab', tabKey);
    // Load data for the new tab
    if (tabKey === 'current-order') {
      if (this.getState('product-list').length === 0) this.loadProducts();
      if (this.getState('supplier-list').length === 0) this.loadSuppliers();
      if (this.getState('withhold-percentage') === null) this.loadWithholdPercentage();
    } else if (tabKey === 'order-history') {
      this.loadOrders();
    } else if (tabKey === 'hold-orders') {
      this.loadHoldOrders(); // manages loading (true → false in finally)
    }
  }

  // ==================== Products & Suppliers Methods ====================

  async loadProducts() {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);

    try {
      const searchQuery = this.getState('product-search-query') || '';
      const result = await window.ipcRenderer.invoke('purchase:get-products', {
        search: searchQuery,
        limit: 50
      });

      if (result.success) {
        this.updateState('product-list', result.products || []);
        return result.products;
      }

      throw new Error(result.error || 'Failed to load products');
    } catch (error) {
      console.error('[PurchaseVM] loadProducts error:', error);
      this.updateState('error', { message: error.message || 'Failed to load products' });
      return [];
    } finally {
      this.updateState('loading', false);
    }
  }

  async loadSuppliers(query = '') {
    const gen = ++this._supplierSearchSeq;
    this.updateState('supplier-dropdown-loading', true);
    this.updateState('error', null);
    try {
      const result = await window.ipcRenderer.invoke('purchase:get-suppliers', {
        search: (query || '').trim(),
        limit: DROPDOWN_SEARCH_LIMIT,
      });

      if (gen !== this._supplierSearchSeq) return [];

      if (result.success) {
        this.updateState('supplier-list', result.suppliers || []);
        return result.suppliers;
      }
      throw new Error(result.error || 'Failed to load suppliers');
    } catch (error) {
      if (gen === this._supplierSearchSeq) {
        console.error('[PurchaseVM] loadSuppliers error:', error);
        this.updateState('error', { message: error.message || 'Failed to load suppliers' });
        this.updateState('supplier-list', []);
      }
      return [];
    } finally {
      if (gen === this._supplierSearchSeq) {
        this.updateState('supplier-dropdown-loading', false);
      }
    }
  }

  updateSupplierSearch(query) {
    this.updateState('supplier-search-query', query);
    clearTimeout(this.supplierSearchTimeout);
    this.supplierSearchTimeout = setTimeout(() => {
      this.loadSuppliers(query);
    }, DROPDOWN_SEARCH_DEBOUNCE_MS);
  }

  selectSupplier(supplier) {
    const currentOrder = this.getState('current-order') || {};
    this.updateState('current-order', {
      ...currentOrder,
      supplier_id: supplier.id,
      supplier: supplier
    })
  }

  async loadWithholdPercentage(force = false) {
    const existing = this.getState('withhold-percentage');
    if (!force && existing != null) return Number(existing);
    try {
      const result = await window.ipcRenderer.invoke('purchase:get-withhold-percentage');
      const numeric = Number(result?.withhold_percentage);
      if (result?.success && Number.isFinite(numeric)) {
        this.updateState('withhold-percentage', numeric);
        return numeric;
      }
    } catch (error) {
      console.error('[PurchaseVM] loadWithholdPercentage error:', error);
    }
    return null;
  }

  validateOrder() {
    const currentOrder = this.getState('current-order') || {};
    const totals = this.calculateOrderTotals();
    const items = currentOrder.items || [];
    if (items.length === 0) {
      this.updateState('current-order', { ...currentOrder, error: 'At least one item is required' });
      return false;
    }
    if (!currentOrder.supplier_id) {
      this.updateState('current-order', { ...currentOrder, error: 'Supplier is required' });
      return false;
    }
    if (!currentOrder.payment_mode) {
      this.updateState('current-order', { ...currentOrder, error: 'Payment mode is required' });
      this.updateState('loading', false);
      return false;
    }
    if (!currentOrder.payment_mode === 'credit' && !currentOrder.first_payment) {
      this.updateState('current-order', { ...currentOrder, error: 'First payment is required for credit mode' });
      this.updateState('loading', false);
      return false;
    }
    if (currentOrder.payment_mode === 'credit' && currentOrder.first_payment > totals.net_amount) {
      this.updateState('current-order', { ...currentOrder, error: 'First payment is greater than the net amount' });
      this.updateState('loading', false);
      return false;
    }
    if (currentOrder.payment_mode === 'cheque') {
      if (!currentOrder.cheque_details) {
        this.updateState('current-order', { ...currentOrder, error: 'Cheque details are required for cheque mode' });
        this.updateState('loading', false);
        return false;
      }
      if (!currentOrder.cheque_details.cheque_date) {
        this.updateState('current-order', { ...currentOrder, error: 'Cheque date is required' });
        this.updateState('loading', false);
        return false;
      }
      const chequeAmt = Number(currentOrder.cheque_details.amount ?? 0);
      if (!Number.isFinite(chequeAmt) || chequeAmt <= 0) {
        this.updateState('current-order', { ...currentOrder, error: 'Cheque amount is required and must be greater than zero' });
        this.updateState('loading', false);
        return false;
      }
      if (chequeAmt > totals.net_amount + 0.01) {
        this.updateState('current-order', { ...currentOrder, error: 'Cheque amount is greater than the net amount' });
        this.updateState('loading', false);
        return false;
      }
    }

    this.updateState('current-order', { ...currentOrder, error: null });

    return true;
  }

  // ==================== Current Order Methods ====================

  updateCurrentOrderField(field, value) {
    const currentOrder = this.getState('current-order') || {};
    this.updateState('current-order', {
      ...currentOrder,
      [field]: value
    });
    this.updateState('loading', false)
  }

  calculateOrderTotals() {
    const currentOrder = this.getState('current-order') || {};
    const items = currentOrder.items || [];

    const subtotal = items.reduce((sum, item) => {
      return sum + (item.quantity * (item.unit_price || 0));
    }, 0);

    const withholdPercentage = currentOrder.is_withholding
      ? Number(this.getState('withhold-percentage') ?? 0)
      : 0;
    const withholdAmount = (subtotal * withholdPercentage) / 100;
    const netAmount = subtotal - withholdAmount;

    const paymentMode = currentOrder.payment_mode || 'cash';
    let amountPaid = 0;
    if (paymentMode === 'cash') {
      amountPaid = netAmount;
    } else if (paymentMode === 'credit') {
      amountPaid = Number(currentOrder.first_payment ?? 0);
    } else if (paymentMode === 'cheque') {
      amountPaid = Number(currentOrder.cheque_details?.amount ?? 0);
    }
    const outstanding = Math.max(0, netAmount - amountPaid);

    return {
      subtotal,
      withhold_percentage: withholdPercentage,
      withhold_amount: withholdAmount,
      net_amount: netAmount,
      first_payment: paymentMode === 'credit' ? amountPaid : null,
      amount_paid: amountPaid,
      outstanding_balance: outstanding
    };
  }

  async saveAsHoldOrder() {
    if (this.getState('loading')) return;

    const currentOrder = this.getState('current-order') || {};
    if (!currentOrder.supplier_id || !currentOrder.items || currentOrder.items.length === 0) {
      throw new Error('Supplier and at least one item are required');
    }

    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const totals = this.calculateOrderTotals();
      const netAmount = totals.net_amount || 0;
      const amountPaid =
        currentOrder.payment_mode === 'credit'
          ? (currentOrder.first_payment || 0)
          : currentOrder.payment_mode === 'cheque'
            ? (currentOrder.cheque_details && currentOrder.cheque_details.amount) || 0
            : netAmount;

      // Full current-order snapshot so reload restores the UI as-is (items include product_name, product_code, etc.)
      const snapshot = {
        supplier_id: Number(currentOrder.supplier_id),
        order_date: normalizeOrderDate(currentOrder.order_date),
        invoice_no: currentOrder.invoice_no || null,
        remark: currentOrder.notes || null,
        payment_mode: currentOrder.payment_mode,
        total_amount: netAmount,
        amount_paid: amountPaid,
        withhold_percentage: currentOrder.is_withholding ? Number(this.getState('withhold-percentage')) : null,
        withhold_amount: totals.withhold_amount || null,
        first_payment: currentOrder.payment_mode === 'credit' ? Number(currentOrder.first_payment || 0) : null,
        cheque_details:
          currentOrder.payment_mode === 'cheque' && currentOrder.cheque_details
            ? { ...currentOrder.cheque_details, amount: Number(currentOrder.cheque_details.amount) }
            : null,
        items: (currentOrder.items || []).map((item) => ({
          product_id: Number(item.product_id),
          product_name: item.product_name || null,
          product_code: item.product_code || null,
          product_category: item.product_category || null,
          product_unit: item.product_unit || null,
          quantity: Math.max(1, Math.floor(Number(item.quantity))),
          unit_price: Number(item.unit_price),
          batch_number: item.batch_number || null,
          expiry_date: item.expiry_date || null,
        })),
      };

      const result = await window.ipcRenderer.invoke('purchase:create-hold-order', snapshot);
      if (!result.success) {
        throw new Error(result.error || 'Failed to save hold order');
      }

      this.updateState('success', { message: 'Hold order saved successfully' });
      this.resetCurrentOrder();
      await this.loadHoldOrders();
      return { success: true };
    } catch (error) {
      console.error('[PurchaseVM] saveAsHoldOrder error:', error);
      this.updateState('error', { message: error.message || 'Failed to save hold order' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async processOrder() {
    if (this.getState('loading')) return;
    
    const currentOrder = this.getState('current-order') || {};
    if (!currentOrder.supplier_id || !currentOrder.items || currentOrder.items.length === 0) {
      throw new Error('Supplier and at least one item are required');
    }

    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    try {
      const totals = this.calculateOrderTotals();
      
      const orderData = {
        supplier_id: Number(currentOrder.supplier_id),
        order_date: currentOrder.order_date,
        invoice_no: currentOrder.invoice_no || null,
        items: currentOrder.items.map(item => ({
          product_id: Number(item.product_id),
          quantity: Math.max(1, Math.floor(Number(item.quantity))),
          unit_price: Number(item.unit_price),
          batch_number: item.batch_number || null,
          expiry_date: item.expiry_date || null
        })),
        payment_mode: currentOrder.payment_mode,
        withhold_percentage: currentOrder.is_withholding ? Number(this.getState('withhold-percentage')) : null,
        first_payment: currentOrder.payment_mode === 'credit' ? Number(currentOrder.first_payment || 0) : null,
        cheque_details: currentOrder.payment_mode === 'cheque' && currentOrder.cheque_details
          ? { ...currentOrder.cheque_details, amount: Number(currentOrder.cheque_details.amount) }
          : null,
        notes: currentOrder.notes || null,
        status: 'completed'
      };

      const result = await window.ipcRenderer.invoke('purchase:create-order', orderData);

      if (result.success) {
        this.updateState('success', { message: 'Purchase order created successfully' });
        this.resetCurrentOrder();
        // Reload orders if on order history tab
        if (this.getActiveTab() === 'order-history') {
          this.loadOrders();
        }
        return result.purchase_order;
      }

      throw new Error(result.error || 'Failed to create purchase order');
    } catch (error) {
      console.error('[PurchaseVM] processOrder error:', error);
      this.updateState('error', { message: error.message || 'Failed to create purchase order' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  // ==================== Order History Methods ====================

  async loadOrders() {
    // Allow order-history refresh even when another request is in-flight.
    // This prevents tab switches from skipping the initial load due to a stale loading flag.
    this.updateState('loading', true);
    this.updateState('error', null);

    try {
      const config = this.getState('order-table-config') || {};
      const result = await window.ipcRenderer.invoke('purchase:get-orders', config);

      if (result.success) {
        this.updateState('order-list', {
          orders: result.orders || [],
          total: result.total || 0,
          stats: result.stats || {}
        });
        return result.orders;
      }

      throw new Error(result.error || 'Failed to load orders');
    } catch (error) {
      console.error('[PurchaseVM] loadOrders error:', error);
      this.updateState('error', { message: error.message || 'Failed to load orders' });
      return [];
    } finally {
      this.updateState('loading', false);
    }
  }

  updateOrderTableConfig(updates) {
    const config = this.getState('order-table-config') || {};
    this.updateState('order-table-config', {
      ...config,
      ...updates
    });
    this.loadOrders();
  }

  /**
   * Set order history stat filter (clicking a stat card). Maps to payment_mode and has_outstanding_balance.
   * @param {string} statKey - 'all' | 'cash' | 'credit' | 'outstanding'
   */
  updateOrderStatFilter(statKey) {
    const updates = { offset: 0, stat_filter: statKey };
    if (statKey === 'all') {
      updates.payment_mode = null;
      updates.has_outstanding_balance = null;
    } else if (statKey === 'cash') {
      updates.payment_mode = 'cash';
      updates.has_outstanding_balance = null;
    } else if (statKey === 'credit') {
      updates.payment_mode = 'credit';
      updates.has_outstanding_balance = null;
    } else if (statKey === 'outstanding') {
      updates.payment_mode = null;
      updates.has_outstanding_balance = true;
    }
    this.updateOrderTableConfig(updates);
  }

  async loadOrderDetails(orderId) {
    if (this.getState('loading')) return;
    this.updateState('loading', true);
    try {
      const result = await window.ipcRenderer.invoke('purchase:get-order-by-id', orderId);
      if (result.success) {
        this.updateState('selected-order', result.order);
        this.updateState('order-drawer-open', true);
        return result.order;
      }
      throw new Error(result.error || 'Failed to load order details');
    } catch (error) {
      console.error('[PurchaseVM] loadOrderDetails error:', error);
      this.updateState('error', { message: error.message || 'Failed to load order details' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  closeOrderDrawer() {
    this.updateState('order-drawer-open', false);
    this.updateState('selected-order', null);
  }

  // ==================== Hold Orders Methods ====================

  /**
   * Updates hold-order-table-config with the given updates, then loads hold orders.
   * Ensures loading is set to false when done so the UI rerenders after every change.
   * @param {Object} updates - Partial config (e.g. { filter: 'archived' }, { offset: 0 }, { search: 'x' })
   */
  async updateHoldOrderTableConfig(updates) {
    const current = this.getState('hold-order-table-config') || {};
    const nextConfig = { ...current, ...updates };
    this.updateState('hold-order-table-config', nextConfig);
    try {
      await this.loadHoldOrders();
    } finally {
      this.updateState('loading', false);
    }
  }

  async loadHoldOrders() {
    // Same rationale as loadOrders(): don't skip hold-order loading during quick tab/filter changes.
    this.updateState('loading', true);
    this.updateState('error', null);

    try {
      const config = this.getState('hold-order-table-config') || {};
      const result = await window.ipcRenderer.invoke('purchase:get-hold-orders', config);

      if (result.success) {
        this.updateState('hold-order-list', {
          hold_orders: result.hold_orders || [],
          total: result.total || 0
        });
        return result.hold_orders;
      }

      throw new Error(result.error || 'Failed to load hold orders');
    } catch (error) {
      console.error('[PurchaseVM] loadHoldOrders error:', error);
      this.updateState('error', { message: error.message || 'Failed to load hold orders' });
      return [];
    } finally {
      this.updateState('loading', false);
    }
  }

  /**
   * Open hold order details drawer (View). Fetches hold by id, sets selected-hold-order, then opens drawer.
   * Pattern: same as Stock/Products (openDrawer → set item, set open false, loading true → setTimeout set open true, loading false).
   */
  async openHoldOrderDrawer(holdOrderId) {
    if (this.getState('loading')) return;
    this.updateState('loading', true);
    try {
      const result = await window.ipcRenderer.invoke('purchase:get-hold-order-by-id', holdOrderId);
      if (!result.success || !result.hold_order) {
        throw new Error(result.error || 'Failed to load hold order');
      }
      const holdOrder = result.hold_order;
      this.updateState('selected-hold-order', holdOrder);
      this.updateState('hold-drawer-open', false);
      this.updateState('loading', true);
      setTimeout(() => {
        this.updateState('hold-drawer-open', true);
        this.updateState('loading', false);
      }, 10);
    } catch (error) {
      console.error('[PurchaseVM] openHoldOrderDrawer error:', error);
      this.updateState('error', { message: error.message || 'Failed to load hold order' });
      this.updateState('loading', false);
    }
  }

  closeHoldOrderDrawer() {
    this.updateState('hold-drawer-open', false);
    this.updateState('loading', true);
    setTimeout(() => {
      this.updateState('selected-hold-order', null);
      this.updateState('loading', false);
    }, 300);
  }

  async loadHoldOrder(holdOrderId) {
    if (this.getState('loading')) return;
    this.updateState('loading', true);
    try {
      const result = await window.ipcRenderer.invoke('purchase:get-hold-order-by-id', holdOrderId);
      if (result.success) {
        const holdOrder = result.hold_order;
        let items = [];
        try {
          items = typeof holdOrder.items === 'string' ? JSON.parse(holdOrder.items) : (holdOrder.items || []);
        } catch (e) {
          console.error('Failed to parse hold order items:', e);
        }
        const chequeDetails =
          holdOrder.cheque_details == null
            ? null
            : typeof holdOrder.cheque_details === 'string'
              ? JSON.parse(holdOrder.cheque_details)
              : holdOrder.cheque_details;

        const withholdPercentage =
          holdOrder.withhold_percentage == null ? null : Number(holdOrder.withhold_percentage);
        const hasWithholding = withholdPercentage != null && withholdPercentage > 0;
        const restoredSupplier = holdOrder.supplier_id
          ? {
              id: holdOrder.supplier_id,
              name: holdOrder.supplier_name || ''
            }
          : null;
        const normalizedItems = (items || []).map((item) => ({
          ...item,
          product_id: item.product_id != null ? Number(item.product_id) : item.product_id,
          quantity: item.quantity != null ? Number(item.quantity) : item.quantity,
          unit_price: item.unit_price != null ? Number(item.unit_price) : item.unit_price
        }));

        // Restore full current-order snapshot so UI matches state before hold (including is_withholding)
        const currentOrder = {
          ...DEFAULT_CURRENT_ORDER,
          supplier_id: holdOrder.supplier_id,
          supplier: restoredSupplier,
          order_date: normalizeOrderDate(holdOrder.order_date),
          invoice_no: holdOrder.invoice_no || '',
          notes: holdOrder.remark || '',
          payment_mode: holdOrder.payment_mode,
          is_withholding: hasWithholding,
          first_payment: holdOrder.first_payment ?? null,
          cheque_details: chequeDetails,
          items: normalizedItems,
          error: null,
        };
        this.updateState('current-order', currentOrder);
        this.updateState('selected-supplier', restoredSupplier);
        this.updateState('supplier-search-query', restoredSupplier?.name || '');
        this.updateState('filtered-items', normalizedItems);

        this.updateTab('current-order');
        return holdOrder;
      }
      throw new Error(result.error || 'Failed to load hold order');
    } catch (error) {
      console.error('[PurchaseVM] loadHoldOrder error:', error);
      this.updateState('error', { message: error.message || 'Failed to load hold order' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async archiveHoldOrder(holdOrderId) {
    if (this.getState('loading')) return;
    
    this.updateState('loading', true);
    this.updateState('error', null);

    try {
      const result = await window.ipcRenderer.invoke('purchase:archive-hold-order', holdOrderId);
      if (result.success) {
        this.updateState('success', { message: 'Hold order archived successfully' });
        await this.loadHoldOrders();
        return result;
      }
      throw new Error(result.error || 'Failed to archive hold order');
    } catch (error) {
      console.error('[PurchaseVM] archiveHoldOrder error:', error);
      this.updateState('error', { message: error.message || 'Failed to archive hold order' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  resetCurrentOrder() {
    this.updateState('current-order', DEFAULT_CURRENT_ORDER);
    this.updateState('supplier-search-query', '');
    this.updateState('filtered-items', []);
    this.updateState('loading', false);
  }
  
  filterOrderItems(query = '') {
    const currentOrder = this.getState('current-order');

    let filteredItems = currentOrder.items;

    if(query !== '') {
      filteredItems = currentOrder.items.filter(item => item.product_name.toLowerCase().includes(query.toLowerCase())
                                                        || item.product_code.toLowerCase().includes(query.toLowerCase()));
    }
    this.updateState('filtered-items', filteredItems);
    this.updateState('loading', false);
  }
  // ==================== Payment Methods ====================

  async loadPaymentHistory(orderId) {
    if (this.getState('loading')) return;
    this.updateState('loading', true);
    try {
      const result = await window.ipcRenderer.invoke('purchase:get-payment-history', orderId);
      if (result.success) {
        this.updateState('payment-history', {
          payments: result.payments || [],
          total_paid: result.total_paid || 0,
          outstanding_balance: result.outstanding_balance || 0
        });
        this.updateState('selected-order-for-payment', orderId);
        return result;
      }
      throw new Error(result.error || 'Failed to load payment history');
    } catch (error) {
      console.error('[PurchaseVM] loadPaymentHistory error:', error);
      this.updateState('error', { message: error.message || 'Failed to load payment history' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  /** Set order for payment and load payment history (e.g. for drawer payment content). Does not open modal. */
  async preparePaymentForOrder(orderId) {
    if (this.getState('loading')) return;
    this.updateState('selected-order-for-payment', orderId);
    return this.loadPaymentHistory(orderId);
  }

  closePaymentModal() {
    this.updateState('payment-modal-open', false);
    this.updateState('selected-order-for-payment', null);
    this.updateState('payment-form-order-id', null);
  }

  /** Set payment form defaults from current payment history (outstanding). Call when opening modal for an order. Sets loading false at end. */
  setPaymentFormDefaults() {
    const history = this.getPaymentHistory();
    const outstanding = Number(history?.outstanding_balance ?? 0);
    const defaultAmount = outstanding > 0 ? String(outstanding.toFixed(2)) : '';
    const today = new Date().toISOString().split('T')[0];
    this.updateState('payment-form-order-id', this.getState('selected-order-for-payment'));
    this.updateState('payment-form', {
      payment_amount: defaultAmount,
      payment_mode: 'cash',
      payment_date: today,
      cheque_details: { bank_name: '', cheque_number: '', cheque_date: '' },
      notes: ''
    });
    this.updateState('loading', false);
  }

  /** Update payment form fields. Sets loading false at end so UI re-renders. */
  updatePaymentForm(partial) {
    const form = this.getState('payment-form') || {};
    this.updateState('payment-form', { ...form, ...partial });
    this.updateState('loading', false);
  }

  /** Reset payment form after successful submit so next open shows fresh defaults. */
  resetPaymentForm() {
    const today = new Date().toISOString().split('T')[0];
    this.updateState('payment-form-order-id', null);
    this.updateState('payment-form', {
      payment_amount: '',
      payment_mode: 'cash',
      payment_date: today,
      cheque_details: { bank_name: '', cheque_number: '', cheque_date: '' },
      notes: ''
    });
    this.updateState('loading', false);
  }

  async recordPayment(paymentData) {
    if (this.getState('loading')) return;

    const orderId = this.getState('selected-order-for-payment');
    if (!orderId) {
      throw new Error('No order selected for payment');
    }

    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);

    let paymentSuccess = false;
    try {
      const result = await window.ipcRenderer.invoke('purchase:pay-order', {
        orderId,
        paymentData
      });

      if (result.success) {
        this.updateState('success', { message: 'Payment recorded successfully' });
        paymentSuccess = true;
        return result.payment;
      }

      throw new Error(result.error || 'Failed to record payment');
    } catch (error) {
      console.error('[PurchaseVM] recordPayment error:', error);
      this.updateState('error', { message: error.message || 'Failed to record payment' });
      throw error;
    } finally {
      this.updateState('loading', false);
      // Refresh order history and drawer after clearing loading (loadOrders/loadPaymentHistory exit early if loading is true)
      if (paymentSuccess && orderId) {
        await this.loadPaymentHistory(orderId);
        await this.loadOrders();
        await this.loadOrderDetails(orderId);
      }
    }
  }

  async reverseOrder(orderId, reason = 'Order reversal requested by user') {
    if (this.getState('loading')) return;
    this.updateState('loading', true);
    this.updateState('error', null);
    this.updateState('success', null);
    try {
      const result = await window.ipcRenderer.invoke('purchase:reverse-order', {
        orderId,
        reverseData: {
          reason,
          reverse_inventory: true,
          reverse_ledger: true
        }
      });

      if (result && result.success) {
        this.updateState('success', { message: 'Order reversed successfully' });
        this.closeOrderDrawer();
        await this.loadOrders();
        return result.reversed_order;
      }

      throw new Error(result?.error || 'Failed to reverse order');
    } catch (error) {
      console.error('[PurchaseVM] reverseOrder error:', error);
      this.updateState('error', { message: error.message || 'Failed to reverse order' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  /**
   * Import purchase orders from spreadsheet payload (array of orders with supplier/product names).
   * Server resolves names to IDs (find or create) and creates orders.
   * Returns { success, summary, successful, failed } so the UI can show partial success and errors.
   */
  async importFromSpreadsheet(payload) {
    if (this.getState('loading')) return;
    this.updateState('loading', true);
    this.updateState('error', null);
    try {
      const result = await window.ipcRenderer.invoke('purchase:import-from-spreadsheet', payload);
      if (result.success && result.summary && result.summary.successful > 0 && this.getActiveTab() === 'order-history') {
        this.loadOrders();
      }
      return result;
    } catch (error) {
      console.error('[PurchaseVM] importFromSpreadsheet error:', error);
      this.updateState('error', { message: error.message || 'Failed to import purchase orders' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  // ==================== Helper Methods ====================

  getSupplierList() {
    return this.getState('supplier-list') || [];
  }

  getOrderList() {
    return this.getState('order-list') || { orders: [], total: 0, stats: {} };
  }

  /**
   * Get the last-created purchase order (for "View last receipt").
   * Always fetches the single most recent completed order by id so the correct receipt is shown.
   * @returns {Promise<{ id: number, ... } | null>}
   */
  async getLastOrder() {
    try {
      const result = await window.ipcRenderer.invoke('purchase:get-orders', {
        limit: 1,
        offset: 0,
        sort_by: 'id',
        order_by: 'desc',
        status: 'completed'
      });
      if (result && result.success && result.orders && result.orders.length > 0) {
        return result.orders[0];
      }
    } catch (e) {
      console.error('[PurchaseVM] getLastOrder error:', e);
    } finally {
      this.updateState('loading', false);
    }
    return null;
  }

  async exportPurchaseOrder() {
    if (this.getState('loading')) return;
    this.updateState('loading', true);
    try {
      const result = await window.ipcRenderer.invoke('purchase:export-purchase-order');
      if (result && result.success && result.csvContent) {
        const blob = new Blob([result.csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `purchase_orders_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        return { success: true };
      }
      throw new Error(result?.error || 'Failed to export purchase order');
    } catch (error) {
      console.error('[PurchaseVM] exportPurchaseOrder error:', error);
      this.updateState('error', { message: error.message || 'Failed to export purchase order' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  getHoldOrderList() {
    return this.getState('hold-order-list') || { hold_orders: [], total: 0 };
  }

  getPaymentHistory() {
    return this.getState('payment-history') || { payments: [], total_paid: 0, outstanding_balance: 0 };
  }
}
