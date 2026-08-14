/**
 * Turn IPC/API errors into plain language for end users.
 */

const IPC_PREFIX = /^Error invoking remote method '[^']+':\s*/i

function stripErrorPrefix(text) {
  let s = String(text || '').trim()
  if (!s) return ''
  s = s.replace(IPC_PREFIX, '')
  if (s.startsWith('Error: ')) s = s.slice(7).trim()
  // Nested IPC wrapper (rare)
  if (IPC_PREFIX.test(s)) return stripErrorPrefix(s)
  return s
}

export function extractErrorMessage(error) {
  if (error == null) return ''
  if (typeof error === 'string') return stripErrorPrefix(error)
  if (typeof error === 'object') {
    if (typeof error.message === 'string' && error.message) return stripErrorPrefix(error.message)
    if (typeof error.error === 'string' && error.error) return stripErrorPrefix(error.error)
  }
  return stripErrorPrefix(String(error))
}

export function isAuthError(error) {
  const msg = extractErrorMessage(error).toLowerCase()
  return msg.includes('authentication required') || msg.includes('session has expired')
}

export function isNoOpenFiscalYearError(error) {
  const msg = extractErrorMessage(error).toLowerCase()
  return msg.includes('no open fiscal year')
}

export function isFiscalYearSetupError(error) {
  const msg = extractErrorMessage(error).toLowerCase()
  return (
    isNoOpenFiscalYearError(error) ||
    msg.includes('no fiscal year covers')
  )
}

function mapKnownMessage(msg) {
  const lower = msg.toLowerCase()

  if (isAuthError(msg)) {
    return 'Your session has expired. Please sign out and sign in again.'
  }
  if (isNoOpenFiscalYearError(msg)) {
    return 'No fiscal year is set up yet. Open Settings → Fiscal Year to create one.'
  }
  if (lower.includes('no fiscal year covers')) {
    return msg.includes('Settings')
      ? msg
      : `${msg} Open Settings → Fiscal Year to set one up.`
  }
  if (
    lower.includes('fetch failed') ||
    lower.includes('network') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('unable to reach')
  ) {
    return 'Unable to reach the server. Check your connection and try again.'
  }
  if (/^http \d{3}$/i.test(msg) || lower.startsWith('invalid json')) {
    return 'The server returned an unexpected response. Please try again.'
  }
  if (/remote method|invoke/i.test(msg)) {
    return ''
  }
  return msg
}

/**
 * @param {unknown} error - Error, string, or { message, error }
 * @param {string} [fallback] - Used when nothing usable remains
 */
export function formatUserError(error, fallback = 'Something went wrong. Please try again.') {
  const mapped = mapKnownMessage(extractErrorMessage(error))
  return mapped || fallback
}

/** VM `error` state may be a string or `{ message }`. */
export function displayErrorText(error, fallback = 'Something went wrong. Please try again.') {
  if (error == null || error === false) return ''
  if (typeof error === 'string') return formatUserError(error, fallback)
  if (typeof error === 'object' && error.message) return formatUserError(error.message, fallback)
  return formatUserError(error, fallback)
}

/** Collapse repeated load failures (e.g. dashboard Promise.allSettled). */
export function summarizeLoadErrors(errors, fallback = 'Some data could not be loaded. Please try again.') {
  const messages = (errors || [])
    .map((e) => formatUserError(e, ''))
    .filter(Boolean)
  const unique = [...new Set(messages)]
  if (unique.length === 0) return null
  if (unique.length === 1) return unique[0]
  if (unique.every((m) => isAuthError(m))) return unique[0]
  return `${fallback} ${unique[0]}`
}
