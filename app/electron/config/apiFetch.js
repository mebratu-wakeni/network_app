/**
 * Shared fetch wrapper for all Electron main-process API calls.
 *
 * Injects headers that are required for cloud deployments:
 * - Accept / Content-Type  : ensures the server returns JSON and doesn't
 *   treat the request as an unknown content type (avoids 415 errors).
 * - User-Agent             : identifies the app to WAF / bot-protection
 *   systems (e.g. Imunify360 on cPanel) so requests are not blocked.
 * - X-Client-Version       : real app version for optional API min-client gates.
 *
 * Caller-supplied headers always win (spread after defaults).
 *
 * 401 interception: when any API call returns 401 (token expired / invalid),
 * the registered `_onSessionExpired` callback fires so main.js can notify
 * the renderer to show the login screen.
 *
 * 426 CLIENT_OUTDATED: when the API rejects an old client, `_onClientOutdated`
 * fires so the updater UI can force a required update.
 */

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { version: APP_VERSION } = require('../../package.json')

const DEFAULT_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': `Mozilla/5.0 (compatible; PharmaSuit/${APP_VERSION})`,
  'X-Client-Version': APP_VERSION
}

let _onSessionExpired = null
let _onServerDown = null
let _onClientOutdated = null
let _clientOutdatedNotified = false

/**
 * Register a callback that fires whenever any API call returns HTTP 401.
 * Call this once from main.js after the BrowserWindow is created.
 */
export function setOnSessionExpired(fn) {
  _onSessionExpired = typeof fn === 'function' ? fn : null
}

/**
 * Register a callback that fires whenever a network-level failure is detected
 * (connection refused, timeout, DNS failure, etc.) — i.e. the server is unreachable.
 * HTTP errors (4xx/5xx) do NOT trigger this; only when fetch() itself throws.
 */
export function setOnServerDown(fn) {
  _onServerDown = typeof fn === 'function' ? fn : null
}

/**
 * Register a callback for HTTP 426 / code CLIENT_OUTDATED from the API.
 */
export function setOnClientOutdated(fn) {
  _onClientOutdated = typeof fn === 'function' ? fn : null
}

/**
 * Drop-in replacement for `fetch` in Electron main-process manager files.
 * Usage: replace `fetch(url, opts)` with `apiFetch(url, opts)` — identical API.
 */
export async function apiFetch(url, options = {}) {
  let response
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...DEFAULT_HEADERS,
        ...(options.headers || {})
      }
    })
  } catch (networkErr) {
    // fetch() threw → server is unreachable (refused, timeout, DNS, etc.)
    if (_onServerDown) {
      try { _onServerDown() } catch (_) {}
    }
    throw networkErr
  }
  if (response.status === 401 && _onSessionExpired) {
    try { _onSessionExpired() } catch (_) {}
  }
  if (response.status === 426 && _onClientOutdated && !_clientOutdatedNotified) {
    _clientOutdatedNotified = true
    let body = null
    try {
      body = await response.clone().json()
    } catch (_) {}
    try {
      _onClientOutdated({
        minSupportedVersion: body?.minSupportedVersion || null,
        message: body?.message || body?.error || null,
        code: body?.code || 'CLIENT_OUTDATED'
      })
    } catch (_) {}
  }
  return response
}
