import { useState } from 'react'
import { auth as authApi } from '../api.js'

export default function ChangePassword({ onBack }) {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (form.new_password !== form.confirm) {
      setError('New passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await authApi.changePassword(form.current_password, form.new_password)
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition w-fit">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div>
        <h1 className="text-xl font-bold text-slate-800">Change Password</h1>
        <p className="text-sm text-slate-500 mt-1">Update your platform admin account password.</p>
      </div>

      {success ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Password changed successfully.
          </div>
          <p className="text-sm text-emerald-600">Your new password is active. You will use it on next login.</p>
          <button onClick={onBack} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg py-2.5 text-sm transition mt-1">
            Back to Dashboard
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Current password</label>
            <input
              type="password" autoFocus required
              value={form.current_password}
              onChange={e => set('current_password', e.target.value)}
              className="border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              placeholder="Your current password"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">New password</label>
            <input
              type="password" required minLength={8}
              value={form.new_password}
              onChange={e => set('new_password', e.target.value)}
              className="border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              placeholder="At least 8 characters"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Confirm new password</label>
            <input
              type="password" required
              value={form.confirm}
              onChange={e => set('confirm', e.target.value)}
              className="border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              placeholder="Repeat new password"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">{error}</div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition mt-1"
          >
            {loading ? 'Saving…' : 'Change Password'}
          </button>
        </form>
      )}
    </div>
  )
}
