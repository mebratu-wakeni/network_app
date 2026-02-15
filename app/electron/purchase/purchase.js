import { getApiUrl } from '../config/apiConfig.js';

/**
 * PurchaseManager - Handles all API communication for purchase management
 */
class PurchaseManager {
  constructor() {
    this.getAuthToken = () => {
      return null; // Will be passed from renderer via IPC
    }
  }

  /**
   * Generic API request helper
   */
  async apiRequest(endpoint, options = {}, token) {
    const url = getApiUrl(endpoint);
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log(`[PurchaseManager] ${options.method || 'GET'} ${url}`);

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body
    });

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      const text = await response.text();
      console.error('[PurchaseManager] Failed to parse JSON:', text);
      throw new Error(`Invalid JSON response: ${parseError.message}`);
    }

    if (!response.ok) {
      console.error(`[PurchaseManager] Error (${response.status}):`, data);
      const error = new Error(data.error || data.message || `HTTP ${response.status}`);
      if (data.details) error.details = data.details;
      throw error;
    }

    return data;
  }

  /**
   * Get products for purchase dropdown/search
   */
  async getProducts(searchParams, token) {
    try {
      const { search = '', limit = 50 } = searchParams || {};
      const url = `/purchases/products?search=${encodeURIComponent(search)}&limit=${limit}`;
      const response = await this.apiRequest(url, { method: 'GET' }, token);
      return {
        success: response.ok === true,
        products: response.products || []
      };
    } catch (error) {
      console.error('[PurchaseManager] getProducts error:', error);
      throw error;
    }
  }

  /**
   * Get suppliers for purchase dropdown/search
   */
  async getSuppliers(searchParams, token) {
    try {
      const { search = '', limit = 50 } = searchParams || {};
      const url = `/purchases/suppliers?search=${encodeURIComponent(search)}&limit=${limit}`;
      const response = await this.apiRequest(url, { method: 'GET' }, token);
      return {
        success: response.ok === true,
        suppliers: response.suppliers || []
      };
    } catch (error) {
      console.error('[PurchaseManager] getSuppliers error:', error);
      throw error;
    }
  }

  /**
   * Get withhold percentage setting
   */
  async getWithholdPercentage(token) {
    try {
      const response = await this.apiRequest('/purchases/settings/withhold-percentage', { method: 'GET' }, token);
      return {
        success: response.ok === true,
        withhold_percentage: response.withhold_percentage,
        setting_name: response.setting_name
      };
    } catch (error) {
      console.error('[PurchaseManager] getWithholdPercentage error:', error);
      throw error;
    }
  }

  /**
   * Create purchase order
   */
  async createOrder(orderData, token) {
    try {
      const response = await this.apiRequest('/purchases/orders', {
        method: 'POST',
        body: JSON.stringify(orderData)
      }, token);
      return {
        success: response.ok === true,
        purchase_order: response.purchase_order
      };
    } catch (error) {
      console.error('[PurchaseManager] createOrder error:', error);
      throw error;
    }
  }

  /**
   * Get purchase orders list
   */
  async getOrders(searchParams, token) {
    try {
      const params = new URLSearchParams();
      Object.keys(searchParams || {}).forEach(key => {
        if (searchParams[key] !== undefined && searchParams[key] !== null) {
          params.append(key, searchParams[key]);
        }
      });
      const url = `/purchases/orders?${params.toString()}`;
      const response = await this.apiRequest(url, { method: 'GET' }, token);
      return {
        success: response.ok === true,
        orders: response.orders || [],
        total: response.total || 0,
        stats: response.stats || {}
      };
    } catch (error) {
      console.error('[PurchaseManager] getOrders error:', error);
      throw error;
    }
  }

  /**
   * Get purchase order details by ID
   */
  async getOrderById(orderId, token) {
    try {
      const response = await this.apiRequest(`/purchases/orders/${orderId}`, { method: 'GET' }, token);
      return {
        success: response.ok === true,
        order: response.order
      };
    } catch (error) {
      console.error('[PurchaseManager] getOrderById error:', error);
      throw error;
    }
  }

  /**
   * Get order receipt
   */
  async getOrderReceipt(orderId, token) {
    try {
      const response = await this.apiRequest(`/purchases/orders/${orderId}/receipt`, { method: 'GET' }, token);
      return {
        success: response.ok === true,
        receipt: response.receipt
      };
    } catch (error) {
      console.error('[PurchaseManager] getOrderReceipt error:', error);
      throw error;
    }
  }

  /**
   * Record payment for purchase order
   */
  async payOrder(orderId, paymentData, token) {
    try {
      const response = await this.apiRequest(`/purchases/orders/${orderId}/pay`, {
        method: 'POST',
        body: JSON.stringify(paymentData)
      }, token);
      return {
        success: response.ok === true,
        payment: response.payment
      };
    } catch (error) {
      console.error('[PurchaseManager] payOrder error:', error);
      throw error;
    }
  }

  /**
   * Reverse purchase order
   */
  async reverseOrder(orderId, reverseData, token) {
    try {
      const response = await this.apiRequest(`/purchases/orders/${orderId}/reverse`, {
        method: 'POST',
        body: JSON.stringify(reverseData)
      }, token);
      return {
        success: response.ok === true,
        reversed_order: response.reversed_order
      };
    } catch (error) {
      console.error('[PurchaseManager] reverseOrder error:', error);
      throw error;
    }
  }

  /**
   * Get payment history for order
   */
  async getPaymentHistory(orderId, token) {
    try {
      const response = await this.apiRequest(`/purchases/orders/${orderId}/payments`, { method: 'GET' }, token);
      return {
        success: response.ok === true,
        payments: response.payments || [],
        total_paid: response.total_paid || 0,
        outstanding_balance: response.outstanding_balance || 0
      };
    } catch (error) {
      console.error('[PurchaseManager] getPaymentHistory error:', error);
      throw error;
    }
  }

  /**
   * Create hold order: full current-order snapshot for UI restore.
   */
  async createHoldOrder(snapshot, token) {
    try {
      const response = await this.apiRequest('/purchases/hold-orders', {
        method: 'POST',
        body: JSON.stringify(snapshot),
        headers: { 'Content-Type': 'application/json' }
      }, token);
      return {
        success: response.ok === true,
        hold_order: response.hold_order
      };
    } catch (error) {
      console.error('[PurchaseManager] createHoldOrder error:', error);
      throw error;
    }
  }

  /**
   * Get hold orders list
   */
  async getHoldOrders(searchParams, token) {
    try {
      const params = new URLSearchParams();
      Object.keys(searchParams || {}).forEach(key => {
        if (searchParams[key] !== undefined && searchParams[key] !== null) {
          params.append(key, searchParams[key]);
        }
      });
      const url = `/purchases/hold-orders?${params.toString()}`;
      const response = await this.apiRequest(url, { method: 'GET' }, token);
      return {
        success: response.ok === true,
        hold_orders: response.hold_orders || [],
        total: response.total || 0
      };
    } catch (error) {
      console.error('[PurchaseManager] getHoldOrders error:', error);
      throw error;
    }
  }

  /**
   * Get hold order by ID
   */
  async getHoldOrderById(holdOrderId, token) {
    try {
      const response = await this.apiRequest(`/purchases/hold-orders/${holdOrderId}`, { method: 'GET' }, token);
      return {
        success: response.ok === true,
        hold_order: response.hold_order
      };
    } catch (error) {
      console.error('[PurchaseManager] getHoldOrderById error:', error);
      throw error;
    }
  }

  /**
   * Archive/delete hold order
   */
  async archiveHoldOrder(holdOrderId, token) {
    try {
      const response = await this.apiRequest(`/purchases/hold-orders/${holdOrderId}`, { method: 'DELETE' }, token);
      return {
        success: response.ok === true,
        message: response.message
      };
    } catch (error) {
      console.error('[PurchaseManager] archiveHoldOrder error:', error);
      throw error;
    }
  }

  /**
   * Bulk import purchases
   */
  async bulkImportPurchases(importData, token) {
    try {
      const response = await this.apiRequest('/purchases/import', {
        method: 'POST',
        body: JSON.stringify(importData)
      }, token);
      return {
        success: response.ok === true && response.success === true,
        summary: response.summary || {},
        results: response.results || []
      };
    } catch (error) {
      console.error('[PurchaseManager] bulkImportPurchases error:', error);
      throw error;
    }
  }

  /**
   * Import purchase orders from spreadsheet payload (supplier/product names resolved on server).
   */
  async importFromSpreadsheet(payload, token) {
    try {
      const response = await this.apiRequest('/purchases/import-from-spreadsheet', {
        method: 'POST',
        body: JSON.stringify(payload)
      }, token);
      return {
        success: response.ok === true && response.success === true,
        summary: response.summary || {},
        successful: response.successful || [],
        failed: response.failed || []
      };
    } catch (error) {
      console.error('[PurchaseManager] importFromSpreadsheet error:', error);
      throw error;
    }
  }

  /**
   * Get purchase statistics
   */
  async getStats(searchParams, token) {
    try {
      const params = new URLSearchParams();
      Object.keys(searchParams || {}).forEach(key => {
        if (searchParams[key] !== undefined && searchParams[key] !== null) {
          params.append(key, searchParams[key]);
        }
      });
      const url = `/purchases/stats?${params.toString()}`;
      const response = await this.apiRequest(url, { method: 'GET' }, token);
      return {
        success: response.ok === true,
        stats: response.stats || {},
        period_summary: response.period_summary || null
      };
    } catch (error) {
      console.error('[PurchaseManager] getStats error:', error);
      throw error;
    }
  }

  /**
   * Export purchase orders to CSV
   */
  async exportPurchaseOrder(token) {
    try {
      const url = getApiUrl('/purchases/export');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'text/csv'
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to export purchase orders: ${response.statusText}`);
      }
      const csvContent = await response.text();
      return { success: true, csvContent };
    } catch (error) {
      console.error('[PurchaseManager] exportPurchaseOrder error:', error);
      return { success: false, error: error.message || 'Failed to export purchase orders' };
    }
  }
}

export default PurchaseManager;
