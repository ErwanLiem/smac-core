import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, AlertTriangle, Lock, Copy } from 'lucide-react'
import { attendusApi } from '../api/attendus'
import { get } from '../api/client'
import { getSiteId } from '../utils/permissions'
import { jouerSonAlerte } from '../utils/sons'
import { COLONNES_INVENTAIRE, getLabelColonne } from '../constants/colonnesInventaire'

interface Ligne {
  id: number
  pn: string
  sn: string
  panneClient: string | null
  garantie: string | null
  statut: string
  snRecu: string | null
  accessoires: string | null
  notes: string | null
  caisse: string | null
}

interface Attendu {
  id: number
  rma: string | null
  bt: string | null
  statut: string
  createdAt: string
  closedAt: string | null
  donneesCommunes: string | null
  lignes: Ligne[]
}

interface Rapport {
  nonRecus: Ligne[]
  inattendus: Ligne[]
  doublonsInventaire: Ligne[]
  recus: Ligne[]
  total: number
}

interface ArticleAccessoire {
  id: number
  label: string
}
interface Emplacement { id: number; nom: string; capaciteMax: number; remplissage: number }

const CODES_NOM       = ['NOM', 'NAME', 'LIBELLE', 'RAISON_SOCIALE']
const CODES_CLIENT    = ['CLIENT', 'CLIENTS']
const CODES_PLATEFORME = ['PLATEFORME', 'PLATEFORMES']

function getEntiteLabel(entite: any, champs: any[]): string {
  const champNom = champs.find((c: any) => CODES_NOM.includes(c.code.toUpperCase()))
  const val = champNom ? entite.valeurs?.find((v: any) => v.champId === champNom.id)?.valeur : null
  return val || entite.valeurs?.map((v: any) => v.valeur).filter(Boolean)[0] || `#${entite.id}`
}

