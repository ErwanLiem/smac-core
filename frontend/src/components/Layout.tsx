import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import ChangerMdpModal from './ChangerMdpModal'

function doitChangerMdp(): boolean {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return false
  return JSON.parse(raw)?.doitChangerMdp === true
}

export default function Layout() {
  const [forcerChangement, setForcerChangement] = useState(doitChangerMdp())

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
      {forcerChangement && (
        <ChangerMdpModal onSuccess={() => setForcerChangement(false)} />
      )}
    </div>
  )
}
