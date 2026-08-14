export default function Layout({ admin, onLogout, onChangePassword, children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l8-4v18M13 21V11l6 4v6M9 9h.01M9 13h.01M9 17h.01" />
              </svg>
            </div>
            <span className="font-semibold text-slate-800 text-sm">MasaTech Admin</span>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="text-xs text-slate-400 hidden sm:inline">masatechplc.com</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 hidden sm:inline">{admin?.display_name || admin?.username}</span>
            <button
              onClick={onChangePassword}
              className="text-xs text-slate-500 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg transition"
              title="Change password"
            >
              Change password
            </button>
            <button
              onClick={onLogout}
              className="text-xs text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  )
}
