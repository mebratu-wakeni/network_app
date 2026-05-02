const { ViewModel, SharedStateManager } = Liteframe;
import { permissionChecker } from '../../utils/PermissionChecker';

/** Normalize date to YYYY-MM-DD for API (handles ISO strings and Date objects from DB). */
function normalizeSaleDate(value) {
  if (value == null || value === '') return new Date().toISOString().split('T')[0];
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (typeof value === 'string' && value.includes('T')) return value.split('T')[0];
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return String(value).split('T')[0].slice(0, 10);
}

const DEFAULT_CURRENT_SALE = {
  // Customer
  customer_id: null,
  customer: null,
  
  // Order details (matching sales_orders table)
  order_date: new Date().toISOString().split('T')[0], // Maps to order_date in DB
  sale_date: new Date().toISOString().split('T')[0], // Alias for UI consistency
  invoice_no: '', // Government/tax authority reference
  remark: '', // Notes/remarks
  
  // Payment (matching sales_orders table)
  payment_type: 'cash', // Maps to payment_type in DB (required, default 'cash')
  payment_mode: 'cash', // Alias for UI consistency
  payment_status: 'unpaid', // 'paid' | 'partial' | 'unpaid' (computed, not user-set)
  
  // Withholding (matching sales_orders table)
  is_withholding: false,
  withhold_percentage: null, // From settings when applicable
  withhold_amount: null, // Computed
  withhold_reference: '', // Stored in remark field
  withhold_ref: null, // Customer withholding receipt ref. when confirming at sale
  withhold_confirmation: false, // Set when confirming withhold
  withhold_settled: false, // Set when withhold is settled
  
  // Financial (matching sales_orders table - computed, not user-set)
  total_amount: 0, // Computed from items
  amount_paid: 0, // Computed based on payment_mode
  received_amount: 0, // Computed: total_amount - withhold_amount
  
  // Payment details (for credit/cheque)
  first_payment: null, // For credit payment mode
  cheque_details: null, // For cheque payment mode
  
  // Items
  items: [],
  
  // UI state
  error: null,
};

export class SalesVM extends ViewModel {
  constructor(sharedStateManager = new SharedStateManager()) {
    super(sharedStateManager);
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
    this.setState('sales-tab', 'current-sale');
    this.setState('loading', false);
    this.setState('error', null);
    this.setState('success', null);
    this.setState('left-panel-collapsed', false);

    this.setState('product-list', []); // inventory/stock items for sale (name, code, sellingPrice, batch, expiry)
    this.setState('product-search-query', '');
    this.setState('customer-list', []);
    this.setState('withhold-percentage', null);
    this.setState('customer-search-query', '');

    this.setState('product-form', {
      product: null,
      quantity: null,
      unit_price: null,
      error: null,
    });
    this.setState('product-form-errors', {});
    this.setState('order-item-list', []);

    this.setState('current-sale', DEFAULT_CURRENT_SALE);

    this.setState('sales-order-list', {
      orders: [],
      total: 0,
      stats: {
        total_orders: { count: 0, value: 0 },
        cash_orders: { count: 0, value: 0 },
        credit_orders: { count: 0, value: 0 },
        cheque_orders: { count: 0, value: 0 },
        outstanding_balance: { count: 0, value: 0 },
        total_withhold_amount: { count: 0, value: 0 },
        reversed_orders: { count: 0, value: 0 },
      },
    });
    this.setState('filtered-items', []);
    this.setState('sales-order-table-config', {
      limit: 20,
      offset: 0,
      search: '',
      status: 'completed',
      customer_id: null,
      payment_type: null,
      payment_mode: null,
      date_from: null,
      date_to: null,
      has_outstanding_balance: null,
      stat_filter: 'all',
      sort_by: 'order_date',
      order_by: 'desc',
    });

    this.setState('hold-order-list', { hold_orders: [], total: 0 });
    this.setState('hold-order-table-config', {
      limit: 20,
      offset: 0,
      search: '',
      sort_by: 'created_at',
      order_by: 'desc',
      filter: 'active',
    });

    this.setState('selected-order', null);
    this.setState('selected-customer', null);
    this.setState('order-drawer-open', false);
    this.setState('selected-hold-order', null);
    this.setState('hold-drawer-open', false);
    this.setState('payment-modal-open', false);

    const today = new Date().toISOString().split('T')[0];
    this.setState('sales-payment-form', {
      payment_amount: '',
      payment_mode: 'cash',
      payment_date: today,
      cheque_details: { bank_name: '', cheque_number: '', cheque_date: '' },
      notes: ''
    });
  }

  isWalkInCustomer(customer) {
    const name = (customer?.name || customer?.full_name || '').trim().toLowerCase()
    return name === 'walk-in'
  }

