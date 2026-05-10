import { getApiUrl } from '../config/apiConfig.js';
import axios from 'axios';
import FormData from 'form-data';

/**
 * CustomersManager - Handles all API communication for customer management
 */
class CustomersManager {
  constructor() {
    this.getAuthToken = () => {
      return null; // Will be passed from renderer via IPC
    }
  }

  /**
   * Get customers with pagination, search, and sorting
   */
  async getCustomers(params, token) {
    try {
      const apiUrl = getApiUrl('/customers');
      const queryParams = new URLSearchParams({
        limit: String(params?.limit ?? 10),
        offset: String(params?.offset ?? 0),
        search: params?.search || '',
        sortBy: params?.sortBy || 'id',
        orderBy: params?.orderBy || 'desc'
      });
      if (params?.customer_type != null && String(params.customer_type).trim() !== '') {
        queryParams.set('customer_type', String(params.customer_type).trim())
      }
      if (params?.customer_types != null && String(params.customer_types).trim() !== '') {
        queryParams.set('customer_types', String(params.customer_types).trim())
      }
      if (params?.prefer_walk_in === true) {
        queryParams.set('prefer_walk_in', '1')
      }

      const response = await fetch(`${apiUrl}?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch customers: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        customers: data.customers || [],
        total: data.total || 0
      };
    } catch (error) {
      console.error('[CustomersManager] Error fetching customers:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch customers',
        customers: [],
        total: 0
      };
    }
  }

  /**
   * Create a new customer
   */
  async createCustomer(customerData, token) {
    try {
      const apiUrl = getApiUrl('/customers');
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create customer: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        customer: data.customer
      };
    } catch (error) {
      console.error('[CustomersManager] Error creating customer:', error);
      return {
        success: false,
        error: error.message || 'Failed to create customer'
      };
    }
  }

  /**
   * Update a customer
   */
  async updateCustomer(customerId, customerData, token) {
    try {
      const apiUrl = getApiUrl(`/customers/${customerId}`);

      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[CustomersManager] updateCustomer - Error Response:', errorData);
        throw new Error(errorData.error || `Failed to update customer: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        customer: data.customer
      };
    } catch (error) {
      console.error('[CustomersManager] updateCustomer - Error:', error);
      return {
        success: false,
        error: error.message || 'Failed to update customer'
      };
    }
  }

  /**
   * Delete a customer
   */
  async deleteCustomer(customerId, token) {
    try {
      const apiUrl = getApiUrl(`/customers/${customerId}`);
      const response = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to delete customer: ${response.statusText}`);
      }

      return {
        success: true
      };
    } catch (error) {
      console.error('[CustomersManager] Error deleting customer:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete customer'
      };
    }
  }

  /**
   * Bulk import customers from CSV (multipart; parse + partial success on API)
   * @param {Uint8Array|ArrayBuffer|number[]} fileBuffer
   */
  async bulkImportCustomersUpload(fileBuffer, fileName, token) {
    try {
      const form = new FormData();
      form.append('file', Buffer.from(fileBuffer), fileName || 'customers.csv');
      const url = getApiUrl('/customers/bulk-import-upload');
      const res = await axios.post(url, form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${token}`
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });
      const data = res.data;
      return {
        success: data.ok !== false,
        summary: data.summary || {},
        results: data.results || []
      };
    } catch (error) {
      if (error.response?.data) {
        const d = error.response.data;
        return {
          success: false,
          error: d.error || d.message || error.message,
          summary: d.summary,
          results: d.results || []
        };
      }
      console.error('[CustomersManager] bulkImportCustomersUpload error:', error);
      throw error;
    }
  }

  /**
   * Bulk import customers (JSON body)
   */
  async bulkImportCustomers(customers, token) {
    try {
      const apiUrl = getApiUrl('/customers/bulk-import');
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ customers })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to import customers: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        summary: data.summary,
        results: data.results
      };
    } catch (error) {
      console.error('[CustomersManager] Error importing customers:', error);
      return {
        success: false,
        error: error.message || 'Failed to import customers'
      };
    }
  }

  /**
   * Export customers to CSV
   */
  async exportCustomers(params, token) {
    try {
      const apiUrl = getApiUrl('/customers/export');
      const queryParams = new URLSearchParams({
        limit: params.limit || 10000,
        offset: params.offset || 0,
        search: params.search || '',
        sortBy: params.sortBy || 'id',
        orderBy: params.orderBy || 'desc'
      });

      const response = await fetch(`${apiUrl}?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to export customers: ${response.statusText}`);
      }

      const csvContent = await response.text();
      return {
        success: true,
        csvContent
      };
    } catch (error) {
      console.error('[CustomersManager] Error exporting customers:', error);
      return {
        success: false,
        error: error.message || 'Failed to export customers'
      };
    }
  }
}

export default CustomersManager;
