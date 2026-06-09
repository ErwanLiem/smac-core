import { useEffect, useRef, useState } from 'react'
import { Trash2, Plus, Pencil, X } from 'lucide-react'
import { inventaireApi } from '../api/inventaire'
import { get, del } from '../api/client'
import { getPermissions } from '../utils/permissions'

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

interface Champ {
  id: number
  code: string
  label: string
  type: string
  obligatoire: boolean
  ordre: number
  actif: boolean
}

interface ValeurChamp {
  champId: number
  valeur: string | null
  champ: Champ
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

interface Inventaire {
  id: number
  articleId: number
  article: Article
  statutId: number | null
  statut: Statut | null
  couleurAlerte: string | null
  createdAt: string
  valeurs: ValeurChamp[]
}

export default function Inventaire() {
  const siteId = getSiteId()
  const { isAdmin } = getPermissions()
  const pagePath = '/inventaire'
  const peutEditer = isAdmin
  const peutSupprimer = isAdmin
  const peutCreer = isAdmin

  const [chargement, setChargement] = useState(true)
  const [champs, setChamps] = useState<Champ[]>([])
  const [colonnesOrdre, setColonnesOrdre] = useState<number[]>([])
  const [articles, setArticles] = useState<any[]>([])
  const [statuts, setStatuts] = useState<Statut[]>([])
  const [inventaires, setInventaires] = useState<Inventaire[]>([])
  const [filtres, setFiltres] = useState<Record<string, string>>({})
  const dragColonne = useRef<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formArticleId, setFormArticleId] = useState<number>(0)
  const [formStatutId, setFormStatutId] = useState<number>(0)
  const [formValeurs, setFormValeurs] = useState<Record<number, string>>({})
  const [modal, setModal] = useState<{ id: number } | null>(null)
  const [modalMasse, setModalMasse] = useState(false)
  const [selection, setSelection] = useState<Set<number>>(new Set())
  const [editItem, setEditItem] = useState<{ id: number; articleId: number; statutId: number | null; valeurs: Record<number, string> } | null>(null)

