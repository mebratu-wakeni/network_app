import { useState, useEffect, useCallback } from 'react'
import { licenses as licensesApi } from '../api.js'
import Badge from '../components/Badge.jsx'
import Modal from '../components/Modal.jsx'

// ── Helpers ──────────────────────────────────────────────────────────────────

const SUB_LABELS = { monthly: 'Monthly', yearly: 'Yearly', lifetime: 'Lifetime' }

function today() { return new Date().toISOString().slice(0, 10) }

function ExpiryBadge({ subscriptionType, expiresAt }) {
  if (subscriptionType === 'lifetime') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200">
        ∞ Lifetime
      </span>
    )
  }
  if (!expiresAt) return <span className="text-xs text-slate-400">—</span>

  const now = today()
  if (expiresAt < now) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 ring-1 ring-red-200">
        ✕ Expired
      </span>
    )
  }

  const daysLeft = Math.ceil((new Date(expiresAt) - new Date(now)) / 86400000)
  const urgent = daysLeft <= 14
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${
      urgent
        ? 'bg-amber-100 text-amber-700 ring-amber-200'
        : 'bg-emerald-100 text-emerald-700 ring-emerald-200'
    }`}>
      {urgent ? '⚠ ' : ''}{daysLeft}d left
    </span>
  )
}

function ActivationBadge({ active }) {
  if (active === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 ring-1 ring-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
        Not installed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
      Installed
    </span>
  )
}

// ── Create modal ─────────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    customer_name: '',
    email: '',
    subscription_type: 'lifetime',
    start_date: today(),
    notes: ''
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
      const data = await licensesApi.create(form)
      setCreated(data.license)
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
          <span className="font-medium text-sm">License created successfully</span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">License Key — send this to your customer</span>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
            <span className="flex-1 font-mono text-lg font-bold text-indigo-700 tracking-wider select-all">
              {created.license_key}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(created.license_key)}
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
          <div><span className="font-medium">Customer:</span> {created.customer_name}</div>
          <div><span className="font-medium">Plan:</span> {SUB_LABELS[created.subscription_type]}</div>
          {created.expires_at
            ? <div><span className="font-medium">Expires:</span> {created.expires_at}</div>
            : <div><span className="font-medium">Expires:</span> Never (lifetime)</div>}
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
        <label className="text-sm font-medium text-slate-700">Customer name <span className="text-red-500">*</span></label>
        <input
          autoFocus type="text" value={form.customer_name} required
          onChange={(e) => set('customer_name', e.target.value)}
          className="border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          placeholder="e.g. ABC Wholesale Pharmacy"
        />
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

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Subscription type <span className="text-red-500">*</span></label>
          <select
            value={form.subscription_type}
            onChange={(e) => set('subscription_type', e.target.value)}
            className="border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition bg-white"
          >
            <option value="lifetime">Lifetime</option>
            <option value="yearly">Yearly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Start date</label>
          <input
            type="date" value={form.start_date}
            onChange={(e) => set('start_date', e.target.value)}
            className="border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>
      </div>

      {form.subscription_type !== 'lifetime' && (
        <div className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          Expiry will be automatically set to{' '}
          <span className="font-semibold text-blue-700">
            {form.subscription_type === 'monthly' ? '1 month' : '1 year'}
          </span>{' '}
          from the start date ({form.start_date}).
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-slate-700">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={2}
          className="border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
          placeholder="Internal notes…"
        />
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">{error}</div>}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg py-2.5 text-sm transition">
          Cancel
        </button>
        <button type="submit" disabled={loading || !form.customer_name}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 text-sm transition">
          {loading ? 'Creating…' : 'Create License'}
        </button>
      </div>
    </form>
  )
}

// ── Main list ─────────────────────────────────────────────────────────────────

export default function LicenseList({ onSelect }) {
  const [allItems, setAllItems] = useState([])
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [activationFilter, setActivationFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await licensesApi.list({ search, status: statusFilter })
      setAllItems(data.licenses || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  // Client-side activation filter (avoids extra round-trip)
  useEffect(() => {
    if (!activationFilter) { setItems(allItems); return }
    setItems(allItems.filter(l =>
      activationFilter === 'installed'
        ? (l.active_devices ?? 0) > 0
        : (l.active_devices ?? 0) === 0
    ))
  }, [allItems, activationFilter])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Licenses</h1>
          {!loading && (
            <p className="text-xs text-slate-400 mt-0.5">
              {allItems.length} total · {allItems.filter(l => (l.active_devices ?? 0) > 0).length} installed
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
          New License
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="search" value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or key…"
          className="flex-1 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
        />
        <select value={activationFilter} onChange={(e) => setActivationFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition bg-white">
          <option value="">All installations</option>
          <option value="installed">Installed (in use)</option>
          <option value="not_installed">Not installed yet</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition bg-white">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="revoked">Revoked</option>
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <span className="text-sm">No licenses yet. Click "New License" to create one.</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Customer</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide hidden md:table-cell">License Key</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide hidden sm:table-cell">Plan / Expiry</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide hidden sm:table-cell">Installation</th>
                <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((lic, i) => (
                <tr
                  key={lic.id}
                  className={`border-b border-slate-100 hover:bg-indigo-50/40 cursor-pointer transition ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}
                  onClick={() => onSelect(lic.id)}
                >
                  <td className="px-5 py-4">
                    <div className="font-medium text-slate-800">{lic.customer_name}</div>
                    {lic.email && <div className="text-xs text-slate-400 mt-0.5">{lic.email}</div>}
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{lic.license_key}</span>
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-slate-600 font-medium">{SUB_LABELS[lic.subscription_type] || lic.subscription_type}</span>
                      <ExpiryBadge subscriptionType={lic.subscription_type} expiresAt={lic.expires_at} />
                    </div>
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <ActivationBadge active={lic.active_devices ?? 0} />
                  </td>
                  <td className="px-5 py-4"><Badge status={lic.status} /></td>
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
        <Modal title="Create New License" onClose={() => setShowCreate(false)}>
          <CreateModal onClose={() => setShowCreate(false)} onCreated={load} />
        </Modal>
      )}
    </div>
  )
}
