/**
 * API Configuration
 * Centralized API base URL configuration
 *
 * This file is safe to import from both the Electron main process (Node)
 * and the renderer (Vite/browser). Do not rely on `process` being present
 * in the renderer — use `VITE_API_BASE_URL` in Vite environment files.
 */

const DEFAULT_API = 'http://localhost:4000/api'

/** Set by Electron main via applyRuntimeConfig — preferred over env alone. */
let _apiBaseOverride = null

export function setApiBaseUrl(url) {
  const trimmed = typeof url === 'string' ? url.trim().replace(/\/+$/, '') : ''
  _apiBaseOverride = trimmed || null
  if (typeof process !== 'undefined' && process?.env) {
    if (_apiBaseOverride) process.env.API_BASE_URL = _apiBaseOverride
    else delete process.env.API_BASE_URL
  }
}

function readApiBase() {
  if (_apiBaseOverride) return _apiBaseOverride

  // Prefer explicit Node env when available (Electron main)
  if (typeof process !== 'undefined' && process && process.env && process.env.API_BASE_URL) {
    return process.env.API_BASE_URL
  }

  // Runtime override persisted by first-run setup (renderer).
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem('apiBaseUrl')
      if (stored) return stored
    }
  } catch (e) {
    // ignore localStorage access issues
  }

  // Vite provides import.meta.env at build time (use VITE_ prefix)
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) {
      return import.meta.env.VITE_API_BASE_URL
    }
  } catch (e) {
    // ignore if import.meta isn't available in this runtime
  }

  return DEFAULT_API
}

// Helper to get full API endpoint URL (keeps existing behavior)
export function getApiUrl(endpoint) {
  const apiBaseUrl = readApiBase()
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${apiBaseUrl}${path}`
}

// Helpers for static assets served from the API root (e.g. /uploads/...)
export function getApiRoot() {
  const apiBaseUrl = readApiBase()
  // Remove a trailing '/api' if present so /uploads resolves correctly
  return apiBaseUrl.replace(/\/api\/?$/i, '')
}

export function getApiAsset(assetPath) {
  if (!assetPath) return null
  const p = assetPath.startsWith('/') ? assetPath : `/${assetPath}`
  return `${getApiRoot()}${p}`
}
