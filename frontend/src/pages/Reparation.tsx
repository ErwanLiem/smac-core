import { useEffect, useRef, useState } from 'react'
import { Wrench, Package, ChevronRight, Clock, X, Check, Search, AlertCircle, Minus, Plus } from 'lucide-react'
import { get, put, post } from '../api/client'
import { getSiteId } from '../utils/permissions'

interface RmaGroupe {
  rma: string
  count: number
  client: string
  pns: string[]
}

interface ArticleRma {
  id: number
  pn: string
  sn: string
  designation: string
  client: string
  panneClient: string
  panneConstate: string
  niveauRep: string
  statut: { label: string; couleur: string } | null
}

interface HistoriqueItem {
  type: string
  date: string
  label: string
  couleur: string
  commentaire: string | null
  intervenant: string | null
}

interface PdaDispo {
  articleId: number
  reference: string
  detail: string
  model: string
  niveauRep: string
  stock: number
}

interface StatutInfo {
  id: number
  code: string
  label: string
  couleur: string
}

interface DetailInventaire {
  id: number
  pn: string
  sn: string
  rma: string
  designation: string
  client: string
  panneClient: string
  panneConstate: string
  niveauRep: string
  model: string
  statut: StatutInfo | null
  historique: HistoriqueItem[]
  pdaDispos: PdaDispo[]
  statutsAttenteInfo: StatutInfo[]
  statutRepare: StatutInfo | null
}

// ─── Couleur badge statut ──────────────────────────────────────────────────────
function BadgeStatut({ statut }: { statut: StatutInfo | null }) {
  if (!statut) return <span style={{ color: '#6b7280' }}>—</span>
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '2px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: 600,
      background: statut.couleur + '1F', color: statut.couleur, border: `1px solid ${statut.couleur}33`
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statut.couleur }} />
      {statut.label}
    </span>
  )
}

