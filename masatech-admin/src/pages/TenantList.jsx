import { useState, useEffect, useCallback } from 'react'
import { tenants as tenantsApi } from '../api.js'
import Badge from '../components/Badge.jsx'
import Modal from '../components/Modal.jsx'

// ── Create modal ─────────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    businessName: '',
    contactName: '',
    phone: '',
    email: '',
    adminUsername: 'admin',
    adminPassword: ''
  })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState(null)

  function set(k, v) { setForm((p) => ({ ...p, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = await tenantsApi.create(form)
      setCreated(data.tenant)
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (created) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-lg px-4 py-3 border border-emerald-200">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium text-sm">Tenant created successfully</span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tenant Code — send this to your customer</span>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
            <span className="flex-1 font-mono text-lg font-bold text-indigo-700 tracking-wider select-all">
              {created.client_code}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(created.client_code)}
              className="text-slate-400 hover:text-indigo-600 transition"
              title="Copy"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="text-sm text-slate-600 space-y-1 bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
          <div><span className="font-medium">Business:</span> {created.business_name}</div>
          <div><span className="font-medium">Admin login:</span> {form.adminUsername}</div>
          <div className="text-xs text-slate-400 mt-1">
            The customer connects with server URL + tenant code, then signs in with the admin username/password you set.
          </div>
        </div>

        <button onClick={onClose} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg py-2.5 text-sm transition">
          Done
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-700">Business name <span className="text-red-500">*</span></label>
        <input
          autoFocus type="text" value={form.businessName} required
          onChange={(e) => set('businessName', e.target.value)}
          className="border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          placeholder="e.g. ABC Pharmacy Ltd"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Contact name</label>
          <input
            type="text" value={form.contactName}
            onChange={(e) => set('contactName', e.target.value)}
            className="border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            placeholder="Optional"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Phone</label>
          <input
            type="text" value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            className="border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-700">Email <span className="text-slate-400 font-normal">(optional)</span></label>
        <input
          type="email" value={form.email}
          onChange={(e) => set('email', e.target.value)}
          className="border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          placeholder="customer@example.com"
        />
      </div>

      <div className="border-t border-slate-100 pt-4 flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Initial admin login</span>
        <p className="text-xs text-slate-400">Created for this tenant's own users database, separate from your platform admin account.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Admin username <span className="text-red-500">*</span></label>
          <input
            type="text" value={form.adminUsername} required
            onChange={(e) => set('adminUsername', e.target.value)}
            className="border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            placeholder="admin"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Admin password <span className="text-red-500">*</span></label>
          <input
            type="text" value={form.adminPassword} required minLength={8}
            onChange={(e) => set('adminPassword', e.target.value)}
            className="border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            placeholder="At least 8 characters"
          />
        </div>
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">{error}</div>}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg py-2.5 text-sm transition">
          Cancel
        </button>
        <button type="submit" disabled={loading || !form.businessName || !form.adminUsername || !form.adminPassword}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 text-sm transition">
          {loading ? 'Creating…' : 'Create Tenant'}
        </button>
      </div>
    </form>
  )
}

// ── Main list ─────────────────────────────────────────────────────────────────

export default function TenantList({ onSelect }) {
  const [allItems, setAllItems] = useState([])
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await tenantsApi.list()
      setAllItems(data.tenants || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Client-side search/status filter (tenant counts are small at this stage)
  useEffect(() => {
    let filtered = allItems
    if (statusFilter) filtered = filtered.filter((t) => t.status === statusFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      filtered = filtered.filter((t) =>
        t.business_name?.toLowerCase().includes(q) ||
        t.client_code?.toLowerCase().includes(q) ||
        t.contact_name?.toLowerCase().includes(q) ||
        t.email?.toLowerCase().includes(q)
      )
    }
    setItems(filtered)
  }, [allItems, search, statusFilter])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Tenants</h1>
          {!loading && (
            <p className="text-xs text-slate-400 mt-0.5">
              {allItems.length} total · {allItems.filter((t) => t.status === 'active').length} active
            </p>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Tenant
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="search" value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by business name, tenant code, contact, or email…"
          className="flex-1 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition bg-white">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Loading…</div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 text-red-500 text-sm">{error}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
            <svg className="w-10 h-10 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l8-4v18M13 21V11l6 4v6M9 9h.01M9 13h.01M9 17h.01" />
            </svg>
            <span className="text-sm">No tenants yet. Click "New Tenant" to onboard one.</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Business</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide hidden md:table-cell">Tenant Code</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide hidden sm:table-cell">Contact</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide hidden sm:table-cell">Created</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((t, i) => (
                <tr
                  key={t.id}
                  className={`border-b border-slate-100 hover:bg-indigo-50/40 cursor-pointer transition ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}
                  onClick={() => onSelect(t.id)}
                >
                  <td className="px-5 py-4">
                    <div className="font-medium text-slate-800">{t.business_name}</div>
                    {t.email && <div className="text-xs text-slate-400 mt-0.5">{t.email}</div>}
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{t.client_code}</span>
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <div className="text-xs text-slate-600">{t.contact_name || '—'}</div>
                    {t.phone && <div className="text-xs text-slate-400">{t.phone}</div>}
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <span className="text-xs text-slate-500">{t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}</span>
                  </td>
                  <td className="px-5 py-4"><Badge status={t.status} /></td>
                  <td className="px-5 py-4 text-right">
                    <svg className="w-4 h-4 text-slate-400 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <Modal title="Create New Tenant" onClose={() => setShowCreate(false)}>
          <CreateModal onClose={() => setShowCreate(false)} onCreated={load} />
        </Modal>
      )}
    </div>
  )
}
