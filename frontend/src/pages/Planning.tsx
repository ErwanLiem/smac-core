import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X, AlertTriangle, Check } from 'lucide-react'
import { get, post, put } from '../api/client'

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

function dateStr(d: Date) {
  // Utiliser les composantes locales (pas UTC) pour éviter le décalage de timezone
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
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
  designationValeur: string
  clientValeur: string
  quantite: number
  ids: number[]
  caisses: Array<{ numero: string; quantite: number }>
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
  lignes: any[]
}

/**
 * Calcule la quantité maximum transférable sans découper une caisse physique.
 * Les caisses dont la quantité dépasse la capacité disponible ne sont pas comptées ;
 * les articles hors caisse peuvent être pris à l'unité.
 */
function qteMaxSansDecoupe(carte: Carte, capaciteMax: number, caisseFiltre: string): number {
  if (caisseFiltre) {
    const c = carte.caisses.find(x => x.numero === caisseFiltre)
    const qte = c?.quantite ?? carte.quantite
    return qte <= capaciteMax ? qte : 0
  }
  if (carte.caisses.length === 0) return Math.min(carte.quantite, capaciteMax)
  const totalEnCaisses = carte.caisses.reduce((s, c) => s + c.quantite, 0)
  const sansCaisse = carte.quantite - totalEnCaisses
  let restant = capaciteMax
  let total = 0
  for (const c of carte.caisses) {
    if (c.quantite <= restant) { total += c.quantite; restant -= c.quantite }
  }
  total += Math.min(Math.max(0, sansCaisse), restant)
  return total
}

/** Quantité totale disponible pour la caisse (ou la carte entière) sans tenir compte de la capacité ni de la règle de découpe. */
function qteAbsolue(carte: Carte, caisseFiltre: string): number {
  if (caisseFiltre) {
    const c = carte.caisses.find(x => x.numero === caisseFiltre)
    return c?.quantite ?? carte.quantite
  }
  return carte.quantite
}

function getDemandeCaisses(d: Demande): string[] {
  return [...new Set(
    (d.lignes ?? [])
      .map((l: any) => l.inventaire?.valeurs?.find((v: any) => v.champ?.code === 'CAISSE')?.valeur)
      .filter(Boolean)
  )] as string[]
}

interface Config {
  labelPN: string
  labelRMA: string
}

