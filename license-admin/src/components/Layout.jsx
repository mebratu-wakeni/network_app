export default function Layout({ admin, onLogout, onChangePassword, children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <span className="font-semibold text-slate-800 text-sm">License Admin</span>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="text-xs text-slate-400 hidden sm:inline">mltplc.com</span>
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
