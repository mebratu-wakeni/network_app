// Empty string = relative URLs (served from the same origin as the api in production,
// under /admin). Vite's dev server proxies /api to http://localhost:4000 (see vite.config.js).
const BASE = import.meta.env.VITE_API_URL || ''

function getToken() {
  return localStorage.getItem('ma_token')
}

async function request(method, path, body = null, requiresAuth = true) {
  const headers = { 'Content-Type': 'application/json' }
  if (requiresAuth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`)
    err.status = res.status
    err.data = data
    throw err
  }

  return data
}

// Auth
export const auth = {
  login: (username, password) =>
    request('POST', '/api/platform-admin/login', { username, password }, false),
  changePassword: (current_password, new_password) =>
    request('POST', '/api/platform-admin/change-password', { current_password, new_password })
}

// Tenant management
export const tenants = {
  list: () => request('GET', '/api/tenants'),
  get: (id) => request('GET', `/api/tenants/${id}`),
  create: (payload) => request('POST', '/api/tenants', payload),
  suspend: (id) => request('PATCH', `/api/tenants/${id}/suspend`),
  reactivate: (id) => request('PATCH', `/api/tenants/${id}/reactivate`),
  listUsers: (id) => request('GET', `/api/tenants/${id}/users`),
  resetUserPassword: (id, userId) => request('POST', `/api/tenants/${id}/users/${userId}/reset-password`)
}
