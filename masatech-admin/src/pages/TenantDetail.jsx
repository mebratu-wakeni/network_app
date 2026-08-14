import { useState, useEffect } from 'react'
import { tenants as tenantsApi } from '../api.js'
import Badge from '../components/Badge.jsx'

function UserRow({ user, onResetPassword, resetLoading }) {
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)

  async function handleReset() {
    if (!confirm(`Reset password for "${user.username}"?\n\nThey will need the new temporary password to log in.`)) return
    setResult(null)
    try {
      const data = await onResetPassword(user.id)
      setResult(data)
    } catch (err) {
      setResult({ error: err.message })
    }
  }

  function copyPassword() {
    navigator.clipboard.writeText(result.tempPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-4 border-b border-slate-100 last:border-b-0">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-800 text-sm">{user.display_name || user.username}</span>
            <span className="text-xs text-slate-400">@{user.username}</span>
            {!user.is_active && (
              <span className="text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-medium">Inactive</span>
            )}
          </div>
          {user.email && <div className="text-xs text-slate-500 mt-0.5">{user.email}</div>}
          <div className="text-xs text-slate-400 mt-0.5">
            Last login: {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}
          </div>
        </div>
        <button
          onClick={handleReset}
          disabled={resetLoading}
          className="flex-shrink-0 border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50 font-semibold text-xs px-3 py-1.5 rounded-lg transition"
        >
          Reset password
        </button>
      </div>

      {result?.error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{result.error}</div>
      )}
      {result?.tempPassword && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <span className="text-xs text-emerald-700">New temporary password for <strong>{result.username}</strong>:</span>
          <span className="flex-1 font-mono text-sm font-bold text-emerald-800 select-all">{result.tempPassword}</span>
          <button onClick={copyPassword} className="text-emerald-600 hover:text-emerald-800 transition" title="Copy">
            {copied ? '✓' : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export default function TenantDetail({ tenantId, onBack }) {
  const [tenant, setTenant] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [actionSuccess, setActionSuccess] = useState(null)
  const [copied, setCopied] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [tenantData, usersData] = await Promise.all([
        tenantsApi.get(tenantId),
        tenantsApi.listUsers(tenantId)
      ])
      setTenant(tenantData.tenant)
      setUsers(usersData.users || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [tenantId])

  async function doAction(fn, confirmMsg) {
    if (confirmMsg && !confirm(confirmMsg)) return
    setActionLoading(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      await fn()
      setActionSuccess('Done.')
      await load()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleResetPassword(userId) {
    const data = await tenantsApi.resetUserPassword(tenantId, userId)
    return data
  }

  function copyCode() {
    navigator.clipboard.writeText(tenant.client_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading…</div>
  if (error) return (
    <div className="flex flex-col items-center gap-3 py-24">
      <p className="text-red-500 text-sm">{error}</p>
      <button onClick={onBack} className="text-indigo-600 text-sm underline">Go back</button>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition w-fit">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to list
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800">{tenant.business_name}</h1>
            <Badge status={tenant.status} />
          </div>
          {(tenant.contact_name || tenant.phone || tenant.email) && (
            <p className="text-sm text-slate-500">
              {[tenant.contact_name, tenant.phone, tenant.email].filter(Boolean).join(' · ')}
            </p>
          )}

          {/* Tenant code */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-slate-400">Tenant Code:</span>
            <span className="font-mono text-base font-bold text-indigo-700 tracking-wider">{tenant.client_code}</span>
            <button onClick={copyCode} className="text-slate-400 hover:text-indigo-600 transition" title="Copy code">
              {copied
                ? <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              }
            </button>
          </div>

          <div className="text-xs text-slate-400">Onboarded {tenant.created_at ? new Date(tenant.created_at).toLocaleDateString() : '—'}</div>
        </div>

        {/* Action button */}
        <div className="flex flex-col gap-2 min-w-[150px]">
          {tenant.status === 'active' ? (
            <button
              onClick={() => doAction(() => tenantsApi.suspend(tenantId), `Suspend "${tenant.business_name}"?\nUsers at this tenant will be blocked from logging in until reactivated.`)}
              disabled={actionLoading}
              className="flex items-center justify-center gap-1.5 border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 font-semibold text-sm px-4 py-2 rounded-lg transition"
            >
              Suspend Tenant
            </button>
          ) : (
            <button
              onClick={() => doAction(() => tenantsApi.reactivate(tenantId))}
              disabled={actionLoading}
              className="flex items-center justify-center gap-1.5 border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 font-semibold text-sm px-4 py-2 rounded-lg transition"
            >
              Reactivate Tenant
            </button>
          )}
        </div>
      </div>

      {actionError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{actionError}</div>}
      {actionSuccess && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">{actionSuccess}</div>}

      {/* Users */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700 text-sm">
            Users
            <span className="ml-2 text-slate-400 font-normal">({users.length})</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Use "Reset password" to help a user who lost access.</p>
        </div>

        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
            <span className="text-sm">No users found for this tenant.</span>
          </div>
        ) : (
          users.map((u) => (
            <UserRow key={u.id} user={u} onResetPassword={handleResetPassword} resetLoading={false} />
          ))
        )}
      </div>
    </div>
  )
}
