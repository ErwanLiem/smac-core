import { useEffect, useRef, useState } from 'react'
import { Cpu, ChevronRight, Clock, X, Check, Search, AlertCircle } from 'lucide-react'
import { get, put } from '../api/client'

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
  niveauRep: string
  statut: StatutInfo | null
  historique: HistoriqueItem[]
  statutMajInjection: StatutInfo | null
  statutAttenteRep: StatutInfo | null
}

function BadgeStatut({ statut }: { statut: { label: string; couleur: string } | null }) {
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

function ModalMaj({
  inventaireId, siteId, onClose, onStatutChange
}: {
  inventaireId: number
  siteId: number
  onClose: () => void
  onStatutChange: () => void
}) {
  const [detail, setDetail] = useState<DetailInventaire | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [actionEnCours, setActionEnCours] = useState(false)

  useEffect(() => { chargerDetail() }, [inventaireId])

  async function chargerDetail() {
    setChargement(true)
    const d = await get<DetailInventaire>(`/production/maj-injection/${siteId}/inventaire/${inventaireId}`)
    setDetail(d)
    setChargement(false)
  }

  async function valider() {
    setActionEnCours(true)
    setErreur('')
    try {
      await put(`/production/maj-injection/${siteId}/inventaire/${inventaireId}/valider`, {})
      onStatutChange()
      onClose()
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur lors de la validation')
      setActionEnCours(false)
    }
  }

  async function changerStatut(statutCode: string) {
    setActionEnCours(true)
    setErreur('')
    try {
      await put(`/production/maj-injection/${siteId}/inventaire/${inventaireId}/statut`, { statutCode })
      onStatutChange()
      onClose()
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur lors du changement de statut')
      setActionEnCours(false)
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#1a1d27', borderRadius: '12px', width: '780px', maxWidth: '95vw',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Cpu size={18} style={{ color: '#3b82f6' }} />
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>MAJ / Injection</span>
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

            {/* Colonne gauche — infos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="card" style={{ padding: '16px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Informations</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                  {[
                    { label: 'P/N',         val: detail.pn },
                    { label: 'N° Série',    val: detail.sn },
                    { label: 'Désignation', val: detail.designation },
                    { label: 'Client',      val: detail.client },
                    { label: 'RMA',         val: detail.rma },
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

              {detail.panneClient && (
                <div className="card" style={{ padding: '16px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Panne client</p>
                  <p style={{ fontSize: '13px', color: '#f1f5f9', margin: 0 }}>{detail.panneClient}</p>
                </div>
              )}

              {/* Bouton validation */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {detail.statutMajInjection ? (
                  <button
                    onClick={valider}
                    disabled={actionEnCours}
                    style={{
                      width: '100%', padding: '12px', borderRadius: '8px', cursor: 'pointer',
                      background: detail.statutMajInjection.couleur, color: '#fff', border: 'none',
                      fontSize: '14px', fontWeight: 700, letterSpacing: '0.03em',
                      boxShadow: `0 0 12px ${detail.statutMajInjection.couleur}55`,
                      opacity: actionEnCours ? 0.6 : 1, transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.15)' }}
                    onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
                  >
                    <Check size={15} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                    MAJ / Injection OK
                  </button>
                ) : (
                  <div style={{ padding: '12px', borderRadius: '8px', background: '#1f2937', color: '#6b7280', fontSize: '13px', textAlign: 'center' }}>
                    Statut MAJINJECTION non configuré dans le workflow.
                  </div>
                )}

                {detail.statutAttenteRep && (
                  <button
                    onClick={() => changerStatut(detail.statutAttenteRep!.code)}
                    disabled={actionEnCours}
                    style={{
                      width: '100%', padding: '10px', borderRadius: '8px', cursor: 'pointer',
                      background: 'transparent', color: '#f59e0b',
                      border: '1px solid #f59e0b55', fontSize: '13px', fontWeight: 600,
                      opacity: actionEnCours ? 0.6 : 1, transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f59e0b15' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    ↩ Retour technicien
                  </button>
                )}
              </div>
            </div>

            {/* Colonne droite — historique */}
            <div className="card" style={{ padding: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                Historique des mouvements
              </p>
              {detail.historique.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#6b7280', fontStyle: 'italic' }}>Aucun mouvement enregistré.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
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
          </div>
        ) : null}

        {erreur && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid #1f2937' }}>
            <div style={{ background: '#1f0000', border: '1px solid #ef4444', borderRadius: '6px', padding: '8px 12px', color: '#f87171', fontSize: '13px', display: 'flex', gap: '8px' }}>
              <AlertCircle size={14} style={{ marginTop: '1px', flexShrink: 0 }} /> {erreur}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────
export default function MajInjection() {
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
    const data = await get<RmaGroupe[]>(`/production/maj-injection/${siteId}/rma`)
    setRmaList(data)
    setChargement(false)
  }

  async function chargerInventaires(rma: string) {
    setChargementInv(true)
    const data = await get<ArticleRma[]>(`/production/maj-injection/${siteId}/rma/${encodeURIComponent(rma)}/inventaires`)
    setInventaires(data)
    setChargementInv(false)
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault()
    const sn = scanSN.trim()
    if (!sn) return
    setErreurScan('')
    try {
      const r = await get<{ inventaireId: number }>(`/production/maj-injection/${siteId}/scan?sn=${encodeURIComponent(sn)}`)
      setScanSN('')
      setInventaireModalId(r.inventaireId)
    } catch {
      setErreurScan(`SN "${sn}" introuvable parmi les machines en attente de MAJ/Injection.`)
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
          <h1 className="page-title">MAJ / Injection</h1>
          <p className="page-subtitle">{totalMachines} machine{totalMachines !== 1 ? 's' : ''} en attente de MAJ/Injection</p>
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
              Aucune machine en attente de MAJ/Injection.
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
                    border: rmaSelectionne === groupe.rma ? '1px solid #3b82f6' : '1px solid #1f2937',
                    background: rmaSelectionne === groupe.rma ? '#0f1b35' : '#141720'
                  }}
                  onMouseEnter={e => { if (rmaSelectionne !== groupe.rma) e.currentTarget.style.borderColor = '#374151' }}
                  onMouseLeave={e => { if (rmaSelectionne !== groupe.rma) e.currentTarget.style.borderColor = '#1f2937' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Cpu size={16} style={{ color: '#3b82f6', flexShrink: 0 }} />
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
                      <span style={{ background: '#3b82f61F', color: '#3b82f6', border: '1px solid #3b82f633', borderRadius: '12px', padding: '2px 10px', fontSize: '12px', fontWeight: 700 }}>
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
              <Cpu size={15} style={{ color: '#3b82f6' }} />
              <span style={{ fontWeight: 600, fontSize: '14px', color: '#f1f5f9' }}>{rmaSelectionne}</span>
              <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: 'auto' }}>Cliquez sur une ligne pour ouvrir</span>
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
                    <th>Niv. rep.</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {inventaires.map(inv => (
                    <tr
                      key={inv.id}
                      onClick={() => setInventaireModalId(inv.id)}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#0f1117' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '' }}
                    >
                      <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{inv.pn || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '13px', color: '#60a5fa' }}>{inv.sn || '—'}</td>
                      <td style={{ fontSize: '13px' }}>{inv.designation || '—'}</td>
                      <td style={{ fontSize: '13px', color: '#9ca3af' }}>{inv.client || '—'}</td>
                      <td style={{ fontSize: '13px', color: '#8b5cf6', fontWeight: 600 }}>{inv.niveauRep || '—'}</td>
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

      {inventaireModalId !== null && (
        <ModalMaj
          inventaireId={inventaireModalId}
          siteId={siteId}
          onClose={() => setInventaireModalId(null)}
          onStatutChange={onStatutChange}
        />
      )}
    </div>
  )
}