  isWalkInSale(currentSale = {}) {
    if (currentSale.customer_id == null || currentSale.customer_id === '') return true
    if (this.isWalkInCustomer(currentSale.customer)) return true
    const customers = this.getState('customer-list') || []
    const matched = customers.find((c) => c.id === currentSale.customer_id)
    return this.isWalkInCustomer(matched)
  }

  /** Set sales payment form defaults (e.g. when opening Record Payment). Updates form and sets loading false at end. */
  setSalesPaymentFormDefaults(outstanding) {
    const today = new Date().toISOString().split('T')[0];
    this.updateState('sales-payment-form', {
      payment_amount: outstanding > 0 ? String(outstanding.toFixed(2)) : '',
      payment_mode: 'cash',
      payment_date: today,
      cheque_details: { bank_name: '', cheque_number: '', cheque_date: '' },
      notes: ''
    });
    this.updateState('loading', false);
  }

  /** Update sales payment form fields. Sets loading false at end so UI re-renders. */
  updateSalesPaymentForm(partial) {
    const form = this.getState('sales-payment-form') || {};
    this.updateState('sales-payment-form', { ...form, ...partial });
    this.updateState('loading', false);
  }

  updateProductForm(field, value) {
    const productForm = this.getState('product-form') || {};
    this.updateState('product-form', { ...productForm, [field]: value });
    this.updateState('loading', true);
    setTimeout(() => this.updateState('loading', false), 0);
  }

  validateProductForm() {
    const productForm = this.getState('product-form') || {};
    if (!productForm.product || (productForm.product.productId == null && productForm.product.id == null)) {
      this.updateState('product-form', { ...productForm, error: 'Select an inventory item (product) to add' });
      return false;
    }
    if (!productForm.quantity) {
      this.updateState('product-form', { ...productForm, error: 'Quantity is required' });
      return false;
    }
    const requestedQty = Number(productForm.quantity);
    if (!Number.isInteger(requestedQty) || requestedQty < 1) {
      this.updateState('product-form', { ...productForm, error: 'Quantity must be a positive whole number' });
      return false;
    }
    const p = productForm.product;
    const availableQty = p.quantity != null ? Number(p.quantity) : 0;
    if (availableQty < 1) {
      this.updateState('product-form', { ...productForm, error: 'This item is out of stock' });
      return false;
    }
    if (requestedQty > availableQty) {
      this.updateState('product-form', {
        ...productForm,
        error: `Available quantity is ${availableQty}. You cannot exceed this amount.`,
      });
      return false;
    }
    const unitPrice = productForm.unit_price != null && productForm.unit_price !== '' ? Number(productForm.unit_price) : NaN;
    const hasValidPrice = !Number.isNaN(unitPrice) && unitPrice > 0;
    const canEditSalesPrice = permissionChecker.hasRule('CanEditSalesPrice');

    if (!canEditSalesPrice && !hasValidPrice) {
      this.updateState('product-form', {
        ...productForm,
        error: 'This item has no valid selling price. You can only sell items with a selling price set. Users with CanEditSalesPrice permission can set the price.',
      });
      return false;
    }
    if (!hasValidPrice && canEditSalesPrice) {
      this.updateState('product-form', { ...productForm, error: 'Enter a valid unit price (greater than 0).' });
      return false;
    }
    this.updateState('product-form', { ...productForm, error: null });
    return true;
  }

  addItemToSale() {
    const selectedProductDetails = this.getState('product-form');
    if (!this.validateProductForm()) {
      this.updateState('loading', false);
      return;
    }
    const p = selectedProductDetails.product;
    const productId = p.productId != null ? p.productId : p.id;
    const item = {
      product_id: productId,
      inventory_id: p.id,
      product_code: p.productCode || p.product_code,
      product_name: p.name,
      product_category: p.category,
      product_unit: p.unit,
      quantity: selectedProductDetails.quantity,
      unit_price: selectedProductDetails.unit_price,
      batch_number: p.batchNumber || p.batch_number || null,
      expiry_date: p.expiryDate || p.expiry_date || null,
    };
    const currentSale = this.getState('current-sale') || {};
    const items = [...(currentSale.items || []), item];
    this.updateState('current-sale', { ...currentSale, items });
    this.resetProductForm();
    this.filterSaleItems();
  }

  removeItemsFromSale(itemIds) {
    const currentSale = this.getState('current-sale') || {};
    const items = (currentSale.items || []).filter((item) => !itemIds.includes(item.product_id));
    this.updateState('current-sale', { ...currentSale, items });
    this.filterSaleItems();
  }

  updateSaleItem(itemId, field, value) {
    const currentSale = this.getState('current-sale') || {};
    const items = (currentSale.items || []).map((item) =>
      item.product_id === itemId ? { ...item, [field]: value } : item
    );
    this.updateState('current-sale', { ...currentSale, items });
    this.updateState('loading', false);
  }

