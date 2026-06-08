import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X, AlertTriangle } from 'lucide-react'
import { get, post, put } from '../api/client'

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

function dateStr(d: Date) { return d.toISOString().split('T')[0] }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function getLundi(d: Date) {
  const r = new Date(d)
  const day = r.getDay()
  const diff = day === 0 ? -6 : 1 - day
  r.setDate(r.getDate() + diff)
  r.setHours(0, 0, 0, 0)
  return r
}
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const JOURS_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

interface Carte {
  pnValeur: string
  rmaValeur: string
  quantite: number
  ids: number[]
}

interface CapaciteJour {
  capacite: number
  techniciens: Array<{
    id: number
    utilisateur: { id: number; nom: string; prenom: string }
    quota: number
    quotaBase: number
    absent: boolean
    absenceId: number | null
    absenceMotif: string | null
  }>
}

interface Demande {
  id: number
  type: string
  statut: string
  datePlanifiee: string
  quantite: number
  pnValeur: string | null
  rmaValeur: string | null
}

interface Config {
  labelPN: string
  labelRMA: string
}

export default function Planning() {
  const siteId = getSiteId()
  const [lundi, setLundi] = useState(() => getLundi(new Date()))
  const [cartes, setCartes]     = useState<Carte[]>([])
  const [capacite, setCapacite] = useState<Record<string, CapaciteJour>>({})
  const [demandes, setDemandes] = useState<Demande[]>([])
  const [config, setConfig]     = useState<Config>({ labelPN: 'P/N', labelRMA: 'RMA' })
  const [dragCarte, setDragCarte] = useState<Carte | null>(null)
  const [dropJour, setDropJour]   = useState<string | null>(null)
  const [modalDrop, setModalDrop] = useState<{ carte: Carte; jour: string } | null>(null)
  const [modalQte, setModalQte]   = useState(1)
  const [modalAbsence, setModalAbsence] = useState<{ jour: string; techId: number; nom: string; absenceId: number | null } | null>(null)
  const [absenceMotif, setAbsenceMotif] = useState('')
  const [confirmAnnuler, setConfirmAnnuler] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur]   = useState('')

  const jours = Array.from({ length: 7 }, (_, i) => addDays(lundi, i))
  const debut = dateStr(lundi)
  const fin   = dateStr(addDays(lundi, 6))

  useEffect(() => { reload() }, [siteId, lundi])

  async function reload() {
    const [cfg, c, cap, d] = await Promise.all([
      get<Config>(`/production/config/${siteId}`),
      get<Carte[]>(`/production/cartes/${siteId}`),
      get<Record<string, CapaciteJour>>(`/production/capacite/${siteId}?debut=${debut}&fin=${fin}`),
      get<Demande[]>(`/production/demandes/${siteId}?statut=EN_ATTENTE`)
    ])
    setConfig(cfg)
    setCartes(c)
    setCapacite(cap)
    setDemandes(d)
  }

  function getDemandesJour(jour: string) {
    return demandes.filter(d => d.datePlanifiee?.startsWith(jour))
  }

  function getChargeJour(jour: string) {
    return getDemandesJour(jour).reduce((s, d) => s + d.quantite, 0)
  }

  // ─── Drag & Drop ───────────────────────────────────────────────────────────

  function onDragStart(carte: Carte) { setDragCarte(carte) }
  function onDragEnd()               { setDragCarte(null); setDropJour(null) }
  function onDragOver(e: React.DragEvent, jour: string) { e.preventDefault(); setDropJour(jour) }
  function onDragLeave()             { setDropJour(null) }

  function onDrop(e: React.DragEvent, jour: string) {
    e.preventDefault()
    setDropJour(null)
    if (!dragCarte) return
    setModalQte(Math.min(dragCarte.quantite, Math.max(1, (capacite[jour]?.capacite ?? 0) - getChargeJour(jour))))
    setModalDrop({ carte: dragCarte, jour })
    setDragCarte(null)
    setErreur('')
  }

  async function confirmerTransfert() {
    if (!modalDrop) return
    setLoading(true)
    setErreur('')
    try {
      await post(`/production/demandes/${siteId}/sn`, {
        datePlanifiee: modalDrop.jour,
        quantite: modalQte,
        pnValeur: modalDrop.carte.pnValeur,
        rmaValeur: modalDrop.carte.rmaValeur
      })
      setModalDrop(null)
      reload()
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur lors de la création de la demande')
    } finally {
      setLoading(false)
    }
  }

  // ─── Absences ──────────────────────────────────────────────────────────────

  async function toggleAbsence() {
    if (!modalAbsence) return
    if (modalAbsence.absenceId) {
      // Supprimer l'absence
      await fetch(`/api/production/absences/${modalAbsence.absenceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
    } else {
      await post('/production/absences', {
        technicienId: modalAbsence.techId,
        date: modalAbsence.jour,
        motif: absenceMotif || null,
        quotaOverride: null
      })
    }
    setModalAbsence(null)
    setAbsenceMotif('')
    reload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Planning de production</h1>
          <p className="page-subtitle">Glissez les cartes sur les jours pour planifier les transferts</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={() => setLundi(l => addDays(l, -7))}><ChevronLeft size={16} /></button>
          <span style={{ fontSize: '13px', color: '#9ca3af', minWidth: '200px', textAlign: 'center' }}>
            Semaine du {lundi.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} au {addDays(lundi, 6).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          <button className="btn btn-secondary" onClick={() => setLundi(l => addDays(l, 7))}><ChevronRight size={16} /></button>
          <button className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={() => setLundi(getLundi(new Date()))}>Aujourd'hui</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>

        {/* ── Colonne cartes ── */}
        <div style={{ width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
            En stock ({cartes.reduce((s, c) => s + c.quantite, 0)} S/N)
          </p>
          {cartes.length === 0 && (
            <div style={{ background: '#1a1d27', borderRadius: '8px', padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
              Aucune machine en stock
            </div>
          )}
          {cartes.map((carte, idx) => (
            <div key={idx}
              draggable
              onDragStart={() => onDragStart(carte)}
              onDragEnd={onDragEnd}
              style={{
                background: dragCarte === carte ? '#1e3a5f' : '#1a1d27',
                border: '1px solid #2d3748',
                borderRadius: '8px',
                padding: '12px',
                cursor: 'grab',
                userSelect: 'none',
                opacity: dragCarte === carte ? 0.5 : 1,
                transition: 'all 0.1s'
              }}
            >
              <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>{config.labelPN}</div>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#f1f5f9', marginBottom: '6px' }}>{carte.pnValeur || '—'}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>{config.labelRMA}</div>
              <div style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '8px' }}>{carte.rmaValeur || '—'}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ background: '#0f172a', color: '#60a5fa', fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', border: '1px solid #1e40af' }}>
                  {carte.quantite} S/N
                </span>
                <span style={{ fontSize: '11px', color: '#4b5563' }}>⠿ glisser</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Calendrier semaine ── */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', overflowY: 'auto' }}>
          {jours.map((jour, idx) => {
            const ds = dateStr(jour)
            const cap = capacite[ds]
            const charge = getChargeJour(ds)
            const restant = Math.max(0, (cap?.capacite ?? 0) - charge)
            const isToday = ds === dateStr(new Date())
            const isDrop = dropJour === ds

            return (
              <div key={ds}
                onDragOver={e => onDragOver(e, ds)}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, ds)}
                style={{
                  background: isDrop ? '#1e3a5f' : isToday ? '#1a2438' : '#141720',
                  border: isDrop ? '2px dashed #3b82f6' : isToday ? '1px solid #1d4ed8' : '1px solid #1f2937',
                  borderRadius: '8px',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  minHeight: '200px',
                  transition: 'all 0.1s'
                }}
              >
                {/* Header jour */}
                <div style={{ borderBottom: '1px solid #1f2937', paddingBottom: '8px', marginBottom: '4px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: isToday ? '#60a5fa' : '#9ca3af' }}>{JOURS[idx]}</div>
                  <div style={{ fontSize: '11px', color: '#4b5563' }}>
                    {jour.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </div>
                  {/* Capacité */}
                  <div style={{ marginTop: '6px', display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: restant > 0 ? '#4ade80' : '#ef4444', fontWeight: 600 }}>
                      {restant} libre{restant > 1 ? 's' : ''}
                    </span>
                    {charge > 0 && <span style={{ fontSize: '11px', color: '#f59e0b' }}>/ {charge} planifié{charge > 1 ? 's' : ''}</span>}
                    <span style={{ fontSize: '11px', color: '#4b5563' }}>/ {cap?.capacite ?? 0} cap.</span>
                  </div>
                </div>

                {/* Techniciens du jour */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
                  {(cap?.techniciens ?? []).map(tech => (
                    <button key={tech.id}
                      title={tech.absent ? `${tech.utilisateur.prenom} — Absent (clic pour retirer l'absence)` : `${tech.utilisateur.prenom} — ${tech.quota} machines (clic pour déclarer absent)`}
                      onClick={() => { setModalAbsence({ jour: ds, techId: tech.id, nom: `${tech.utilisateur.prenom} ${tech.utilisateur.nom}`, absenceId: tech.absenceId }); setAbsenceMotif(tech.absenceMotif ?? '') }}
                      style={{
                        fontSize: '10px', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', border: 'none',
                        background: tech.absent ? '#1f2937' : '#052e16',
                        color: tech.absent ? '#6b7280' : '#4ade80',
                        textDecoration: tech.absent ? 'line-through' : 'none',
                        opacity: tech.absent ? 0.6 : 1
                      }}
                    >
                      {tech.utilisateur.prenom} {tech.absent ? '✗' : `(${tech.quota})`}
                    </button>
                  ))}
                  {(cap?.techniciens ?? []).length === 0 && (
                    <span style={{ fontSize: '10px', color: '#4b5563' }}>Aucun tech.</span>
                  )}
                </div>

                {/* Demandes du jour */}
                {getDemandesJour(ds).map(d => (
                  <div key={d.id} style={{ background: '#1a1d27', borderRadius: '6px', padding: '6px 8px', border: '1px solid #2d3748', position: 'relative' }}>
                    <button
                      onClick={() => setConfirmAnnuler(d.id)}
                      title="Annuler ce transfert"
                      style={{ position: 'absolute', top: '4px', right: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px', lineHeight: 1, borderRadius: '3px' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
                    >
                      <X size={12} />
                    </button>
                    <div style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 600, paddingRight: '14px' }}>{d.pnValeur || d.type}</div>
                    {d.rmaValeur && <div style={{ fontSize: '10px', color: '#6b7280' }}>{config.labelRMA}: {d.rmaValeur}</div>}
                    <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '2px' }}>× {d.quantite}</div>
                  </div>
                ))}

                {isDrop && dragCarte && (
                  <div style={{ border: '2px dashed #3b82f6', borderRadius: '6px', padding: '8px', textAlign: 'center', fontSize: '11px', color: '#60a5fa' }}>
                    Déposer ici
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Modal confirmation transfert ── */}
      {modalDrop && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '28px', maxWidth: '420px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Planifier le transfert</h3>
            <div style={{ background: '#0f172a', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '13px', color: '#cbd5e1' }}>
              <div><span style={{ color: '#6b7280' }}>{config.labelPN} :</span> <strong>{modalDrop.carte.pnValeur}</strong></div>
              <div><span style={{ color: '#6b7280' }}>{config.labelRMA} :</span> <strong>{modalDrop.carte.rmaValeur}</strong></div>
              <div><span style={{ color: '#6b7280' }}>Date :</span> <strong>{new Date(modalDrop.jour).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}</strong></div>
              <div style={{ marginTop: '6px', color: '#4ade80', fontSize: '12px' }}>
                Capacité restante ce jour : {Math.max(0, (capacite[modalDrop.jour]?.capacite ?? 0) - getChargeJour(modalDrop.jour))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Quantité à transférer <span style={{ color: '#6b7280' }}>(max : {modalDrop.carte.quantite})</span></label>
              <input type="number" min={1} max={modalDrop.carte.quantite} required className="form-input"
                value={modalQte} onChange={e => setModalQte(Math.min(modalDrop.carte.quantite, Math.max(1, Number(e.target.value))))} />
            </div>
            {erreur && (
              <div style={{ background: '#1f0a0a', border: '1px solid #dc2626', borderRadius: '6px', padding: '8px 12px', color: '#ef4444', fontSize: '13px', marginBottom: '12px', display: 'flex', gap: '6px' }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} /> {erreur}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setModalDrop(null)}>Annuler</button>
              <button className="btn btn-primary" onClick={confirmerTransfert} disabled={loading}>
                {loading ? 'En cours...' : 'Confirmer le transfert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal absence technicien ── */}
      {modalAbsence && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '24px', maxWidth: '380px', width: '100%' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>
              {modalAbsence.absenceId ? 'Retirer l\'absence' : 'Déclarer absent'}
            </h3>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '16px' }}>
              <strong style={{ color: '#f1f5f9' }}>{modalAbsence.nom}</strong> — {new Date(modalAbsence.jour).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
            {!modalAbsence.absenceId && (
              <div className="form-group">
                <label className="form-label">Motif <span style={{ color: '#6b7280', fontWeight: 400 }}>(optionnel)</span></label>
                <input className="form-input" placeholder="Congé, maladie…" value={absenceMotif} onChange={e => setAbsenceMotif(e.target.value)} />
              </div>
            )}
            {modalAbsence.absenceId && (
              <p style={{ fontSize: '13px', color: '#f59e0b', marginBottom: '16px' }}>
                Retirer l'absence remettra ce technicien dans le calcul de capacité pour cette journée.
              </p>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setModalAbsence(null)}>Annuler</button>
              <button className={`btn ${modalAbsence.absenceId ? 'btn-secondary' : 'btn-danger'}`} onClick={toggleAbsence}>
                {modalAbsence.absenceId ? 'Retirer l\'absence' : 'Confirmer l\'absence'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal confirmation annulation transfert ── */}
      {confirmAnnuler !== null && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '10px', padding: '24px', maxWidth: '380px', width: '100%' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>Annuler ce transfert ?</h3>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '20px' }}>
              Les S/N associés seront remis en statut stock et la carte réapparaîtra dans le planning.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmAnnuler(null)}>Retour</button>
              <button className="btn btn-danger" onClick={async () => {
                await put(`/production/demandes/${confirmAnnuler}/annuler`, {})
                setConfirmAnnuler(null)
                reload()
              }}>
                Confirmer l'annulation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