export default function AttendusDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const snInputRef = useRef<HTMLInputElement>(null)
  const caisseInputRef = useRef<HTMLInputElement>(null)
  const okAlerteRef = useRef<HTMLButtonElement>(null)
  const siteId = getSiteId()

  const [attendu, setAttendu] = useState<Attendu | null>(null)
  const [articlesAccessoires, setArticlesAccessoires] = useState<ArticleAccessoire[]>([])
  const [pnActif, setPnActif] = useState<string | null>(null)
  const [snSaisie, setSnSaisie] = useState('')
  const [caisseActive, setCaisseActive] = useState('')
  const [emplacementId, setEmplacementId] = useState<number>(0)
  const [emplacements, setEmplacements]   = useState<Emplacement[]>([])
  const [dernierScan, setDernierScan] = useState<{ resultat: string; pn?: string; dejaEnInventaire?: boolean; sn?: string } | null>(null)
  const [alerteScan, setAlerteScan] = useState<{ type: 'DEJA_SCANNE' | 'DEJA_INVENTAIRE'; sn: string; pn?: string } | null>(null)
  const [accessoiresParLigne, setAccessoiresParLigne] = useState<Record<number, number[]>>({})
  const [showRapport, setShowRapport] = useState(false)
  const [rapport, setRapport] = useState<Rapport | null>(null)
  const [showCloturer, setShowCloturer] = useState(false)
  const [erreurCloture, setErreurCloture] = useState<{ message: string; snsEnDoublon: string[]; champsManquants?: string[] } | null>(null)
  const [showValider, setShowValider] = useState(false)
  const [validerOk, setValiderOk] = useState<{ lignesInjectees: number; snDoublons?: string[] } | null>(null)
  const [copie, setCopie] = useState(false)
  const [editInfos, setEditInfos] = useState(false)
  const [editDonnees, setEditDonnees] = useState<Record<string, string>>({})
  const [configChamps, setConfigChamps] = useState<{ code: string; visible: boolean; obligatoire: boolean; visibleListe: boolean; obligatoireCloture?: boolean }[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [champsClients, setChampsClients] = useState<any[]>([])
  const [plateformes, setPlateformes] = useState<any[]>([])
  const [champsPlateformes, setChampsPlateformes] = useState<any[]>([])

  useEffect(() => { reload() }, [id])
  useEffect(() => { if (alerteScan) okAlerteRef.current?.focus() }, [alerteScan])


  async function reload() {
    const [data, arts, champsArts, plats, champsPlats, cl, cc, cfg, emps] = await Promise.all([
      attendusApi.getDetail(Number(id)),
      get<any[]>(`/articles/${siteId}`),
      get<any[]>(`/articles/${siteId}/champs`),
      get<any[]>(`/plateformes/${siteId}`),
      get<any[]>(`/plateformes/${siteId}/champs`),
      get<any[]>(`/clients/${siteId}`),
      get<any[]>(`/clients/${siteId}/champs`),
      get<any>(`/config-attendus/${siteId}`),
      get<Emplacement[]>(`/emplacements/${siteId}`)
    ])
    setAttendu(data)
    setEmplacements(emps)
    setPlateformes(plats)
    setChampsPlateformes(champsPlats.filter((c: any) => c.actif))
    setClients(cl)
    setChampsClients(cc.filter((c: any) => c.actif))

    // Initialiser editDonnees depuis donneesCommunes
    let donnees: Record<string, string> = {}
    if (data.donneesCommunes) { try { donnees = JSON.parse(data.donneesCommunes) } catch {} }
    setEditDonnees(donnees)

    // Config champs attendu
    if (cfg?.config?.champsAttendu) {
      try {
        const parsed = typeof cfg.config.champsAttendu === 'string' ? JSON.parse(cfg.config.champsAttendu) : cfg.config.champsAttendu
        setConfigChamps(parsed)
      } catch {}
    }
    // Initialiser les accessoires cochés depuis les données existantes
    const accMap: Record<number, number[]> = {}
    data.lignes.forEach((l: Ligne) => {
      if (l.accessoires) {
        try {
          const labels: string[] = JSON.parse(l.accessoires)
          // sera recalculé après chargement des articles
          accMap[l.id] = labels as any
        } catch {}
      }
    })

    // Filtrer les articles accessoires (type = ACCESSOIRE)
    const champsTypeIds = champsArts.filter((c: any) =>
      ['TYPE', 'TYPE_PRODUIT', 'CATEGORIE'].includes(c.code.toUpperCase())
    ).map((c: any) => c.id)

    const acc = arts
      .filter((a: any) => a.valeurs.some((v: any) =>
        champsTypeIds.includes(v.champId) && String(v.valeur ?? '').toUpperCase() === 'ACCESSOIRE'
      ))
      .map((a: any) => {
        const desig = a.valeurs.find((v: any) =>
          ['DESIGNATION', 'NOM', 'LIBELLE'].includes(v.champ?.code?.toUpperCase?.() ?? '')
        )?.valeur
        const pn = a.valeurs.find((v: any) =>
          ['PN', 'P_N', 'PART_NUMBER'].includes(v.champ?.code?.toUpperCase?.() ?? '')
        )?.valeur
        return { id: a.id, label: desig || pn || `Accessoire #${a.id}` }
      })
    setArticlesAccessoires(acc)
  }

  function groupParPN(lignes: Ligne[]): Record<string, Ligne[]> {
    const groups: Record<string, Ligne[]> = {}
    for (const l of lignes) {
      if (!groups[l.pn]) groups[l.pn] = []
      groups[l.pn].push(l)
    }
    return groups
  }

  async function scannerSN(e: React.FormEvent) {
    e.preventDefault()
    if (!snSaisie.trim() || !pnActif) return
    if (!caisseActive.trim() || alerteScan) return
    try {
      const res = await fetch(`/api/attendus/${id}/scanner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ sn: snSaisie.trim(), pn: pnActif, accessoires: [], caisse: caisseActive || undefined, emplacementId: emplacementId || undefined })
      })
      const result = await res.json()
      const snScanne = snSaisie.trim()
      setDernierScan({ ...result, sn: snScanne })
      setSnSaisie('')

      // Ouvrir modal + son si problème
      if (result.resultat === 'DEJA_SCANNE') {
        jouerSonAlerte()
        setAlerteScan({ type: 'DEJA_SCANNE', sn: snScanne, pn: result.pn })
      } else if (result.dejaEnInventaire) {
        // Alerte doublon inventaire quelle que soit la situation (RECU ou INATTENDU)
        jouerSonAlerte()
        setAlerteScan({ type: 'DEJA_INVENTAIRE', sn: snScanne, pn: result.pn })
      }

      reload()
    } catch {
      setDernierScan({ resultat: 'ERREUR' })
    }
    snInputRef.current?.focus()
  }

  async function toggleAccessoireLigne(ligneId: number, accLabel: string, checked: boolean) {
    const ligne = attendu?.lignes.find(l => l.id === ligneId)
    if (!ligne) return
    let accs: string[] = []
    try { accs = ligne.accessoires ? JSON.parse(ligne.accessoires) : [] } catch {}
    if (checked) {
      accs = [...accs, accLabel]
    } else {
      accs = accs.filter(a => a !== accLabel)
    }
    await attendusApi.updateLigne(ligneId, { accessoires: JSON.stringify(accs) })
    reload()
  }

  async function handleSaveInfos() {
    await attendusApi.update(Number(id), { donneesCommunes: editDonnees })
    setEditInfos(false)
    reload()
  }

  async function handleValider() {
    try {
      const result = await attendusApi.valider(Number(id))
      setValiderOk(result)
      setShowValider(false)
      reload()
    } catch (e: any) {
      alert('Erreur lors de la validation : ' + e.message)
    }
  }

  async function handleCloturer() {
    try {
      const result = await attendusApi.cloturer(Number(id))
      setShowCloturer(false)
      setErreurCloture(null)
      setValiderOk(result)
      reload()
    } catch (e: any) {
      if (e.data?.snsEnDoublon || e.data?.champsManquants) {
        setErreurCloture({ message: e.data.error, snsEnDoublon: e.data.snsEnDoublon || [], champsManquants: e.data.champsManquants })
        setShowCloturer(false)
      } else {
        alert('Erreur : ' + e.message)
      }
    }
  }

  async function handleRapport() {
    const data = await attendusApi.rapport(Number(id))
    setRapport(data)
    setShowRapport(true)
  }

  function texteRapportEmail(): string {
    if (!rapport || !attendu) return ''
    const rmaName = attendu.rma || 'N/A'
    const champClientCode = configChamps.find(c => CODES_CLIENT.includes(c.code.toUpperCase()))?.code
    const clientName = (champClientCode && editDonnees[champClientCode]) || editDonnees['customer'] || 'N/A'
    const hasEcarts = rapport.nonRecus.length > 0 || rapport.inattendus.length > 0 || (rapport.doublonsInventaire?.length ?? 0) > 0

    const lines: string[] = []
    lines.push('Hi everyone,')
    lines.push('')

    if (!hasEcarts) {
      lines.push(`I confirm receipt of the RMA ${rmaName} from customer ${clientName}.`)
      lines.push('It is complete and compliant.')
    } else {
      lines.push(`I confirm receipt of the RMA ${rmaName} from customer ${clientName}.`)
      lines.push('')
      lines.push('Errors were identified during the review.')
      lines.push('')

      if (rapport.nonRecus.length > 0) {
        lines.push(`Missing S/N (${rapport.nonRecus.length}):`)
        const byPN = groupParPN(rapport.nonRecus)
        for (const [pn, ligs] of Object.entries(byPN)) {
          lines.push(`  P/N ${pn}:`)
          ligs.forEach(l => lines.push(`    - ${l.sn}`))
        }
        lines.push('')
      }

      if (rapport.inattendus.length > 0) {
        lines.push(`Unexpected S/N (${rapport.inattendus.length}):`)
        rapport.inattendus.forEach(l => lines.push(`  - ${l.sn} (P/N: ${l.pn})`))
        lines.push('')
      }

      if (rapport.doublonsInventaire && rapport.doublonsInventaire.length > 0) {
        lines.push(`S/N already in inventory (${rapport.doublonsInventaire.length}):`)
        rapport.doublonsInventaire.forEach(l => lines.push(`  - ${l.sn} — ${l.notes || 'Already in inventory'}`))
        lines.push('')
      }
    }

    lines.push('Regards,')
    return lines.join('\n')
  }

  function copierRapport() {
    navigator.clipboard.writeText(texteRapportEmail())
    setCopie(true)
    setTimeout(() => setCopie(false), 2000)
  }

  if (!attendu) return <div style={{ padding: '40px', color: '#94a3b8' }}>Chargement...</div>

  const isClos = attendu.statut === 'CLOS'
  const lignesNormales = attendu.lignes.filter(l => l.statut !== 'INATTENDU' && l.statut !== 'DOUBLON_INVENTAIRE')
  const inattendus = attendu.lignes.filter(l => l.statut === 'INATTENDU')
  const doublonsInv = attendu.lignes.filter(l => l.statut === 'DOUBLON_INVENTAIRE')
  const groupes = groupParPN(lignesNormales)
  const totalAttendu = lignesNormales.length
  const totalRecu = lignesNormales.filter(l => l.statut === 'RECU' || l.statut === 'INJECTE').length
  const lignesPNActif = pnActif ? (groupes[pnActif] || []) : []

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <button onClick={() => navigate('/attendus')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '13px' }}>← Réceptions attendues</button>
            {isClos && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: '#1e2130', color: '#94a3b8', padding: '2px 8px', borderRadius: '4px' }}><Lock size={11} /> Clôturé</span>}
          </div>
          <h1 className="page-title">
            {(() => {
              const colonnes = configChamps.filter(c => c.visibleListe)
              if (colonnes.length > 0 && editDonnees[colonnes[0].code]) return editDonnees[colonnes[0].code]
              if (attendu.rma) return attendu.rma
              return `Réception prévue #${attendu.id}`
            })()}
          </h1>
          <p className="page-subtitle">
            {configChamps.filter(c => c.visibleListe).slice(1).map(c => {
              return editDonnees[c.code] ? `${getLabelColonne(c.code)} : ${editDonnees[c.code]}` : null
            }).filter(Boolean).join(' · ')}
            {configChamps.filter(c => c.visibleListe).slice(1).some(c => editDonnees[c.code]) ? ' · ' : ''}
            {new Date(attendu.createdAt).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isClos && <button className="btn btn-secondary" onClick={() => setEditInfos(true)}>Modifier infos</button>}
          <button className="btn btn-secondary" onClick={handleRapport}>Rapport d'erreur</button>
          {!isClos && (
            <>
              <button className="btn btn-danger" style={{ background: '#dc2626', color: 'white', borderColor: '#dc2626' }} onClick={() => setShowCloturer(true)}>
                <Lock size={14} /> Clôturer et enregistrer
              </button>
            </>
          )}
        </div>
      </div>

      {/* Barre de progression globale */}
      <div style={{ background: '#1a1d27', border: '1px solid #2d3148', borderRadius: '8px', padding: '10px 16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ flex: 1, background: '#1e2130', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
          <div style={{ background: '#2563eb', height: '100%', width: `${totalAttendu > 0 ? (totalRecu / totalAttendu) * 100 : 0}%`, transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#2563eb', whiteSpace: 'nowrap' }}>{totalRecu} / {totalAttendu} reçus</span>
        {inattendus.length > 0 && <span style={{ fontSize: '12px', color: '#f59e0b' }}>⚠️ {inattendus.length} inattendu{inattendus.length > 1 ? 's' : ''}</span>}
      </div>

      {/* Corps principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '12px' }}>

        {/* Colonne gauche — cartes PN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Object.entries(groupes).map(([pn, lignes]) => {
            const recus = lignes.filter(l => l.statut === 'RECU' || l.statut === 'INJECTE').length
            const total = lignes.length
            const complet = recus === total
            const actif = pnActif === pn

            return (
              <div key={pn}
                onClick={() => { setPnActif(pn); setDernierScan(null); setSnSaisie(''); if (!isClos) setTimeout(() => snInputRef.current?.focus(), 100) }}
                style={{
                  border: `2px solid ${actif ? '#2563eb' : complet ? '#4ade80' : '#2d3148'}`,
                  borderRadius: '8px', padding: '12px',
                  background: actif ? '#1e3a5f' : complet ? '#1e3a1e' : '#1a1d27',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <code style={{ fontSize: '11px', fontWeight: 600, color: actif ? '#60a5fa' : '#cbd5e1' }}>{pn}</code>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: complet ? '#16a34a' : '#2563eb' }}>{recus}/{total}</span>
                </div>
                <div style={{ background: '#1e2130', borderRadius: '3px', height: '4px', overflow: 'hidden' }}>
                  <div style={{ background: complet ? '#16a34a' : '#2563eb', height: '100%', width: `${(recus / total) * 100}%` }} />
                </div>
                {complet && <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={11} /> Complet</div>}
              </div>
            )
          })}

          {/* Inattendus */}
          {inattendus.length > 0 && (
            <div style={{ border: '2px solid #fcd34d', borderRadius: '8px', padding: '12px', background: '#2d2200' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#fbbf24', marginBottom: '8px' }}>
                ⚠️ Inattendus ({inattendus.length})
              </div>
              {inattendus.map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#fbbf24', fontWeight: 600 }}>{l.sn}</div>
                  {!isClos && (
                    <button
                      onClick={async () => { await attendusApi.descanner(l.id); reload() }}
                      title="Annuler ce scan inattendu"
                      style={{ background: 'none', border: '1px solid #fcd34d', borderRadius: '4px', cursor: 'pointer', color: '#fbbf24', padding: '2px 6px', fontSize: '11px', marginLeft: '6px', flexShrink: 0 }}
                    >
                      ✕ Annuler
                    </button>
                  )}
                </div>
              ))}
              {!isClos && inattendus.length > 0 && (
                <button
                  onClick={async () => { for (const l of inattendus) await attendusApi.descanner(l.id); reload() }}
                  style={{ marginTop: '6px', width: '100%', fontSize: '11px', padding: '4px', background: '#92400e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  ✕ Tout annuler
                </button>
              )}
            </div>
          )}

          {/* Déjà en inventaire */}
          {doublonsInv.length > 0 && (
            <div style={{ border: '2px solid #f9a8d4', borderRadius: '8px', padding: '12px', background: '#2d0a1e' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#be185d', marginBottom: '8px' }}>
                🔴 Déjà en inventaire ({doublonsInv.length})
              </div>
              {doublonsInv.map(l => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#be185d', fontWeight: 600 }}>{l.sn}</div>
                    {l.notes && <div style={{ fontSize: '10px', color: '#9d174d', marginTop: '1px' }}>{l.notes}</div>}
                  </div>
                  {!isClos && (
                    <button
                      onClick={async () => {
                        await attendusApi.descanner(l.id)
                        reload()
                      }}
                      title="Déscannerle S/N — remet en attente"
                      style={{ background: 'none', border: '1px solid #f9a8d4', borderRadius: '4px', cursor: 'pointer', color: '#be185d', padding: '2px 6px', fontSize: '11px', marginLeft: '6px', flexShrink: 0 }}
                    >
                      ✕ Annuler
                    </button>
                  )}
                </div>
              ))}
              {!isClos && doublonsInv.length > 0 && (
                <button
                  onClick={async () => {
                    for (const l of doublonsInv) await attendusApi.descanner(l.id)
                    reload()
                  }}
                  style={{ marginTop: '6px', width: '100%', fontSize: '11px', padding: '4px', background: '#be185d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  ✕ Tout annuler
                </button>
              )}
            </div>
          )}
        </div>

        {/* Colonne droite — panneau de scan */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!pnActif ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '40px' }}>←</div>
              <p style={{ fontSize: '14px' }}>{isClos ? 'Sélectionnez un P/N pour voir les détails' : 'Sélectionnez un P/N pour commencer le scan'}</p>
            </div>
          ) : (
            <>
              {/* Zone de scan */}
              {!isClos && (
                <div className="card">
                  <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Scanner un S/N</h3>
                  <p style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '10px' }}>P/N actif : <code style={{ background: '#1e3a5f', color: '#2563eb', padding: '1px 6px', borderRadius: '4px' }}>{pnActif}</code></p>

                  {/* Caisse active */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', padding: '8px 12px', background: caisseActive ? '#1c2a1c' : '#1a1d27', border: `1px solid ${caisseActive ? '#4ade80' : '#374151'}`, borderRadius: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>📦 Caisse :</span>
                    <input
                      ref={caisseInputRef}
                      className="form-input"
                      placeholder="Scanner ou saisir le n° de caisse..."
                      value={caisseActive}
                      onChange={e => setCaisseActive(e.target.value.trim())}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); snInputRef.current?.focus() } }}
                      style={{ flex: 1, padding: '4px 8px', fontSize: '13px', fontWeight: caisseActive ? 700 : 400, color: caisseActive ? '#4ade80' : '#9ca3af', background: 'transparent', border: 'none', outline: 'none' }}
                    />
                    {caisseActive && (
                      <button type="button" onClick={() => { setCaisseActive(''); caisseInputRef.current?.focus() }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '16px', lineHeight: 1 }}>×</button>
                    )}
                  </div>

                  {!caisseActive && (
                    <p style={{ fontSize: '12px', color: '#f59e0b', marginTop: '6px', marginBottom: '6px' }}>
                      ⚠️ Renseignez le numéro de caisse avant de scanner des S/N.
                    </p>
                  )}

                  {emplacements.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', marginBottom: '4px', padding: '8px 12px', background: emplacementId ? '#1c2838' : '#1a1d27', border: `1px solid ${emplacementId ? '#60a5fa' : '#374151'}`, borderRadius: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>📍 Emplacement :</span>
                      <select
                        value={emplacementId}
                        onChange={e => setEmplacementId(Number(e.target.value))}
                        style={{ flex: 1, padding: '4px 8px', fontSize: '13px', fontWeight: emplacementId ? 700 : 400, color: emplacementId ? '#60a5fa' : '#9ca3af', background: 'transparent', border: 'none', outline: 'none' }}
                      >
                        <option value={0}>— Choisir un emplacement —</option>
                        {emplacements.map(e => (
                          <option key={e.id} value={e.id}>{e.nom} ({e.remplissage}/{e.capaciteMax})</option>
                        ))}
                      </select>
                      {emplacementId > 0 && (
                        <button type="button" onClick={() => setEmplacementId(0)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '16px', lineHeight: 1 }}>×</button>
                      )}
                    </div>
                  )}

                  <form onSubmit={scannerSN}>
                    <input
                      ref={snInputRef}
                      autoFocus
                      className="form-input"
                      placeholder="Scanner ou saisir un S/N..."
                      value={snSaisie}
                      onChange={e => setSnSaisie(e.target.value)}
                      disabled={!caisseActive.trim() || !!alerteScan}
                      style={{ marginTop: '10px', marginBottom: '10px' }}
                    />

                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={!snSaisie.trim() || !caisseActive.trim() || !!alerteScan}>
                      Valider le scan
                    </button>
                  </form>

                  {dernierScan && dernierScan.resultat !== 'DEJA_SCANNE' && !(dernierScan.resultat === 'RECU' && dernierScan.dejaEnInventaire) && (
                    <div style={{
                      marginTop: '10px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
                      background: dernierScan.resultat === 'RECU' && !dernierScan.dejaEnInventaire ? '#dcfce7'
                        : dernierScan.resultat === 'RECU' && dernierScan.dejaEnInventaire ? '#fef3c7'
                        : dernierScan.resultat === 'DEJA_SCANNE' ? '#fee2e2'
                        : dernierScan.resultat === 'INATTENDU' ? '#fef3c7'
                        : '#fee2e2',
                      color: dernierScan.resultat === 'RECU' && !dernierScan.dejaEnInventaire ? '#16a34a'
                        : dernierScan.resultat === 'RECU' && dernierScan.dejaEnInventaire ? '#92400e'
                        : dernierScan.resultat === 'DEJA_SCANNE' ? '#dc2626'
                        : dernierScan.resultat === 'INATTENDU' ? '#92400e'
                        : '#dc2626',
                    }}>
                      {dernierScan.resultat === 'RECU' && !dernierScan.dejaEnInventaire && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle size={14} /> S/N validé ✓ — P/N : <strong>{dernierScan.pn}</strong></div>
                      )}
                      {dernierScan.resultat === 'RECU' && dernierScan.dejaEnInventaire && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle size={14} /> S/N validé — P/N : <strong>{dernierScan.pn}</strong></div>
                          <div style={{ marginTop: '4px', fontSize: '12px' }}>⚠️ Ce S/N est déjà présent en inventaire — il sera ignoré à la clôture</div>
                        </div>
                      )}
                      {dernierScan.resultat === 'DEJA_SCANNE' && null}
                      {dernierScan.resultat === 'INATTENDU' && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={14} /> S/N non attendu pour ce P/N — ajouté au rapport</div>
                          {dernierScan.dejaEnInventaire && <div style={{ marginTop: '4px', fontSize: '12px' }}>⚠️ Ce S/N est déjà présent en inventaire — il sera ignoré à la clôture</div>}
                        </div>
                      )}
                      {dernierScan.resultat === 'ERREUR' && <><XCircle size={14} style={{ display: 'inline', marginRight: '6px' }} />Erreur lors du scan</>}
                    </div>
                  )}
                </div>
              )}

              {/* Liste des S/N pour ce PN */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #2d3148', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600 }}>S/N attendus — <code style={{ background: '#1e3a5f', color: '#2563eb', padding: '1px 6px', borderRadius: '4px', fontSize: '12px' }}>{pnActif}</code></h3>
                  <span style={{ fontSize: '12px', color: '#cbd5e1' }}>
                    {lignesPNActif.filter(l => l.statut === 'RECU').length}/{lignesPNActif.length}
                  </span>
                </div>
                <table className="table">
                  <thead>
                    <tr style={{ background: '#141720' }}>
                      <th style={{ padding: '6px 14px', textAlign: 'left', color: '#cbd5e1', fontWeight: 600 }}>S/N</th>
                      <th style={{ padding: '6px 14px', textAlign: 'left', color: '#cbd5e1', fontWeight: 600 }}>Caisse</th>
                      <th style={{ padding: '6px 14px', textAlign: 'left', color: '#cbd5e1', fontWeight: 600 }}>Garantie</th>
                      <th style={{ padding: '6px 14px', textAlign: 'left', color: '#cbd5e1', fontWeight: 600 }}>Panne client</th>
                      {articlesAccessoires.length > 0 && articlesAccessoires.map(acc => (
                        <th key={acc.id} style={{ padding: '6px 10px', textAlign: 'center', color: '#cbd5e1', fontWeight: 600, whiteSpace: 'nowrap', fontSize: '11px' }}>{acc.label}</th>
                      ))}
                      <th style={{ padding: '6px 14px', textAlign: 'center', color: '#cbd5e1', fontWeight: 600 }}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignesPNActif.map((l, i) => {
                      const accs: string[] = l.accessoires ? (() => { try { return JSON.parse(l.accessoires) } catch { return [] } })() : []
                      return (
                        <tr key={l.id} style={{ borderTop: '1px solid #1e2130', background: i % 2 === 0 ? '#1a1d27' : '#141720' }}>
                          <td style={{ padding: '6px 14px', fontFamily: 'monospace', fontWeight: l.statut === 'RECU' ? 600 : 400, color: l.statut === 'RECU' ? '#60a5fa' : '#94a3b8' }}>{l.sn}</td>
                          <td style={{ padding: '6px 14px' }}>
                            {l.caisse
                              ? <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: '#1c2a1c', color: '#4ade80', border: '1px solid #166534' }}>📦 {l.caisse}</span>
                              : <span style={{ color: '#4b5563', fontSize: '12px' }}>—</span>}
                          </td>
                          <td style={{ padding: '6px 14px', color: '#cbd5e1' }}>{l.garantie || '—'}</td>
                          <td style={{ padding: '6px 14px', color: '#cbd5e1', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.panneClient || '—'}</td>
                          {articlesAccessoires.length > 0 && articlesAccessoires.map(acc => (
                            <td key={acc.id} style={{ padding: '6px 10px', textAlign: 'center' }}>
                              {l.statut === 'RECU' ? (
                                <input type="checkbox"
                                  checked={accs.includes(acc.label)}
                                  disabled={isClos}
                                  onChange={e => toggleAccessoireLigne(l.id, acc.label, e.target.checked)}
                                  style={{ cursor: isClos ? 'default' : 'pointer' }}
                                />
                              ) : <span style={{ color: '#e5e7eb' }}>—</span>}
                            </td>
                          ))}
                          <td style={{ padding: '6px 14px', textAlign: 'center' }}>
                            {(l.statut === 'RECU' || l.statut === 'INJECTE') && <span style={{ color: '#16a34a', fontSize: '16px' }}>✓</span>}
                            {l.statut === 'ATTENDU' && <span style={{ color: '#d1d5db', fontSize: '16px' }}>○</span>}
                            {l.statut === 'NON_RECU' && <span style={{ color: '#dc2626', fontSize: '16px' }}>✗</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal rapport */}
      {showRapport && rapport && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '28px', maxWidth: '600px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Rapport d'erreur</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" onClick={copierRapport}><Copy size={14} /> {copie ? 'Copié !' : 'Copier pour email'}</button>
                <button className="btn btn-secondary" onClick={() => setShowRapport(false)}>Fermer</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div style={{ textAlign: 'center', background: '#dcfce7', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a' }}>{rapport.recus.length}</div>
                  <div style={{ fontSize: '12px', color: '#16a34a' }}>Reçus</div>
                </div>
                <div style={{ textAlign: 'center', background: '#fee2e2', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626' }}>{rapport.nonRecus.length}</div>
                  <div style={{ fontSize: '12px', color: '#dc2626' }}>Manquants</div>
                </div>
                <div style={{ textAlign: 'center', background: '#fef3c7', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#92400e' }}>{rapport.inattendus.length}</div>
                  <div style={{ fontSize: '12px', color: '#92400e' }}>Inattendus</div>
                </div>
                <div style={{ textAlign: 'center', background: '#fce7f3', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#be185d' }}>{rapport.doublonsInventaire?.length ?? 0}</div>
                  <div style={{ fontSize: '12px', color: '#be185d' }}>Doublons</div>
                </div>
              </div>
              {rapport.nonRecus.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#dc2626', marginBottom: '8px' }}>❌ S/N manquants</h4>
                  {Object.entries(groupParPN(rapport.nonRecus)).map(([pn, ligs]) => (
                    <div key={pn} style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' }}>P/N {pn} ({ligs.length})</div>
                      {ligs.map(l => <div key={l.id} style={{ fontSize: '12px', fontFamily: 'monospace', color: '#cbd5e1', paddingLeft: '12px' }}>· {l.sn}</div>)}
                    </div>
                  ))}
                </div>
              )}
              {rapport.inattendus.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>⚠️ S/N inattendus</h4>
                  {rapport.inattendus.map(l => (
                    <div key={l.id} style={{ fontSize: '12px', fontFamily: 'monospace', color: '#cbd5e1', marginBottom: '2px' }}>· {l.sn} (P/N : {l.pn})</div>
                  ))}
                </div>
              )}
              {rapport.doublonsInventaire && rapport.doublonsInventaire.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#be185d', marginBottom: '8px' }}>🔴 S/N déjà en inventaire</h4>
                  {rapport.doublonsInventaire.map(l => (
                    <div key={l.id} style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>· {l.sn}</span>
                      <span style={{ marginLeft: '8px', color: '#be185d' }}>{l.notes || 'Déjà en inventaire'}</span>
                    </div>
                  ))}
                </div>
              )}

              {rapport.nonRecus.length === 0 && rapport.inattendus.length === 0 && !rapport.doublonsInventaire?.length && (
                <div style={{ textAlign: 'center', color: '#16a34a', padding: '20px' }}>
                  <CheckCircle size={32} style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontWeight: 600 }}>Aucun écart — tous les S/N ont été reçus !</p>
                </div>
              )}

              <div style={{ marginTop: '16px', background: '#141720', border: '1px solid #2d3148', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#cbd5e1', marginBottom: '6px', fontWeight: 600 }}>APERÇU EMAIL</div>
                <pre style={{ fontSize: '12px', color: '#e2e8f0', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{texteRapportEmail()}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal valider */}
      {showValider && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '28px', maxWidth: '440px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Valider la réception ?</h3>
            <p style={{ color: '#cbd5e1', fontSize: '14px', marginBottom: '8px' }}>
              Les <strong>{attendu.lignes.filter(l => l.statut === 'RECU').length} S/N reçus</strong> vont être injectés dans l'inventaire avec le statut "En stock".
            </p>
            <p style={{ color: '#cbd5e1', fontSize: '13px', marginBottom: '20px' }}>
              ℹ️ Vous pourrez continuer à scanner après validation.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowValider(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleValider}>✓ Confirmer</button>
            </div>
          </div>
        </div>
      )}

      {/* Succès validation */}
      {validerOk && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#1a1d27', border: '1px solid #2d3148', borderRadius: '10px', padding: '16px 20px', maxWidth: '400px', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#16a34a', fontWeight: 600, marginBottom: validerOk.snDoublons?.length ? '8px' : 0 }}>
            <CheckCircle size={20} />
            {validerOk.lignesInjectees} ligne{validerOk.lignesInjectees !== 1 ? 's' : ''} injectée{validerOk.lignesInjectees !== 1 ? 's' : ''} dans l'inventaire
          </div>
          {validerOk.snDoublons && validerOk.snDoublons.length > 0 && (
            <div style={{ fontSize: '12px', color: '#f59e0b', borderTop: '1px solid #1e2130', paddingTop: '8px' }}>
              ⚠️ {validerOk.snDoublons.length} S/N déjà présent{validerOk.snDoublons.length > 1 ? 's' : ''} ignoré{validerOk.snDoublons.length > 1 ? 's' : ''} : {validerOk.snDoublons.join(', ')}
            </div>
          )}
          <button onClick={() => setValiderOk(null)} style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><XCircle size={16} /></button>
        </div>
      )}

      {/* Modal alerte scan — bloquant, doit être fermé via le bouton OK */}
      {alerteScan && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '32px', maxWidth: '420px', width: '100%', textAlign: 'center', border: '3px solid #dc2626' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
            {alerteScan.type === 'DEJA_SCANNE' && (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626', marginBottom: '8px' }}>S/N déjà validé !</h3>
                <p style={{ color: '#cbd5e1', fontSize: '14px', marginBottom: '8px' }}>Ce S/N a déjà été scanné et validé dans cet attendu.</p>
              </>
            )}
            {alerteScan.type === 'DEJA_INVENTAIRE' && (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626', marginBottom: '8px' }}>S/N déjà en inventaire !</h3>
                <p style={{ color: '#cbd5e1', fontSize: '14px', marginBottom: '8px' }}>Ce S/N est déjà présent dans l'inventaire. Il sera ignoré à la clôture.</p>
              </>
            )}
            <code style={{ display: 'block', background: '#fee2e2', color: '#dc2626', padding: '8px 16px', borderRadius: '6px', fontWeight: 700, fontSize: '16px', marginBottom: '20px' }}>
              {alerteScan.sn}
            </code>
            {alerteScan.pn && <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>P/N : {alerteScan.pn}</p>}
            <button ref={okAlerteRef} className="btn btn-primary" style={{ width: '100%' }}
              onClick={() => { setAlerteScan(null); snInputRef.current?.focus() }}>
              OK — Continuer le scan
            </button>
          </div>
        </div>
      )}

      {/* Modal erreur clôture */}
      {erreurCloture && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '28px', maxWidth: '480px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px', color: '#dc2626' }}>❌ Clôture impossible</h3>
            <p style={{ color: '#cbd5e1', fontSize: '14px', marginBottom: '12px' }}>{erreurCloture.message}</p>
            {erreurCloture.snsEnDoublon.length > 0 && (
              <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626', marginBottom: '6px' }}>S/N concernés :</div>
                {erreurCloture.snsEnDoublon.map(sn => (
                  <div key={sn} style={{ fontSize: '12px', fontFamily: 'monospace', color: '#dc2626' }}>· {sn}</div>
                ))}
              </div>
            )}
            {erreurCloture.champsManquants && erreurCloture.champsManquants.length > 0 && (
              <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626', marginBottom: '6px' }}>Champs manquants :</div>
                {erreurCloture.champsManquants.map(label => (
                  <div key={label} style={{ fontSize: '12px', color: '#dc2626' }}>· {label}</div>
                ))}
              </div>
            )}
            <p style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '20px' }}>
              {erreurCloture.champsManquants && erreurCloture.champsManquants.length > 0
                ? 'Complétez ces informations via "Modifier infos" avant de clôturer.'
                : 'Supprimez ces S/N de l\'inventaire ou contactez un administrateur avant de clôturer.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {erreurCloture.champsManquants && erreurCloture.champsManquants.length > 0 && (
                <button className="btn btn-primary" onClick={() => { setErreurCloture(null); setEditInfos(true) }}>Modifier infos</button>
              )}
              <button className="btn btn-secondary" onClick={() => setErreurCloture(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal clôturer */}
      {showCloturer && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '28px', maxWidth: '440px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Clôturer et enregistrer ?</h3>
            <p style={{ color: '#cbd5e1', fontSize: '14px', marginBottom: '8px' }}>
              Les <strong>{attendu.lignes.filter(l => l.statut === 'RECU').length} S/N reçus</strong> seront injectés dans l'inventaire avec le statut "En stock".
            </p>
            <p style={{ color: '#cbd5e1', fontSize: '14px', marginBottom: '8px' }}>Les S/N non scannés seront marqués comme <strong>non reçus</strong>.</p>
            <p style={{ color: '#dc2626', fontSize: '13px', marginBottom: '20px' }}>⚠️ Cette action est irréversible.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowCloturer(false)}>Annuler</button>
              <button className="btn btn-danger" style={{ background: '#dc2626', color: 'white', borderColor: '#dc2626' }} onClick={handleCloturer}>
                <Lock size={14} /> Clôturer et enregistrer dans l'inventaire
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal modifier infos */}
      {editInfos && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '28px', maxWidth: '480px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Modifier les informations</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {configChamps.filter(c => c.visible).map(cc => {
                const colDef = COLONNES_INVENTAIRE.find(c => c.key === cc.code)
                const label = colDef?.label ?? getLabelColonne(cc.code)
                const isClient = CODES_CLIENT.includes(cc.code.toUpperCase())
                const isPlateforme = CODES_PLATEFORME.includes(cc.code.toUpperCase())
                const isDate = colDef?.type === 'date'
                return (
                  <div key={cc.code} className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">
                      {label}
                      {cc.obligatoire && <span style={{ color: '#dc2626' }}> *</span>}
                      {!cc.obligatoire && cc.obligatoireCloture && <span style={{ color: '#f59e0b' }} title="Requis avant de pouvoir clôturer l'attendu"> * (requis pour clôture)</span>}
                    </label>
                    {isClient ? (
                      <select className="form-input" value={editDonnees[cc.code] ?? ''} onChange={e => setEditDonnees(d => ({ ...d, [cc.code]: e.target.value }))}>
                        <option value="">— Choisir un client —</option>
                        {clients.map(cl => <option key={cl.id} value={getEntiteLabel(cl, champsClients)}>{getEntiteLabel(cl, champsClients)}</option>)}
                      </select>
                    ) : isPlateforme ? (
                      <select className="form-input" value={editDonnees[cc.code] ?? ''} onChange={e => setEditDonnees(d => ({ ...d, [cc.code]: e.target.value }))}>
                        <option value="">— Choisir une plateforme —</option>
                        {plateformes.map(pl => <option key={pl.id} value={getEntiteLabel(pl, champsPlateformes)}>{getEntiteLabel(pl, champsPlateformes)}</option>)}
                      </select>
                    ) : isDate ? (
                      <input type="date" className="form-input" value={editDonnees[cc.code] ?? ''} onChange={e => setEditDonnees(d => ({ ...d, [cc.code]: e.target.value }))} />
                    ) : (
                      <input type="text" className="form-input" value={editDonnees[cc.code] ?? ''} onChange={e => setEditDonnees(d => ({ ...d, [cc.code]: e.target.value }))} />
                    )}
                  </div>
                )
              })}
              {configChamps.filter(c => c.visible).length === 0 && (
                <p style={{ color: '#9ca3af', fontSize: '13px' }}>Aucun champ configuré — allez dans Configuration → Réceptions attendues.</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setEditInfos(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSaveInfos}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
