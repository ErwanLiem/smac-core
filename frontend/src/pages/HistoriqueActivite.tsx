import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { get } from '../api/client'
import { getSiteId } from '../utils/permissions'

interface Ligne {
  id: number
  type: string
  entite: string
  entiteId: number | null
  sn: string | null
  rma: string | null
  label: string | null
  couleur: string
  commentaire: string | null
  createdAt: string
  intervenant: string | null
  login: string | null
  resultat: 'OK' | 'NOK' | null
}

interface Reponse {
  total: number
  page: number
  pageSize: number
  pages: number
  rows: Ligne[]
}

const LABELS_TYPE: Record<string, string> = {
  RECEPTION:         'Réception',
  MODIFICATION:      'Modification',
  SUPPRESSION:       'Suppression',
  TRANSITION_STATUT: 'Transition statut',
  CREATION:          'Création',
  TRANSFERT:         'Transfert',
  EMBALLAGE:         'Emballage',
  MASTERBOX:         'Master Box',
  EXPEDITION:        'Expédition',
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
  const [data, setData]             = useState<Reponse | null>(null)
  const [chargement, setChargement] = useState(true)
  const [page, setPage]             = useState(1)

  const [filtreType,        setFiltreType]        = useState('')
  const [filtreIntervenant, setFiltreIntervenant] = useState('')
  const [filtreDateDeb,     setFiltreDateDeb]     = useState('')
  const [filtreDateFin,     setFiltreDateFin]     = useState('')
  const [filtreEntite,      setFiltreEntite]      = useState('')
  const [filtreResultat,    setFiltreResultat]    = useState('')
  const [filtreSN,          setFiltreSN]          = useState('')
  const [filtreRMA,         setFiltreRMA]         = useState('')

  useEffect(() => {
    document.querySelector('.main-content')?.classList.add('page-table')
    return () => { document.querySelector('.main-content')?.classList.remove('page-table') }
  }, [])

  useEffect(() => { charger(page) }, [siteId, page, filtreType, filtreIntervenant, filtreDateDeb, filtreDateFin, filtreEntite, filtreSN, filtreRMA])

  async function charger(p: number) {
    setChargement(true)
    const params = new URLSearchParams({ page: String(p) })
    if (filtreType)        params.set('type',        filtreType)
    if (filtreIntervenant) params.set('intervenant', filtreIntervenant)
    if (filtreDateDeb)     params.set('dateDebut',   filtreDateDeb)
    if (filtreDateFin)     params.set('dateFin',     filtreDateFin)
    if (filtreEntite)      params.set('entite',      filtreEntite)
    if (filtreSN)          params.set('sn',          filtreSN)
    if (filtreRMA)         params.set('rma',         filtreRMA)
    try {
      const r = await get<Reponse>(`/historique-activite/${siteId}?${params}`)
      setData(r)
    } catch {}
    setChargement(false)
  }

  function resetFiltres() {
    setFiltreType(''); setFiltreIntervenant(''); setFiltreDateDeb(''); setFiltreDateFin('')
    setFiltreEntite(''); setFiltreResultat(''); setFiltreSN(''); setFiltreRMA(''); setPage(1)
  }

  function onFiltre() { setPage(1) }

  const hasFiltres = !!(filtreType || filtreIntervenant || filtreDateDeb || filtreDateFin || filtreEntite || filtreResultat || filtreSN || filtreRMA)

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const rowsFiltrees = (data?.rows ?? []).filter(l =>
    !filtreResultat || (l.resultat ?? '').includes(filtreResultat)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <h1 className="page-title">Historique d'activité</h1>
          <p className="page-subtitle">
            {data ? `${data.total} événement${data.total !== 1 ? 's' : ''}` : '…'}
            {hasFiltres && ' (filtré)'}
          </p>
        </div>
        {hasFiltres && (
          <button onClick={resetFiltres} className="btn btn-secondary" style={{ fontSize: '12px' }}>
            <X size={12} /> Effacer filtres
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {chargement ? (
          <div className="loading-container" style={{ flex: 1 }}><div className="loading-spinner" /></div>
        ) : (
          <>
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
              <table className="table" style={{ minWidth: 'max-content' }}>
                <thead>
                  <tr>
                    <th style={{ width: '140px' }}>Date</th>
                    <th style={{ width: '140px' }}>Type</th>
                    <th style={{ width: '90px'  }}>Entité</th>
                    <th style={{ width: '130px' }}>N° Série</th>
                    <th style={{ width: '100px' }}>RMA</th>
                    <th>Événement</th>
                    <th style={{ width: '75px'  }}>Résultat</th>
                    <th style={{ width: '150px' }}>Intervenant</th>
                  </tr>
                  <tr className="table-filter-row">
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '10px', color: '#6b7280', width: '16px', flexShrink: 0 }}>Du</span>
                          <input type="date" className="form-input" style={{ padding: '3px 4px', fontSize: '11px', flex: 1 }} value={filtreDateDeb} onChange={e => { setFiltreDateDeb(e.target.value); onFiltre() }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '10px', color: '#6b7280', width: '16px', flexShrink: 0 }}>Au</span>
                          <input type="date" className="form-input" style={{ padding: '3px 4px', fontSize: '11px', flex: 1 }} value={filtreDateFin} onChange={e => { setFiltreDateFin(e.target.value); onFiltre() }} />
                        </div>
                      </div>
                    </td>
                    <td><input className="form-input" style={{ padding: '3px 6px', fontSize: '12px', width: '100%' }} placeholder="Filtrer…" value={filtreType}        onChange={e => { setFiltreType(e.target.value); onFiltre() }} /></td>
                    <td><input className="form-input" style={{ padding: '3px 6px', fontSize: '12px', width: '100%' }} placeholder="Filtrer…" value={filtreEntite}      onChange={e => { setFiltreEntite(e.target.value); onFiltre() }} /></td>
                    <td><input className="form-input" style={{ padding: '3px 6px', fontSize: '12px', width: '100%' }} placeholder="Filtrer…" value={filtreSN}          onChange={e => { setFiltreSN(e.target.value); onFiltre() }} /></td>
                    <td><input className="form-input" style={{ padding: '3px 6px', fontSize: '12px', width: '100%' }} placeholder="Filtrer…" value={filtreRMA}         onChange={e => { setFiltreRMA(e.target.value); onFiltre() }} /></td>
                    <td />
                    <td><input className="form-input" style={{ padding: '3px 6px', fontSize: '12px', width: '100%' }} placeholder="Filtrer…" value={filtreResultat} onChange={e => setFiltreResultat(e.target.value.toUpperCase())} /></td>
                    <td><input className="form-input" style={{ padding: '3px 6px', fontSize: '12px', width: '100%' }} placeholder="Filtrer…" value={filtreIntervenant} onChange={e => { setFiltreIntervenant(e.target.value); onFiltre() }} /></td>
                  </tr>
                </thead>
                <tbody>
                  {rowsFiltrees.map(l => (
                    <tr key={l.id}>
                      <td style={{ fontSize: '12px', color: '#6b7280', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{formatDate(l.createdAt)}</td>
                      <td>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#1f2937', color: '#9ca3af', border: '1px solid #374151', fontWeight: 500, whiteSpace: 'nowrap' }}>
                          {LABELS_TYPE[l.type] ?? l.type}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{LABELS_ENTITE[l.entite] ?? l.entite}</td>
                      <td style={{ fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {l.sn
                          ? <span style={{ color: '#60a5fa', fontWeight: 500 }}>{l.sn}</span>
                          : <span style={{ color: '#4b5563' }}>#{l.entiteId ?? '—'}</span>
                        }
                      </td>
                      <td style={{ fontSize: '12px', fontFamily: 'monospace', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                        {l.rma ?? '—'}
                      </td>
                      <td>
                        {l.type === 'TRANSITION_STATUT' && l.label?.includes(' → ') ? (() => {
                          const [avant, apres] = l.label.split(' → ')
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: '#1f2937', color: '#9ca3af', border: '1px solid #374151', whiteSpace: 'nowrap' }}>
                                  {avant}
                                </span>
                                <span style={{ color: '#4b5563', fontSize: '14px' }}>→</span>
                                <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: l.couleur + '1F', color: l.couleur, border: `1px solid ${l.couleur}44`, whiteSpace: 'nowrap' }}>
                                  {apres}
                                </span>
                              </div>
                              {l.commentaire && (
                                <span style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>{l.commentaire}</span>
                              )}
                            </div>
                          )
                        })() : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {l.couleur && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.couleur, flexShrink: 0 }} />}
                            <span style={{ fontSize: '13px', color: '#f1f5f9' }}>{l.label ?? LABELS_TYPE[l.type] ?? l.type}</span>
                            {l.commentaire && <span style={{ fontSize: '12px', color: '#6b7280' }}>— {l.commentaire}</span>}
                          </div>
                        )}
                      </td>
                      <td>
                        {l.resultat === 'OK' && (
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: '#052e16', color: '#4ade80', border: '1px solid #16a34a44' }}>OK</span>
                        )}
                        {l.resultat === 'NOK' && (
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, background: '#1f0000', color: '#f87171', border: '1px solid #ef444444' }}>NOK</span>
                        )}
                        {!l.resultat && <span style={{ color: '#374151', fontSize: '12px' }}>—</span>}
                      </td>
                      <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {l.intervenant
                          ? <span style={{ color: '#f1f5f9' }}>{l.intervenant}</span>
                          : <span style={{ color: '#4b5563' }}>—</span>
                        }
                        {l.login && <span style={{ display: 'block', fontSize: '11px', color: '#4b5563' }}>{l.login}</span>}
                      </td>
                    </tr>
                  ))}
                  {rowsFiltrees.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: '#6b7280', padding: '48px' }}>
                        Aucun événement trouvé.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data && data.pages > 1 && (
              <div style={{ padding: '10px 16px', borderTop: '1px solid #1f2937', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>
                  Page {data.page} / {data.pages} — {data.total} résultat{data.total !== 1 ? 's' : ''}
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={data.page === 1} className="btn btn-secondary" style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ChevronLeft size={14} /> Préc.
                  </button>
                  <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={data.page === data.pages} className="btn btn-secondary" style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
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
