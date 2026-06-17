import { getPermissions } from '../utils/permissions'
import { COLONNES_INVENTAIRE } from '../constants/colonnesInventaire'

export default function AdminInventaire({ embedded }: { embedded?: boolean } = {}) {
  const { isAdmin } = getPermissions()

  if (!isAdmin) return <div className="card" style={{ padding: '32px', color: '#9ca3af' }}>Accès refusé.</div>

  return (
    <div>
      {!embedded && (
        <div className="page-header">
          <div>
            <h1 className="page-title">Structure inventaire</h1>
            <p className="page-subtitle">Colonnes fixes de la base inventaire</p>
          </div>
        </div>
      )}

      <div className="card">
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
          La structure de l'inventaire est désormais fixe (colonnes définies dans le schéma de la base de données).
          Les colonnes ne sont plus configurables dynamiquement.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Colonne</th>
                <th>Label</th>
                <th>Type</th>
                <th style={{ textAlign: 'center' }}>Réception S/N</th>
                <th style={{ textAlign: 'center' }}>Réception QTE</th>
              </tr>
            </thead>
            <tbody>
              {COLONNES_INVENTAIRE.map(c => (
                <tr key={c.key}>
                  <td><code style={{ fontSize: '12px', background: '#1e3a5f', padding: '2px 6px', borderRadius: '4px', color: '#60a5fa' }}>{c.key}</code></td>
                  <td style={{ fontWeight: 500 }}>{c.label}</td>
                  <td><span style={{ fontSize: '12px', color: '#6b7280' }}>{c.type === 'date' ? 'Date' : 'Texte'}</span></td>
                  <td style={{ textAlign: 'center' }}>{c.receptionSN ? <span className="badge badge-success">✓</span> : <span style={{ color: '#d1d5db' }}>—</span>}</td>
                  <td style={{ textAlign: 'center' }}>{c.receptionQTE ? <span className="badge badge-success">✓</span> : <span style={{ color: '#d1d5db' }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
