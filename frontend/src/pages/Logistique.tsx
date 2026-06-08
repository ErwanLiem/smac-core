import { useEffect, useState } from 'react'
import { Check, X, Plus, Truck, Hash } from 'lucide-react'
import { get, post, put } from '../api/client'

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

interface Config { labelPN: string; labelRMA: string; champsAffichageQTE: string[] }
interface Article { id: number; valeurs: any[] }
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

const CODES_PN = ['PN', 'P_N', 'PART_NUMBER', 'PART_NO']

function getArticleLabel(art: any): string {
  if (!art) return '—'
  const desig = art.valeurs?.find((v: any) =>
    CODES_DESIG.includes(v.champ?.code?.toUpperCase?.() ?? '')
  )?.valeur
  return desig || art.valeurs?.[0]?.valeur || `Article #${art.id}`
}

function getArticleOptionLabel(art: any): string {
  if (!art) return '—'
  const pn   = art.valeurs?.find((v: any) => CODES_PN.includes(v.champ?.code?.toUpperCase?.() ?? ''))?.valeur
  const desig = art.valeurs?.find((v: any) => CODES_DESIG.includes(v.champ?.code?.toUpperCase?.() ?? ''))?.valeur
  if (pn && desig) return `${pn} — ${desig}`
  if (pn)   return pn
  if (desig) return desig
  return `Article #${art.id}`
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
  const [config, setConfig]   = useState<Config>({ labelPN: 'P/N', labelRMA: 'RMA', champsAffichageQTE: [] })
  const [demandes, setDemandes] = useState<Demande[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [champsArticle, setChampsArticle] = useState<ChampArticle[]>([])
  const [onglet, setOnglet]   = useState<'sn' | 'qte'>('sn')
  const [showQTE, setShowQTE] = useState(false)
  const [formQTE, setFormQTE] = useState({ articleId: 0, quantite: 1, datePlanifiee: new Date().toISOString().split('T')[0] })
  const [confirmAction, setConfirmAction] = useState<{ id: number; action: 'valider' | 'annuler' } | null>(null)
  const [succes, setSucces] = useState('')
  const [erreurQTE, setErreurQTE] = useState('')

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    const [cfg, d, arts, champs] = await Promise.all([
      get<Config>(`/production/config/${siteId}`),
      get<Demande[]>(`/production/demandes/${siteId}`),
      get<Article[]>(`/production/articles-qte/${siteId}`),
      get<ChampArticle[]>(`/articles/${siteId}/champs`)
    ])
    setConfig(cfg)
    setDemandes(d)
    setArticles(arts)
    setChampsArticle(champs)
  }

  async function handleAction(id: number, action: 'valider' | 'annuler') {
    await put(`/production/demandes/${id}/${action}`, {})
    setConfirmAction(null)
    setSucces(action === 'valider' ? 'Transfert validé.' : 'Demande annulée.')
    setTimeout(() => setSucces(''), 2500)
    reload()
  }

  async function handleQTE(e: React.FormEvent) {
    e.preventDefault()
    setErreurQTE('')
    try {
      await post(`/production/demandes/${siteId}/qte`, formQTE)
      setFormQTE({ articleId: 0, quantite: 1, datePlanifiee: new Date().toISOString().split('T')[0] })
      setShowQTE(false)
      reload()
    } catch (err: any) {
      setErreurQTE(err.message ?? 'Erreur lors de la création')
    }
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

  function TableDemandes({ liste, historique }: { liste: Demande[]; historique: Demande[] }) {
    return (
      <div>
        {liste.length === 0 ? (
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
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>{d.pnValeur}</span>
                          {d.rmaValeur && <span style={{ color: '#9ca3af', fontSize: '12px', marginLeft: '8px' }}>{config.labelRMA}: {d.rmaValeur}</span>}
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

        {historique.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Historique</p>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
                      <td style={{ fontSize: '12px', color: '#9ca3af' }}>{d.type === 'SN' ? d.pnValeur : <ArticleInfo article={d.article} champsAffichage={config.champsAffichageQTE} champsArticle={champsArticle} />}</td>
                      <td style={{ textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>{d.quantite}</td>
                      <td>{statutBadge(d.statut)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attente transfert</h1>
          <p className="page-subtitle">Demandes de transfert vers la production</p>
        </div>
        {onglet === 'qte' && (
          <button className="btn btn-primary" onClick={() => setShowQTE(true)}>
            <Plus size={15} /> Nouvelle demande QTE
          </button>
        )}
      </div>

      {succes && (
        <div style={{ background: '#052e16', border: '1px solid #16a34a', borderRadius: '8px', padding: '10px 16px', color: '#4ade80', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Check size={15} /> {succes}
        </div>
      )}

      {/* Onglets */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid #1f2937' }}>
        {([
          { key: 'sn',  label: 'Transfert SN',       count: snAttente.length,  icon: <Truck size={14} /> },
          { key: 'qte', label: 'Transfert quantité',  count: qteAttente.length, icon: <Hash size={14} /> },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setOnglet(t.key)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, border: 'none', cursor: 'pointer', borderBottom: onglet === t.key ? '2px solid #3b82f6' : '2px solid transparent', background: 'transparent', color: onglet === t.key ? '#60a5fa' : '#6b7280', marginBottom: '-1px' }}>
            {t.icon} {t.label}
            {t.count > 0 && <span style={{ background: onglet === t.key ? '#1e3a5f' : '#1f2937', color: onglet === t.key ? '#60a5fa' : '#9ca3af', fontSize: '11px', padding: '0 6px', borderRadius: '10px' }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {onglet === 'sn'  && <TableDemandes liste={snAttente}  historique={snHistorique} />}
      {onglet === 'qte' && <TableDemandes liste={qteAttente} historique={qteHistorique} />}

      {/* Modal demande QTE */}
      {showQTE && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '28px', maxWidth: '400px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Demande de transfert quantité</h3>
            <form onSubmit={handleQTE}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Article *</label>
                  <select required className="form-input" value={formQTE.articleId} onChange={e => { setFormQTE(f => ({ ...f, articleId: Number(e.target.value) })); setErreurQTE('') }}>
                    <option value={0}>— Choisir un article —</option>
                    {articles.map(a => <option key={a.id} value={a.id}>{getArticleOptionLabel(a)}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Quantité *</label>
                  <input type="number" min={1} required className="form-input" value={formQTE.quantite} onChange={e => { setFormQTE(f => ({ ...f, quantite: Number(e.target.value) })); setErreurQTE('') }} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Date planifiée *</label>
                  <input type="date" required className="form-input" value={formQTE.datePlanifiee} onChange={e => setFormQTE(f => ({ ...f, datePlanifiee: e.target.value }))} />
                </div>
              </div>
              {erreurQTE && (
                <div style={{ background: '#1f0a0a', border: '1px solid #dc2626', borderRadius: '6px', padding: '10px 14px', color: '#ef4444', fontSize: '13px', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ⚠ {erreurQTE}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowQTE(false); setErreurQTE('') }}>Annuler</button>
                <button type="submit" className="btn btn-primary"><Check size={14} /> Créer la demande</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmation */}
      {confirmAction && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '10px', padding: '24px', maxWidth: '360px', width: '100%' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>
              {confirmAction.action === 'valider' ? 'Valider ce transfert ?' : 'Annuler cette demande ?'}
            </h3>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '20px' }}>
              {confirmAction.action === 'valider'
                ? 'Pour les demandes QTE, le stock labo sera incrémenté.'
                : 'Les S/N associés seront remis en statut stock.'}
            </p>
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
