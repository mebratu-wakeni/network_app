import { useState, useCallback } from 'react'
import { auth as authApi } from '../api.js'

const TOKEN_KEY = 'lm_token'
const ADMIN_KEY = 'lm_admin'

function loadAdmin() {
  try { return JSON.parse(localStorage.getItem(ADMIN_KEY) || 'null') } catch { return null }
}

export function useAuth() {
  const [admin, setAdmin] = useState(loadAdmin)

  const login = useCallback(async (username, password) => {
    const data = await authApi.login(username, password)
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(ADMIN_KEY, JSON.stringify(data.admin))
    setAdmin(data.admin)
    return data.admin
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ADMIN_KEY)
    setAdmin(null)
  }, [])

  return { admin, isLoggedIn: !!admin, login, logout }
}
