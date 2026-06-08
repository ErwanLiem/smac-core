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
  AlertTriangle,
  Truck,
} from 'lucide-react'
import type { Utilisateur } from '../types'

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [expandedSection, setExpandedSection] = useState<string | null>('ACCUEIL')

  const utilisateur: Utilisateur | null = JSON.parse(localStorage.getItem('utilisateur') || 'null')
  const permissions: string[] = utilisateur?.permissions ?? []
  const isAdmin = utilisateur?.role?.code === 'ADMIN'

  function peutVoir(path: string) {
    return isAdmin || permissions.includes(`${path}:view`)
  }

  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('utilisateur')
    navigate('/login')
  }

  function toggleSection(section: string) {
    setExpandedSection(prev => prev === section ? null : section)
  }

  const menuSections = [
    {
      title: 'ACCUEIL',
      items: [
        { name: 'Tableau de bord', path: '/', icon: LayoutDashboard },
      ],
    },
    {
      title: 'CATALOGUE',
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
        { name: 'Planning', path: '/planning', icon: ClipboardList },
        { name: 'Inventaire labo', path: '/inventaire-labo', icon: Package },
      ],
    },
    {
      title: 'LOGISTIQUE',
      items: [
        { name: 'Attendus', path: '/attendus', icon: ClipboardList },
        { name: 'Réception', path: '/reception', icon: Package },
        { name: 'Inventaire', path: '/inventaire', icon: Warehouse },
        { name: 'Attente transfert', path: '/logistique', icon: Truck },
      ],
    },
    {
      title: 'CONFIGURATION',
      items: [
        { name: 'Config. articles', path: '/admin/articles', icon: Database },
        { name: 'Config. clients', path: '/admin/clients', icon: Users },
        { name: 'Config. plateformes', path: '/admin/plateformes', icon: Building2 },
        { name: 'Config. inventaire', path: '/admin/inventaire', icon: Database },
        { name: 'Config. Attendus', path: '/admin/attendus', icon: Settings },
        { name: 'Config. règles alerte', path: '/admin/regles-alerte', icon: AlertTriangle },
        { name: 'Config. production', path: '/admin/production', icon: Settings },
        { name: 'Config. workflow', path: '/admin/workflow', icon: Settings },
        { name: 'Config. rôles', path: '/admin/roles', icon: Settings },
        { name: 'Config. utilisateurs', path: '/admin/utilisateurs', icon: Users },
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
          const isExpanded = expandedSection === section.title
          const hasActiveItem = section.items.some(item => location.pathname === item.path)
          const isSectionHighlighted = isExpanded || hasActiveItem
          return (
            <div key={section.title} className={`sidebar-section ${isExpanded ? '' : 'collapsed'} ${isSectionHighlighted ? 'has-active' : ''}`}>
              <button onClick={() => toggleSection(section.title)} className="sidebar-section-header" style={isSectionHighlighted ? { color: '#2563eb', fontWeight: 600 } : {}}>
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
