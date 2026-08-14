import { useState } from 'react'
import { useAuth } from './hooks/useAuth.js'
import Login from './pages/Login.jsx'
import TenantList from './pages/TenantList.jsx'
import TenantDetail from './pages/TenantDetail.jsx'
import ChangePassword from './pages/ChangePassword.jsx'
import Layout from './components/Layout.jsx'

export default function App() {
  const { admin, isLoggedIn, login, logout } = useAuth()
  const [selectedId, setSelectedId] = useState(null)
  const [page, setPage] = useState('list')   // 'list' | 'change-password'

  if (!isLoggedIn) {
    return <Login onLogin={login} />
  }

  function renderPage() {
    if (page === 'change-password') {
      return <ChangePassword onBack={() => setPage('list')} />
    }
    if (selectedId) {
      return <TenantDetail tenantId={selectedId} onBack={() => setSelectedId(null)} />
    }
    return <TenantList onSelect={(id) => { setSelectedId(id); setPage('list') }} />
  }

  return (
    <Layout admin={admin} onLogout={logout} onChangePassword={() => { setSelectedId(null); setPage('change-password') }}>
      {renderPage()}
    </Layout>
  )
}
