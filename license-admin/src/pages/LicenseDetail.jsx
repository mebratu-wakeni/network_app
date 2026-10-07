import { useState, useEffect } from 'react'
import { licenses as licensesApi } from '../api.js'
import Badge from '../components/Badge.jsx'

const SUB_LABELS = { monthly: 'Monthly', yearly: 'Yearly', lifetime: 'Lifetime' }

function today() { return new Date().toISOString().slice(0, 10) }

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date(today())) / 86400000)
}

function ExpiryInfo({ subscriptionType, startDate, expiresAt }) {
  if (subscriptionType === 'lifetime') {
    return (
      <div className="flex items-center gap-2 text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 text-sm">
        <span className="text-lg">∞</span>
        <div>
          <div className="font-semibold">Lifetime license</div>
          <div className="text-xs text-indigo-500">No expiry date · valid forever</div>
        </div>
      </div>
    )
  }

  const days = daysUntil(expiresAt)
  const expired = days !== null && days < 0

  return (
    <div className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm border ${
      expired
        ? 'bg-red-50 border-red-200 text-red-800'
        : days <= 14
        ? 'bg-amber-50 border-amber-200 text-amber-800'
        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
    }`}>
      <div className="mt-0.5 text-base">{expired ? '✕' : '⏱'}</div>
      <div>
        <div className="font-semibold">
          {expired
            ? `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`
            : `Expires in ${days} day${days === 1 ? '' : 's'}`}
        </div>
        <div className="text-xs opacity-70 mt-0.5">
          Start: {startDate} · Expires: {expiresAt}
        </div>
      </div>
    </div>
  )
}

function DeviceCard({ activation }) {
  const lastSeen = activation.last_seen_at
    ? new Date(activation.last_seen_at).toLocaleString()
    : '—'
  const activatedAt = activation.activated_at
    ? new Date(activation.activated_at).toLocaleString()
    : '—'

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-4 border-b border-slate-100 last:border-b-0 ${!activation.is_active ? 'opacity-45' : ''}`}>
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
        <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-slate-800 text-sm">
            {activation.device_name || 'Unknown machine'}
          </span>
          {activation.is_active
            ? <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full ring-1 ring-emerald-200 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"/>Active</span>
            : <span className="text-xs bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-medium">Inactive</span>
          }
        </div>
        {activation.company_name && (
          <div className="text-xs text-slate-500 mt-0.5">{activation.company_name}{activation.company_phone ? ` · ${activation.company_phone}` : ''}</div>
        )}
        <div className="text-xs text-slate-400 font-mono mt-0.5 truncate">{activation.device_fingerprint}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-xs text-slate-500">Activated: {activatedAt}</div>
        <div className="text-xs text-slate-400">Last seen: {lastSeen}</div>
      </div>
    </div>
  )
}

export default function LicenseDetail({ licenseId, onBack }) {
  const [license, setLicense] = useState(null)
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
      const data = await licensesApi.get(licenseId)
      setLicense(data.license)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [licenseId])

  async function doAction(fn, confirmMsg) {
    if (confirmMsg && !confirm(confirmMsg)) return
    setActionLoading(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      const result = await fn()
      setActionSuccess(result.message || 'Done.')
      await load()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  function copyKey() {
    navigator.clipboard.writeText(license.license_key)
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

  const activations = license?.activations || []
  const currentActivation = activations.find(a => a.is_active)

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
            <h1 className="text-xl font-bold text-slate-800">{license.customer_name}</h1>
            <Badge status={license.status} />
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
              {SUB_LABELS[license.subscription_type]}
            </span>
          </div>
          {license.email && <p className="text-sm text-slate-500">{license.email}</p>}

          {/* Key */}
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-base font-bold text-indigo-700 tracking-wider">{license.license_key}</span>
            <button onClick={copyKey} className="text-slate-400 hover:text-indigo-600 transition" title="Copy key">
              {copied
                ? <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              }
            </button>
          </div>

          <div className="text-xs text-slate-400">Created {license.created_at ? new Date(license.created_at).toLocaleDateString() : '—'}</div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 min-w-[150px]">
          {license.status === 'active' ? (
            <button
              onClick={() => doAction(() => licensesApi.revoke(licenseId), `Revoke license for "${license.customer_name}"?\nThe software will stop working on their machine.`)}
              disabled={actionLoading}
              className="flex items-center justify-center gap-1.5 border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 font-semibold text-sm px-4 py-2 rounded-lg transition"
            >
              Revoke License
            </button>
          ) : (
            <button
              onClick={() => doAction(() => licensesApi.reactivate(licenseId))}
              disabled={actionLoading}
              className="flex items-center justify-center gap-1.5 border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 font-semibold text-sm px-4 py-2 rounded-lg transition"
            >
              Reactivate License
            </button>
          )}

          {currentActivation && (
            <button
              onClick={() => doAction(
                () => licensesApi.resetActivation(licenseId),
                `Reset activation for "${license.customer_name}"?\n\nThis will deactivate their current machine so they can activate on a new one.`
              )}
              disabled={actionLoading}
              className="flex items-center justify-center gap-1.5 border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50 font-semibold text-sm px-4 py-2 rounded-lg transition"
            >
              Reset Activation
            </button>
          )}
        </div>
      </div>

      {actionError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{actionError}</div>}
      {actionSuccess && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">{actionSuccess}</div>}

      {/* Expiry info */}
      <ExpiryInfo
        subscriptionType={license.subscription_type}
        startDate={license.start_date}
        expiresAt={license.expires_at}
      />

      {/* Notes */}
      {license.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Notes: </span>{license.notes}
        </div>
      )}

      {/* Installation history */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-700 text-sm">
              Installation History
              <span className="ml-2 text-slate-400 font-normal">({activations.length})</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {currentActivation
                ? `Currently active on: ${currentActivation.device_name || currentActivation.device_fingerprint.slice(0, 16) + '…'}`
                : 'Not installed on any machine yet'}
            </p>
          </div>
        </div>

        {activations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
            <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-sm">Not installed yet — send the license key to your customer.</span>
          </div>
        ) : (
          activations.map(act => <DeviceCard key={act.id} activation={act} />)
        )}
      </div>
    </div>
  )
}
