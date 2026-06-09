import { ClipboardList, Settings, Database } from 'lucide-react'
import { Link } from 'react-router-dom'

const cards = [
  { to: '/suivi', icon: ClipboardList, color: '#2563eb', bg: '#dbeafe', label: 'Suivi articles', sub: 'Gérer le workflow' },
  { to: '/admin/donnees', icon: Database, color: '#0891b2', bg: '#cffafe', label: 'Données', sub: 'Configurer les champs' },
  { to: '/admin/workflow', icon: Settings, color: '#6b7280', bg: '#f3f4f6', label: 'Admin workflow', sub: 'Statuts & transitions' },
]

export default function Dashboard() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-subtitle">Bienvenue sur SMAC Vallery</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
        {cards.map(({ to, icon: Icon, color, bg, label, sub }) => (
          <Link key={to} to={to} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', transition: 'box-shadow 0.15s, border-color 0.15s', marginBottom: 0 }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.07)'; e.currentTarget.style.borderColor = '#d1d5db' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ background: bg, padding: '10px', borderRadius: '8px', flexShrink: 0 }}>
                  <Icon size={20} color={color} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '14px' }}>{label}</div>
                  <div style={{ fontSize: '13px', color: '#9ca3af', marginTop: '2px' }}>{sub}</div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
