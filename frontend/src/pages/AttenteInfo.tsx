import Tabs from '../components/Tabs'

const ONGLETS = [
  { key: 'ASP', label: 'ASP — Pièce',      couleur: '#f59e0b' },
  { key: 'ASW', label: 'ASW — Firmware',   couleur: '#8b5cf6' },
  { key: 'ENG', label: 'ENG — Technique',  couleur: '#3b82f6' },
  { key: 'NLV', label: 'NLV — Non répar.', couleur: '#ef4444' },
  { key: 'PRV', label: 'PRV — Devis',      couleur: '#10b981' },
]

function PanneauAttente({ code, couleur }: { code: string; couleur: string }) {
  return (
    <div className="card" style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
      <div style={{ fontSize: '28px', fontWeight: 700, color: couleur, marginBottom: '8px' }}>{code}</div>
      Module en cours de développement.
    </div>
  )
}

export default function AttenteInfo() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attente info</h1>
          <p className="page-subtitle">Machines en attente de retour d'information</p>
        </div>
      </div>

      <Tabs tabs={ONGLETS.map(o => ({
        key: o.key,
        label: o.label,
        content: <PanneauAttente code={o.key} couleur={o.couleur} />
      }))} />
    </div>
  )
}