  useEffect(() => {
    document.querySelector('.main-content')?.classList.add('page-table')
    return () => { document.querySelector('.main-content')?.classList.remove('page-table') }
  }, [])

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    const [c, a, s, i] = await Promise.all([
      inventaireApi.getChamps(siteId),
      get(`/articles/${siteId}`),
      get(`/workflow/${siteId}/statuts`),
      inventaireApi.getAll(siteId)
    ])
    const champsActifs = c.filter(ch => ch.actif)
    setChamps(champsActifs)
    // Restaurer l'ordre sauvegardé, en ignorant les champs supprimés et ajoutant les nouveaux
    const login = JSON.parse(localStorage.getItem('utilisateur') || '{}')?.login ?? 'default'
    const savedOrdre = JSON.parse(localStorage.getItem(`inventaire_colonnes_${login}`) || '[]') as number[]
    const ids = champsActifs.map(ch => ch.id)
    const restored = [
      ...savedOrdre.filter(id => ids.includes(id)),
      ...ids.filter(id => !savedOrdre.includes(id))
    ]
    setColonnesOrdre(restored)
    setArticles(a)
    setStatuts(s)
    setInventaires(i)
    setChargement(false)
  }

  function getValeur(item: Inventaire, champId: number) {
    return item.valeurs.find(v => v.champId === champId)?.valeur ?? '—'
  }

  // Colonnes triées selon l'ordre drag & drop
  const champsOrdonnes = colonnesOrdre.map(id => champs.find(c => c.id === id)).filter(Boolean) as Champ[]

  function onDragStart(champId: number) {
    dragColonne.current = champId
  }

  function onDrop(champId: number) {
    if (dragColonne.current === null || dragColonne.current === champId) return
    const from = colonnesOrdre.indexOf(dragColonne.current)
    const to = colonnesOrdre.indexOf(champId)
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

  async function supprimerSelection() {
    for (const id of Array.from(selection)) {
      await del(`/inventaire/${id}`)
    }
    setSelection(new Set())
    setModalMasse(false)
    reload()
  }

  const CODES_DESIGNATION = ['DESIGNATION', 'DESIG', 'NOM', 'LIBELLE', 'DESCRIPTION']

  function getArticleLabel(articleId: number): string {
    const art = articles.find(a => a.id === articleId)
    if (!art) return `Article #${articleId}`
    const desig = art.valeurs.find(v =>
      CODES_DESIGNATION.includes(v.champ?.code?.toUpperCase?.() ?? '')
    )?.valeur
    return desig || art.valeurs.map(v => v.valeur).filter(Boolean)[0] || `Article #${articleId}`
  }

  const hasActiveFiltres = Object.values(filtres).some(v => v.trim() !== '')

  const filteredInventaires = inventaires.filter(inv => {
    // Filtre Statut
    if (filtres['statut']?.trim()) {
      const label = inv.statut?.label ?? ''
      if (!label.toLowerCase().includes(filtres['statut'].toLowerCase())) return false
    }
    // Filtres champs dynamiques
    for (const champ of champs) {
      const filtre = filtres[String(champ.id)]?.trim()
      if (filtre) {
        const valeur = String(inv.valeurs.find(v => v.champId === champ.id)?.valeur ?? '')
        if (!valeur.toLowerCase().includes(filtre.toLowerCase())) return false
      }
    }
    return true
  })

  function resetFiltres() {
    setFiltres({})
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const valeurs = Object.entries(formValeurs).map(([champId, valeur]) => ({ champId: Number(champId), valeur }))
    await inventaireApi.create(siteId, {
      articleId: Number(formArticleId),
      statutId: formStatutId || null,
      valeurs
    })
    setFormArticleId(0)
    setFormStatutId(0)
    setFormValeurs({})
    setShowForm(false)
    reload()
  }

  async function handleDelete(id: number) {
    await inventaireApi.delete(id)
    setModal(null)
    reload()
  }

  function openEdit(item: Inventaire) {
    const valeurs: Record<number, string> = {}
    item.valeurs.forEach(v => { valeurs[v.champId] = v.valeur ?? '' })
    setEditItem({ id: item.id, articleId: item.articleId, statutId: item.statutId, valeurs })
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editItem) return
    const valeurs = Object.entries(editItem.valeurs).map(([champId, valeur]) => ({ champId: Number(champId), valeur }))
    await inventaireApi.update(editItem.id, {
      statutId: editItem.statutId || null,
      valeurs
    })
    setEditItem(null)
    reload()
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
          {false && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <Plus size={16} /> Ajouter
            </button>
          )}
        </div>
      </div>

      {chargement ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : champs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
          <p style={{ marginBottom: '8px', fontWeight: 500 }}>Aucun champ configuré</p>
          <p style={{ fontSize: '13px' }}>Configurez d'abord les champs dans Configuration → Structure inventaire.</p>
        </div>
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
                <th>Statut</th>
                {champsOrdonnes.map(c => (
                  <th key={c.id}
                    draggable
                    onDragStart={() => onDragStart(c.id)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => onDrop(c.id)}
                    style={{ cursor: 'grab', userSelect: 'none', whiteSpace: 'nowrap' }}
                    title="Glisser pour déplacer"
                  >
                    {c.label} <span style={{ color: '#bfdbfe', fontSize: '10px' }}>⠿</span>
                  </th>
                ))}
                <th></th>
              </tr>
              <tr style={{ background: '#141720' }}>
                <td style={{ padding: '4px 8px' }}></td>
                <td style={{ padding: '4px 8px' }}>
                  <input className="form-input" placeholder="Filtrer..."
                    value={filtres['statut'] ?? ''}
                    onChange={e => setFiltres(f => ({ ...f, statut: e.target.value }))}
                    style={{ fontSize: '12px', padding: '3px 6px', minWidth: '80px' }} />
                </td>
                {champsOrdonnes.map(c => (
                  <td key={c.id} style={{ padding: '4px 8px' }}>
                    <input className="form-input" placeholder="Filtrer..."
                      value={filtres[String(c.id)] ?? ''}
                      onChange={e => setFiltres(f => ({ ...f, [c.id]: e.target.value }))}
                      style={{ fontSize: '12px', padding: '3px 6px', minWidth: '80px' }} />
                  </td>
                ))}
                <td style={{ padding: '4px 8px' }}></td>
              </tr>
            </thead>
            <tbody>
              {filteredInventaires.length === 0 && (
                <tr><td colSpan={champs.length + 2} style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>
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
                  <td style={{ padding: '4px 10px' }}><StatutBadge statut={item.statut} /></td>
                  {champsOrdonnes.map(c => (
                    <td key={c.id} style={{ padding: '4px 10px' }}>{getValeur(item, c.id) || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                  ))}
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
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Modal ajout */}
      {showForm && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '10px', padding: '28px', maxWidth: '520px', width: '100%', maxHeight: '85vh', overflow: 'auto' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Ajouter — Inventaire</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Article *</label>
                <select required value={formArticleId} onChange={e => setFormArticleId(Number(e.target.value))} className="form-input">
                  <option value={0}>— Choisir un article —</option>
                  {articles.map(a => (
                    <option key={a.id} value={a.id}>{getArticleLabel(a.id)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Statut initial</label>
                <select value={formStatutId} onChange={e => setFormStatutId(Number(e.target.value))} className="form-input">
                  <option value={0}>— Aucun statut —</option>
                  {statuts.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              {champs.map(c => (
                <div className="form-group" key={c.id}>
                  <label className="form-label">
                    {c.label}
                    {c.obligatoire && <span style={{ color: '#dc2626', marginLeft: '4px' }}>*</span>}
                  </label>
                  {(c.type === 'DATE' || c.type === 'DATE_TODAY') ? (
                    <input type="date" required={c.obligatoire} className="form-input"
                      value={formValeurs[c.id] ?? ''}
                      onChange={e => setFormValeurs(f => ({ ...f, [c.id]: e.target.value }))} />
                  ) : c.type === 'NUMBER' ? (
                    <input type="number" required={c.obligatoire} className="form-input"
                      value={formValeurs[c.id] ?? ''}
                      onChange={e => setFormValeurs(f => ({ ...f, [c.id]: e.target.value }))} />
                  ) : (
                    <input type="text" required={c.obligatoire} className="form-input"
                      value={formValeurs[c.id] ?? ''}
                      onChange={e => setFormValeurs(f => ({ ...f, [c.id]: e.target.value }))} />
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setFormValeurs({}); setFormArticleId(0); setFormStatutId(0) }}>Annuler</button>
                <button type="submit" className="btn btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal édition */}
      {editItem && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '10px', padding: '28px', maxWidth: '520px', width: '100%', maxHeight: '85vh', overflow: 'auto' }}>
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
              {champs.map(c => (
                <div className="form-group" key={c.id}>
                  <label className="form-label">
                    {c.label}
                    {c.obligatoire && <span style={{ color: '#dc2626', marginLeft: '4px' }}>*</span>}
                  </label>
                  {(c.type === 'DATE' || c.type === 'DATE_TODAY') ? (
                    <input type="date" required={c.obligatoire} className="form-input"
                      value={editItem.valeurs[c.id] ?? ''}
                      onChange={e => setEditItem(ei => ei ? { ...ei, valeurs: { ...ei.valeurs, [c.id]: e.target.value } } : ei)} />
                  ) : c.type === 'NUMBER' ? (
                    <input type="number" required={c.obligatoire} className="form-input"
                      value={editItem.valeurs[c.id] ?? ''}
                      onChange={e => setEditItem(ei => ei ? { ...ei, valeurs: { ...ei.valeurs, [c.id]: e.target.value } } : ei)} />
                  ) : (
                    <input type="text" required={c.obligatoire} className="form-input"
                      value={editItem.valeurs[c.id] ?? ''}
                      onChange={e => setEditItem(ei => ei ? { ...ei, valeurs: { ...ei.valeurs, [c.id]: e.target.value } } : ei)} />
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
