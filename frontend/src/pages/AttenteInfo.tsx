import { useEffect, useState, useCallback } from 'react'
import { RotateCcw, RefreshCw, AlertCircle } from 'lucide-react'
import Tabs from '../components/Tabs'
import ModalHistorique from '../components/ModalHistorique'
import { get, put } from '../api/client'
import { getSiteId } from '../utils/permissions'

const ONGLETS = [
  { key: 'ASP', label: 'ASP — Pièce',      couleur: '#f59e0b' },
  { key: 'ASW', label: 'ASW — Firmware',   couleur: '#8b5cf6' },
  { key: 'ENG', label: 'ENG — Technique',  couleur: '#3b82f6' },
  { key: 'NLV', label: 'NLV — Non répar.', couleur: '#ef4444' },
  { key: 'PRV', label: 'PRV — Devis',      couleur: '#10b981' },
]

interface AttenteItem {
  attenteInfoId: number
  inventaireId:  number
  pn:            string
  sn:            string
  rma:           string
  client:        string
  designation:   string
  model:         string
  statut:        { id: number; code: string; label: string; couleur: string } | null
  commentaire:   string
  technicien:    string | null
  createdAt:     string
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function filtre(val: string, f: string) {
  return val.toLowerCase().includes(f.toLowerCase())
}

function PanneauAttente({ type, couleur }: { type: string; couleur: string }) {
  const siteId = getSiteId()
  const [items, setItems] = useState<AttenteItem[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [actionId, setActionId] = useState<number | null>(null)
  const [msgSucces, setMsgSucces] = useState('')
  const [filtres, setFiltres] = useState({ sn: '', pn: '', client: '', rma: '', designation: '', commentaire: '' })
  const [historiqueId, setHistoriqueId] = useState<{ id: number; sn: string } | null>(null)

  const charger = useCallback(async () => {
    setChargement(true)
    setErreur('')
    try {
      const data = await get<AttenteItem[]>(`/production/attente-info/${siteId}/${type}`)
      setItems(data)
    } catch {
      setErreur('Impossible de charger les articles.')
    } finally {
      setChargement(false)
    }
  }, [siteId, type])

  useEffect(() => { charger() }, [charger])

  async function retourProduction(inventaireId: number) {
    setActionId(inventaireId)
    setErreur('')
    try {
      await put(`/production/attente-info/${siteId}/${inventaireId}/retour`, {})
      setMsgSucces('Article renvoyé en production.')
      setTimeout(() => setMsgSucces(''), 3000)
      charger()
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur lors du retour en production')
    } finally {
      setActionId(null)
    }
  }

  const filtered = items.filter(i =>
    filtre(i.sn, filtres.sn) &&
    filtre(i.pn, filtres.pn) &&
    filtre(i.client, filtres.client) &&
    filtre(i.rma, filtres.rma) &&
    filtre(i.designation, filtres.designation) &&
    filtre(i.commentaire, filtres.commentaire)
  )

  const hasFiltres = Object.values(filtres).some(v => v !== '')

  const setF = (k: keyof typeof filtres) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFiltres(f => ({ ...f, [k]: e.target.value }))

  const COLS = [
    { key: 'sn',          label: 'N° Série',    filtrable: true,  fKey: 'sn'          },
    { key: 'pn',          label: 'P/N',          filtrable: true,  fKey: 'pn'          },
    { key: 'designation', label: 'Désignation',  filtrable: true,  fKey: 'designation' },
    { key: 'client',      label: 'Client',       filtrable: true,  fKey: 'client'      },
    { key: 'rma',         label: 'RMA',          filtrable: true,  fKey: 'rma'         },
    { key: 'statut',      label: 'Statut',       filtrable: false, fKey: ''            },
    { key: 'commentaire', label: 'Commentaire',  filtrable: true,  fKey: 'commentaire' },
    { key: 'technicien',  label: 'Technicien',   filtrable: false, fKey: ''            },
    { key: 'createdAt',   label: 'Depuis',       filtrable: false, fKey: ''            },
    { key: 'action',      label: '',             filtrable: false, fKey: ''            },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '12px' }}>

      {/* Barre messages */}
      {erreur && (
        <div style={{ background: '#1f0000', border: '1px solid #ef4444', borderRadius: '6px', padding: '10px 14px', color: '#f87171', fontSize: '13px', display: 'flex', gap: '8px', flexShrink: 0 }}>
          <AlertCircle size={14} style={{ marginTop: '1px', flexShrink: 0 }} /> {erreur}
        </div>
      )}
      {msgSucces && (
        <div style={{ background: '#052e16', border: '1px solid #4ade80', borderRadius: '6px', padding: '10px 14px', color: '#4ade80', fontSize: '13px', flexShrink: 0 }}>
          {msgSucces}
        </div>
      )}

      {/* Carte tableau */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {chargement ? (
          <div className="loading-container" style={{ flex: 1 }}><div className="loading-spinner" /></div>
        ) : (
          <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
            <table className="table" style={{ minWidth: 'max-content' }}>
              <thead>
                <tr>
                  {COLS.map(c => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                </tr>
                <tr className="table-filter-row">
                  {COLS.map(c => (
                    <td key={c.key}>
                      {c.filtrable ? (
                        <input
                          className="form-input"
                          style={{ padding: '4px 8px', fontSize: '12px', width: '100%', minWidth: '80px' }}
                          placeholder="Filtrer…"
                          value={filtres[c.fKey as keyof typeof filtres]}
                          onChange={setF(c.fKey as keyof typeof filtres)}
                        />
                      ) : (
                        c.key === 'action' && hasFiltres ? (
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '11px', padding: '3px 8px' }}
                            onClick={() => setFiltres({ sn: '', pn: '', client: '', rma: '', designation: '', commentaire: '' })}
                          >
                            Effacer
                          </button>
                        ) : null
                      )}
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={COLS.length} style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: couleur, marginBottom: '8px' }}>{type}</div>
                      {hasFiltres ? 'Aucun résultat pour ces filtres.' : 'Aucun article en attente pour le moment.'}
                    </td>
                  </tr>
                ) : filtered.map(item => (
                  <tr
                    key={item.attenteInfoId}
                    onDoubleClick={() => setHistoriqueId({ id: item.inventaireId, sn: item.sn || item.pn || `#${item.inventaireId}` })}
                    style={{ cursor: 'default' }}
                  >
                    <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{item.sn || '—'}</td>
                    <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', color: '#9ca3af' }}>{item.pn || '—'}</td>
                    <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.designation || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{item.client || '—'}</td>
                    <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', color: '#9ca3af' }}>{item.rma || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {item.statut ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: item.statut.couleur + '1F', color: item.statut.couleur, border: `1px solid ${item.statut.couleur}33` }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: item.statut.couleur }} />
                          {item.statut.label}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ maxWidth: '240px', color: '#d1d5db' }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {item.commentaire}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', color: '#9ca3af', fontSize: '12px' }}>{item.technicien ?? '—'}</td>
                    <td style={{ whiteSpace: 'nowrap', color: '#9ca3af', fontSize: '12px' }}>{formatDate(item.createdAt)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => retourProduction(item.inventaireId)}
                        disabled={actionId === item.inventaireId}
                        title="Retour en production"
                        className="btn btn-secondary"
                        style={{ fontSize: '12px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px', opacity: actionId === item.inventaireId ? 0.5 : 1 }}
                      >
                        <RotateCcw size={12} /> Retour prod.
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {historiqueId && (
        <ModalHistorique
          inventaireId={historiqueId.id}
          titre={`Historique — ${historiqueId.sn}`}
          onClose={() => setHistoriqueId(null)}
        />
      )}
    </div>
  )
}

export default function AttenteInfo() {
  useEffect(() => {
    document.querySelector('.main-content')?.classList.add('page-table')
    return () => { document.querySelector('.main-content')?.classList.remove('page-table') }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attente info</h1>
          <p className="page-subtitle">Machines en attente de retour d'information</p>
        </div>
        <RefreshCw size={16} style={{ color: '#6b7280', cursor: 'default' }} />
      </div>

      <Tabs
        flex
        tabs={ONGLETS.map(o => ({
          key: o.key,
          label: o.label,
          content: <PanneauAttente type={o.key} couleur={o.couleur} />
        }))}
      />
    </div>
  )
}