// ─── Modal réparation ──────────────────────────────────────────────────────────
function ModalReparation({
  inventaireId, siteId, onClose, onStatutChange
}: {
  inventaireId: number
  siteId: number
  onClose: () => void
  onStatutChange: () => void
}) {
  const [detail, setDetail] = useState<DetailInventaire | null>(null)
  const [chargement, setChargement] = useState(true)
  const [panneConstate, setPanneConstate] = useState('')
  const [panneEnEdit, setPanneEnEdit] = useState(false)
  const [qtePDA, setQtePDA] = useState<Record<number, number>>({})
  const [erreur, setErreur] = useState('')
  const [succes, setSucces] = useState('')
  const [actionEnCours, setActionEnCours] = useState(false)

  useEffect(() => {
    chargerDetail()
  }, [inventaireId])

  async function chargerDetail() {
    setChargement(true)
    const d = await get<DetailInventaire>(`/production/reparation/${siteId}/inventaire/${inventaireId}`)
    setDetail(d)
    setPanneConstate(d.panneConstate || '')
    setChargement(false)
  }

  async function sauvegarderPanne() {
    if (!detail) return
    await put(`/production/reparation/${siteId}/inventaire/${inventaireId}/panne`, { valeur: panneConstate })
    setPanneEnEdit(false)
    setSucces('Panne constatée sauvegardée.')
    setTimeout(() => setSucces(''), 2500)
    chargerDetail()
  }

  async function utiliserPDA(articleId: number, quantite: number) {
    if (quantite < 1) return
    setActionEnCours(true)
    setErreur('')
    try {
      const r = await post<{ success: boolean; niveauRep: string }>(
        `/production/reparation/${siteId}/inventaire/${inventaireId}/pda`,
        { articleId, quantite }
      )
      setSucces(`PDA consommé${r.niveauRep ? ` — Niveau de réparation : ${r.niveauRep}` : ''}.`)
      setTimeout(() => setSucces(''), 3000)
      setQtePDA(q => ({ ...q, [articleId]: 1 }))
      chargerDetail()
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur lors de la consommation')
    } finally {
      setActionEnCours(false)
    }
  }

  async function changerStatut(statutCode: string) {
    setActionEnCours(true)
    setErreur('')
    try {
      await put(`/production/reparation/${siteId}/inventaire/${inventaireId}/statut`, { statutCode })
      onStatutChange()
      onClose()
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur lors du changement de statut')
      setActionEnCours(false)
    }
  }

  function formatDate(d: string) {
    const date = new Date(d)
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#1a1d27', borderRadius: '12px', width: '900px', maxWidth: '95vw',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Wrench size={18} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>Réparation</span>
            {detail && <span style={{ fontSize: '13px', color: '#6b7280' }}>— {detail.sn || detail.pn || `#${inventaireId}`}</span>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {chargement ? (
          <div className="loading-container" style={{ flex: 1, minHeight: '300px' }}><div className="loading-spinner" /></div>
        ) : detail ? (
          <div style={{ flex: 1, overflow: 'auto', padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

            {/* Colonne gauche */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Infos pratiques */}
              <div className="card" style={{ padding: '16px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Informations</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                  {[
                    { label: 'P/N', val: detail.pn },
                    { label: 'N° Série', val: detail.sn },
                    { label: 'Désignation', val: detail.designation },
                    { label: 'Client', val: detail.client },
                    { label: 'RMA', val: detail.rma },
                    { label: 'Model', val: detail.model },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>{label}</div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: val ? '#f1f5f9' : '#4b5563', fontFamily: 'monospace' }}>{val || '—'}</div>
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Statut</div>
                    <BadgeStatut statut={detail.statut} />
                  </div>
                  {detail.niveauRep && (
                    <div>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>Niveau réparation</div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#8b5cf6' }}>{detail.niveauRep}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Panne client */}
              <div className="card" style={{ padding: '16px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Panne client (entrée)</p>
                <p style={{ fontSize: '13px', color: detail.panneClient ? '#f1f5f9' : '#4b5563', fontStyle: detail.panneClient ? 'normal' : 'italic' }}>
                  {detail.panneClient || 'Non renseignée'}
                </p>
              </div>

              {/* Panne constatée */}
              <div className="card" style={{ padding: '16px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Panne constatée</p>
                {panneEnEdit ? (
                  <div>
                    <textarea
                      className="form-input"
                      rows={3}
                      value={panneConstate}
                      onChange={e => setPanneConstate(e.target.value)}
                      style={{ width: '100%', resize: 'vertical', fontSize: '13px', marginBottom: '8px' }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-primary" style={{ fontSize: '12px', padding: '5px 12px' }} onClick={sauvegarderPanne}>
                        <Check size={13} /> Enregistrer
                      </button>
                      <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '5px 12px' }} onClick={() => { setPanneEnEdit(false); setPanneConstate(detail.panneConstate) }}>
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <p style={{ flex: 1, fontSize: '13px', color: detail.panneConstate ? '#f1f5f9' : '#4b5563', fontStyle: detail.panneConstate ? 'normal' : 'italic', margin: 0 }}>
                      {panneConstate || 'Non renseignée'}
                    </p>
                    <button onClick={() => setPanneEnEdit(true)} style={{ background: 'none', border: '1px solid #374151', borderRadius: '4px', padding: '3px 8px', color: '#9ca3af', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}>
                      ✎
                    </button>
                  </div>
                )}
              </div>

              {/* Pièces PDA */}
              <div className="card" style={{ padding: '16px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                  <Package size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  Pièces détachées (PDA)
                </p>
                {detail.pdaDispos.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#6b7280', fontStyle: 'italic' }}>Aucune pièce disponible pour ce modèle.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {detail.pdaDispos.map(pda => (
                      <div key={pda.articleId} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: '#0f1117', borderRadius: '6px', border: '1px solid #1f2937' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {pda.reference}{pda.detail ? ` — ${pda.detail}` : ''}
                          </div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                            {pda.niveauRep && <span style={{ fontSize: '11px', color: '#8b5cf6' }}>Niv. {pda.niveauRep}</span>}
                            <span style={{ fontSize: '11px', color: '#6b7280' }}>Stock : {pda.stock}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            onClick={() => setQtePDA(q => ({ ...q, [pda.articleId]: Math.max(1, (q[pda.articleId] ?? 1) - 1) }))}
                            style={{ background: '#1f2937', border: 'none', color: '#9ca3af', cursor: 'pointer', borderRadius: '4px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Minus size={12} />
                          </button>
                          <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '24px', textAlign: 'center', color: '#f1f5f9' }}>
                            {qtePDA[pda.articleId] ?? 1}
                          </span>
                          <button
                            onClick={() => setQtePDA(q => ({ ...q, [pda.articleId]: Math.min(pda.stock, (q[pda.articleId] ?? 1) + 1) }))}
                            style={{ background: '#1f2937', border: 'none', color: '#9ca3af', cursor: 'pointer', borderRadius: '4px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Plus size={12} />
                          </button>
                          <button
                            onClick={() => utiliserPDA(pda.articleId, qtePDA[pda.articleId] ?? 1)}
                            disabled={actionEnCours}
                            style={{ background: '#8b5cf6', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '4px', padding: '4px 10px', fontSize: '12px', fontWeight: 600, marginLeft: '4px' }}
                          >
                            Utiliser
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Colonne droite */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Historique */}
              <div className="card" style={{ padding: '16px', flex: 1 }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                  <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                  Historique des mouvements
                </p>
                {detail.historique.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#6b7280', fontStyle: 'italic' }}>Aucun mouvement enregistré.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {detail.historique.map((h, i) => (
                      <div key={i} style={{ display: 'flex', gap: '10px', paddingBottom: '12px', position: 'relative' }}>
                        {i < detail.historique.length - 1 && (
                          <div style={{ position: 'absolute', left: '8px', top: '18px', bottom: '0', width: '1px', background: '#1f2937' }} />
                        )}
                        <div style={{ flexShrink: 0, width: '17px', height: '17px', borderRadius: '50%', background: h.couleur + '30', border: `2px solid ${h.couleur}`, marginTop: '1px' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: '#f1f5f9' }}>{h.label}</div>
                          {h.commentaire && <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{h.commentaire}</div>}
                          <div style={{ display: 'flex', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11px', color: '#6b7280' }}>{formatDate(h.date)}</span>
                            {h.intervenant && <span style={{ fontSize: '11px', color: '#4b5563' }}>· {h.intervenant}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bouton Réparation OK */}
              {detail.statutRepare && (
                <button
                  onClick={() => changerStatut(detail.statutRepare!.code)}
                  disabled={actionEnCours}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '8px', cursor: 'pointer',
                    background: detail.statutRepare.couleur, color: '#fff', border: 'none',
                    fontSize: '14px', fontWeight: 700, letterSpacing: '0.03em',
                    boxShadow: `0 0 12px ${detail.statutRepare.couleur}55`,
                    transition: 'all 0.15s', opacity: actionEnCours ? 0.6 : 1
                  }}
                  onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.15)' }}
                  onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
                >
                  <Check size={15} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                  Réparation OK
                </button>
              )}

              {/* Boutons attente info */}
              <div className="card" style={{ padding: '16px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Mettre en attente d'information</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {detail.statutsAttenteInfo.map(s => (
                    <button
                      key={s.code}
                      onClick={() => changerStatut(s.code)}
                      disabled={actionEnCours}
                      style={{
                        background: s.couleur + '1F', color: s.couleur, border: `1px solid ${s.couleur}33`,
                        padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                        textAlign: 'left', transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = s.couleur + '35' }}
                      onMouseLeave={e => { e.currentTarget.style.background = s.couleur + '1F' }}
                    >
                      {s.code} — {s.label}
                    </button>
                  ))}
                  {detail.statutsAttenteInfo.length === 0 && (
                    <p style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>Aucun statut d'attente configuré (ASP, ASW, ENG, NLV, PRV).</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Feedback bas */}
        {(erreur || succes) && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid #1f2937' }}>
            {erreur && (
              <div style={{ background: '#1f0000', border: '1px solid #ef4444', borderRadius: '6px', padding: '8px 12px', color: '#f87171', fontSize: '13px', display: 'flex', gap: '8px' }}>
                <AlertCircle size={14} style={{ marginTop: '1px', flexShrink: 0 }} /> {erreur}
              </div>
            )}
            {succes && (
              <div style={{ background: '#052e16', border: '1px solid #16a34a', borderRadius: '6px', padding: '8px 12px', color: '#4ade80', fontSize: '13px', display: 'flex', gap: '8px' }}>
                <Check size={14} style={{ marginTop: '1px', flexShrink: 0 }} /> {succes}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function Reparation() {
  const siteId = getSiteId()
  const [rmaList, setRmaList] = useState<RmaGroupe[]>([])
  const [rmaSelectionne, setRmaSelectionne] = useState<string | null>(null)
  const [inventaires, setInventaires] = useState<ArticleRma[]>([])
  const [chargement, setChargement] = useState(true)
  const [chargementInv, setChargementInv] = useState(false)
  const [scanSN, setScanSN] = useState('')
  const [erreurScan, setErreurScan] = useState('')
  const [inventaireModalId, setInventaireModalId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { chargerRmaList() }, [siteId])

  useEffect(() => {
    if (rmaSelectionne) chargerInventaires(rmaSelectionne)
  }, [rmaSelectionne])

  async function chargerRmaList() {
    setChargement(true)
    const data = await get<RmaGroupe[]>(`/production/reparation/${siteId}/rma`)
    setRmaList(data)
    setChargement(false)
  }

  async function chargerInventaires(rma: string) {
    setChargementInv(true)
    const data = await get<ArticleRma[]>(`/production/reparation/${siteId}/rma/${encodeURIComponent(rma)}/inventaires`)
    setInventaires(data)
    setChargementInv(false)
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault()
    const sn = scanSN.trim()
    if (!sn) return
    setErreurScan('')
    try {
      const r = await get<{ inventaireId: number }>(`/production/reparation/${siteId}/scan?sn=${encodeURIComponent(sn)}`)
      setScanSN('')
      setInventaireModalId(r.inventaireId)
    } catch {
      setErreurScan(`SN "${sn}" introuvable parmi les machines en attente de réparation.`)
      setScanSN('')
      inputRef.current?.focus()
    }
  }

  function onStatutChange() {
    chargerRmaList()
    if (rmaSelectionne) chargerInventaires(rmaSelectionne)
  }

  const totalMachines = rmaList.reduce((acc, r) => acc + r.count, 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Réparation</h1>
          <p className="page-subtitle">{totalMachines} machine{totalMachines !== 1 ? 's' : ''} en attente de réparation</p>
        </div>
      </div>

      {/* Zone scan */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
        <form onSubmit={handleScan} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Search size={16} style={{ color: '#6b7280', flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="form-input"
            style={{ flex: 1, maxWidth: '360px' }}
            placeholder="Scanner un numéro de série…"
            value={scanSN}
            onChange={e => { setScanSN(e.target.value); setErreurScan('') }}
            autoFocus
          />
          <button type="submit" className="btn btn-primary" disabled={!scanSN.trim()}>Ouvrir</button>
        </form>
        {erreurScan && (
          <p style={{ marginTop: '8px', fontSize: '13px', color: '#f87171', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <AlertCircle size={13} /> {erreurScan}
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: rmaSelectionne ? '300px 1fr' : '1fr', gap: '20px', alignItems: 'start' }}>

        {/* Cartes RMA */}
        <div>
          {chargement ? (
            <div className="loading-container" style={{ minHeight: '200px' }}><div className="loading-spinner" /></div>
          ) : rmaList.length === 0 ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
              Aucune machine en attente de réparation.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {rmaList.map(groupe => (
                <div
                  key={groupe.rma}
                  className="card"
                  onClick={() => setRmaSelectionne(prev => prev === groupe.rma ? null : groupe.rma)}
                  style={{
                    padding: '14px 16px', cursor: 'pointer', transition: 'all 0.15s',
                    border: rmaSelectionne === groupe.rma ? '1px solid #2563eb' : '1px solid #1f2937',
                    background: rmaSelectionne === groupe.rma ? '#0f1b35' : '#141720'
                  }}
                  onMouseEnter={e => { if (rmaSelectionne !== groupe.rma) e.currentTarget.style.borderColor = '#374151' }}
                  onMouseLeave={e => { if (rmaSelectionne !== groupe.rma) e.currentTarget.style.borderColor = '#1f2937' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Wrench size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {groupe.rma}
                      </div>
                      {groupe.client && (
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {groupe.client}
                        </div>
                      )}
                      {groupe.pns.length > 0 && (
                        <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {groupe.pns.join(', ')}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#f59e0b1F', color: '#f59e0b', border: '1px solid #f59e0b33', borderRadius: '12px', padding: '2px 10px', fontSize: '12px', fontWeight: 700 }}>
                        {groupe.count}
                      </span>
                      <ChevronRight size={15} style={{ color: '#6b7280', transform: rmaSelectionne === groupe.rma ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Détail RMA */}
        {rmaSelectionne && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wrench size={15} style={{ color: '#f59e0b' }} />
              <span style={{ fontWeight: 600, fontSize: '14px', color: '#f1f5f9' }}>{rmaSelectionne}</span>
              <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: 'auto' }}>Cliquez sur une ligne pour ouvrir la réparation</span>
            </div>
            {chargementInv ? (
              <div className="loading-container" style={{ minHeight: '120px' }}><div className="loading-spinner" /></div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>P/N</th>
                    <th>N° Série</th>
                    <th>Désignation</th>
                    <th>Client</th>
                    <th>Panne client</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {inventaires.map(inv => (
                    <tr
                      key={inv.id}
                      onClick={() => setInventaireModalId(inv.id)}
                      style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#0f1117' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '' }}
                    >
                      <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{inv.pn || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '13px', color: '#60a5fa' }}>{inv.sn || '—'}</td>
                      <td style={{ fontSize: '13px' }}>{inv.designation || '—'}</td>
                      <td style={{ fontSize: '13px', color: '#9ca3af' }}>{inv.client || '—'}</td>
                      <td style={{ fontSize: '12px', color: '#9ca3af', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.panneClient || '—'}</td>
                      <td><BadgeStatut statut={inv.statut} /></td>
                    </tr>
                  ))}
                  {inventaires.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: '#6b7280', padding: '32px' }}>Aucune machine</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Modal réparation */}
      {inventaireModalId !== null && (
        <ModalReparation
          inventaireId={inventaireModalId}
          siteId={siteId}
          onClose={() => setInventaireModalId(null)}
          onStatutChange={onStatutChange}
        />
      )}
    </div>
  )
}
