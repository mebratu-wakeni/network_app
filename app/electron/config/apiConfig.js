/**
 * API Configuration
 * Centralized API base URL configuration
 */

// API base URL - can be overridden by environment variable
export const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000/api';

// Helper to get full API endpoint URL
export function getApiUrl(endpoint) {
  // Ensure endpoint starts with /
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${path}`;
}

