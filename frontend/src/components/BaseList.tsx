import { useEffect, useRef, useState } from 'react'
import { Trash2, Plus, X, Check, Pencil } from 'lucide-react'
import { get, post, put, del } from '../api/client'

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

interface Item {
  id: number
  createdAt: string
  valeurs: ValeurChamp[]
}

interface Props {
  titre: string
  sousTitre: string
  baseUrl: string
  siteId: number
  pagePath: string
}

export default function BaseList({ titre, sousTitre, baseUrl, siteId, pagePath }: Props) {
  const utilisateur = JSON.parse(localStorage.getItem('utilisateur') || 'null')
  const isAdmin = utilisateur?.role?.code === 'ADMIN'
  const permissions: string[] = utilisateur?.permissions ?? []
  const peutEditer  = isAdmin || permissions.includes(`${pagePath}:edit`)
  const peutSupprimer = isAdmin || permissions.includes(`${pagePath}:delete`)
  const peutCreer   = isAdmin || permissions.includes(`${pagePath}:edit`)

  const [champs, setChamps] = useState<Champ[]>([])
  const [colonnesOrdre, setColonnesOrdre] = useState<number[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [filtres, setFiltres] = useState<Record<string, string>>({})
  const dragColonne = useRef<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formValeurs, setFormValeurs] = useState<Record<number, string>>({})
  const [modal, setModal] = useState<{ id: number } | null>(null)
  const [editItem, setEditItem] = useState<{ id: number; valeurs: Record<number, string> } | null>(null)

  const hasActiveFiltres = Object.values(filtres).some(v => v.trim() !== '')

  const filteredItems = items.filter(item => {
    for (const [champId, val] of Object.entries(filtres)) {
      if (!val.trim()) continue
      const valeur = String(item.valeurs.find(v => v.champId === Number(champId))?.valeur ?? '')
      if (!valeur.toLowerCase().includes(val.toLowerCase())) return false
    }
    return true
  })

  useEffect(() => {
    document.querySelector('.main-content')?.classList.add('page-table')
    return () => { document.querySelector('.main-content')?.classList.remove('page-table') }
  }, [])

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    const [c, i] = await Promise.all([
      get<Champ[]>(`${baseUrl}/${siteId}/champs`),
      get<Item[]>(`${baseUrl}/${siteId}`)
    ])
    const champsActifs = c.filter(ch => ch.actif)
    setChamps(champsActifs)
    const login = JSON.parse(localStorage.getItem('utilisateur') || '{}')?.login ?? 'default'
    const storageKey = `${baseUrl}_colonnes_${login}`
    const savedOrdre = JSON.parse(localStorage.getItem(storageKey) || '[]') as number[]
    const ids = champsActifs.map(ch => ch.id)
    const restored = [
      ...savedOrdre.filter(id => ids.includes(id)),
      ...ids.filter(id => !savedOrdre.includes(id))
    ]
    setColonnesOrdre(restored)
    setItems(i)
  }

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
    localStorage.setItem(`${baseUrl}_colonnes_${login}`, JSON.stringify(newOrdre))
    dragColonne.current = null
  }

  function getValeur(item: Item, champId: number) {
    return item.valeurs.find(v => v.champId === champId)?.valeur ?? 'â€”'
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const valeurs = Object.entries(formValeurs).map(([champId, valeur]) => ({ champId: Number(champId), valeur }))
    await post(`${baseUrl}/${siteId}`, { valeurs })
    setFormValeurs({})
    setShowForm(false)
    reload()
  }

  async function handleDelete(id: number) {
    await del(`${baseUrl}/${id}`)
    setModal(null)
    reload()
  }

  function openEdit(item: Item) {
    const valeurs: Record<number, string> = {}
    item.valeurs.forEach(v => { valeurs[v.champId] = v.valeur ?? '' })
    setEditItem({ id: item.id, valeurs })
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editItem) return
    const valeurs = Object.entries(editItem.valeurs).map(([champId, valeur]) => ({ champId: Number(champId), valeur }))
    await put(`${baseUrl}/${editItem.id}`, { valeurs })
    setEditItem(null)
    reload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{titre}</h1>
          <p className="page-subtitle">{filteredItems.length} enregistrement{filteredItems.length !== 1 ? 's' : ''}{hasActiveFiltres && ` (sur ${items.length})`}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {hasActiveFiltres && (
            <button className="btn btn-secondary" onClick={() => setFiltres({})}>
              <X size={14} /> Effacer filtres
            </button>
          )}
          {peutCreer && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <Plus size={16} /> Ajouter
            </button>
          )}
        </div>
      </div>

      {champs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
          <p style={{ marginBottom: '8px', fontWeight: 500 }}>Aucun champ configurÃ©</p>
          <p style={{ fontSize: '13px' }}>Configurez d'abord les champs dans la section Configuration.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
          <table className="table" style={{ minWidth: 'max-content' }}>
            <thead>
              <tr>
                {champsOrdonnes.map(c => (
                  <th key={c.id}
                    draggable
                    onDragStart={() => onDragStart(c.id)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => onDrop(c.id)}
                    style={{ cursor: 'grab', userSelect: 'none', whiteSpace: 'nowrap' }}
                    title="Glisser pour dÃ©placer"
                  >
                    {c.label} <span style={{ color: '#bfdbfe', fontSize: '10px' }}>â ¿</span>
                  </th>
                ))}
                <th>AjoutÃ© le</th>
                <th></th>
              </tr>
              <tr style={{ background: '#141720' }}>
                {champsOrdonnes.map(c => (
                  <td key={c.id} style={{ padding: '4px 8px' }}>
                    <input className="form-input" placeholder="Filtrer..."
                      value={filtres[String(c.id)] ?? ''}
                      onChange={e => setFiltres(f => ({ ...f, [c.id]: e.target.value }))}
                      style={{ fontSize: '12px', padding: '3px 6px', minWidth: '80px' }} />
                  </td>
                ))}
                <td style={{ padding: '4px 8px' }}></td>
                <td style={{ padding: '4px 8px' }}></td>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 && (
                <tr><td colSpan={champsOrdonnes.length + 2} style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>
                  {hasActiveFiltres ? 'Aucun rÃ©sultat' : 'Aucune donnÃ©e'}
                </td></tr>
              )}
              {filteredItems.map((item, idx) => (
                <tr key={item.id} style={{ background: idx % 2 === 0 ? '#1a1d27' : '#141720' }}>
                  {champsOrdonnes.map(c => (
                    <td key={c.id}>{getValeur(item, c.id) || <span style={{ color: '#d1d5db' }}>â€”</span>}</td>
                  ))}
                  <td style={{ color: '#9ca3af', fontSize: '13px' }}>
                    {new Date(item.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td style={{ display: 'flex', gap: '6px' }}>
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
          <div style={{ background: '#1a1d27', borderRadius: '10px', padding: '28px', maxWidth: '520px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Ajouter â€” {titre}</h3>
            <form onSubmit={handleCreate}>
              {champs.map(c => {
                const opts = c.options ? (() => { try { return JSON.parse(c.options) } catch { return [] } })() : []
                const today = new Date().toISOString().split('T')[0]
                // Auto-remplir DATE_TODAY si pas encore de valeur
                if (c.type === 'DATE_TODAY' && !formValeurs[c.id]) {
                  setTimeout(() => setFormValeurs(f => f[c.id] ? f : ({ ...f, [c.id]: today })), 0)
                }
                return (
                <div className="form-group" key={c.id}>
                  <label className="form-label">
                    {c.label}
                    {c.obligatoire && <span style={{ color: '#dc2626', marginLeft: '4px' }}>*</span>}
                  </label>
                  {c.type === 'DATE' ? (
                    <input type="date" required={c.obligatoire} className="form-input"
                      value={formValeurs[c.id] ?? ''}
                      onChange={e => setFormValeurs(f => ({ ...f, [c.id]: e.target.value }))} />
                  ) : c.type === 'DATE_TODAY' ? (
                    <input type="date" required={c.obligatoire} className="form-input"
                      value={formValeurs[c.id] ?? today}
                      onChange={e => setFormValeurs(f => ({ ...f, [c.id]: e.target.value }))} />
                  ) : c.type === 'NUMBER' ? (
                    <input type="number" required={c.obligatoire} className="form-input"
                      value={formValeurs[c.id] ?? ''}
                      onChange={e => setFormValeurs(f => ({ ...f, [c.id]: e.target.value }))} />
                  ) : c.type === 'SELECT' ? (
                    <select required={c.obligatoire} className="form-input"
                      value={formValeurs[c.id] ?? ''}
                      onChange={e => setFormValeurs(f => ({ ...f, [c.id]: e.target.value }))}>
                      <option value="">â€” Choisir â€”</option>
                      {opts.map((o: string) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type="text" required={c.obligatoire} className="form-input"
                      value={formValeurs[c.id] ?? ''}
                      onChange={e => setFormValeurs(f => ({ ...f, [c.id]: e.target.value }))} />
                  )}
                </div>
              )})}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setFormValeurs({}) }}>Annuler</button>
                <button type="submit" className="btn btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ã©dition */}
      {editItem && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '10px', padding: '28px', maxWidth: '520px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Modifier â€” {titre}</h3>
            <form onSubmit={handleEdit}>
              {champs.map(c => {
                const opts = c.options ? (() => { try { return JSON.parse(c.options) } catch { return [] } })() : []
                return (
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
                  ) : c.type === 'SELECT' ? (
                    <select required={c.obligatoire} className="form-input"
                      value={editItem.valeurs[c.id] ?? ''}
                      onChange={e => setEditItem(ei => ei ? { ...ei, valeurs: { ...ei.valeurs, [c.id]: e.target.value } } : ei)}>
                      <option value="">â€” Choisir â€”</option>
                      {opts.map((o: string) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type="text" required={c.obligatoire} className="form-input"
                      value={editItem.valeurs[c.id] ?? ''}
                      onChange={e => setEditItem(ei => ei ? { ...ei, valeurs: { ...ei.valeurs, [c.id]: e.target.value } } : ei)} />
                  )}
                </div>
              )})}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditItem(null)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal suppression */}
      {modal && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '10px', padding: '28px', maxWidth: '420px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Confirmer la suppression</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>Cet enregistrement sera dÃ©finitivement supprimÃ©.</p>
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