  saveOrderItem(editedItem) {
    const currentSale = this.getState('current-sale') || {};
    const items = (currentSale.items || []).map((item) =>
      item.product_id === editedItem.product_id ? { ...item, ...editedItem } : item
    );
    this.updateState('current-sale', { ...currentSale, items });
    this.filterSaleItems();
  }

  resetProductForm() {
    this.updateState('product-form', {
      product: null,
      quantity: null,
      unit_price: null,
    });
  }

  updateCurrentSaleField(field, value) {
    const currentSale = this.getState('current-sale') || {};
    const updates = { [field]: value };
    
    // Keep aliases in sync with DB field names
    if (field === 'sale_date') {
      updates.order_date = value; // Keep order_date in sync (DB field)
    } else if (field === 'order_date') {
      updates.sale_date = value; // Keep sale_date in sync (UI alias)
    } else if (field === 'payment_mode') {
      updates.payment_type = value; // Keep payment_type in sync (DB field)
    } else if (field === 'payment_type') {
      updates.payment_mode = value; // Keep payment_mode in sync (UI alias)
    }
    
    this.updateState('current-sale', { ...currentSale, ...updates });
    this.updateState('loading', false);
  }

  toggleWithholding() {
    const currentSale = this.getState('current-sale') || {};
    // Walk-in customers cannot have withholding
    const isWalkIn = this.isWalkInSale(currentSale);
    if (isWalkIn) {
      // Cannot enable withholding for walk-in - keep it disabled
      return;
    }
    const isWithholding = !currentSale.is_withholding;
    this.updateState('current-sale', {
      ...currentSale,
      is_withholding: isWithholding,
      ...(isWithholding ? {} : { withhold_reference: '', withhold_ref: null }),
    });
    this.updateState('loading', true);
    setTimeout(() => this.updateState('loading', false), 0);
  }

  validateSale() {
    const currentSale = this.getState('current-sale') || {};
    const items = currentSale.items || [];
    if (items.length === 0) {
      this.updateState('current-sale', { ...currentSale, error: 'At least one item is required' });
      return false;
    }
    if (!currentSale.payment_mode) {
      this.updateState('current-sale', { ...currentSale, error: 'Payment mode is required' });
      this.updateState('loading', false);
      return false;
    }
    this.updateState('current-sale', { ...currentSale, error: null });
    return true;
  }

