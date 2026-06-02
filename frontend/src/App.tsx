import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AdminWorkflow from './pages/AdminWorkflow'
import AdminArticles from './pages/AdminArticles'
import AdminClients from './pages/AdminClients'
import AdminPlateformes from './pages/AdminPlateformes'
import AdminInventaire from './pages/AdminInventaire'
import AdminRoles from './pages/AdminRoles'
import AdminUtilisateurs from './pages/AdminUtilisateurs'
import Suivi from './pages/Suivi'
import Articles from './pages/Articles'
import Clients from './pages/Clients'
import Plateformes from './pages/Plateformes'
import Inventaire from './pages/Inventaire'
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
            <Route path="/admin/articles" element={<AdminArticles />} />
            <Route path="/admin/clients" element={<AdminClients />} />
            <Route path="/admin/plateformes" element={<AdminPlateformes />} />
            <Route path="/admin/inventaire" element={<AdminInventaire />} />
            <Route path="/articles" element={<Articles />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/plateformes" element={<Plateformes />} />
            <Route path="/inventaire" element={<Inventaire />} />
            <Route path="/admin/roles" element={<AdminRoles />} />
            <Route path="/admin/utilisateurs" element={<AdminUtilisateurs />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
