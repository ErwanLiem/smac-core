import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Filter, X } from 'lucide-react'
import { get } from '../api/client'
import { getSiteId } from '../utils/permissions'

interface Ligne {
  id: number
  type: string
  entite: string
  entiteId: number | null
  sn: string | null
  label: string | null
  couleur: string
  commentaire: string | null
  createdAt: string
  intervenant: string | null
  login: string | null
}

interface Reponse {
  total: number
  page: number
  pageSize: number
  pages: number
  rows: Ligne[]
}

interface User { id: number; nom: string; prenom: string; login: string }

const LABELS_TYPE: Record<string, string> = {
  RECEPTION:        'Réception',
  MODIFICATION:     'Modification',
  SUPPRESSION:      'Suppression',
  TRANSITION_STATUT:'Transition statut',
  CREATION:         'Création',
  TRANSFERT:        'Transfert',
  EMBALLAGE:        'Emballage',
  MASTERBOX:        'Master Box',
  EXPEDITION:       'Expédition',
}

const LABELS_ENTITE: Record<string, string> = {
  inventaire: 'Inventaire',
  article:    'Article',
  client:     'Client',
  plateforme: 'Plateforme',
  statut:     'Statut',
}

export default function HistoriqueActivite() {
  const siteId = getSiteId()
  const [data, setData]           = useState<Reponse | null>(null)
  const [chargement, setChargement] = useState(true)
  const [page, setPage]           = useState(1)
  const [types, setTypes]         = useState<string[]>([])
  const [users, setUsers]         = useState<User[]>([])

  const [filtreType,   setFiltreType]   = useState('')
  const [filtreUser,   setFiltreUser]   = useState('')
  const [filtreDateDeb, setFiltreDateDeb] = useState('')
  const [filtreDateFin, setFiltreDateFin] = useState('')
  const [filtreEntite, setFiltreEntite] = useState('')

  useEffect(() => {
    document.querySelector('.main-content')?.classList.add('page-table')
    return () => { document.querySelector('.main-content')?.classList.remove('page-table') }
  }, [])

  useEffect(() => {
    get<string[]>(`/historique-activite/${siteId}/types`).then(setTypes).catch(() => {})
    get<User[]>(`/historique-activite/${siteId}/users`).then(setUsers).catch(() => {})
  }, [siteId])

  useEffect(() => { charger(page) }, [siteId, page, filtreType, filtreUser, filtreDateDeb, filtreDateFin, filtreEntite])

  async function charger(p: number) {
    setChargement(true)
    const params = new URLSearchParams({ page: String(p) })
    if (filtreType)    params.set('type',      filtreType)
    if (filtreUser)    params.set('userId',    filtreUser)
    if (filtreDateDeb) params.set('dateDebut', filtreDateDeb)
    if (filtreDateFin) params.set('dateFin',   filtreDateFin)
    if (filtreEntite)  params.set('entite',    filtreEntite)
    try {
      const r = await get<Reponse>(`/historique-activite/${siteId}?${params}`)
      setData(r)
    } catch {}
    setChargement(false)
  }

  function resetFiltres() {
    setFiltreType(''); setFiltreUser(''); setFiltreDateDeb(''); setFiltreDateFin(''); setFiltreEntite('')
    setPage(1)
  }

  function onFiltre() { setPage(1) }

  const hasFiltres = !!(filtreType || filtreUser || filtreDateDeb || filtreDateFin || filtreEntite)

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <h1 className="page-title">Historique d'activité</h1>
          <p className="page-subtitle">{data ? `${data.total} événement${data.total !== 1 ? 's' : ''}` : '…'}</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="card" style={{ marginBottom: '20px', padding: '14px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6b7280' }}>
            <Filter size={14} />
            <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filtres</span>
          </div>

          <select className="form-input" style={{ width: '160px', fontSize: '13px', padding: '6px 10px' }}
            value={filtreType} onChange={e => { setFiltreType(e.target.value); onFiltre() }}>
            <option value="">Tous les types</option>
            {types.map(t => <option key={t} value={t}>{LABELS_TYPE[t] ?? t}</option>)}
          </select>

          <select className="form-input" style={{ width: '160px', fontSize: '13px', padding: '6px 10px' }}
            value={filtreEntite} onChange={e => { setFiltreEntite(e.target.value); onFiltre() }}>
            <option value="">Toutes entités</option>
            {Object.entries(LABELS_ENTITE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>

          <select className="form-input" style={{ width: '180px', fontSize: '13px', padding: '6px 10px' }}
            value={filtreUser} onChange={e => { setFiltreUser(e.target.value); onFiltre() }}>
            <option value="">Tous les utilisateurs</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
          </select>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input type="date" className="form-input" style={{ fontSize: '13px', padding: '6px 10px', width: '140px' }}
              value={filtreDateDeb} onChange={e => { setFiltreDateDeb(e.target.value); onFiltre() }} />
            <span style={{ color: '#6b7280', fontSize: '12px' }}>→</span>
            <input type="date" className="form-input" style={{ fontSize: '13px', padding: '6px 10px', width: '140px' }}
              value={filtreDateFin} onChange={e => { setFiltreDateFin(e.target.value); onFiltre() }} />
          </div>

          {hasFiltres && (
            <button onClick={resetFiltres} style={{ background: 'none', border: '1px solid #374151', borderRadius: '6px', padding: '6px 10px', color: '#9ca3af', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <X size={12} /> Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Tableau */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {chargement ? (
          <div className="loading-container" style={{ minHeight: '300px' }}><div className="loading-spinner" /></div>
        ) : (
          <>
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '150px' }}>Date</th>
                  <th style={{ width: '130px' }}>Type</th>
                  <th style={{ width: '100px' }}>Entité</th>
                  <th style={{ width: '160px' }}>N° Série / ID</th>
                  <th>Événement</th>
                  <th style={{ width: '140px' }}>Intervenant</th>
                </tr>
              </thead>
              <tbody>
                {data?.rows.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontSize: '12px', color: '#6b7280', fontFamily: 'monospace' }}>{formatDate(l.createdAt)}</td>
                    <td>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#1f2937', color: '#9ca3af', border: '1px solid #374151', fontWeight: 500 }}>
                        {LABELS_TYPE[l.type] ?? l.type}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: '#6b7280' }}>{LABELS_ENTITE[l.entite] ?? l.entite}</td>
                    <td style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                      {l.sn
                        ? <span style={{ color: '#60a5fa', fontWeight: 500 }}>{l.sn}</span>
                        : <span style={{ color: '#4b5563' }}>#{l.entiteId ?? '—'}</span>
                      }
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {l.couleur && (
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.couleur, flexShrink: 0 }} />
                        )}
                        <span style={{ fontSize: '13px', color: '#f1f5f9' }}>{l.label ?? LABELS_TYPE[l.type] ?? l.type}</span>
                        {l.commentaire && <span style={{ fontSize: '12px', color: '#6b7280' }}>— {l.commentaire}</span>}
                      </div>
                    </td>
                    <td style={{ fontSize: '12px' }}>
                      {l.intervenant
                        ? <span style={{ color: '#f1f5f9' }}>{l.intervenant}</span>
                        : <span style={{ color: '#4b5563' }}>—</span>
                      }
                      {l.login && <span style={{ display: 'block', fontSize: '11px', color: '#4b5563' }}>{l.login}</span>}
                    </td>
                  </tr>
                ))}
                {data?.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: '#6b7280', padding: '48px' }}>
                      Aucun événement trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>

            {/* Pagination */}
            {data && data.pages > 1 && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid #1f2937', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>
                  Page {data.page} / {data.pages} — {data.total} résultat{data.total !== 1 ? 's' : ''}
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={data.page === 1}
                    className="btn btn-secondary"
                    style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <ChevronLeft size={14} /> Préc.
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                    disabled={data.page === data.pages}
                    className="btn btn-secondary"
                    style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    Suiv. <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