  calculateSaleTotals() {
    const currentSale = this.getState('current-sale') || {};
    const items = currentSale.items || [];
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * (item.unit_price || 0)), 0);
    const withholdPercentage = currentSale.is_withholding ? this.getState('withhold-percentage') : 0;
    const withholdAmount = (subtotal * withholdPercentage) / 100;
    const netAmount = subtotal - withholdAmount;

    const paymentMode = currentSale.payment_mode || 'cash';
    let amountPaid = 0;
    if (paymentMode === 'cash') {
      amountPaid = netAmount;
    } else if (paymentMode === 'credit') {
      amountPaid = Number(currentSale.first_payment != null ? currentSale.first_payment : 0);
    } else if (paymentMode === 'cheque') {
      amountPaid = Number((currentSale.cheque_details && currentSale.cheque_details.amount != null) ? currentSale.cheque_details.amount : 0);
    }
    const outstanding = Math.max(0, netAmount - amountPaid);

    return {
      subtotal,
      withhold_percentage: withholdPercentage,
      withhold_amount: withholdAmount,
      net_amount: netAmount,
      first_payment: paymentMode === 'credit' ? amountPaid : null,
      amount_paid: amountPaid,
      outstanding_balance: outstanding,
    };
  }

  getActiveTab() {
    return this.getState('sales-tab') || 'current-sale';
  }

  updateTab(tabKey) {
    this.updateState('sales-tab', tabKey);
    if (tabKey === 'current-sale') {
      if ((this.getState('product-list') || []).length === 0) this.loadProducts();
      if ((this.getState('customer-list') || []).length === 0) this.loadCustomers();
      if (this.getState('withhold-percentage') === null) this.loadWithholdPercentage();
    } else if (tabKey === 'sales-history') {
      this.loadSalesOrders();
    } else if (tabKey === 'hold-orders') {
      this.loadHoldOrders();
    }
  }

  async loadProducts() {
    if (this.getState('loading')) return;
    this.updateState('loading', true);
    this.updateState('error', null);
    try {
      const searchQuery = this.getState('product-search-query') || '';
      const result = await window.ipcRenderer.invoke('inventory:get-stock', {
        limit: 50,
        offset: 0,
        search: searchQuery,
        filter: 'all',
        sortBy: 'id',
        orderBy: 'desc',
      });
      if (result && result.success && Array.isArray(result.stock)) {
        this.updateState('product-list', result.stock);
        return result.stock;
      }
      if (result && result.error) throw new Error(result.error);
    } catch (error) {
      console.error('[SalesVM] loadProducts error:', error);
      this.updateState('error', { message: error.message || 'Failed to load inventory for sale' });
      return [];
    } finally {
      this.updateState('loading', false);
    }
  }

  async loadCustomers(query) {
    if (this.getState('loading')) return [];
    this.updateState('loading', true);
    this.updateState('error', null);
    try {
      // Use same API as Purchase: inventory partners with types 'retailer' and 'both'
      const [retailersResult, bothResult, otherResult] = await Promise.all([
        window.ipcRenderer.invoke('inventory:get-partners', 'retailer'),
        window.ipcRenderer.invoke('inventory:get-partners', 'both'),
        window.ipcRenderer.invoke('inventory:get-partners', 'other'),
      ]);
      const retailers = Array.isArray(retailersResult) ? retailersResult : [];
      const both = Array.isArray(bothResult) ? bothResult : [];
      const others = Array.isArray(otherResult) ? otherResult : [];
      const merged = [...retailers];
      const seenIds = new Set(merged.map((c) => c.id));
      both.forEach((c) => {
        if (!seenIds.has(c.id)) {
          merged.push(c);
          seenIds.add(c.id);
        }
      });
      const walkIn = others.find((c) => this.isWalkInCustomer(c));
      const finalCustomers = walkIn
        ? [walkIn, ...merged.filter((c) => c.id !== walkIn.id)]
        : merged;
      this.updateState('customer-list', finalCustomers);
      return finalCustomers;
    } catch (error) {
      console.error('[SalesVM] loadCustomers error:', error);
      this.updateState('error', { message: error.message || 'Failed to load customers' });
      return [];
    } finally {
      this.updateState('loading', false);
    }
  }

  updateCustomerSearch(query) {
    this.updateState('customer-search-query', query);
    clearTimeout(this.customerSearchTimeout);
    this.customerSearchTimeout = setTimeout(() => this.loadCustomers(query), 500);
  }

  selectCustomer(customer) {
    const currentSale = this.getState('current-sale') || {};
    const isWalkIn = this.isWalkInCustomer(customer);
    this.updateState('current-sale', { 
      ...currentSale, 
      customer_id: customer.id, 
      customer,
      is_withholding: isWalkIn ? false : currentSale.is_withholding,
      withhold_reference: isWalkIn ? '' : currentSale.withhold_reference,
      // Reset withhold confirmation fields when customer changes
      withhold_ref: null,
      withhold_confirmation: false
    });
    this.updateState('selected-customer', customer);
  }

  selectWalkIn() {
    const currentSale = this.getState('current-sale') || {};
    const customers = this.getState('customer-list') || []
    const walkIn = customers.find((c) => this.isWalkInCustomer(c)) || null
    this.updateState('current-sale', { 
      ...currentSale, 
      customer_id: walkIn?.id ?? null, 
      customer: walkIn,
      is_withholding: false,
      withhold_reference: '',
      withhold_ref: null,
    });
    this.updateState('selected-customer', walkIn);
  }

  async loadWithholdPercentage() {
    if (this.getState('loading')) return null;
    try {
      const result = await window.ipcRenderer.invoke('sales:get-withhold-percentage');
      if (result && result.success) {
        this.updateState('withhold-percentage', result.withhold_percentage);
        return result.withhold_percentage;
      }
      const purchaseResult = await window.ipcRenderer.invoke('purchase:get-withhold-percentage');
      if (purchaseResult && purchaseResult.success) {
        this.updateState('withhold-percentage', purchaseResult.withhold_percentage);
        return purchaseResult.withhold_percentage;
      }
    } catch (e) {
      console.error('[SalesVM] loadWithholdPercentage error:', e);
    }
    return null;
  }

  async getProducts(query) {
    if (this.getState('loading')) return [];
    this.updateState('loading', true);
    try {
      const result = await window.ipcRenderer.invoke('inventory:get-stock', {
        limit: 30,
        offset: 0,
        search: query || '',
        filter: 'all',
        sortBy: 'id',
        orderBy: 'desc',
      });
      if (result && result.success && Array.isArray(result.stock)) {
        this.updateState('product-list', result.stock);
        return result.stock;
      }
      throw new Error(result?.error || 'Failed to fetch inventory for sale');
    } catch (error) {
      console.error('Error fetching inventory for sale:', error);
      return [];
    } finally {
      this.updateState('loading', false);
    }
  }

  getCustomerList() {
    return this.getState('customer-list') || [];
  }

  /**
   * Partners suitable as sales customers for bulk AR payment (excludes walk-in). Does not toggle global loading.
   */
  async fetchPartnersForBulkCustomerPayment() {
    try {
      const [retailersResult, bothResult, otherResult] = await Promise.all([
        window.ipcRenderer.invoke('inventory:get-partners', 'retailer'),
        window.ipcRenderer.invoke('inventory:get-partners', 'both'),
        window.ipcRenderer.invoke('inventory:get-partners', 'other'),
      ]);
      const retailers = Array.isArray(retailersResult) ? retailersResult : [];
      const both = Array.isArray(bothResult) ? bothResult : [];
      const others = Array.isArray(otherResult) ? otherResult : [];
      const merged = [...retailers];
      const seenIds = new Set(merged.map((c) => c.id));
      both.forEach((c) => {
        if (!seenIds.has(c.id)) {
          merged.push(c);
          seenIds.add(c.id);
        }
      });
      const walkIn = others.find((c) => this.isWalkInCustomer(c));
      const walkInId = walkIn?.id;
      return merged.filter((c) => c.id !== walkInId && !this.isWalkInCustomer(c));
    } catch (error) {
      console.error('[SalesVM] fetchPartnersForBulkCustomerPayment error:', error);
      return [];
    }
  }

  /** Outstanding completed sales for bulk payment preview. Does not toggle global loading. */
  async getCustomerOutstandingForPayment(customerId) {
    const id = Number(customerId);
    if (!Number.isFinite(id) || id <= 0) {
      return { orders: [], total_outstanding: 0 };
    }
    const result = await window.ipcRenderer.invoke('sales:get-customer-outstanding', id);
    if (result && result.success) {
      return {
        orders: result.orders || [],
        total_outstanding: Number(result.total_outstanding) || 0,
      };
    }
    throw new Error(result?.error || 'Failed to load customer outstanding balance');
  }

  /**
   * Bulk customer payment across outstanding orders. Refreshes sales order list on success; does not use global loading.
   */
  async bulkPayCustomerSales(payload) {
    const result = await window.ipcRenderer.invoke('sales:bulk-pay-customer', payload);
    if (result && result.success) {
      await this.loadSalesOrders();
      return result;
    }
    throw new Error(result?.error || 'Failed to record bulk payment');
  }

  getSalesOrderList() {
    return this.getState('sales-order-list') || { orders: [], total: 0, stats: {} };
  }

  getHoldOrderList() {
    return this.getState('hold-order-list') || { hold_orders: [], total: 0 };
  }

  updateSalesOrderTableConfig(updates) {
    const config = this.getState('sales-order-table-config') || {};
    this.updateState('sales-order-table-config', { ...config, ...updates });
    this.loadSalesOrders();
  }

  updateOrderStatFilter(statKey) {
    this.updateSalesOrderTableConfig({ stat_filter: statKey || 'all', offset: 0 });
  }

  async updateHoldOrderTableConfig(updates) {
    const config = this.getState('hold-order-table-config') || {};
    this.updateState('hold-order-table-config', { ...config, ...updates });
    // Always trigger loadHoldOrders - it will handle loading state internally
    await this.loadHoldOrders();
  }

  async loadSalesOrders() {
    // Remove loading guard - allow filters/search/pagination to always trigger reload
    // Multiple concurrent requests are fine - the last one will set the final state
    this.updateState('loading', true);
    try {
      const config = this.getState('sales-order-table-config') || {};
      const result = await window.ipcRenderer.invoke('sales:get-orders', {
        limit: config.limit,
        offset: config.offset,
        search: config.search,
        status: config.status,
        customer_id: config.customer_id,
        payment_type: config.payment_type || config.payment_mode,
        payment_mode: config.payment_type || config.payment_mode,
        date_from: config.date_from,
        date_to: config.date_to,
        stat_filter: config.stat_filter,
        sort_by: config.sort_by,
        order_by: config.order_by,
      });
      if (result && result.success) {
        this.updateState('sales-order-list', { orders: result.orders || [], total: result.total || 0, stats: result.stats || {} });
      } else {
        this.updateState('sales-order-list', { orders: [], total: 0, stats: {} });
      }
    } catch (error) {
      console.error('[SalesVM] loadSalesOrders error:', error);
      this.updateState('sales-order-list', { orders: [], total: 0, stats: {} });
    } finally {
      this.updateState('loading', false);
    }
  }

  async loadHoldOrders() {
    // Remove loading guard - allow pagination/filter/search to always trigger reload
    // Multiple concurrent requests are fine - the last one will set the final state
    this.updateState('loading', true);
    try {
      const config = this.getState('hold-order-table-config') || {};
      const result = await window.ipcRenderer.invoke('sales:get-hold-orders', {
        limit: config.limit,
        offset: config.offset,
        search: config.search,
        filter: config.filter,
        sort_by: config.sort_by,
        order_by: config.order_by,
      });
      if (result && result.success) {
        this.updateState('hold-order-list', { hold_orders: result.hold_orders || [], total: result.total || 0 });
      } else {
        this.updateState('hold-order-list', { hold_orders: [], total: 0 });
      }
    } catch (error) {
      console.error('[SalesVM] loadHoldOrders error:', error);
      this.updateState('hold-order-list', { hold_orders: [], total: 0 });
    } finally {
      this.updateState('loading', false);
    }
  }

  resetCurrentSale() {
    this.updateState('current-sale', DEFAULT_CURRENT_SALE);
    this.updateState('customer-search-query', '');
    this.updateState('filtered-items', []);
    this.updateState('loading', false);
  }

  filterSaleItems(query = '') {
    const currentSale = this.getState('current-sale') || {};
    const items = currentSale.items || [];
    const filtered = query === '' ? items : items.filter((item) => (item.product_name || '').toLowerCase().includes(query.toLowerCase()) || (item.product_code || '').toLowerCase().includes(query.toLowerCase()));
    this.updateState('filtered-items', filtered);
    this.updateState('loading', false);
  }

  async loadHoldOrder(holdOrderId) {
    if (this.getState('loading')) return;
    this.updateState('loading', true);
    try {
      const result = await window.ipcRenderer.invoke('sales:get-hold-order-by-id', holdOrderId);
      if (result && result.success && result.hold_order) {
        const holdOrder = result.hold_order;
        const snapshot = holdOrder.snapshot || holdOrder;
        const items = Array.isArray(snapshot.items) ? snapshot.items : (typeof holdOrder.items === 'string' ? (() => { try { return JSON.parse(holdOrder.items); } catch (e) { return []; } })() : (holdOrder.items || []));
        const chequeDetails = snapshot.cheque_details == null ? null : (typeof snapshot.cheque_details === 'string' ? (() => { try { return JSON.parse(snapshot.cheque_details); } catch (e) { return null; } })() : snapshot.cheque_details);
        
        // Use customer from snapshot if available, otherwise use customer_name from join
        const customerFromSnapshot = snapshot.customer || (snapshot.current_sale && snapshot.current_sale.customer);
        const customerName = (customerFromSnapshot && (customerFromSnapshot.name || customerFromSnapshot.full_name)) || holdOrder.customer_name || '';
        const customerId = (customerFromSnapshot && customerFromSnapshot.id) || snapshot.customer_id || holdOrder.customer_id || null;
        
        const customerForSelect = customerId
          ? {
              id: customerId,
              name: customerName,
              full_name: customerName,
              ...(customerFromSnapshot || {}) // Include any other customer props from snapshot
            }
          : null;

        // Ensure customer is in customer-list (confirmation modal reads from there)
        if (customerForSelect) {
          const currentCustomerList = this.getState('customer-list') || [];
          const customerExists = currentCustomerList.some(c => c.id === customerId);
          if (!customerExists) {
            // Add customer to the list so confirmation modal can find it
            this.updateState('customer-list', [...currentCustomerList, customerForSelect]);
          } else {
            // Update existing customer in list with any additional props from snapshot
            const updatedList = currentCustomerList.map(c =>
              c.id === customerId ? { ...c, ...customerForSelect } : c
            );
            this.updateState('customer-list', updatedList);
          }
        }

        this.updateState('customer-search-query', customerName || (customerId == null ? 'Walk-in' : ''));
        this.updateState('selected-customer', customerForSelect);

        // Walk-in customers cannot have withholding
        const isWalkIn = this.isWalkInCustomer(customerForSelect) || (!customerForSelect && String(customerName || '').trim().toLowerCase() === 'walk-in');
        const snapshotWithholding = (snapshot.withhold_percentage != null || holdOrder.withhold_percentage != null) && Number(snapshot.withhold_percentage || holdOrder.withhold_percentage || 0) > 0;
        
        const orderDate = normalizeSaleDate(snapshot.sale_date || snapshot.order_date || holdOrder.order_date);
        const paymentMode = snapshot.payment_mode || snapshot.payment_type || holdOrder.payment_mode || 'cash';
        
        const currentSale = {
          // Customer
          customer_id: customerId,
          customer: customerForSelect,
          
          // Order details (matching sales_orders table)
          order_date: orderDate,
          sale_date: orderDate, // Alias for UI consistency
          invoice_no: snapshot.invoice_no || holdOrder.invoice_no || '',
          remark: snapshot.remark || '',
          
          // Payment (matching sales_orders table)
          payment_type: paymentMode,
          payment_mode: paymentMode, // Alias for UI consistency
          payment_status: 'unpaid', // Will be computed on checkout
          
          // Withholding (matching sales_orders table)
          is_withholding: isWalkIn ? false : snapshotWithholding,
          withhold_percentage: snapshot.withhold_percentage != null ? Number(snapshot.withhold_percentage) : null,
          withhold_amount: null, // Will be computed
          withhold_reference: isWalkIn ? '' : (snapshot.withhold_reference || ''),
          withhold_ref: isWalkIn ? null : (snapshot.withhold_ref ?? snapshot.sales_invoice_no ?? null),
          withhold_confirmation: false,
          withhold_settled: false,
          
          // Financial (will be computed)
          total_amount: 0,
          amount_paid: 0,
          received_amount: 0,
          
          // Payment details
          first_payment: snapshot.first_payment != null ? snapshot.first_payment : (holdOrder.first_payment != null ? holdOrder.first_payment : null),
          cheque_details: chequeDetails,
          
          // Items
          items,
          
          // UI state
          error: null,
        };
        this.updateState('current-sale', currentSale);
        this.updateState('filtered-items', items);
        this.updateTab('current-sale');
        return holdOrder;
      }
      throw new Error(result?.error || 'Failed to load hold order');
    } catch (error) {
      console.error('[SalesVM] loadHoldOrder error:', error);
      this.updateState('error', { message: error.message || 'Failed to load hold order' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async openHoldOrderDrawer(holdOrderId) {
    if (this.getState('loading')) return;
    this.updateState('loading', true);
    try {
      const result = await window.ipcRenderer.invoke('sales:get-hold-order-by-id', holdOrderId);
      if (result && result.success && result.hold_order) {
        this.updateState('selected-hold-order', result.hold_order);
        this.updateState('hold-drawer-open', true);
      } else {
        throw new Error(result?.error || 'Failed to load hold order');
      }
    } catch (error) {
      console.error('[SalesVM] openHoldOrderDrawer error:', error);
      this.updateState('error', { message: error.message || 'Failed to load hold order' });
    } finally {
      this.updateState('loading', false);
    }
  }

  closeHoldOrderDrawer() {
    this.updateState('hold-drawer-open', false);
    this.updateState('selected-hold-order', null);
  }

  async saveAsHoldOrder() {
    if (this.getState('loading')) return;
    const currentSale = this.getState('current-sale') || {};
    if (!currentSale.items || currentSale.items.length === 0) {
      throw new Error('At least one item is required');
    }
    this.updateState('loading', true);
    this.updateState('error', null);
    try {
      const totals = this.calculateSaleTotals();
      const netAmount = totals.net_amount || 0;
      const amountPaid = currentSale.payment_mode === 'credit' ? (currentSale.first_payment || 0) : currentSale.payment_mode === 'cheque' ? (currentSale.cheque_details?.amount || 0) : netAmount;
      const snapshot = {
        customer_id: currentSale.customer_id != null && currentSale.customer_id !== '' ? Number(currentSale.customer_id) : null,
        sale_date: normalizeSaleDate(currentSale.sale_date),
        invoice_no: currentSale.invoice_no || null,
        payment_mode: currentSale.payment_mode,
        payment_type: currentSale.payment_mode,
        total_amount: netAmount,
        amount_paid: amountPaid,
        withhold_percentage: currentSale.is_withholding ? Number(this.getState('withhold-percentage')) : null,
        withhold_amount: totals.withhold_amount || null,
        withhold_reference: currentSale.withhold_reference || null,
        withhold_ref: currentSale.withhold_ref || null,
        first_payment: currentSale.payment_mode === 'credit' ? Number(currentSale.first_payment || 0) : null,
        cheque_details: currentSale.payment_mode === 'cheque' && currentSale.cheque_details ? { ...currentSale.cheque_details, amount: Number(currentSale.cheque_details.amount) } : null,
        remark: currentSale.remark || null,
        items: (currentSale.items || []).map((item) => ({
          product_id: Number(item.product_id),
          inventory_id: Number(item.inventory_id),
          product_name: item.product_name || null,
          product_code: item.product_code || null,
          quantity: Math.max(1, Math.floor(Number(item.quantity))),
          unit_price: Number(item.unit_price),
          batch_number: item.batch_number || null,
          expiry_date: item.expiry_date || null,
        })),
      };
      const result = await window.ipcRenderer.invoke('sales:create-hold-order', snapshot);
      if (result && result.success) {
        this.updateState('success', { message: 'Hold order saved successfully' });
        this.resetCurrentSale();
        await this.loadHoldOrders();
        return { success: true };
      }
      throw new Error(result?.error || 'Failed to save hold order');
    } catch (error) {
      console.error('[SalesVM] saveAsHoldOrder error:', error);
      this.updateState('error', { message: error.message || 'Failed to save hold order' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async processSale() {
    if (this.getState('loading')) return;
    const currentSale = this.getState('current-sale') || {};
    if (!currentSale.items || currentSale.items.length === 0) {
      throw new Error('At least one item is required');
    }
    this.updateState('loading', true);
    this.updateState('error', null);
    try {
      const result = await window.ipcRenderer.invoke('sales:process-sale', { currentSale: currentSale, totals: this.calculateSaleTotals() });
      if (result && result.success) {
        this.updateState('success', { message: 'Sale completed successfully' });
        this.resetCurrentSale();
        return result;
      }
      throw new Error(result?.error || 'Sale API not yet implemented');
    } catch (error) {
      console.error('[SalesVM] processSale error:', error);
      this.updateState('error', { message: error.message || 'Failed to complete sale' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async loadOrderDetails(orderId) {
    if (this.getState('loading')) return null;
    this.updateState('loading', true);
    try {
      const result = await window.ipcRenderer.invoke('sales:get-order-by-id', orderId);
      if (result && result.success) {
        const payload = { order: result.order, items: result.items || [] };
        this.updateState('selected-order', payload);
        return payload;
      }
      throw new Error(result?.error || 'Failed to load order details');
    } catch (error) {
      console.error('[SalesVM] loadOrderDetails error:', error);
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

  async payOrder(orderId, paymentData) {
    if (this.getState('loading')) return;
    this.updateState('loading', true);
    let paymentSuccess = false;
    try {
      const result = await window.ipcRenderer.invoke('sales:pay-order', { orderId, ...paymentData });
      if (result && result.success) {
        await this.loadOrderDetails(orderId);
        paymentSuccess = true;
        return result;
      }
      throw new Error(result?.error || 'Failed to record payment');
    } catch (error) {
      console.error('[SalesVM] payOrder error:', error);
      this.updateState('error', { message: error.message || 'Failed to record payment' });
      throw error;
    } finally {
      this.updateState('loading', false);
      // Refresh sales history so the table shows updated outstanding balance / status (loadSalesOrders exits early if loading is true, so we call after clearing loading)
      if (paymentSuccess) await this.loadSalesOrders();
    }
  }

  async confirmWithhold(orderId, withholdRef) {
    if (this.getState('loading')) return;
    this.updateState('loading', true);
    try {
      const result = await window.ipcRenderer.invoke('sales:confirm-withhold', { orderId, withhold_ref: withholdRef });
      if (result && result.success) {
        await this.loadOrderDetails(orderId);
        await this.loadSalesOrders();
        return result;
      }
      throw new Error(result?.error || 'Failed to confirm withhold');
    } catch (error) {
      console.error('[SalesVM] confirmWithhold error:', error);
      this.updateState('error', { message: error.message || 'Failed to confirm withhold' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async rollbackWithhold(orderId) {
    if (this.getState('loading')) return;
    this.updateState('loading', true);
    try {
      const result = await window.ipcRenderer.invoke('sales:rollback-withhold', orderId);
      if (result && result.success) {
        await this.loadOrderDetails(orderId);
        await this.loadSalesOrders();
        return result;
      }
      throw new Error(result?.error || 'Failed to rollback withhold');
    } catch (error) {
      console.error('[SalesVM] rollbackWithhold error:', error);
      this.updateState('error', { message: error.message || 'Failed to rollback withhold' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async reverseOrder(orderId, reason) {
    if (this.getState('loading')) return;
    this.updateState('loading', true);
    try {
      const result = await window.ipcRenderer.invoke('sales:reverse-order', { orderId, reason });
      if (result && result.success) {
        this.closeOrderDrawer();
        await this.loadSalesOrders();
        return result;
      }
      throw new Error(result?.error || 'Failed to reverse order');
    } catch (error) {
      console.error('[SalesVM] reverseOrder error:', error);
      this.updateState('error', { message: error.message || 'Failed to reverse order' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  async archiveHoldOrder(holdOrderId) {
    if (this.getState('loading')) return;
    this.updateState('loading', true);
    try {
      const result = await window.ipcRenderer.invoke('sales:archive-hold-order', holdOrderId);
      if (result && result.success) {
        await this.loadHoldOrders();
        return;
      }
      throw new Error(result?.error || 'Failed to archive hold order');
    } catch (error) {
      console.error('[SalesVM] archiveHoldOrder error:', error);
      this.updateState('error', { message: error.message || 'Failed to archive hold order' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }

  /**
   * Get the last-created sales order (for "View last receipt").
   * Always fetches the single most recent completed order by id so the correct receipt is shown.
   * @returns {Promise<{ id: number, ... } | null>}
   */
  async getLastOrder() {
    try {
      const result = await window.ipcRenderer.invoke('sales:get-orders', {
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
      console.error('[SalesVM] getLastOrder error:', e);
    } finally {
      this.updateState('loading', false);
    }
    return null;
  }

  async exportSalesOrder() {
    if (this.getState('loading')) return;
    this.updateState('loading', true);
    try {
      const result = await window.ipcRenderer.invoke('sales:export-sales-order');
      if (result && result.success && result.csvContent) {
        // Create a blob and download
        const blob = new Blob([result.csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sales_orders_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        return { success: true };
      }
      throw new Error(result?.error || 'Failed to export sales order');
    } catch (error) {
      console.error('[SalesVM] exportSalesOrder error:', error);
      this.updateState('error', { message: error.message || 'Failed to export sales order' });
      throw error;
    } finally {
      this.updateState('loading', false);
    }
  }
}
