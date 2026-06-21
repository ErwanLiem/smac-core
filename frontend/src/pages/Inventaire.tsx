import { useEffect, useRef, useState } from 'react'
import { Trash2, Pencil, X, History, Columns3 } from 'lucide-react'
import { inventaireApi } from '../api/inventaire'
import { get, del } from '../api/client'
import { getPermissions, getSiteId } from '../utils/permissions'
import ExportExcelButton, { type ExportColumn } from '../components/ExportExcelButton'
import { formatDate } from '../utils/dates'
import { COLONNES_INVENTAIRE } from '../constants/colonnesInventaire'

const LABELS_TYPE_HISTORIQUE: Record<string, string> = {
  RECEPTION: 'Réception',
  TRANSFERT: 'Transfert',
  MODIFICATION: 'Modification',
  SUPPRESSION: 'Suppression',
  CREATION: 'Création',
  TRANSITION_STATUT: 'Changement de statut'
}

interface HistoriqueEntry {
  id: number
  type: string
  createdAt: string
  details: Record<string, any> | null
  operateur: { id: number; login: string; nom: string; prenom: string } | null
}

interface Article {
  id: number
  valeurs: any[]
}

interface Statut {
  id: number
  label: string
  couleur: string
}

interface PieceUtilisee {
  id: number
  pn: string | null
  pnType: string | null
  sp: string | null
  status: string | null
}

interface Inventaire {
  id: number
  articleId: number
  article: Article
  statutId: number | null
  statut: Statut | null
  couleurAlerte: string | null
  createdAt: string
  pieces: PieceUtilisee[]
  [key: string]: any
}

const CODES_DESIGNATION = ['DESIGNATION', 'DESIG', 'NOM', 'LIBELLE', 'DESCRIPTION']

