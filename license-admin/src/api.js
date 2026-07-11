const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4001'

function getToken() {
  return localStorage.getItem('lm_token')
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
    request('POST', '/auth/login', { username, password }, false),
  changePassword: (current_password, new_password) =>
    request('POST', '/auth/change-password', { current_password, new_password })
}

// Admin license endpoints
export const licenses = {
  list: (params = {}) => {
    const qs = new URLSearchParams()
    if (params.search) qs.set('search', params.search)
    if (params.status) qs.set('status', params.status)
    return request('GET', `/license/admin/list?${qs}`)
  },
  get: (id) => request('GET', `/license/admin/${id}`),
  create: (payload) => request('POST', '/license/admin', payload),
  revoke: (id) => request('PATCH', `/license/admin/${id}/revoke`),
  reactivate: (id) => request('PATCH', `/license/admin/${id}/reactivate`),
  resetActivation: (id) => request('PATCH', `/license/admin/${id}/reset-activation`)
}