export default function Planning() {
  const siteId = getSiteId()
  const [lundi, setLundi] = useState(() => getLundi(new Date()))
  const [chargement, setChargement] = useState(true)
  const [cartes, setCartes]     = useState<Carte[]>([])
  const [capacite, setCapacite] = useState<Record<string, CapaciteJour>>({})
  const [demandes, setDemandes] = useState<Demande[]>([])
  const [config, setConfig]     = useState<Config>({ labelPN: 'P/N', labelRMA: 'RMA' })
  const [dragCarte, setDragCarte] = useState<Carte | null>(null)
  const [dropJour, setDropJour]   = useState<string | null>(null)
  const [modalDrop, setModalDrop] = useState<{ carte: Carte; jour: string } | null>(null)
  const [modalQte, setModalQte]   = useState(1)
  const [modalCaisseFiltre, setModalCaisseFiltre] = useState('')
  const [modalException, setModalException] = useState(false)
  const [modalAbsence, setModalAbsence] = useState<{ jour: string; techId: number; nom: string; absenceId: number | null; quotaBase: number } | null>(null)
  const [absenceMotif, setAbsenceMotif] = useState('')
  const [modalPresences, setModalPresences] = useState<string | null>(null)
  const [presencesSearch, setPresencesSearch] = useState('')
  const [confirmAnnuler, setConfirmAnnuler] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur]   = useState('')
  const [info, setInfo]       = useState('')
  const [quotaPartielInput, setQuotaPartielInput] = useState(0)
  const [showSamedi, setShowSamedi] = useState(false)

  const nbJours = showSamedi ? 6 : 5                                   // Lun→Ven ou Lun→Sam, jamais Dim
  const jours   = Array.from({ length: nbJours }, (_, i) => addDays(lundi, i))
  const debut   = dateStr(lundi)
  const fin     = dateStr(addDays(lundi, 5))                           // Toujours jusqu'au Sam pour les données

  useEffect(() => { reload() }, [siteId, lundi])

  async function reload() {
    const [cfg, c, cap, d] = await Promise.all([
      get<Config>(`/production/config/${siteId}`),
      get<Carte[]>(`/production/cartes/${siteId}`),
      get<Record<string, CapaciteJour>>(`/production/capacite/${siteId}?debut=${debut}&fin=${fin}`),
      get<Demande[]>(`/production/demandes/${siteId}`)
    ])
    setConfig(cfg)
    setCartes(c)
    setCapacite(cap)
    setDemandes(d)
    setChargement(false)
  }

  function getDemandesJour(jour: string) {
    return demandes.filter(d => d.datePlanifiee?.startsWith(jour) && d.statut !== 'ANNULEE')
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
    const cap = capacite[jour]?.capacite ?? 0
    const charge = getChargeJour(jour)
    const restant = Math.max(0, cap - charge)
    setModalQte(qteMaxSansDecoupe(dragCarte, restant, ''))
    setModalCaisseFiltre('')
    setModalException(false)
    setModalDrop({ carte: dragCarte, jour })
    setDragCarte(null)
    setErreur('')
    setInfo('')
  }

  async function confirmerTransfert() {
    if (!modalDrop) return
    const cap = capacite[modalDrop.jour]?.capacite ?? 0
    const charge = getChargeJour(modalDrop.jour)
    const restant = Math.max(0, cap - charge)
    if (!modalException && modalQte > restant) {
      setErreur(`Quantité demandée (${modalQte}) dépasse la capacité restante ce jour (${restant}).`)
      return
    }
    setLoading(true)
    setErreur('')
    setInfo('')
    try {
      const result = await post<any>(`/production/demandes/${siteId}/sn`, {
        datePlanifiee: modalDrop.jour,
        quantite: modalQte,
        pnValeur: modalDrop.carte.pnValeur,
        rmaValeur: modalDrop.carte.rmaValeur,
        clientValeur: modalDrop.carte.clientValeur,
        ...(modalCaisseFiltre ? { caisseValeur: modalCaisseFiltre } : {}),
        ...(modalException ? { force: true } : {})
      })
      setModalDrop(null)
      setModalCaisseFiltre('')
      setModalException(false)
      if (result?.quantite < result?.quantiteDemandee) {
        setInfo(`${result.quantite} article(s) planifié(s) sur ${result.quantiteDemandee} demandé(s) : une caisse ne peut pas être scindée, seules les caisses entièrement transférables ont été retenues.`)
      }
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
    const returnToBase = quotaPartielInput >= modalAbsence.quotaBase
    if (returnToBase && !modalAbsence.absenceId) {
      // Aucun changement à faire, juste fermer
      setModalAbsence(null)
      setAbsenceMotif('')
      return
    }
    if (returnToBase) {
      // Supprimer l'absence existante → revenir au quota de base
      await fetch(`/api/production/absences/${modalAbsence.absenceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
    } else {
      // Créer/remplacer une absence avec quotaOverride
      if (modalAbsence.absenceId) {
        await fetch(`/api/production/absences/${modalAbsence.absenceId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
      }
      await post('/production/absences', {
        technicienId: modalAbsence.techId,
        date: modalAbsence.jour,
        motif: absenceMotif || null,
        quotaOverride: quotaPartielInput
      })
    }
    setModalAbsence(null)
    setAbsenceMotif('')
    reload()
  }

  async function togglePresenceRapide(jour: string, tech: CapaciteJour['techniciens'][number]) {
    if (tech.absent || tech.quota < tech.quotaBase) {
      // Rétablir la présence complète → supprimer l'absence
      if (tech.absenceId) {
        await fetch(`/api/production/absences/${tech.absenceId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
      }
    } else {
      // Marquer absent (quotaOverride = 0)
      if (tech.absenceId) {
        await fetch(`/api/production/absences/${tech.absenceId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
      }
      await post('/production/absences', {
        technicienId: tech.id,
        date: jour,
        motif: null,
        quotaOverride: 0
      })
    }
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
          <span style={{ fontSize: '14px', color: '#9ca3af', minWidth: '210px', textAlign: 'center' }}>
            Semaine du {lundi.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} au {addDays(lundi, 6).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          <button className="btn btn-secondary" onClick={() => setLundi(l => addDays(l, 7))}><ChevronRight size={16} /></button>
          <button className="btn btn-secondary" onClick={() => setLundi(getLundi(new Date()))}>Aujourd'hui</button>
          <button
            className={`btn ${showSamedi ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowSamedi(s => !s)}
            title={showSamedi ? 'Masquer le samedi' : 'Afficher le samedi'}
          >
            Sam.
          </button>
        </div>
      </div>

      {/* Bannière d'erreur (hors modal) */}
      {erreur && !modalDrop && (
        <div style={{ background: '#1f0a0a', border: '1px solid #dc2626', borderRadius: '6px', padding: '10px 14px', color: '#ef4444', fontSize: '14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {erreur}
          </div>
          <button onClick={() => setErreur('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px', lineHeight: 1 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Bannière d'information (hors modal) */}
      {info && (
        <div style={{ background: '#0c1e2e', border: '1px solid #3b82f6', borderRadius: '6px', padding: '10px 14px', color: '#93c5fd', fontSize: '14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            ℹ️ {info}
          </div>
          <button onClick={() => setInfo('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px', lineHeight: 1 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {chargement ? (
        <div className="loading-container" style={{ flex: 1 }}><div className="loading-spinner" /></div>
      ) : (
      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>

        {/* ── Colonne cartes ── */}
        <div style={{ width: '230px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
            En stock ({cartes.reduce((s, c) => s + c.quantite, 0)} S/N)
          </p>
          {cartes.length === 0 && (
            <div style={{ background: '#1a1d27', borderRadius: '8px', padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
              Aucune machine en stock
            </div>
          )}
          {cartes.map((carte, idx) => (
            <div key={idx}
              draggable
              onDragStart={() => onDragStart(carte)}
              onDragEnd={onDragEnd}
              style={{
                background: '#1a1d27',
                border: dragCarte === carte ? '1px solid #3b82f6' : '1px solid #2d3748',
                borderRadius: '8px',
                padding: '9px 11px',
                cursor: 'grab',
                userSelect: 'none',
                opacity: dragCarte === carte ? 0.45 : 1,
                transition: 'all 0.1s'
              }}
            >
              {/* Client */}
              {carte.clientValeur && (
                <div style={{ marginBottom: '3px' }}>
                  <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '3px', background: '#1e293b', color: '#93c5fd', border: '1px solid #334155', fontWeight: 600 }}>
                    {carte.clientValeur}
                  </span>
                </div>
              )}
              {/* RMA */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '3px' }}>
                <span style={{ fontSize: '11px', color: '#6b7280', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{config.labelRMA}</span>
                <span style={{ fontWeight: 700, fontSize: '14px', color: '#f8fafc', lineHeight: 1.2 }}>{carte.rmaValeur || '—'}</span>
              </div>
              {/* P/N */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: carte.designationValeur ? '2px' : '5px' }}>
                <span style={{ fontSize: '11px', color: '#6b7280', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{config.labelPN}</span>
                <span style={{ fontWeight: 500, fontSize: '12px', color: '#e2e8f0' }}>{carte.pnValeur || '—'}</span>
              </div>
              {/* Désignation */}
              {carte.designationValeur && (
                <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {carte.designationValeur}
                </div>
              )}
              {/* Caisses */}
              {carte.caisses.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '5px' }}>
                  {carte.caisses.map(c => (
                    <span key={c.numero} style={{ fontSize: '11px', padding: '1px 5px', borderRadius: '3px', background: '#1f2937', color: '#cbd5e1', border: '1px solid #374151' }}>
                      📦 {c.numero} ({c.quantite})
                    </span>
                  ))}
                </div>
              )}
              {/* Pied de carte */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0' }}>{carte.quantite} S/N</span>
                <span style={{ fontSize: '11px', color: '#4b5563' }}>⠿ glisser</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Calendrier semaine ── */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${nbJours}, 1fr)`, gap: '8px', overflowY: 'auto' }}>
          {jours.map((jour, idx) => {
            const ds      = dateStr(jour)
            const today   = dateStr(new Date())
            const cap         = capacite[ds]
            const charge      = getChargeJour(ds)
            const restant     = (cap?.capacite ?? 0) - charge   // négatif = sur-capacité
            const surCapacite = restant < 0
            const isToday     = ds === today
            const isPast      = ds < today
            const isDrop      = dropJour === ds

            return (
              <div key={ds}
                onDragOver={e => onDragOver(e, ds)}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, ds)}
                style={{
                  background: isDrop ? '#1e3a5f' : isToday ? '#1a2438' : surCapacite ? '#1f0f0f' : '#1a1d27',
                  border: isDrop ? '2px dashed #3b82f6' : surCapacite ? '1px solid #dc2626' : isToday ? '1px solid #3b82f6' : isPast ? '1px solid #252836' : '1px solid #2d3748',
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
                  {/* Jour + date sur une ligne */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: isToday ? '#60a5fa' : isPast ? '#94a3b8' : '#e2e8f0' }}>{JOURS[idx]}</span>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: isPast ? '#6b7280' : '#cbd5e1' }}>
                      {jour.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                  {/* Capacité — 3 lignes séparées */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>Capacité</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1' }}>{cap?.capacite ?? 0}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>Planifié</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: charge > 0 ? '#e2e8f0' : '#4b5563' }}>{charge}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>Restant</span>
                      {surCapacite ? (
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#f87171' }}>⚠ +{Math.abs(restant)}</span>
                      ) : (
                        <span style={{ fontSize: '13px', fontWeight: 700, color: restant === 0 ? '#f59e0b' : '#f1f5f9' }}>{restant}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Présences — chip compact */}
                {(() => {
                  const techs = cap?.techniciens ?? []
                  if (techs.length === 0) return <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Aucun tech.</span>
                  const nbPresents = techs.filter(t => !t.absent).length
                  const nbAbsents  = techs.filter(t => t.absent).length
                  const nbPartiels = techs.filter(t => !t.absent && t.quota < t.quotaBase).length
                  return (
                    <button
                      onClick={() => { setModalPresences(ds); setPresencesSearch('') }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '6px 9px', background: '#0f172a', border: '1px solid #2d3748', borderRadius: '5px', cursor: 'pointer', marginBottom: '4px', gap: '4px' }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ color: '#f1f5f9' }}>👥 {nbPresents}/{techs.length}</span>
                        {nbAbsents > 0 && <span style={{ color: '#f87171' }}>· {nbAbsents} abs.</span>}
                        {nbPartiels > 0 && <span style={{ color: '#f1f5f9' }}>· {nbPartiels} part.</span>}
                      </span>
                      <span style={{ color: '#e2e8f0' }}>{cap?.capacite ?? 0} cap.</span>
                    </button>
                  )
                })()}

                {/* Demandes du jour */}
                {getDemandesJour(ds).map(d => {
                  const validee = d.statut === 'VALIDEE'
                  return (
                    <div key={d.id} style={{ background: validee ? '#0f2415' : '#1a1d27', borderRadius: '6px', padding: '6px 8px', border: `1px solid ${validee ? '#16a34a' : '#2d3748'}`, position: 'relative' }}>
                      {validee && (
                        <div style={{ position: 'absolute', top: '4px', right: '20px', color: '#4ade80', lineHeight: 1 }}>
                          <Check size={12} />
                        </div>
                      )}
                      <button
                        onClick={() => setConfirmAnnuler(d.id)}
                        title={validee ? 'Retirer ce transfert validé' : 'Annuler ce transfert'}
                        style={{ position: 'absolute', top: '4px', right: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#4b5563', padding: '2px', lineHeight: 1, borderRadius: '3px' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#4b5563')}
                      >
                        <X size={12} />
                      </button>
                      {d.rmaValeur
                        ? <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', paddingRight: '16px', lineHeight: 1.2, marginBottom: '2px' }}>{d.rmaValeur}</div>
                        : <div style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', paddingRight: '16px' }}>{d.type}</div>
                      }
                      {d.pnValeur && <div style={{ fontSize: '12px', color: '#e2e8f0', marginBottom: '2px' }}>{d.pnValeur}</div>}
                      {getDemandeCaisses(d).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', marginBottom: '3px' }}>
                          {getDemandeCaisses(d).map(c => (
                            <span key={c} style={{ fontSize: '12px', padding: '2px 6px', borderRadius: '4px', background: '#1f2937', color: '#e2e8f0', border: '1px solid #374151' }}>📦 {c}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: '#e2e8f0', marginTop: '1px' }}>× {d.quantite}</div>
                    </div>
                  )
                })}

                {isDrop && dragCarte && (
                  <div style={{ border: '2px dashed #3b82f6', borderRadius: '6px', padding: '8px', textAlign: 'center', fontSize: '13px', color: '#60a5fa' }}>
                    Déposer ici
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      )}

      {/* ── Modal confirmation transfert ── */}
      {modalDrop && (() => {
        const restant = Math.max(0, (capacite[modalDrop.jour]?.capacite ?? 0) - getChargeJour(modalDrop.jour))
        const maxQteNormal = qteMaxSansDecoupe(modalDrop.carte, restant, modalCaisseFiltre)
        const maxQteAbsolu = qteAbsolue(modalDrop.carte, modalCaisseFiltre)
        const maxQte = modalException ? maxQteAbsolu : maxQteNormal
        return (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '28px', maxWidth: '420px', width: '100%' }}>
            <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '16px' }}>Planifier le transfert</h3>
            <div style={{ background: '#0f172a', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '14px', color: '#cbd5e1' }}>
              <div><span style={{ color: '#6b7280' }}>{config.labelPN} :</span> <strong>{modalDrop.carte.pnValeur}</strong></div>
              <div><span style={{ color: '#6b7280' }}>{config.labelRMA} :</span> <strong>{modalDrop.carte.rmaValeur}</strong></div>
              <div><span style={{ color: '#6b7280' }}>Date :</span> <strong>{new Date(modalDrop.jour).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}</strong></div>
              <div style={{ marginTop: '6px', color: '#4ade80', fontSize: '13px' }}>
                Capacité restante ce jour : {Math.max(0, (capacite[modalDrop.jour]?.capacite ?? 0) - getChargeJour(modalDrop.jour))}
              </div>
            </div>
            {modalDrop.carte.caisses.length > 0 && (
              <div className="form-group">
                <label className="form-label">Caisse <span style={{ color: '#6b7280', fontWeight: 400 }}>(optionnel — filtre les S/N)</span></label>
                <select className="form-input" value={modalCaisseFiltre}
                  onChange={e => {
                    const num = e.target.value
                    setModalCaisseFiltre(num)
                    const cap = capacite[modalDrop.jour]?.capacite ?? 0
                    const charge = getChargeJour(modalDrop.jour)
                    const restantSel = Math.max(0, cap - charge)
                    setModalQte(modalException ? qteAbsolue(modalDrop.carte, num) : qteMaxSansDecoupe(modalDrop.carte, restantSel, num))
                  }}>
                  <option value="">— Toutes les caisses —</option>
                  {modalDrop.carte.caisses.map(c => (
                    <option key={c.numero} value={c.numero}>📦 {c.numero} ({c.quantite} S/N)</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">
                Quantité à transférer
                <span style={{ color: '#6b7280' }}> (max : {maxQte})</span>
              </label>
              <input type="number" min={1}
                max={maxQte}
                required className="form-input"
                value={modalQte}
                onChange={e => setModalQte(Math.min(Math.max(1, maxQte), Math.max(1, Number(e.target.value))))} />
              {!modalException && !modalCaisseFiltre && modalDrop.carte.caisses.length > 0 && (
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  ℹ️ Une caisse physique ne peut pas être scindée : seules les caisses entièrement transférables sont prises en compte.
                </p>
              )}
              {!modalException && maxQte === 0 && (
                <p style={{ fontSize: '12px', color: '#f87171', marginTop: '4px' }}>
                  ⚠️ {modalCaisseFiltre
                    ? `Cette caisse ne tient pas dans la capacité restante (${restant}) et ne peut pas être scindée. Choisissez une autre caisse ou un autre jour.`
                    : `Aucune caisse complète ne tient dans la capacité restante (${restant}). Choisissez une caisse spécifique ou un autre jour.`}
                </p>
              )}
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#1f1709', border: '1px solid #92400e', borderRadius: '6px', padding: '10px 12px' }}>
              <input
                type="checkbox"
                id="modalException"
                checked={modalException}
                onChange={e => {
                  const checked = e.target.checked
                  setModalException(checked)
                  setModalQte(checked ? maxQteAbsolu : maxQteNormal)
                }}
                style={{ marginTop: '3px' }}
              />
              <label htmlFor="modalException" style={{ fontSize: '12px', color: '#fbbf24', cursor: 'pointer' }}>
                Réception exceptionnelle : autoriser le découpage d'une caisse et/ou le dépassement de la capacité du jour pour ce dispatch.
              </label>
            </div>
            {modalException && (
              <p style={{ fontSize: '12px', color: '#f59e0b', marginTop: '4px', marginBottom: '12px' }}>
                ⚠️ Le découpage de caisse et le dépassement de capacité sont autorisés pour ce transfert. Le jour apparaîtra en sur-capacité dans le planning.
              </p>
            )}
            {erreur && (
              <div style={{ background: '#1f0a0a', border: '1px solid #dc2626', borderRadius: '6px', padding: '8px 12px', color: '#ef4444', fontSize: '14px', marginBottom: '12px', display: 'flex', gap: '6px' }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '2px' }} /> {erreur}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setModalDrop(null)}>Annuler</button>
              <button className="btn btn-primary" onClick={confirmerTransfert} disabled={loading || maxQte === 0}>
                {loading ? 'En cours...' : 'Confirmer le transfert'}
              </button>
            </div>
          </div>
        </div>
        )
      })()}

      {/* ── Modal gestion des présences (liste complète) ── */}
      {modalPresences && (() => {
        const ds    = modalPresences
        const techs = capacite[ds]?.techniciens ?? []
        const recherche = presencesSearch.toLowerCase().trim()
        const filtres = recherche
          ? techs.filter(t => `${t.utilisateur.prenom} ${t.utilisateur.nom}`.toLowerCase().includes(recherche))
          : techs
        const nbPresents = techs.filter(t => !t.absent).length
        const nbAbsents  = techs.filter(t => t.absent).length
        const nbPartiels = techs.filter(t => !t.absent && t.quota < t.quotaBase).length
        return (
          <div className="modal-overlay">
            <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '24px', maxWidth: '520px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
                    Présences — {new Date(ds).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </h3>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '13px' }}>
                    <span style={{ color: '#4ade80' }}>✓ {nbPresents} présent{nbPresents > 1 ? 's' : ''}</span>
                    {nbPartiels > 0 && <span style={{ color: '#f59e0b' }}>~ {nbPartiels} partiel{nbPartiels > 1 ? 's' : ''}</span>}
                    {nbAbsents  > 0 && <span style={{ color: '#f87171' }}>✗ {nbAbsents} absent{nbAbsents > 1 ? 's' : ''}</span>}
                    <span style={{ color: '#94a3b8' }}>· cap. {capacite[ds]?.capacite ?? 0}</span>
                  </div>
                </div>
                <button onClick={() => setModalPresences(null)}
                  style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '0 2px' }}>×</button>
              </div>

              {/* ── Alerte sur-capacité ── */}
              {(() => {
                const chargeJour = getChargeJour(ds)
                const capJour    = capacite[ds]?.capacite ?? 0
                if (chargeJour <= capJour) return null
                const surplus    = chargeJour - capJour
                // Toutes les demandes actives (EN_ATTENTE et VALIDEE) sont retirables
                const transferts = getDemandesJour(ds).filter(d => d.statut !== 'ANNULEE')
                return (
                  <div style={{ background: '#1f0a0a', border: '1px solid #dc2626', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
                    <div style={{ color: '#f87171', fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                      ⚠ Sur-capacité — {surplus} transfert{surplus > 1 ? 's' : ''} en trop
                    </div>
                    <div style={{ color: '#fca5a5', fontSize: '12px', marginBottom: transferts.length > 0 ? '10px' : '0' }}>
                      Capacité actuelle : {capJour} · Planifié : {chargeJour}
                    </div>
                    {transferts.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {transferts.map(d => {
                          const caisses = getDemandeCaisses(d)
                          const estValidee = d.statut === 'VALIDEE'
                          return (
                            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#2d0f0f', borderRadius: '5px', padding: '6px 10px' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontWeight: 600, fontSize: '13px', color: '#f1f5f9' }}>{d.rmaValeur || d.type}</span>
                                {d.pnValeur && <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '6px' }}>{d.pnValeur}</span>}
                                {caisses.length > 0 && (
                                  <span style={{ fontSize: '12px', color: '#e2e8f0', marginLeft: '6px' }}>
                                    {caisses.map(c => `📦 ${c}`).join(' ')}
                                  </span>
                                )}
                                <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '6px' }}>× {d.quantite}</span>
                                {estValidee && (
                                  <span style={{ fontSize: '11px', marginLeft: '6px', padding: '1px 5px', borderRadius: '3px', background: '#052e16', color: '#4ade80' }}>validé</span>
                                )}
                              </div>
                              <button
                                onClick={async () => {
                                  await put(`/production/demandes/${d.id}/annuler`, {})
                                  reload()
                                }}
                                style={{ flexShrink: 0, fontSize: '12px', padding: '4px 11px', background: '#7f1d1d', border: '1px solid #dc2626', borderRadius: '4px', color: '#fca5a5', cursor: 'pointer', fontWeight: 600 }}
                              >
                                Retirer
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Recherche */}
              {techs.length > 6 && (
                <input
                  className="form-input"
                  placeholder="🔍 Rechercher un technicien..."
                  value={presencesSearch}
                  onChange={e => setPresencesSearch(e.target.value)}
                  style={{ marginBottom: '10px', fontSize: '13px' }}
                  autoFocus
                />
              )}

              {/* Liste */}
              <div style={{ overflowY: 'auto', flex: 1, marginBottom: '12px' }}>
                {filtres.length === 0 && (
                  <p style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', padding: '20px' }}>Aucun technicien trouvé</p>
                )}
                {filtres.map((tech, i) => {
                  const estAbsent  = tech.absent
                  const estPartiel = !tech.absent && tech.quota < tech.quotaBase
                  const estPresent = !tech.absent && tech.quota >= tech.quotaBase
                  return (
                    <div key={tech.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 4px', borderBottom: i < filtres.length - 1 ? '1px solid #1f2937' : 'none' }}>
                      {/* Nom */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: '14px', color: estAbsent ? '#6b7280' : '#f1f5f9', textDecoration: estAbsent ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {tech.utilisateur.prenom} {tech.utilisateur.nom}
                        </div>
                        {tech.absenceMotif && <div style={{ fontSize: '12px', color: '#6b7280' }}>{tech.absenceMotif}</div>}
                      </div>
                      {/* Badge statut */}
                      <div style={{ flexShrink: 0 }}>
                        {estAbsent  && <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: '#1f0a0a', color: '#f87171' }}>Absent</span>}
                        {estPartiel && <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: '#1c1200', color: '#f59e0b' }}>Partiel {tech.quota}/{tech.quotaBase}</span>}
                        {estPresent && <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: '#052e16', color: '#4ade80' }}>Présent ({tech.quota})</span>}
                      </div>
                      {/* Toggle rapide */}
                      <button
                        title={estAbsent || estPartiel ? 'Rétablir présence complète' : 'Marquer absent'}
                        onClick={() => togglePresenceRapide(ds, tech)}
                        style={{ flexShrink: 0, width: '30px', height: '30px', borderRadius: '6px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', background: estAbsent || estPartiel ? '#052e16' : '#1f0a0a', color: estAbsent || estPartiel ? '#4ade80' : '#f87171' }}
                      >
                        {estAbsent || estPartiel ? '✓' : '✗'}
                      </button>
                      {/* Ajuster (quota partiel / motif) */}
                      <button
                        title="Ajuster quota et motif"
                        onClick={() => {
                          setModalAbsence({ jour: ds, techId: tech.id, nom: `${tech.utilisateur.prenom} ${tech.utilisateur.nom}`, absenceId: tech.absenceId, quotaBase: tech.quotaBase })
                          setAbsenceMotif(tech.absenceMotif ?? '')
                          setQuotaPartielInput(tech.absent ? tech.quota : tech.quotaBase)
                          setModalPresences(null)
                        }}
                        style={{ flexShrink: 0, fontSize: '12px', padding: '4px 9px', background: 'none', border: '1px solid #374151', borderRadius: '5px', color: '#9ca3af', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Ajuster
                      </button>
                    </div>
                  )
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setModalPresences(null)}>Fermer</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Modal présence / absence technicien ── */}
      {modalAbsence && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '24px', maxWidth: '400px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Ajuster la présence</h3>
            <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '12px' }}>
              <strong style={{ color: '#f1f5f9' }}>{modalAbsence.nom}</strong>
              {' — '}
              {new Date(modalAbsence.jour).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
            <div style={{ background: '#0f172a', borderRadius: '6px', padding: '8px 12px', marginBottom: '16px', fontSize: '13px', color: '#9ca3af' }}>
              Quota de base : <strong style={{ color: '#f1f5f9' }}>{modalAbsence.quotaBase} machine{modalAbsence.quotaBase > 1 ? 's' : ''}</strong>
            </div>
            <div className="form-group">
              <label className="form-label">
                Quota pour ce jour <span style={{ color: '#6b7280', fontWeight: 400 }}>(0 = absent)</span>
              </label>
              <input
                type="number" min={0} max={modalAbsence.quotaBase} className="form-input"
                value={quotaPartielInput}
                onChange={e => setQuotaPartielInput(Math.max(0, Math.min(modalAbsence.quotaBase, Number(e.target.value))))}
              />
              {quotaPartielInput === 0 && (
                <p style={{ fontSize: '12px', color: '#f87171', marginTop: '4px' }}>⚠️ Technicien absent — quota = 0 pour cette journée.</p>
              )}
              {quotaPartielInput > 0 && quotaPartielInput < modalAbsence.quotaBase && (
                <p style={{ fontSize: '12px', color: '#60a5fa', marginTop: '4px' }}>ℹ️ Présence partielle — quota réduit à {quotaPartielInput} pour cette journée.</p>
              )}
              {quotaPartielInput >= modalAbsence.quotaBase && modalAbsence.absenceId && (
                <p style={{ fontSize: '12px', color: '#4ade80', marginTop: '4px' }}>✓ Quota de base rétabli — l'absence sera supprimée.</p>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Motif <span style={{ color: '#6b7280', fontWeight: 400 }}>(optionnel)</span></label>
              <input className="form-input" placeholder="Congé, maladie, demi-journée…" value={absenceMotif} onChange={e => setAbsenceMotif(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setModalAbsence(null)}>Annuler</button>
              <button
                className={`btn ${quotaPartielInput === 0 ? 'btn-danger' : quotaPartielInput >= modalAbsence.quotaBase && modalAbsence.absenceId ? 'btn-secondary' : 'btn-primary'}`}
                onClick={toggleAbsence}
              >
                {quotaPartielInput >= modalAbsence.quotaBase
                  ? (modalAbsence.absenceId ? 'Retirer l\'absence' : 'Fermer')
                  : quotaPartielInput === 0
                  ? 'Marquer absent'
                  : 'Appliquer présence partielle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal confirmation annulation transfert ── */}
      {confirmAnnuler !== null && (() => {
        const d = demandes.find(x => x.id === confirmAnnuler)
        const estValidee = d?.statut === 'VALIDEE'
        return (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '10px', padding: '24px', maxWidth: '380px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>
              {estValidee ? 'Retirer ce transfert validé ?' : 'Annuler ce transfert ?'}
            </h3>
            <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '20px' }}>
              {estValidee
                ? 'Ce transfert a déjà été validé. Les S/N associés seront remis en statut stock et la carte réapparaîtra dans le planning.'
                : 'Les S/N associés seront remis en statut stock et la carte réapparaîtra dans le planning.'
              }
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
        )
      })()}
    </div>
  )
}
