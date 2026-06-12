import { useEffect, useState } from 'react'
import { Check, X, Truck, Hash, History } from 'lucide-react'
import { get, put } from '../api/client'
import { getSiteId } from '../utils/permissions'

interface Config { labelPN: string; labelRMA: string; champsAffichageQTE: string[] }
interface ChampArticle { id: number; code: string; label: string }

interface Demande {
  id: number
  type: 'SN' | 'QTE'
  statut: string
  datePlanifiee: string
  quantite: number
  pnValeur: string | null
  rmaValeur: string | null
  article: { id: number; valeurs: any[] } | null
  lignes: any[]
}

const CODES_DESIG = ['DESIGNATION', 'DESIG', 'NOM', 'LIBELLE']

function getArticleLabel(art: any): string {
  if (!art) return '—'
  const desig = art.valeurs?.find((v: any) =>
    CODES_DESIG.includes(v.champ?.code?.toUpperCase?.() ?? '')
  )?.valeur
  return desig || art.valeurs?.[0]?.valeur || `Article #${art.id}`
}

function getValeurArticle(art: any, code: string): string {
  if (!art?.valeurs) return ''
  return art.valeurs.find((v: any) => v.champ?.code?.toUpperCase() === code.toUpperCase())?.valeur ?? ''
}

function ArticleInfo({ article, champsAffichage, champsArticle }: {
  article: any
  champsAffichage: string[]
  champsArticle: Array<{ code: string; label: string }>
}) {
  if (!article) return <span style={{ color: '#6b7280' }}>—</span>
  if (champsAffichage.length === 0) return <span>{getArticleLabel(article)}</span>
  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      {champsAffichage.map(code => {
        const champ = champsArticle.find(c => c.code === code)
        const valeur = getValeurArticle(article, code)
        if (!valeur) return null
        return (
          <span key={code} style={{ fontSize: '12px' }}>
            <span style={{ color: '#6b7280' }}>{champ?.label ?? code} : </span>
            <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{valeur}</span>
          </span>
        )
      })}
    </div>
  )
}

