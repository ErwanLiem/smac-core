import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, AlertTriangle, Lock, Copy } from 'lucide-react'
import { attendusApi } from '../api/attendus'
import { get } from '../api/client'

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
}

interface Attendu {
  id: number
  rma: string | null
  bt: string | null
  client: string | null
  statut: string
  createdAt: string
  closedAt: string | null
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

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

export default function AttendusDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const snInputRef = useRef<HTMLInputElement>(null)
  const siteId = getSiteId()

  const [attendu, setAttendu] = useState<Attendu | null>(null)
  const [articlesAccessoires, setArticlesAccessoires] = useState<ArticleAccessoire[]>([])
  const [pnActif, setPnActif] = useState<string | null>(null)
  const [snSaisie, setSnSaisie] = useState('')
  const [dernierScan, setDernierScan] = useState<{ resultat: string; pn?: string; dejaEnInventaire?: boolean; sn?: string } | null>(null)
  const [alerteScan, setAlerteScan] = useState<{ type: 'DEJA_SCANNE' | 'DEJA_INVENTAIRE'; sn: string; pn?: string } | null>(null)
  const [accessoiresParLigne, setAccessoiresParLigne] = useState<Record<number, number[]>>({})
  const [showRapport, setShowRapport] = useState(false)
  const [rapport, setRapport] = useState<Rapport | null>(null)
  const [showCloturer, setShowCloturer] = useState(false)
  const [erreurCloture, setErreurCloture] = useState<{ message: string; snsEnDoublon: string[] } | null>(null)
  const [showValider, setShowValider] = useState(false)
  const [validerOk, setValiderOk] = useState<{ lignesInjectees: number; snDoublons?: string[] } | null>(null)
  const [copie, setCopie] = useState(false)
  const [editInfos, setEditInfos] = useState(false)
  const [rma, setRma] = useState('')
  const [bt, setBt] = useState('')
  const [plateforme, setPlateforme] = useState('')
  const [dateCreationRMA, setDateCreationRMA] = useState('')
  const [plateformes, setPlateformes] = useState<any[]>([])
  const [champsPlateformes, setChampsPlateformes] = useState<any[]>([])

  useEffect(() => { reload() }, [id])

