import { useEffect, useState } from 'react'
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
  Truck,
  PackageCheck,
  Wrench,
  History,
} from 'lucide-react'
import type { Utilisateur } from '../types'
import { get } from '../api/client'
import { getSiteId } from '../utils/permissions'

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [expandedSection, setExpandedSection] = useState<string | null>('ACCUEIL')
  const [transfertsEnAttente, setTransfertsEnAttente] = useState(0)

  const utilisateur: Utilisateur | null = JSON.parse(localStorage.getItem('utilisateur') || 'null')
  const permissions: string[] = utilisateur?.permissions ?? []
  const isAdmin = utilisateur?.role?.code === 'ADMIN'

  function peutVoir(path: string) {
    return isAdmin || permissions.includes(`${path}:view`)
  }

  useEffect(() => {
    if (!peutVoir('/logistique')) return

    function refreshTransferts() {
      get<{ id: number }[]>(`/production/demandes/${getSiteId()}?statut=EN_ATTENTE`)
        .then(demandes => setTransfertsEnAttente(demandes.length))
        .catch(() => {})
    }

    refreshTransferts()
    window.addEventListener('transferts-en-attente:changed', refreshTransferts)
    const interval = setInterval(refreshTransferts, 15000)
    return () => {
      window.removeEventListener('transferts-en-attente:changed', refreshTransferts)
      clearInterval(interval)
    }
  }, [location.pathname])

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
        { name: 'Réparation', path: '/reparation', icon: Wrench },
        { name: 'MAJ / Injection', path: '/maj-injection', icon: ClipboardList },
        { name: 'Contrôle qualité', path: '/controle-qualite', icon: ClipboardList },
        { name: 'Attente info', path: '/attente-info', icon: ClipboardList },
        { name: 'Planning', path: '/planning', icon: ClipboardList },
        { name: 'Suivi PDA Labo', path: '/suivi-pda-labo', icon: Package },
      ],
    },
    {
      title: 'LOGISTIQUE',
      items: [
        { name: 'Réceptions prévues', path: '/attendus', icon: ClipboardList },
        { name: 'Réception', path: '/reception', icon: Package },
        { name: 'Inventaire', path: '/inventaire', icon: Warehouse },
        { name: 'Transfert', path: '/logistique', icon: Truck },
        { name: 'Suivi PDA', path: '/suivi-pda', icon: Package },
        { name: 'Expéditions', path: '/expeditions', icon: PackageCheck },
        { name: 'Emplacements', path: '/emplacements', icon: Warehouse },
      ],
    },
    {
      title: 'ADMINISTRATION',
      items: [
        { name: 'Historique activité', path: '/admin/historique-activite', icon: History },
      ],
    },
    {
      title: 'CONFIGURATION',
      items: [
        { name: 'Données', path: '/admin/donnees', icon: Database },
        { name: 'Workflow', path: '/admin/workflow', icon: Settings },
        { name: 'Production', path: '/admin/production', icon: Truck },
        { name: 'Réceptions prévues', path: '/admin/attendus', icon: ClipboardList },
        { name: 'Société', path: '/admin/config-site', icon: Building2 },
        { name: 'Accès', path: '/admin/acces', icon: Users },
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
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {section.title === 'LOGISTIQUE' && transfertsEnAttente > 0 && (
                    <span className="sidebar-link-badge">{transfertsEnAttente}</span>
                  )}
                  <ChevronDown className="sidebar-section-icon" size={16} />
                </span>
              </button>
              <div className="sidebar-section-items">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.path
                  const Icon = item.icon
                  return (
                    <Link key={item.path} to={item.path} className={`sidebar-link ${isActive ? 'active' : ''}`}>
                      <Icon className="sidebar-link-icon" size={18} />
                      <span>{item.name}</span>
                      {item.path === '/logistique' && transfertsEnAttente > 0 && (
                        <span className="sidebar-link-badge">{transfertsEnAttente}</span>
                      )}
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
