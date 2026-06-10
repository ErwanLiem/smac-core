import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AdminWorkflow from './pages/AdminWorkflow'
import AdminDonnees from './pages/AdminDonnees'
import AdminAcces from './pages/AdminAcces'
import Suivi from './pages/Suivi'
import Articles from './pages/Articles'
import Clients from './pages/Clients'
import Plateformes from './pages/Plateformes'
import Inventaire from './pages/Inventaire'
import Reception from './pages/Reception'
import Attendus from './pages/Attendus'
import AdminAttendus from './pages/AdminAttendus'
import AdminProduction from './pages/AdminProduction'
import Planning from './pages/Planning'
import Logistique from './pages/Logistique'
import SuiviPDA from './pages/SuiviPDA'
import SuiviPDALabo from './pages/SuiviPDALabo'
import Expeditions from './pages/Expeditions'
import AttendusDetail from './pages/AttendusDetail'
import Layout from './components/Layout'

function isConnecte() {
  return !!localStorage.getItem('token')
}

function RoutePrivee() {
  if (!isConnecte()) return <Navigate to="/login" replace />
  return <Outlet />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RoutePrivee />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/suivi" element={<Suivi />} />
            <Route path="/admin/workflow" element={<AdminWorkflow />} />
            <Route path="/admin/donnees" element={<AdminDonnees />} />
            <Route path="/articles" element={<Articles />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/plateformes" element={<Plateformes />} />
            <Route path="/inventaire" element={<Inventaire />} />
            <Route path="/reception" element={<Reception />} />
            <Route path="/attendus" element={<Attendus />} />
            <Route path="/admin/attendus" element={<AdminAttendus />} />
            <Route path="/admin/production" element={<AdminProduction />} />
            <Route path="/planning" element={<Planning />} />
            <Route path="/logistique" element={<Logistique />} />
            <Route path="/suivi-pda" element={<SuiviPDA />} />
            <Route path="/suivi-pda-labo" element={<SuiviPDALabo />} />
            <Route path="/expeditions" element={<Expeditions />} />
            <Route path="/attendus/:id" element={<AttendusDetail />} />
            <Route path="/admin/acces" element={<AdminAcces />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