export default function Logistique() {
  const siteId = getSiteId()
  const [chargement, setChargement] = useState(true)
  const [config, setConfig]   = useState<Config>({ labelPN: 'P/N', labelRMA: 'RMA', champsAffichageQTE: [] })
  const [demandes, setDemandes] = useState<Demande[]>([])
  const [champsArticle, setChampsArticle] = useState<ChampArticle[]>([])
  const [onglet, setOnglet]   = useState<'sn' | 'qte'>('sn')
  const [confirmAction, setConfirmAction] = useState<{ id: number; action: 'valider' | 'annuler' } | null>(null)
  const [succes, setSucces] = useState('')
  const [showHistorique, setShowHistorique] = useState(false)

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    const [cfg, d, champs] = await Promise.all([
      get<Config>(`/production/config/${siteId}`),
      get<Demande[]>(`/production/demandes/${siteId}`),
      get<ChampArticle[]>(`/articles/${siteId}/champs`)
    ])
    setConfig(cfg)
    setDemandes(d)
    setChampsArticle(champs)
    setChargement(false)
  }

  async function handleAction(id: number, action: 'valider' | 'annuler') {
    await put(`/production/demandes/${id}/${action}`, {})
    setConfirmAction(null)
    setSucces(action === 'valider' ? 'Transfert validé.' : 'Demande annulée.')
    setTimeout(() => setSucces(''), 2500)
    reload()
    window.dispatchEvent(new Event('transferts-en-attente:changed'))
  }

  function getCaissesDemande(d: Demande): string[] {
    return [...new Set(
      d.lignes
        .map((l: any) => l.inventaire?.valeurs?.find((v: any) => v.champ?.code === 'CAISSE')?.valeur)
        .filter(Boolean)
    )] as string[]
  }

  const demandesSN  = demandes.filter(d => d.type === 'SN')
  const demandesQTE = demandes.filter(d => d.type === 'QTE')
  const snAttente   = demandesSN.filter(d => d.statut === 'EN_ATTENTE')
  const snHistorique = demandesSN.filter(d => d.statut !== 'EN_ATTENTE')
  const qteAttente  = demandesQTE.filter(d => d.statut === 'EN_ATTENTE')
  const qteHistorique = demandesQTE.filter(d => d.statut !== 'EN_ATTENTE')

  function statutBadge(statut: string) {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      EN_ATTENTE: { bg: '#1c1917', color: '#fb923c', label: 'En attente' },
      VALIDEE:    { bg: '#052e16', color: '#4ade80', label: 'Validée' },
      ANNULEE:    { bg: '#1f2937', color: '#6b7280', label: 'Annulée' },
    }
    const s = map[statut] ?? { bg: '#1f2937', color: '#9ca3af', label: statut }
    return <span style={{ fontSize: '11px', padding: '1px 8px', borderRadius: '4px', background: s.bg, color: s.color }}>{s.label}</span>
  }

  function TableDemandes({ liste }: { liste: Demande[] }) {
    return (
      <div>
        {chargement ? (
          <div className="loading-container"><div className="loading-spinner" /></div>
        ) : liste.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
            <Truck size={28} style={{ marginBottom: '10px', color: '#374151' }} />
            <p style={{ fontWeight: 500 }}>Aucun transfert en attente</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date planifiée</th>
                  <th>Détail</th>
                  <th style={{ textAlign: 'center' }}>Qté</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {liste.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontSize: '13px' }}>
                      {new Date(d.datePlanifiee).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
                    </td>
                    <td>
                      {d.type === 'SN' ? (
                        <div>
                          {d.rmaValeur && <div style={{ fontWeight: 700, fontSize: '14px', color: '#f1f5f9', lineHeight: 1.2 }}>{d.rmaValeur}</div>}
                          {d.pnValeur && <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '1px' }}>{config.labelPN} : {d.pnValeur}</div>}
                          {getCaissesDemande(d).length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
                              {getCaissesDemande(d).map(c => (
                                <span key={c} style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: '#1c2a1c', color: '#4ade80', border: '1px solid #166534' }}>📦 {c}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <ArticleInfo article={d.article} champsAffichage={config.champsAffichageQTE} champsArticle={champsArticle} />
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#f59e0b' }}>{d.quantite}</td>
                    <td>{statutBadge(d.statut)}</td>
                    <td style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-primary btn-icon" title="Valider" onClick={() => setConfirmAction({ id: d.id, action: 'valider' })}><Check size={14} /></button>
                      <button className="btn btn-danger btn-icon" title="Annuler" onClick={() => setConfirmAction({ id: d.id, action: 'annuler' })}><X size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  function TableHistorique({ historique }: { historique: Demande[] }) {
    if (historique.length === 0) {
      return <p style={{ textAlign: 'center', color: '#6b7280', padding: '24px' }}>Aucun historique</p>
    }
    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden', margin: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Détail</th>
              <th style={{ textAlign: 'center' }}>Qté</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {historique.map(d => (
              <tr key={d.id} style={{ opacity: 0.7 }}>
                <td style={{ fontSize: '12px', color: '#6b7280' }}>{new Date(d.datePlanifiee).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</td>
                <td>
                  {d.type === 'SN' ? (
                    <div>
                      {d.rmaValeur && <div style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1' }}>{d.rmaValeur}</div>}
                      {d.pnValeur && <div style={{ fontSize: '11px', color: '#6b7280' }}>{config.labelPN} : {d.pnValeur}</div>}
                    </div>
                  ) : (
                    <ArticleInfo article={d.article} champsAffichage={config.champsAffichageQTE} champsArticle={champsArticle} />
                  )}
                </td>
                <td style={{ textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>{d.quantite}</td>
                <td>{statutBadge(d.statut)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Transfert</h1>
          <p className="page-subtitle">Demandes de transfert vers la production</p>
        </div>
      </div>

      {succes && (
        <div style={{ background: '#052e16', border: '1px solid #16a34a', borderRadius: '8px', padding: '10px 16px', color: '#4ade80', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Check size={15} /> {succes}
        </div>
      )}

      {/* Onglets */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #1f2937' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {([
            { key: 'sn',  label: 'Transfert Production', count: snAttente.length,  icon: <Truck size={14} /> },
            { key: 'qte', label: 'Transfert PDA',         count: qteAttente.length, icon: <Hash size={14} /> },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setOnglet(t.key)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, border: 'none', cursor: 'pointer', borderBottom: onglet === t.key ? '2px solid #3b82f6' : '2px solid transparent', background: 'transparent', color: onglet === t.key ? '#60a5fa' : '#6b7280', marginBottom: '-1px' }}>
              {t.icon} {t.label}
              {t.count > 0 && <span style={{ background: onglet === t.key ? '#1e3a5f' : '#1f2937', color: onglet === t.key ? '#60a5fa' : '#9ca3af', fontSize: '11px', padding: '0 6px', borderRadius: '10px' }}>{t.count}</span>}
            </button>
          ))}
        </div>
        <button className="btn btn-secondary" style={{ marginBottom: '8px' }} onClick={() => setShowHistorique(true)}>
          <History size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          Historique
        </button>
      </div>

      {onglet === 'sn'  && <TableDemandes liste={snAttente} />}
      {onglet === 'qte' && <TableDemandes liste={qteAttente} />}

      {/* Modal historique */}
      {showHistorique && (
        <div className="modal-overlay" onClick={() => setShowHistorique(false)}>
          <div
            style={{ background: '#1a1d27', borderRadius: '12px', padding: '24px', maxWidth: '720px', width: '100%', maxHeight: '80vh', overflow: 'auto', border: '1px solid #2d3748' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Historique — {onglet === 'sn' ? 'Transfert Production' : 'Transfert PDA'}
              </h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowHistorique(false)}>
                <X size={15} />
              </button>
            </div>
            <TableHistorique historique={onglet === 'sn' ? snHistorique : qteHistorique} />
          </div>
        </div>
      )}

      {/* Modal confirmation */}
      {confirmAction && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '10px', padding: '24px', maxWidth: '360px', width: '100%' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>
              {confirmAction.action === 'valider'
                ? (() => { const d = demandes.find(d => d.id === confirmAction.id); return d?.type === 'SN' ? 'Transférer vers la production ?' : 'Valider ce transfert ?' })()
                : 'Annuler cette demande ?'}
            </h3>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '16px' }}>
              {confirmAction.action === 'valider' ? (() => {
                const d = demandes.find(d => d.id === confirmAction.id)
                return d?.type === 'QTE'
                  ? 'Le stock labo sera incrémenté et le stock inventaire décrémenté.'
                  : 'Les articles seront transférés vers la production.'
              })() : 'Les S/N associés seront remis en statut stock.'}
            </p>
            {(() => {
              const d = demandes.find(x => x.id === confirmAction.id)
              if (d?.type !== 'SN') return null
              const caisses = getCaissesDemande(d)
              if (caisses.length === 0) return null
              return (
                <div style={{ background: '#1c2a1c', border: '1px solid #166534', borderRadius: '6px', padding: '8px 12px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '5px' }}>Caisses concernées</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {caisses.map(c => (
                      <span key={c} style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: '#052e16', color: '#4ade80', border: '1px solid #16a34a' }}>
                        📦 {c}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })()}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmAction(null)}>Retour</button>
              <button className={`btn ${confirmAction.action === 'valider' ? 'btn-primary' : 'btn-danger'}`}
                onClick={() => handleAction(confirmAction.id, confirmAction.action)}>
                {confirmAction.action === 'valider' ? 'Valider' : 'Annuler la demande'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
