import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ClipboardList,
  Settings,
  ChevronDown,
  LogOut,
  Warehouse,
  Database,
  Users,
  Building2,
  Package,
} from 'lucide-react'
import type { Utilisateur } from '../types'

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [expandedSections, setExpandedSections] = useState<string[]>(['ACCUEIL', 'PRODUCTION'])

  const utilisateur: Utilisateur | null = JSON.parse(localStorage.getItem('utilisateur') || 'null')
  const permissions: string[] = utilisateur?.permissions ?? []
  const isAdmin = utilisateur?.role?.code === 'ADMIN'

  function peutVoir(path: string) {
    return isAdmin || permissions.includes(path)
  }

  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('utilisateur')
    navigate('/login')
  }

  function toggleSection(section: string) {
    setExpandedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    )
  }

  const menuSections = [
    {
      title: 'ACCUEIL',
      items: [
        { name: 'Tableau de bord', path: '/', icon: LayoutDashboard },
      ],
    },
    {
      title: 'BASE DE DONNÉES',
      items: [
        { name: 'Articles', path: '/articles', icon: Package },
        { name: 'Clients', path: '/clients', icon: Users },
        { name: 'Plateformes', path: '/plateformes', icon: Building2 },
      ],
    },
    {
      title: 'PRODUCTION',
      items: [
        { name: 'Suivi', path: '/suivi', icon: ClipboardList },
      ],
    },
    {
      title: 'CONFIGURATION',
      items: [
        { name: 'Articles', path: '/admin/articles', icon: Database },
        { name: 'Clients', path: '/admin/clients', icon: Users },
        { name: 'Plateformes', path: '/admin/plateformes', icon: Building2 },
        { name: 'Workflow', path: '/admin/workflow', icon: Settings },
        { name: 'Rôles', path: '/admin/roles', icon: Settings },
        { name: 'Utilisateurs', path: '/admin/utilisateurs', icon: Users },
      ],
    },
  ].map(section => ({
    ...section,
    items: section.items.filter(item => peutVoir(item.path))
  })).filter(section => section.items.length > 0)

  return (
    <div className="sidebar">
      {/* Logo */}
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '36px', height: '36px', background: '#2563eb', borderRadius: '8px'
          }}>
            <Warehouse size={20} color="white" />
          </div>
          <div>
            <div className="sidebar-logo">SMAC</div>
            <div className="sidebar-subtitle">{utilisateur?.site?.nom ?? 'Gestion industrielle'}</div>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="sidebar-nav">
        {menuSections.map((section) => {
          const isExpanded = expandedSections.includes(section.title)
          return (
            <div key={section.title} className={`sidebar-section ${isExpanded ? '' : 'collapsed'}`}>
              <button onClick={() => toggleSection(section.title)} className="sidebar-section-header">
                <span>{section.title}</span>
                <ChevronDown className="sidebar-section-icon" size={16} />
              </button>
              <div className="sidebar-section-items">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.path
                  const Icon = item.icon
                  return (
                    <Link key={item.path} to={item.path} className={`sidebar-link ${isActive ? 'active' : ''}`}>
                      <Icon className="sidebar-link-icon" size={18} />
                      <span>{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Utilisateur */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-name">
            {utilisateur ? `${utilisateur.prenom} ${utilisateur.nom}` : 'Administrateur'}
          </div>
          <div className="sidebar-user-role">{utilisateur?.role?.label ?? ''}</div>
        </div>
        <button onClick={handleLogout} className="sidebar-logout-btn">
          <LogOut size={16} />
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
