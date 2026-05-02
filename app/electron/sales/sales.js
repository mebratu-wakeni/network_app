import { getApiUrl } from '../config/apiConfig.js'

/**
 * SalesManager - API communication for sales module.
 * Mirrors PurchaseManager: orders, hold orders, pay, withhold confirm/rollback, reverse.
 */
class SalesManager {
  async apiRequest(endpoint, options = {}, token) {
    const url = getApiUrl(endpoint)
    const headers = { 'Content-Type': 'application/json', ...options.headers }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body
    })

    let data
    try {
      data = await response.json()
    } catch (e) {
      const text = await response.text()
      throw new Error(data?.error || data?.message || `Invalid response: ${text}`)
    }

    if (!response.ok) {
      const err = new Error(data?.error || data?.message || `HTTP ${response.status}`)
      if (data?.details) err.details = data.details
      throw err
    }
    return data
  }

  async getWithholdPercentage(token) {
    const response = await this.apiRequest('/sales/settings/withhold-percentage', { method: 'GET' }, token)
    return {
      success: response.ok === true,
      withhold_percentage: response.withhold_percentage,
      setting_name: response.setting_name
    }
  }

  async createOrder(orderData, token) {
    const response = await this.apiRequest('/sales/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    }, token)
    return {
      success: response.ok === true,
      order: response.order
    }
  }

  async getOrders(searchParams, token) {
    const params = new URLSearchParams()
    Object.keys(searchParams || {}).forEach(key => {
      if (searchParams[key] !== undefined && searchParams[key] !== null) {
        params.append(key, searchParams[key])
      }
    })
    const response = await this.apiRequest(`/sales/orders?${params.toString()}`, { method: 'GET' }, token)
    return {
      success: response.ok === true,
      orders: response.orders || [],
      total: response.total || 0,
      stats: response.stats || {},
      period_summary: response.period_summary || null
    }
  }

  async getOrderById(orderId, token) {
    const response = await this.apiRequest(`/sales/orders/${orderId}`, { method: 'GET' }, token)
    return {
      success: response.ok === true,
      order: response.order,
      items: response.items || []
    }
  }

  async getOrderReceipt(orderId, token) {
    try {
      const response = await this.apiRequest(`/sales/orders/${orderId}/receipt`, { method: 'GET' }, token)
      return {
        success: response.ok === true,
        receipt: response.receipt
      }
    } catch (error) {
      console.error('[SalesManager] getOrderReceipt error:', error)
      throw error
    }
  }

  async payOrder(orderId, paymentData, token) {
    const response = await this.apiRequest(`/sales/orders/${orderId}/pay`, {
      method: 'POST',
      body: JSON.stringify(paymentData)
    }, token)
    return {
      success: response.ok === true,
      amount_paid: response.amount_paid,
      payment_status: response.payment_status,
      outstanding_balance: response.outstanding_balance
    }
  }

  async getCustomerOutstandingForPayment(customerId, token) {
    const response = await this.apiRequest(
      `/sales/customers/${encodeURIComponent(customerId)}/outstanding-for-payment`,
      { method: 'GET' },
      token
    )
    return {
      success: response.ok === true,
      orders: response.orders || [],
      total_outstanding: response.total_outstanding != null ? Number(response.total_outstanding) : 0
    }
  }

  async bulkPayCustomerSales(body, token) {
    const response = await this.apiRequest('/sales/orders/bulk-pay', {
      method: 'POST',
      body: JSON.stringify(body)
    }, token)
    return {
      success: response.ok === true,
      total_applied: response.total_applied,
      applied: response.applied || []
    }
  }

  async confirmWithhold(orderId, body, token) {
    const response = await this.apiRequest(`/sales/orders/${orderId}/withhold-confirmation`, {
      method: 'PATCH',
      body: JSON.stringify(body || {})
    }, token)
    return { success: response.ok === true, order: response.order }
  }

  async rollbackWithhold(orderId, token) {
    const response = await this.apiRequest(`/sales/orders/${orderId}/withhold-rollback`, {
      method: 'PATCH',
      body: JSON.stringify({})
    }, token)
    return { success: response.ok === true, order: response.order }
  }

  async reverseOrder(orderId, reverseData, token) {
    const response = await this.apiRequest(`/sales/orders/${orderId}/reverse`, {
      method: 'POST',
      body: JSON.stringify(reverseData || {})
    }, token)
    return { success: response.ok === true, ...response }
  }

  async createHoldOrder(snapshot, token) {
    const response = await this.apiRequest('/sales/hold-orders', {
      method: 'POST',
      body: JSON.stringify(snapshot)
    }, token)
    return {
      success: response.ok === true,
      hold_order: response.hold_order
    }
  }

  async getHoldOrders(searchParams, token) {
    const params = new URLSearchParams()
    Object.keys(searchParams || {}).forEach(key => {
      if (searchParams[key] !== undefined && searchParams[key] !== null) {
        params.append(key, searchParams[key])
      }
    })
    const response = await this.apiRequest(`/sales/hold-orders?${params.toString()}`, { method: 'GET' }, token)
    return {
      success: response.ok === true,
      hold_orders: response.hold_orders || [],
      total: response.total || 0
    }
  }

  async getHoldOrderById(holdOrderId, token) {
    const response = await this.apiRequest(`/sales/hold-orders/${holdOrderId}`, { method: 'GET' }, token)
    return {
      success: response.ok === true,
      hold_order: response.hold_order
    }
  }

  async archiveHoldOrder(holdOrderId, token) {
    await this.apiRequest(`/sales/hold-orders/${holdOrderId}`, { method: 'DELETE' }, token)
    return { success: true }
  }

  async exportSalesOrder(token) {
    try {
      const url = getApiUrl('/sales/orders/export')
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'text/csv'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to export sales orders: ${response.statusText}`)
      }

      const csvContent = await response.text()
      
      return {
        success: true,
        csvContent: csvContent
      }
    } catch (error) {
      console.error('[SalesManager] exportSalesOrder error:', error)
      return {
        success: false,
        error: error.message || 'Failed to export sales orders'
      }
    }
  }
}

export default SalesManager
