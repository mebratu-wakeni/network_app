import { useState } from 'react'
import { useAuth } from './hooks/useAuth.js'
import Login from './pages/Login.jsx'
import LicenseList from './pages/LicenseList.jsx'
import LicenseDetail from './pages/LicenseDetail.jsx'
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
      return <LicenseDetail licenseId={selectedId} onBack={() => setSelectedId(null)} />
    }
    return <LicenseList onSelect={(id) => { setSelectedId(id); setPage('list') }} />
  }

  return (
    <Layout admin={admin} onLogout={logout} onChangePassword={() => { setSelectedId(null); setPage('change-password') }}>
      {renderPage()}
    </Layout>
  )
}