  async function reload() {
    const [data, arts, champsArts, plats, champsPlats] = await Promise.all([
      attendusApi.getDetail(Number(id)),
      get<any[]>(`/articles/${siteId}`),
      get<any[]>(`/articles/${siteId}/champs`),
      get<any[]>(`/plateformes/${siteId}`),
      get<any[]>(`/plateformes/${siteId}/champs`)
    ])
    setAttendu(data)
    setRma(data.rma || '')
    setBt(data.bt || '')
    setPlateforme(data.plateforme || '')
    setDateCreationRMA(data.dateCreationRMA || '')
    setPlateformes(plats)
    setChampsPlateformes(champsPlats.filter((c: any) => c.actif))
    // Initialiser les accessoires cochÃ©s depuis les donnÃ©es existantes
    const accMap: Record<number, number[]> = {}
    data.lignes.forEach((l: Ligne) => {
      if (l.accessoires) {
        try {
          const labels: string[] = JSON.parse(l.accessoires)
          // sera recalculÃ© aprÃ¨s chargement des articles
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

  async function handleScan(e: React.FormEvent) {
    e.preventDefault()
    if (!snSaisie.trim() || !pnActif) return
    try {
      const result = await attendusApi.scanner(Number(id), snSaisie.trim())
      // On passe le PN actif et les accessoires
      await fetch(`/api/attendus/${id}/scanner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          sn: snSaisie.trim(),
          pn: pnActif,
          accessoires: accessoiresCochÃ©s.map(aid => articlesAccessoires.find(a => a.id === aid)?.label).filter(Boolean)
        })
      })
      setDernierScan(result)
      setSnSaisie('')
            reload()
    } catch {
      setDernierScan({ resultat: 'ERREUR' })
    }
    snInputRef.current?.focus()
  }

  // Scan direct via l'API correcte
  function jouerSonAlerte() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.type = 'square'
      oscillator.frequency.setValueAtTime(880, ctx.currentTime)
      oscillator.frequency.setValueAtTime(440, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.4)
    } catch {}
  }

  async function scannerSN(e: React.FormEvent) {
    e.preventDefault()
    if (!snSaisie.trim() || !pnActif) return
    try {
      const res = await fetch(`/api/attendus/${id}/scanner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ sn: snSaisie.trim(), pn: pnActif, accessoires: [] })
      })
      const result = await res.json()
      const snScanne = snSaisie.trim()
      setDernierScan({ ...result, sn: snScanne })
      setSnSaisie('')

      // Ouvrir modal + son si problÃ¨me
      if (result.resultat === 'DEJA_SCANNE') {
        jouerSonAlerte()
        setAlerteScan({ type: 'DEJA_SCANNE', sn: snScanne, pn: result.pn })
      } else if (result.resultat === 'RECU' && result.dejaEnInventaire) {
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

  const CODES_NOM = ['NOM', 'NAME', 'LIBELLE', 'RAISON_SOCIALE']

  function getPlateformeLabel(pl: any): string {
    const champNom = champsPlateformes.find((c: any) => CODES_NOM.includes(c.code.toUpperCase()))
    if (champNom) {
      const val = pl.valeurs?.find((v: any) => v.champId === champNom.id)?.valeur
      if (val) return val
    }
    return pl.valeurs?.map((v: any) => v.valeur).filter(Boolean)[0] || `Plateforme #${pl.id}`
  }

  async function handleSaveInfos() {
    await attendusApi.update(Number(id), { rma, bt, plateforme, dateCreationRMA })
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
      try {
        const parsed = JSON.parse(e.message)
        setErreurCloture({ message: parsed.error, snsEnDoublon: parsed.snsEnDoublon || [] })
        setShowCloturer(false)
      } catch {
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
    const clientName = attendu.client || 'N/A'
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
        rapport.doublonsInventaire.forEach(l => lines.push(`  - ${l.sn} â€” ${l.notes || 'Already in inventory'}`))
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

  if (!attendu) return <div style={{ padding: '40px', color: '#9ca3af' }}>Chargement...</div>

  const isClos = attendu.statut === 'CLOS'
  const lignesNormales = attendu.lignes.filter(l => l.statut !== 'INATTENDU' && l.statut !== 'DOUBLON_INVENTAIRE')
  const inattendus = attendu.lignes.filter(l => l.statut === 'INATTENDU')
  const doublonsInv = attendu.lignes.filter(l => l.statut === 'DOUBLON_INVENTAIRE')
  const groupes = groupParPN(lignesNormales)
  const totalAttendu = lignesNormales.length
  const totalRecu = lignesNormales.filter(l => l.statut === 'RECU').length
  const lignesPNActif = pnActif ? (groupes[pnActif] || []) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <button onClick={() => navigate('/attendus')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '13px' }}>â† Attendus</button>
            {isClos && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '4px' }}><Lock size={11} /> ClÃ´turÃ©</span>}
          </div>
          <h1 className="page-title">{attendu.rma ? `RMA ${attendu.rma}` : 'Attendu sans RMA'}</h1>
          <p className="page-subtitle">
            {attendu.client && `${attendu.client} Â· `}
            {attendu.bt && `BT : ${attendu.bt} Â· `}
            {new Date(attendu.createdAt).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isClos && <button className="btn btn-secondary" onClick={() => setEditInfos(true)}>Modifier infos</button>}
          <button className="btn btn-secondary" onClick={handleRapport}>Rapport d'Ã©cart</button>
          {!isClos && (
            <>
              <button className="btn btn-danger" style={{ background: '#dc2626', color: 'white', borderColor: '#dc2626' }} onClick={() => setShowCloturer(true)}>
                <Lock size={14} /> ClÃ´turer et enregistrer
              </button>
            </>
          )}
        </div>
      </div>

      {/* Barre de progression globale */}
      <div style={{ background: '#1a1d27', border: '1px solid #2d3148', borderRadius: '8px', padding: '10px 16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ flex: 1, background: '#0f1117', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
          <div style={{ background: '#2563eb', height: '100%', width: `${totalAttendu > 0 ? (totalRecu / totalAttendu) * 100 : 0}%`, transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#2563eb', whiteSpace: 'nowrap' }}>{totalRecu} / {totalAttendu} reÃ§us</span>
        {inattendus.length > 0 && <span style={{ fontSize: '12px', color: '#f59e0b' }}>âš ï¸ {inattendus.length} inattendu{inattendus.length > 1 ? 's' : ''}</span>}
      </div>

      {/* Corps principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '12px', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Colonne gauche â€” cartes PN */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Object.entries(groupes).map(([pn, lignes]) => {
            const recus = lignes.filter(l => l.statut === 'RECU').length
            const total = lignes.length
            const complet = recus === total
            const actif = pnActif === pn

            return (
              <div key={pn}
                onClick={() => { setPnActif(pn); setDernierScan(null); setSnSaisie(''); if (!isClos) setTimeout(() => snInputRef.current?.focus(), 100) }}
                style={{
                  border: `2px solid ${actif ? '#2563eb' : complet ? '#86efac' : '#e5e7eb'}`,
                  borderRadius: '8px', padding: '12px',
                  background: actif ? '#1e3a5f' : complet ? '#1e3a1e' : '#1a1d27',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <code style={{ fontSize: '11px', fontWeight: 600, color: actif ? '#1d4ed8' : '#374151' }}>{pn}</code>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: complet ? '#16a34a' : '#2563eb' }}>{recus}/{total}</span>
                </div>
                <div style={{ background: '#f1f5f9', borderRadius: '3px', height: '4px', overflow: 'hidden' }}>
                  <div style={{ background: complet ? '#16a34a' : '#2563eb', height: '100%', width: `${(recus / total) * 100}%` }} />
                </div>
                {complet && <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={11} /> Complet</div>}
              </div>
            )
          })}

          {/* Inattendus */}
          {inattendus.length > 0 && (
            <div style={{ border: '2px solid #fcd34d', borderRadius: '8px', padding: '12px', background: '#fffbeb' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#92400e', marginBottom: '6px' }}>
                âš ï¸ Inattendus ({inattendus.length})
              </div>
              {inattendus.map(l => (
                <div key={l.id} style={{ fontSize: '11px', fontFamily: 'monospace', color: '#92400e' }}>{l.sn}</div>
              ))}
            </div>
          )}

          {/* DÃ©jÃ  en inventaire */}
          {doublonsInv.length > 0 && (
            <div style={{ border: '2px solid #f9a8d4', borderRadius: '8px', padding: '12px', background: '#fdf2f8' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#be185d', marginBottom: '8px' }}>
                ðŸ”´ DÃ©jÃ  en inventaire ({doublonsInv.length})
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
                      title="DÃ©scannerle S/N â€” remet en attente"
                      style={{ background: 'none', border: '1px solid #f9a8d4', borderRadius: '4px', cursor: 'pointer', color: '#be185d', padding: '2px 6px', fontSize: '11px', marginLeft: '6px', flexShrink: 0 }}
                    >
                      âœ• Annuler
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
                  âœ• Tout annuler
                </button>
              )}
            </div>
          )}
        </div>

        {/* Colonne droite â€” panneau de scan */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!pnActif ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '40px' }}>â†</div>
              <p style={{ fontSize: '14px' }}>{isClos ? 'SÃ©lectionnez un P/N pour voir les dÃ©tails' : 'SÃ©lectionnez un P/N pour commencer le scan'}</p>
            </div>
          ) : (
            <>
              {/* Zone de scan */}
              {!isClos && (
                <div className="card">
                  <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Scanner un S/N</h3>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>P/N actif : <code style={{ background: '#1e3a5f', color: '#2563eb', padding: '1px 6px', borderRadius: '4px' }}>{pnActif}</code></p>

                  <form onSubmit={scannerSN}>
                    <input
                      ref={snInputRef}
                      autoFocus
                      className="form-input"
                      placeholder="Scanner ou saisir un S/N..."
                      value={snSaisie}
                      onChange={e => setSnSaisie(e.target.value)}
                      style={{ marginBottom: '10px' }}
                    />

                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={!snSaisie.trim()}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle size={14} /> S/N validÃ© âœ“ â€” P/N : <strong>{dernierScan.pn}</strong></div>
                      )}
                      {dernierScan.resultat === 'RECU' && dernierScan.dejaEnInventaire && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle size={14} /> S/N validÃ© â€” P/N : <strong>{dernierScan.pn}</strong></div>
                          <div style={{ marginTop: '4px', fontSize: '12px' }}>âš ï¸ Ce S/N est dÃ©jÃ  prÃ©sent en inventaire â€” il sera ignorÃ© Ã  la clÃ´ture</div>
                        </div>
                      )}
                      {dernierScan.resultat === 'DEJA_SCANNE' && null}
                      {dernierScan.resultat === 'INATTENDU' && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={14} /> S/N non attendu pour ce P/N â€” ajoutÃ© au rapport</div>
                          {dernierScan.dejaEnInventaire && <div style={{ marginTop: '4px', fontSize: '12px' }}>âš ï¸ Ce S/N est dÃ©jÃ  prÃ©sent en inventaire â€” il sera ignorÃ© Ã  la clÃ´ture</div>}
                        </div>
                      )}
                      {dernierScan.resultat === 'ERREUR' && <><XCircle size={14} style={{ display: 'inline', marginRight: '6px' }} />Erreur lors du scan</>}
                    </div>
                  )}
                </div>
              )}

              {/* Liste des S/N pour ce PN */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600 }}>S/N attendus â€” <code style={{ background: '#1e3a5f', color: '#2563eb', padding: '1px 6px', borderRadius: '4px', fontSize: '12px' }}>{pnActif}</code></h3>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    {lignesPNActif.filter(l => l.statut === 'RECU').length}/{lignesPNActif.length}
                  </span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#141720' }}>
                      <th style={{ padding: '6px 14px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>S/N</th>
                      <th style={{ padding: '6px 14px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Garantie</th>
                      <th style={{ padding: '6px 14px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Panne client</th>
                      {articlesAccessoires.length > 0 && articlesAccessoires.map(acc => (
                        <th key={acc.id} style={{ padding: '6px 10px', textAlign: 'center', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap', fontSize: '11px' }}>{acc.label}</th>
                      ))}
                      <th style={{ padding: '6px 14px', textAlign: 'center', color: '#6b7280', fontWeight: 600 }}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignesPNActif.map((l, i) => {
                      const accs: string[] = l.accessoires ? (() => { try { return JSON.parse(l.accessoires) } catch { return [] } })() : []
                      return (
                        <tr key={l.id} style={{ borderTop: '1px solid #f3f4f6', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ padding: '6px 14px', fontFamily: 'monospace', fontWeight: l.statut === 'RECU' ? 600 : 400, color: l.statut === 'RECU' ? '#1d4ed8' : '#374151' }}>{l.sn}</td>
                          <td style={{ padding: '6px 14px', color: '#6b7280' }}>{l.garantie || 'â€”'}</td>
                          <td style={{ padding: '6px 14px', color: '#6b7280', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.panneClient || 'â€”'}</td>
                          {articlesAccessoires.length > 0 && articlesAccessoires.map(acc => (
                            <td key={acc.id} style={{ padding: '6px 10px', textAlign: 'center' }}>
                              {l.statut === 'RECU' ? (
                                <input type="checkbox"
                                  checked={accs.includes(acc.label)}
                                  disabled={isClos}
                                  onChange={e => toggleAccessoireLigne(l.id, acc.label, e.target.checked)}
                                  style={{ cursor: isClos ? 'default' : 'pointer' }}
                                />
                              ) : <span style={{ color: '#e5e7eb' }}>â€”</span>}
                            </td>
                          ))}
                          <td style={{ padding: '6px 14px', textAlign: 'center' }}>
                            {l.statut === 'RECU' && <span style={{ color: '#16a34a', fontSize: '16px' }}>âœ“</span>}
                            {l.statut === 'ATTENDU' && <span style={{ color: '#d1d5db', fontSize: '16px' }}>â—‹</span>}
                            {l.statut === 'NON_RECU' && <span style={{ color: '#dc2626', fontSize: '16px' }}>âœ—</span>}
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
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Rapport d'Ã©cart</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" onClick={copierRapport}><Copy size={14} /> {copie ? 'CopiÃ© !' : 'Copier pour email'}</button>
                <button className="btn btn-secondary" onClick={() => setShowRapport(false)}>Fermer</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div style={{ textAlign: 'center', background: '#dcfce7', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a' }}>{rapport.recus.length}</div>
                  <div style={{ fontSize: '12px', color: '#16a34a' }}>ReÃ§us</div>
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
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#dc2626', marginBottom: '8px' }}>âŒ S/N manquants</h4>
                  {Object.entries(groupParPN(rapport.nonRecus)).map(([pn, ligs]) => (
                    <div key={pn} style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>P/N {pn} ({ligs.length})</div>
                      {ligs.map(l => <div key={l.id} style={{ fontSize: '12px', fontFamily: 'monospace', color: '#6b7280', paddingLeft: '12px' }}>Â· {l.sn}</div>)}
                    </div>
                  ))}
                </div>
              )}
              {rapport.inattendus.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>âš ï¸ S/N inattendus</h4>
                  {rapport.inattendus.map(l => (
                    <div key={l.id} style={{ fontSize: '12px', fontFamily: 'monospace', color: '#6b7280', marginBottom: '2px' }}>Â· {l.sn} (P/N : {l.pn})</div>
                  ))}
                </div>
              )}
              {rapport.doublonsInventaire && rapport.doublonsInventaire.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#be185d', marginBottom: '8px' }}>ðŸ”´ S/N dÃ©jÃ  en inventaire</h4>
                  {rapport.doublonsInventaire.map(l => (
                    <div key={l.id} style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>Â· {l.sn}</span>
                      <span style={{ marginLeft: '8px', color: '#be185d' }}>{l.notes || 'DÃ©jÃ  en inventaire'}</span>
                    </div>
                  ))}
                </div>
              )}

              {rapport.nonRecus.length === 0 && rapport.inattendus.length === 0 && !rapport.doublonsInventaire?.length && (
                <div style={{ textAlign: 'center', color: '#16a34a', padding: '20px' }}>
                  <CheckCircle size={32} style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontWeight: 600 }}>Aucun Ã©cart â€” tous les S/N ont Ã©tÃ© reÃ§us !</p>
                </div>
              )}

              <div style={{ marginTop: '16px', background: '#141720', border: '1px solid #2d3148', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px', fontWeight: 600 }}>APERÃ‡U EMAIL</div>
                <pre style={{ fontSize: '12px', color: '#374151', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{texteRapportEmail()}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal valider */}
      {showValider && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '28px', maxWidth: '440px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Valider la rÃ©ception ?</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>
              Les <strong>{attendu.lignes.filter(l => l.statut === 'RECU').length} S/N reÃ§us</strong> vont Ãªtre injectÃ©s dans l'inventaire avec le statut "En stock".
            </p>
            <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '20px' }}>
              â„¹ï¸ Vous pourrez continuer Ã  scanner aprÃ¨s validation.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowValider(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleValider}>âœ“ Confirmer</button>
            </div>
          </div>
        </div>
      )}

      {/* SuccÃ¨s validation */}
      {validerOk && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#1a1d27', border: '1px solid #2d3148', borderRadius: '10px', padding: '16px 20px', maxWidth: '400px', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#16a34a', fontWeight: 600, marginBottom: validerOk.snDoublons?.length ? '8px' : 0 }}>
            <CheckCircle size={20} />
            {validerOk.lignesInjectees} ligne{validerOk.lignesInjectees !== 1 ? 's' : ''} injectÃ©e{validerOk.lignesInjectees !== 1 ? 's' : ''} dans l'inventaire
          </div>
          {validerOk.snDoublons && validerOk.snDoublons.length > 0 && (
            <div style={{ fontSize: '12px', color: '#f59e0b', borderTop: '1px solid #f3f4f6', paddingTop: '8px' }}>
              âš ï¸ {validerOk.snDoublons.length} S/N dÃ©jÃ  prÃ©sent{validerOk.snDoublons.length > 1 ? 's' : ''} ignorÃ©{validerOk.snDoublons.length > 1 ? 's' : ''} : {validerOk.snDoublons.join(', ')}
            </div>
          )}
          <button onClick={() => setValiderOk(null)} style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><XCircle size={16} /></button>
        </div>
      )}

      {/* Modal alerte scan */}
      {alerteScan && (
        <div className="modal-overlay" onClick={() => { setAlerteScan(null); snInputRef.current?.focus() }}>
          <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '32px', maxWidth: '420px', width: '100%', textAlign: 'center', border: '3px solid #dc2626' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>âš ï¸</div>
            {alerteScan.type === 'DEJA_SCANNE' && (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626', marginBottom: '8px' }}>S/N dÃ©jÃ  validÃ© !</h3>
                <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>Ce S/N a dÃ©jÃ  Ã©tÃ© scannÃ© et validÃ© dans cet attendu.</p>
              </>
            )}
            {alerteScan.type === 'DEJA_INVENTAIRE' && (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#dc2626', marginBottom: '8px' }}>S/N dÃ©jÃ  en inventaire !</h3>
                <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>Ce S/N est dÃ©jÃ  prÃ©sent dans l'inventaire. Il sera ignorÃ© Ã  la clÃ´ture.</p>
              </>
            )}
            <code style={{ display: 'block', background: '#fee2e2', color: '#dc2626', padding: '8px 16px', borderRadius: '6px', fontWeight: 700, fontSize: '16px', marginBottom: '20px' }}>
              {alerteScan.sn}
            </code>
            {alerteScan.pn && <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '16px' }}>P/N : {alerteScan.pn}</p>}
            <button className="btn btn-primary" style={{ width: '100%' }}
              onClick={() => { setAlerteScan(null); snInputRef.current?.focus() }}>
              OK â€” Continuer le scan
            </button>
          </div>
        </div>
      )}

      {/* Modal erreur clÃ´ture */}
      {erreurCloture && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '28px', maxWidth: '480px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px', color: '#dc2626' }}>âŒ ClÃ´ture impossible</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '12px' }}>{erreurCloture.message}</p>
            {erreurCloture.snsEnDoublon.length > 0 && (
              <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626', marginBottom: '6px' }}>S/N concernÃ©s :</div>
                {erreurCloture.snsEnDoublon.map(sn => (
                  <div key={sn} style={{ fontSize: '12px', fontFamily: 'monospace', color: '#dc2626' }}>Â· {sn}</div>
                ))}
              </div>
            )}
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>
              Supprimez ces S/N de l'inventaire ou contactez un administrateur avant de clÃ´turer.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setErreurCloture(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal clÃ´turer */}
      {showCloturer && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '28px', maxWidth: '440px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>ClÃ´turer et enregistrer ?</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>
              Les <strong>{attendu.lignes.filter(l => l.statut === 'RECU').length} S/N reÃ§us</strong> seront injectÃ©s dans l'inventaire avec le statut "En stock".
            </p>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>Les S/N non scannÃ©s seront marquÃ©s comme <strong>non reÃ§us</strong>.</p>
            <p style={{ color: '#dc2626', fontSize: '13px', marginBottom: '20px' }}>âš ï¸ Cette action est irrÃ©versible.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowCloturer(false)}>Annuler</button>
              <button className="btn btn-danger" style={{ background: '#dc2626', color: 'white', borderColor: '#dc2626' }} onClick={handleCloturer}>
                <Lock size={14} /> ClÃ´turer et enregistrer dans l'inventaire
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal modifier infos */}
      {editInfos && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '28px', maxWidth: '400px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Modifier les informations</h3>
            <div className="form-group">
              <label className="form-label">NÂ° RMA</label>
              <input className="form-input" value={rma} onChange={e => setRma(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">NÂ° BT</label>
              <input className="form-input" value={bt} onChange={e => setBt(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Plateforme</label>
              <select className="form-input" value={plateforme} onChange={e => setPlateforme(e.target.value)}>
                <option value="">â€” Choisir une plateforme â€”</option>
                {plateformes.map(pl => (
                  <option key={pl.id} value={getPlateformeLabel(pl)}>{getPlateformeLabel(pl)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date crÃ©ation RMA</label>
              <input type="date" className="form-input" value={dateCreationRMA} onChange={e => setDateCreationRMA(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setEditInfos(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSaveInfos}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

