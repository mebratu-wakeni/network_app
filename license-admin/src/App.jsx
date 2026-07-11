import { useState } from 'react'
import { useAuth } from './hooks/useAuth.js'
import Login from './pages/Login.jsx'
import LicenseList from './pages/LicenseList.jsx'
import LicenseDetail from './pages/LicenseDetail.jsx'
import Layout from './components/Layout.jsx'

export default function App() {
  const { admin, isLoggedIn, login, logout } = useAuth()
  const [selectedId, setSelectedId] = useState(null)

  if (!isLoggedIn) {
    return <Login onLogin={login} />
  }

  return (
    <Layout admin={admin} onLogout={logout}>
      {selectedId ? (
        <LicenseDetail
          licenseId={selectedId}
          onBack={() => setSelectedId(null)}
        />
      ) : (
        <LicenseList onSelect={setSelectedId} />
      )}
    </Layout>
  )
}
