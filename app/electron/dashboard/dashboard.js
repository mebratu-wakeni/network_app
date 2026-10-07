import { getApiUrl } from '../config/apiConfig.js';
import { apiFetch } from '../config/apiFetch.js';

/**
 * DashboardManager - Fetches ledger balances and other dashboard data from the API.
 */
class DashboardManager {
  async getLedgerBalances(token) {
    const url = getApiUrl('/ledger/balances');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await apiFetch(url, { method: 'GET', headers });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || data.message || `HTTP ${response.status}`);
    }

    return {
      success: true,
      balances: data.balances || {},
    };
  }
}

export default new DashboardManager();
