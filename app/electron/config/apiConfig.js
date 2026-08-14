/**
 * API Configuration
 * Centralized API base URL configuration
 *
 * This file is safe to import from both the Electron main process (Node)
 * and the renderer (Vite/browser). Do not rely on `process` being present
 * in the renderer — use `VITE_API_BASE_URL` in Vite environment files.
 *
 * IMPORTANT: Vite can statically replace `process.env.FOO` with undefined at
 * build time. Always use bracket access + globalThis so runtime setApiBaseUrl()
 * actually wins (duplicate bundle copies of this module also share globalThis).
 */

const DEFAULT_API = 'http://localhost:4000/api'
const ENV_KEY = 'API_BASE_URL'
const GLOBAL_KEY = '__MASATECH_API_BASE_URL__'

function readEnvApiBase() {
  try {
    if (typeof process !== 'undefined' && process?.env) {
      const value = process.env[ENV_KEY]
      if (value) return String(value).trim().replace(/\/+$/, '')
    }
  } catch (_) {}
  return null
}

export function setApiBaseUrl(url) {
  const trimmed = typeof url === 'string' ? url.trim().replace(/\/+$/, '') : ''
  const next = trimmed || null
  try {
    globalThis[GLOBAL_KEY] = next
  } catch (_) {}
  try {
    if (typeof process !== 'undefined' && process?.env) {
      if (next) process.env[ENV_KEY] = next
      else delete process.env[ENV_KEY]
    }
  } catch (_) {}
}

function readApiBase() {
  try {
    const fromGlobal = globalThis[GLOBAL_KEY]
    if (fromGlobal) return String(fromGlobal)
  } catch (_) {}

  const fromEnv = readEnvApiBase()
  if (fromEnv) return fromEnv

  // Runtime override persisted by first-run setup (renderer).
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem('apiBaseUrl')
      if (stored) return stored
    }
  } catch (_) {}

  // Vite provides import.meta.env at build time (use VITE_ prefix)
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) {
      return import.meta.env.VITE_API_BASE_URL
    }
  } catch (_) {}

  return DEFAULT_API
}

export function getApiUrl(endpoint) {
  const apiBaseUrl = readApiBase()
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${apiBaseUrl}${path}`
}

export function getApiRoot() {
  const apiBaseUrl = readApiBase()
  return apiBaseUrl.replace(/\/api\/?$/i, '')
}

export function getApiAsset(assetPath) {
  if (!assetPath) return null
  const p = assetPath.startsWith('/') ? assetPath : `/${assetPath}`
  return `${getApiRoot()}${p}`
}

/** Debug helper for Electron logs */
export function getConfiguredApiBase() {
  return readApiBase()
}
