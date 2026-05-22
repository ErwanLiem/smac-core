import { ClipboardList, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-subtitle">Bienvenue sur SMAC Vallery</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <Link to="/suivi" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ cursor: 'pointer', transition: 'box-shadow 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#dbeafe', padding: '10px', borderRadius: '8px' }}>
                <ClipboardList size={22} color="#2563eb" />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#111827' }}>Suivi articles</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>Gérer le workflow</div>
              </div>
            </div>
          </div>
        </Link>

        <Link to="/admin/workflow" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ cursor: 'pointer', transition: 'box-shadow 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#f3f4f6', padding: '10px', borderRadius: '8px' }}>
                <Settings size={22} color="#6b7280" />
              </div>
              <div>
                <div style={{ fontWeight: 600, color: '#111827' }}>Admin workflow</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>Configurer statuts & transitions</div>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
