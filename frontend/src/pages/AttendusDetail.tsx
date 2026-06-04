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
  const [dernierScan, setDernierScan] = useState<{ resultat: string; pn?: string } | null>(null)
  const [accessoiresParLigne, setAccessoiresParLigne] = useState<Record<number, number[]>>({})
  const [showRapport, setShowRapport] = useState(false)
  const [rapport, setRapport] = useState<Rapport | null>(null)
  const [showCloturer, setShowCloturer] = useState(false)
  const [showValider, setShowValider] = useState(false)
  const [validerOk, setValiderOk] = useState<{ lignesInjectees: number; snDoublons?: string[] } | null>(null)
  const [copie, setCopie] = useState(false)
  const [editInfos, setEditInfos] = useState(false)
  const [rma, setRma] = useState('')
  const [bt, setBt] = useState('')

  useEffect(() => { reload() }, [id])

  async function reload() {
    const [data, arts, champsArts] = await Promise.all([
      attendusApi.getDetail(Number(id)),
      get<any[]>(`/articles/${siteId}`),
      get<any[]>(`/articles/${siteId}/champs`)
    ])
    setAttendu(data)
    setRma(data.rma || '')
    setBt(data.bt || '')
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
          accessoires: accessoiresCochés.map(aid => articlesAccessoires.find(a => a.id === aid)?.label).filter(Boolean)
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
      setDernierScan(result)
      setSnSaisie('')
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
    await attendusApi.update(Number(id), { rma, bt })
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
    await attendusApi.cloturer(Number(id))
    setShowCloturer(false)
    reload()
  }

  async function handleRapport() {
    const data = await attendusApi.rapport(Number(id))
    setRapport(data)
    setShowRapport(true)
  }

  function texteRapportEmail(): string {
    if (!rapport || !attendu) return ''
    const lines: string[] = []
    lines.push(`Rapport d'écart — RMA ${attendu.rma || 'N/A'} — BT ${attendu.bt || 'N/A'}`)
    lines.push(`Client : ${attendu.client || 'N/A'}`)
    lines.push(`Date : ${new Date().toLocaleDateString('fr-FR')}`)
    lines.push('')
    if (rapport.nonRecus.length > 0) {
      lines.push(`❌ S/N MANQUANTS (${rapport.nonRecus.length})`)
      const byPN = groupParPN(rapport.nonRecus)
      for (const [pn, ligs] of Object.entries(byPN)) {
        lines.push(`  P/N ${pn} :`)
        ligs.forEach(l => lines.push(`    - ${l.sn}`))
      }
      lines.push('')
    }
    if (rapport.inattendus.length > 0) {
      lines.push(`⚠️ S/N NON ATTENDUS (${rapport.inattendus.length})`)
      rapport.inattendus.forEach(l => lines.push(`  - ${l.sn} (P/N : ${l.pn})`))
      lines.push('')
    }
    lines.push(`✅ S/N REÇUS : ${rapport.recus.length} / ${rapport.total}`)
    return lines.join('\n')
  }

  function copierRapport() {
    navigator.clipboard.writeText(texteRapportEmail())
    setCopie(true)
    setTimeout(() => setCopie(false), 2000)
  }

  if (!attendu) return <div style={{ padding: '40px', color: '#9ca3af' }}>Chargement...</div>

  const isClos = attendu.statut === 'CLOS'
  const lignesNormales = attendu.lignes.filter(l => l.statut !== 'INATTENDU')
  const inattendus = attendu.lignes.filter(l => l.statut === 'INATTENDU')
  const groupes = groupParPN(lignesNormales)
  const totalAttendu = lignesNormales.length
  const totalRecu = attendu.lignes.filter(l => l.statut === 'RECU').length
  const lignesPNActif = pnActif ? (groupes[pnActif] || []) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <button onClick={() => navigate('/attendus')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '13px' }}>← Attendus</button>
            {isClos && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '4px' }}><Lock size={11} /> Clôturé</span>}
          </div>
          <h1 className="page-title">{attendu.rma ? `RMA ${attendu.rma}` : 'Attendu sans RMA'}</h1>
          <p className="page-subtitle">
            {attendu.client && `${attendu.client} · `}
            {attendu.bt && `BT : ${attendu.bt} · `}
            {new Date(attendu.createdAt).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isClos && <button className="btn btn-secondary" onClick={() => setEditInfos(true)}>Modifier infos</button>}
          <button className="btn btn-secondary" onClick={handleRapport}>Rapport d'écart</button>
          {!isClos && (
            <>
              <button className="btn btn-primary" onClick={() => setShowValider(true)}>✓ Valider → Inventaire</button>
              <button className="btn btn-danger" style={{ background: '#dc2626', color: 'white', borderColor: '#dc2626' }} onClick={() => setShowCloturer(true)}>
                <Lock size={14} /> Clôturer
              </button>
            </>
          )}
        </div>
      </div>

      {/* Barre de progression globale */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ flex: 1, background: '#f1f5f9', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
          <div style={{ background: '#2563eb', height: '100%', width: `${totalAttendu > 0 ? (totalRecu / totalAttendu) * 100 : 0}%`, transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#2563eb', whiteSpace: 'nowrap' }}>{totalRecu} / {totalAttendu} reçus</span>
        {inattendus.length > 0 && <span style={{ fontSize: '12px', color: '#f59e0b' }}>⚠️ {inattendus.length} inattendu{inattendus.length > 1 ? 's' : ''}</span>}
      </div>

      {/* Corps principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '12px', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Colonne gauche — cartes PN */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {Object.entries(groupes).map(([pn, lignes]) => {
            const recus = lignes.filter(l => l.statut === 'RECU').length
            const total = lignes.length
            const complet = recus === total
            const actif = pnActif === pn

            return (
              <div key={pn}
                onClick={() => { if (!isClos) { setPnActif(pn); setDernierScan(null); setSnSaisie(''); setAccessoiresCochés([]); setTimeout(() => snInputRef.current?.focus(), 100) } }}
                style={{
                  border: `2px solid ${actif ? '#2563eb' : complet ? '#86efac' : '#e5e7eb'}`,
                  borderRadius: '8px', padding: '12px',
                  background: actif ? '#eff6ff' : complet ? '#f0fdf4' : 'white',
                  cursor: isClos ? 'default' : 'pointer',
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
                ⚠️ Inattendus ({inattendus.length})
              </div>
              {inattendus.map(l => (
                <div key={l.id} style={{ fontSize: '11px', fontFamily: 'monospace', color: '#92400e' }}>{l.sn}</div>
              ))}
            </div>
          )}
        </div>

        {/* Colonne droite — panneau de scan */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!pnActif ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '40px' }}>←</div>
              <p style={{ fontSize: '14px' }}>{isClos ? 'Sélectionnez un P/N pour voir les détails' : 'Sélectionnez un P/N pour commencer le scan'}</p>
            </div>
          ) : (
            <>
              {/* Zone de scan */}
              {!isClos && (
                <div className="card">
                  <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Scanner un S/N</h3>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>P/N actif : <code style={{ background: '#eff6ff', color: '#2563eb', padding: '1px 6px', borderRadius: '4px' }}>{pnActif}</code></p>

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

                  {dernierScan && (
                    <div style={{
                      marginTop: '10px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
                      background: dernierScan.resultat === 'RECU' ? '#dcfce7' : dernierScan.resultat === 'INATTENDU' ? '#fef3c7' : '#fee2e2',
                      color: dernierScan.resultat === 'RECU' ? '#16a34a' : dernierScan.resultat === 'INATTENDU' ? '#92400e' : '#dc2626',
                    }}>
                      {dernierScan.resultat === 'RECU' && <><CheckCircle size={14} style={{ display: 'inline', marginRight: '6px' }} />S/N validé ✓</>}
                      {dernierScan.resultat === 'INATTENDU' && <><AlertTriangle size={14} style={{ display: 'inline', marginRight: '6px' }} />S/N non attendu pour ce P/N — ajouté comme inattendu</>}
                      {dernierScan.resultat === 'ERREUR' && <><XCircle size={14} style={{ display: 'inline', marginRight: '6px' }} />Erreur lors du scan</>}
                    </div>
                  )}
                </div>
              )}

              {/* Liste des S/N pour ce PN */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600 }}>S/N attendus — <code style={{ background: '#eff6ff', color: '#2563eb', padding: '1px 6px', borderRadius: '4px', fontSize: '12px' }}>{pnActif}</code></h3>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    {lignesPNActif.filter(l => l.statut === 'RECU').length}/{lignesPNActif.length}
                  </span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8faff' }}>
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
                          <td style={{ padding: '6px 14px', color: '#6b7280' }}>{l.garantie || '—'}</td>
                          <td style={{ padding: '6px 14px', color: '#6b7280', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.panneClient || '—'}</td>
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
                            {l.statut === 'RECU' && <span style={{ color: '#16a34a', fontSize: '16px' }}>✓</span>}
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
          <div style={{ background: 'white', borderRadius: '12px', padding: '28px', maxWidth: '600px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Rapport d'écart</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" onClick={copierRapport}><Copy size={14} /> {copie ? 'Copié !' : 'Copier pour email'}</button>
                <button className="btn btn-secondary" onClick={() => setShowRapport(false)}>Fermer</button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
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
              </div>
              {rapport.nonRecus.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#dc2626', marginBottom: '8px' }}>❌ S/N manquants</h4>
                  {Object.entries(groupParPN(rapport.nonRecus)).map(([pn, ligs]) => (
                    <div key={pn} style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>P/N {pn} ({ligs.length})</div>
                      {ligs.map(l => <div key={l.id} style={{ fontSize: '12px', fontFamily: 'monospace', color: '#6b7280', paddingLeft: '12px' }}>· {l.sn}</div>)}
                    </div>
                  ))}
                </div>
              )}
              {rapport.inattendus.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>⚠️ S/N inattendus</h4>
                  {rapport.inattendus.map(l => (
                    <div key={l.id} style={{ fontSize: '12px', fontFamily: 'monospace', color: '#6b7280', marginBottom: '2px' }}>· {l.sn} (P/N : {l.pn})</div>
                  ))}
                </div>
              )}
              {rapport.nonRecus.length === 0 && rapport.inattendus.length === 0 && (
                <div style={{ textAlign: 'center', color: '#16a34a', padding: '20px' }}>
                  <CheckCircle size={32} style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontWeight: 600 }}>Aucun écart — tous les S/N ont été reçus !</p>
                </div>
              )}
              <div style={{ marginTop: '16px', background: '#f8faff', border: '1px solid #e0e7ff', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px', fontWeight: 600 }}>APERÇU EMAIL</div>
                <pre style={{ fontSize: '12px', color: '#374151', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{texteRapportEmail()}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal valider */}
      {showValider && (
        <div className="modal-overlay">
          <div style={{ background: 'white', borderRadius: '12px', padding: '28px', maxWidth: '440px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Valider la réception ?</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>
              Les <strong>{attendu.lignes.filter(l => l.statut === 'RECU').length} S/N reçus</strong> vont être injectés dans l'inventaire avec le statut "En stock".
            </p>
            <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '20px' }}>
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
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px 20px', maxWidth: '400px', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#16a34a', fontWeight: 600, marginBottom: validerOk.snDoublons?.length ? '8px' : 0 }}>
            <CheckCircle size={20} />
            {validerOk.lignesInjectees} ligne{validerOk.lignesInjectees !== 1 ? 's' : ''} injectée{validerOk.lignesInjectees !== 1 ? 's' : ''} dans l'inventaire
          </div>
          {validerOk.snDoublons && validerOk.snDoublons.length > 0 && (
            <div style={{ fontSize: '12px', color: '#f59e0b', borderTop: '1px solid #f3f4f6', paddingTop: '8px' }}>
              ⚠️ {validerOk.snDoublons.length} S/N déjà présent{validerOk.snDoublons.length > 1 ? 's' : ''} ignoré{validerOk.snDoublons.length > 1 ? 's' : ''} : {validerOk.snDoublons.join(', ')}
            </div>
          )}
          <button onClick={() => setValiderOk(null)} style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><XCircle size={16} /></button>
        </div>
      )}

      {/* Modal clôturer */}
      {showCloturer && (
        <div className="modal-overlay">
          <div style={{ background: 'white', borderRadius: '12px', padding: '28px', maxWidth: '440px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Clôturer l'attendu ?</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>Les S/N non scannés seront marqués comme <strong>non reçus</strong>.</p>
            <p style={{ color: '#dc2626', fontSize: '13px', marginBottom: '20px' }}>⚠️ Cette action est irréversible.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowCloturer(false)}>Annuler</button>
              <button className="btn btn-danger" style={{ background: '#dc2626', color: 'white', borderColor: '#dc2626' }} onClick={handleCloturer}>
                <Lock size={14} /> Clôturer définitivement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal modifier infos */}
      {editInfos && (
        <div className="modal-overlay">
          <div style={{ background: 'white', borderRadius: '12px', padding: '28px', maxWidth: '400px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Modifier les informations</h3>
            <div className="form-group">
              <label className="form-label">N° RMA</label>
              <input className="form-input" value={rma} onChange={e => setRma(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">N° BT</label>
              <input className="form-input" value={bt} onChange={e => setBt(e.target.value)} />
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