export default function Inventaire() {
  const siteId = getSiteId()
  const { isAdmin } = getPermissions()
  const peutEditer = isAdmin
  const peutSupprimer = isAdmin

  const [chargement, setChargement] = useState(true)
  const [colonnesOrdre, setColonnesOrdre] = useState<string[]>([])
  const [colonnesCachees, setColonnesCachees] = useState<Set<string>>(new Set())
  const [showToggle, setShowToggle] = useState(false)
  const toggleRef = useRef<HTMLDivElement>(null)
  const [articles, setArticles] = useState<any[]>([])
  const [statuts, setStatuts] = useState<Statut[]>([])
  const [inventaires, setInventaires] = useState<Inventaire[]>([])
  const [filtres, setFiltres] = useState<Record<string, string>>({})
  const dragColonne = useRef<string | null>(null)
  const [modal, setModal] = useState<{ id: number } | null>(null)
  const [modalMasse, setModalMasse] = useState(false)
  const [selection, setSelection] = useState<Set<number>>(new Set())
  const [editItem, setEditItem] = useState<{ id: number; articleId: number; statutId: number | null; fields: Record<string, string> } | null>(null)
  const [historique, setHistorique] = useState<HistoriqueEntry[] | null>(null)
  const [historiqueLoading, setHistoriqueLoading] = useState(false)

  useEffect(() => {
    document.querySelector('.main-content')?.classList.add('page-table')
    return () => { document.querySelector('.main-content')?.classList.remove('page-table') }
  }, [])

  useEffect(() => { reload() }, [siteId])

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [siteId])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (toggleRef.current && !toggleRef.current.contains(e.target as Node)) setShowToggle(false)
    }
    if (showToggle) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showToggle])

  async function reload() {
    const [a, s, i] = await Promise.all([
      get(`/articles/${siteId}`),
      get(`/workflow/${siteId}/statuts`),
      inventaireApi.getAll(siteId)
    ])
    const login = JSON.parse(localStorage.getItem('utilisateur') || '{}')?.login ?? 'default'
    const allKeys = COLONNES_INVENTAIRE.map(c => c.key)
    const savedOrdre = JSON.parse(localStorage.getItem(`inventaire_colonnes_${login}`) || '[]') as string[]
    const restored = [
      ...savedOrdre.filter(k => allKeys.includes(k)),
      ...allKeys.filter(k => !savedOrdre.includes(k))
    ]
    setColonnesOrdre(restored)
    const savedCachees = JSON.parse(localStorage.getItem(`inventaire_colonnes_cachees_${login}`) || '[]') as string[]
    setColonnesCachees(new Set(savedCachees.filter(k => allKeys.includes(k))))
    setArticles(a)
    setStatuts(s)
    setInventaires(i)
    setChargement(false)
  }

  function getValeur(item: Inventaire, key: string): string {
    if (key === 'emplacementNom') return (item as any).emplacement?.nom ?? '—'
    const col = COLONNES_INVENTAIRE.find(c => c.key === key)
    const val = (item as any)[key]
    if (val == null || val === '') return '—'
    if (col?.type === 'date') return formatDate(val)
    return String(val)
  }

  const colonnesOrdonnees = colonnesOrdre
    .map(k => COLONNES_INVENTAIRE.find(c => c.key === k))
    .filter(Boolean) as typeof COLONNES_INVENTAIRE
  const colonnesAffichees = colonnesOrdonnees.filter(c => !colonnesCachees.has(c.key))

  const maxPieces = Math.max(0, ...inventaires.map(i => (i.pieces ?? []).length))

  const colonnesPieces: ExportColumn[] = []
  for (let i = 0; i < maxPieces; i++) {
    colonnesPieces.push(
      { key: `p${i}_pn`,     label: `PN_${i + 1}` },
      { key: `p${i}_pnType`, label: `PN Type${i + 1}` },
      { key: `p${i}_sp`,     label: `SP_${i + 1}` },
      { key: `p${i}_status`, label: `P/N Status ${i + 1}` },
    )
  }

  const colonnesExport: ExportColumn[] = [
    { key: 'statut', label: 'Statut' },
    { key: 'article', label: 'Article' },
    ...colonnesOrdonnees.map(c => ({ key: c.key, label: c.label })),
    ...colonnesPieces,
  ]

  function valeurExport(item: Inventaire, key: string): string {
    if (key === 'statut') return item.statut?.label ?? ''
    if (key === 'article') return getArticleLabel(item.articleId)
    if (key.startsWith('p') && key.includes('_')) {
      const [idxPart, field] = key.split('_')
      const idx = Number(idxPart.slice(1))
      const piece = (item.pieces ?? [])[idx]
      if (!piece) return ''
      if (field === 'pn') return piece.pn ?? ''
      if (field === 'pnType') return piece.pnType ?? ''
      if (field === 'sp') return piece.sp ?? ''
      if (field === 'status') return piece.status ?? ''
    }
    const v = getValeur(item, key)
    return v === '—' ? '' : v
  }

  function toggleColonne(key: string) {
    setColonnesCachees(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      const login = JSON.parse(localStorage.getItem('utilisateur') || '{}')?.login ?? 'default'
      localStorage.setItem(`inventaire_colonnes_cachees_${login}`, JSON.stringify(Array.from(next)))
      return next
    })
  }

  function onDragStart(key: string) { dragColonne.current = key }

  function onDrop(key: string) {
    if (dragColonne.current === null || dragColonne.current === key) return
    const from = colonnesOrdre.indexOf(dragColonne.current)
    const to = colonnesOrdre.indexOf(key)
    const newOrdre = [...colonnesOrdre]
    newOrdre.splice(from, 1)
    newOrdre.splice(to, 0, dragColonne.current)
    setColonnesOrdre(newOrdre)
    const login = JSON.parse(localStorage.getItem('utilisateur') || '{}')?.login ?? 'default'
    localStorage.setItem(`inventaire_colonnes_${login}`, JSON.stringify(newOrdre))
    dragColonne.current = null
  }

  function toggleSelection(id: number) {
    setSelection(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selection.size === filteredInventaires.length) {
      setSelection(new Set())
    } else {
      setSelection(new Set(filteredInventaires.map(i => i.id)))
    }
  }

  async function ouvrirHistorique() {
    const id = Array.from(selection)[0]
    if (!id) return
    setHistorique([])
    setHistoriqueLoading(true)
    try {
      const data = await inventaireApi.getHistorique(id)
      setHistorique(data as HistoriqueEntry[])
    } finally {
      setHistoriqueLoading(false)
    }
  }

  async function supprimerSelection() {
    for (const id of Array.from(selection)) {
      await del(`/inventaire/${id}`)
    }
    setSelection(new Set())
    setModalMasse(false)
    reload()
  }

  function getArticleLabel(articleId: number): string {
    const art = articles.find(a => a.id === articleId)
    if (!art) return `Article #${articleId}`
    const desig = art.valeurs.find((v: any) =>
      CODES_DESIGNATION.includes(v.champ?.code?.toUpperCase?.() ?? '')
    )?.valeur
    return desig || art.valeurs.map((v: any) => v.valeur).filter(Boolean)[0] || `Article #${articleId}`
  }

  const hasActiveFiltres = Object.values(filtres).some(v => v.trim() !== '')

  const filteredInventaires = inventaires.filter(inv => {
    if (filtres['statut']?.trim()) {
      if (!(inv.statut?.label ?? '').toLowerCase().includes(filtres['statut'].toLowerCase())) return false
    }
    for (const col of COLONNES_INVENTAIRE) {
      const filtre = filtres[col.key]?.trim()
      if (filtre) {
        const val = String(inv[col.key] ?? '')
        if (!val.toLowerCase().includes(filtre.toLowerCase())) return false
      }
    }
    return true
  })

  function resetFiltres() { setFiltres({}) }

  async function handleDelete(id: number) {
    await inventaireApi.delete(id)
    setModal(null)
    reload()
  }

  function openEdit(item: Inventaire) {
    const fields: Record<string, string> = {}
    for (const col of COLONNES_INVENTAIRE) {
      const val = item[col.key]
      if (val != null) {
        fields[col.key] = col.type === 'date' ? String(val).split('T')[0] : String(val)
      } else {
        fields[col.key] = ''
      }
    }
    setEditItem({ id: item.id, articleId: item.articleId, statutId: item.statutId, fields })
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editItem) return
    try {
      const data: Record<string, any> = { statutId: editItem.statutId || null }
      for (const col of COLONNES_INVENTAIRE) {
        if (col.key === 'emplacementNom') continue
        const val = editItem.fields[col.key] || null
        data[col.key] = val
      }
      await inventaireApi.update(editItem.id, data)
      setEditItem(null)
      reload()
    } catch (e: any) {
      alert(e?.data?.error ?? e?.message ?? 'Erreur lors de la sauvegarde')
    }
  }

  function StatutBadge({ statut }: { statut: Statut | null }) {
    if (!statut) return <span style={{ color: '#d1d5db' }}>—</span>
    return <span style={{ background: statut.couleur, color: 'white', fontSize: '11px', fontWeight: 500, padding: '1px 7px', borderRadius: '4px', whiteSpace: 'nowrap', display: 'inline-block' }}>{statut.label}</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventaire</h1>
          <p className="page-subtitle">
            {filteredInventaires.length} enregistrement{filteredInventaires.length !== 1 ? 's' : ''}
            {hasActiveFiltres && ` (sur ${inventaires.length})`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {selection.size === 1 && (
            <button className="btn btn-secondary" onClick={ouvrirHistorique}>
              <History size={14} /> Détail
            </button>
          )}
          {selection.size > 0 && peutSupprimer && (
            <button className="btn btn-danger" style={{ background: '#dc2626', color: 'white', borderColor: '#dc2626' }} onClick={() => setModalMasse(true)}>
              <Trash2 size={14} /> Supprimer ({selection.size})
            </button>
          )}
          {hasActiveFiltres && (
            <button className="btn btn-secondary" onClick={resetFiltres}>
              <X size={14} /> Effacer filtres
            </button>
          )}
          <div ref={toggleRef} style={{ position: 'relative' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowToggle(o => !o)} title="Afficher ou masquer des colonnes">
              <Columns3 size={14} /> Colonnes
            </button>
            {showToggle && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: '#1a1d27', border: '1px solid #2d3140', borderRadius: '8px', padding: '8px', zIndex: 20, minWidth: '180px', maxHeight: '320px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                {colonnesOrdonnees.map(c => (
                  <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={!colonnesCachees.has(c.key)} onChange={() => toggleColonne(c.key)} />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <ExportExcelButton
            columns={colonnesExport}
            rows={filteredInventaires}
            getValue={valeurExport}
            filename={`inventaire_${new Date().toISOString().slice(0, 10)}.xlsx`}
            sheetName="Inventaire"
          />
        </div>
      </div>

      {chargement ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
          <table className="table" style={{ minWidth: 'max-content', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th style={{ width: '36px', textAlign: 'center' }}>
                  <input type="checkbox"
                    checked={filteredInventaires.length > 0 && selection.size === filteredInventaires.length}
                    onChange={toggleAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th></th>
                <th>Statut</th>
                {colonnesAffichees.map(c => (
                  <th key={c.key}
                    draggable
                    onDragStart={() => onDragStart(c.key)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => onDrop(c.key)}
                    style={{ cursor: 'grab', userSelect: 'none', whiteSpace: 'nowrap' }}
                    title="Glisser pour déplacer"
                  >
                    {c.label} <span style={{ color: '#bfdbfe', fontSize: '10px' }}>⠿</span>
                  </th>
                ))}
                {Array.from({ length: maxPieces }, (_, i) => (
                  <th key={`pieces_${i}`} colSpan={4} style={{ textAlign: 'center', borderLeft: '2px solid #2d3148', whiteSpace: 'nowrap', background: '#1a1d2f' }}>
                    Pièce {i + 1}
                  </th>
                ))}
              </tr>
              {maxPieces > 0 && (
                <tr style={{ background: '#141720' }}>
                  <td colSpan={3 + colonnesAffichees.length} />
                  {Array.from({ length: maxPieces }, (_, i) => (
                    <>
                      <td key={`p${i}_pn_h`} style={{ padding: '4px 8px', borderLeft: '2px solid #2d3148', fontSize: '11px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>PN_{i + 1}</td>
                      <td key={`p${i}_pnType_h`} style={{ padding: '4px 8px', fontSize: '11px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>Type</td>
                      <td key={`p${i}_sp_h`} style={{ padding: '4px 8px', fontSize: '11px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>SP</td>
                      <td key={`p${i}_status_h`} style={{ padding: '4px 8px', fontSize: '11px', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>Statut</td>
                    </>
                  ))}
                </tr>
              )}
              <tr style={{ background: '#141720' }}>
                <td style={{ padding: '4px 8px' }}></td>
                <td style={{ padding: '4px 8px' }}></td>
                <td style={{ padding: '4px 8px' }}>
                  <input className="form-input" placeholder="Filtrer..."
                    value={filtres['statut'] ?? ''}
                    onChange={e => setFiltres(f => ({ ...f, statut: e.target.value }))}
                    style={{ fontSize: '12px', padding: '3px 6px', minWidth: '80px' }} />
                </td>
                {colonnesAffichees.map(c => (
                  <td key={c.key} style={{ padding: '4px 8px' }}>
                    <input className="form-input" placeholder="Filtrer..."
                      value={filtres[c.key] ?? ''}
                      onChange={e => setFiltres(f => ({ ...f, [c.key]: e.target.value }))}
                      style={{ fontSize: '12px', padding: '3px 6px', minWidth: '80px' }} />
                  </td>
                ))}
                {Array.from({ length: maxPieces * 4 }, (_, i) => (
                  <td key={`pf_${i}`} style={{ padding: '4px 8px' }} />
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredInventaires.length === 0 && (
                <tr><td colSpan={colonnesAffichees.length + 3} style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>
                  {hasActiveFiltres ? 'Aucun résultat' : 'Aucune donnée'}
                </td></tr>
              )}
              {filteredInventaires.map((item, idx) => (
                <tr key={item.id} style={{
                  background: selection.has(item.id)
                    ? '#1e3a5f'
                    : item.couleurAlerte
                      ? `${item.couleurAlerte}26`
                      : idx % 2 === 0 ? '#1a1d27' : '#141720',
                  borderLeft: item.couleurAlerte ? `3px solid ${item.couleurAlerte}` : undefined,
                }}>
                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                    <input type="checkbox"
                      checked={selection.has(item.id)}
                      onChange={() => toggleSelection(item.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '4px 8px', display: 'flex', gap: '6px' }}>
                    {peutEditer && (
                      <button className="btn btn-secondary btn-icon" onClick={() => openEdit(item)}>
                        <Pencil size={14} />
                      </button>
                    )}
                    {peutSupprimer && (
                      <button className="btn btn-danger btn-icon" onClick={() => setModal({ id: item.id })}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                  <td style={{ padding: '4px 10px' }}><StatutBadge statut={item.statut} /></td>
                  {colonnesAffichees.map(c => (
                    <td key={c.key} style={{ padding: '4px 10px' }}>
                      {getValeur(item, c.key) === '—'
                        ? <span style={{ color: '#d1d5db' }}>—</span>
                        : getValeur(item, c.key)
                      }
                    </td>
                  ))}
                  {Array.from({ length: maxPieces }, (_, i) => {
                    const piece = (item.pieces ?? [])[i]
                    return (
                      <>
                        <td key={`p${i}_pn`} style={{ padding: '4px 10px', borderLeft: '2px solid #2d3148', fontFamily: 'monospace', fontSize: '11px' }}>{piece?.pn ?? <span style={{ color: '#d1d5db' }}>—</span>}</td>
                        <td key={`p${i}_pnType`} style={{ padding: '4px 10px', fontSize: '11px' }}>{piece?.pnType ?? <span style={{ color: '#d1d5db' }}>—</span>}</td>
                        <td key={`p${i}_sp`} style={{ padding: '4px 10px', fontFamily: 'monospace', fontSize: '11px' }}>{piece?.sp ?? <span style={{ color: '#d1d5db' }}>—</span>}</td>
                        <td key={`p${i}_status`} style={{ padding: '4px 10px', fontSize: '11px' }}>{piece?.status ?? <span style={{ color: '#d1d5db' }}>—</span>}</td>
                      </>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Modal édition */}
      {editItem && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '10px', padding: '28px', maxWidth: '560px', width: '100%', maxHeight: '85vh', overflow: 'auto' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Modifier — Inventaire</h3>
            <form onSubmit={handleEdit}>
              <div className="form-group">
                <label className="form-label">Article</label>
                <input type="text" disabled className="form-input" value={getArticleLabel(editItem.articleId)} style={{ background: '#141720', color: '#9ca3af', cursor: 'not-allowed' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Statut</label>
                <select value={editItem.statutId || 0} onChange={e => setEditItem(ei => ei ? { ...ei, statutId: Number(e.target.value) || null } : ei)} className="form-input">
                  <option value={0}>— Aucun statut —</option>
                  {statuts.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              {COLONNES_INVENTAIRE.map(c => (
                <div className="form-group" key={c.key}>
                  <label className="form-label">{c.label}</label>
                  {c.type === 'date' ? (
                    <input type="date" className="form-input"
                      value={editItem.fields[c.key] ?? ''}
                      onChange={e => setEditItem(ei => ei ? { ...ei, fields: { ...ei.fields, [c.key]: e.target.value } } : ei)} />
                  ) : (
                    <input type="text" className="form-input"
                      value={editItem.fields[c.key] ?? ''}
                      onChange={e => setEditItem(ei => ei ? { ...ei, fields: { ...ei.fields, [c.key]: e.target.value } } : ei)} />
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditItem(null)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal suppression en masse */}
      {modalMasse && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '10px', padding: '28px', maxWidth: '420px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Confirmer la suppression</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>
              <strong>{selection.size} enregistrement{selection.size > 1 ? 's' : ''}</strong> seront définitivement supprimés.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setModalMasse(false)}>Annuler</button>
              <button className="btn btn-danger" style={{ background: '#dc2626', color: 'white', borderColor: '#dc2626' }} onClick={supprimerSelection}>
                Supprimer {selection.size} ligne{selection.size > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal historique */}
      {historique !== null && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '10px', padding: '28px', maxWidth: '560px', width: '100%', maxHeight: '85vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Historique de la ligne</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setHistorique(null)}><X size={14} /></button>
            </div>
            {historiqueLoading ? (
              <div className="loading-container"><div className="loading-spinner" /></div>
            ) : historique.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '14px', textAlign: 'center', padding: '24px' }}>Aucun mouvement enregistré pour cette ligne.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Date / heure</th>
                    <th>Opération</th>
                    <th>Opérateur</th>
                  </tr>
                </thead>
                <tbody>
                  {historique.map(h => (
                    <tr key={h.id}>
                      <td>{new Date(h.createdAt).toLocaleString('fr-FR')}</td>
                      <td>{LABELS_TYPE_HISTORIQUE[h.type] ?? h.type}</td>
                      <td>{h.operateur ? h.operateur.login : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal suppression */}
      {modal && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '10px', padding: '28px', maxWidth: '420px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Confirmer la suppression</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>Cet enregistrement sera définitivement supprimé.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Annuler</button>
              <button className="btn btn-danger" style={{ background: '#dc2626', color: 'white', borderColor: '#dc2626' }} onClick={() => handleDelete(modal.id)}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
