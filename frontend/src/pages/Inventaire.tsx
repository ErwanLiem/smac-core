import { useEffect, useState } from 'react'
import { Trash2, Plus, Pencil, Search, X } from 'lucide-react'
import { inventaireApi } from '../api/inventaire'
import { get } from '../api/client'
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

  const [champs, setChamps] = useState<Champ[]>([])
  const [articles, setArticles] = useState<any[]>([])
  const [statuts, setStatuts] = useState<Statut[]>([])
  const [inventaires, setInventaires] = useState<Inventaire[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formArticleId, setFormArticleId] = useState<number>(0)
  const [formStatutId, setFormStatutId] = useState<number>(0)
  const [formValeurs, setFormValeurs] = useState<Record<number, string>>({})
  const [modal, setModal] = useState<{ id: number } | null>(null)
  const [editItem, setEditItem] = useState<{ id: number; articleId: number; statutId: number | null; valeurs: Record<number, string> } | null>(null)

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    const [c, a, s, i] = await Promise.all([
      inventaireApi.getChamps(siteId),
      get(`/api/articles/${siteId}`),
      get(`/api/workflow/${siteId}/statuts`),
      inventaireApi.getAll(siteId)
    ])
    setChamps(c.filter(ch => ch.actif))
    setArticles(a)
    setStatuts(s)
    setInventaires(i)
  }

  function getValeur(item: Inventaire, champId: number) {
    return item.valeurs.find(v => v.champId === champId)?.valeur ?? '—'
  }

  function getArticleLabel(articleId: number): string {
    const art = articles.find(a => a.id === articleId)
    if (!art) return `Article #${articleId}`
    const valeurs = art.valeurs.map(v => v.valeur).filter(Boolean).join(' ')
    return valeurs || `Article #${articleId}`
  }

  const filteredInventaires = inventaires.filter(inv => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      getArticleLabel(inv.articleId).toLowerCase().includes(query) ||
      inv.valeurs.some(v => String(v.valeur ?? '').toLowerCase().includes(query))
    )
  })

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
    return <span className="badge" style={{ background: statut.couleur, color: 'white' }}>{statut.label}</span>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventaire</h1>
          <p className="page-subtitle">{filteredInventaires.length} enregistrement{filteredInventaires.length !== 1 ? 's' : ''}{searchQuery && ` (sur ${inventaires.length})`}</p>
        </div>
        {peutCreer && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Ajouter
          </button>
        )}
      </div>

      {inventaires.length > 0 && (
        <div style={{ marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Search size={18} style={{ color: '#9ca3af' }} />
          <input
            type="text"
            placeholder="Rechercher dans tous les champs..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ flex: 1, maxWidth: '400px' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
              <X size={18} />
            </button>
          )}
        </div>
      )}

      {champs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
          <p style={{ marginBottom: '8px', fontWeight: 500 }}>Aucun champ configuré</p>
          <p style={{ fontSize: '13px' }}>Configurez d'abord les champs dans Configuration → Structure inventaire.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Article</th>
                <th>Statut</th>
                {champs.map(c => <th key={c.id}>{c.label}</th>)}
                <th>Ajouté le</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredInventaires.length === 0 && (
                <tr><td colSpan={champs.length + 4} style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>
                  {searchQuery ? 'Aucun résultat' : 'Aucune donnée'}
                </td></tr>
              )}
              {filteredInventaires.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 500 }}>{getArticleLabel(item.articleId)}</td>
                  <td><StatutBadge statut={item.statut} /></td>
                  {champs.map(c => (
                    <td key={c.id}>{getValeur(item, c.id) || <span style={{ color: '#d1d5db' }}>—</span>}</td>
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
      )}

      {/* Modal ajout */}
      {showForm && (
        <div className="modal-overlay">
          <div style={{ background: 'white', borderRadius: '10px', padding: '28px', maxWidth: '520px', width: '100%', maxHeight: '85vh', overflow: 'auto' }}>
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
                  {c.type === 'DATE' ? (
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
          <div style={{ background: 'white', borderRadius: '10px', padding: '28px', maxWidth: '520px', width: '100%', maxHeight: '85vh', overflow: 'auto' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Modifier — Inventaire</h3>
            <form onSubmit={handleEdit}>
              <div className="form-group">
                <label className="form-label">Article</label>
                <input type="text" disabled className="form-input" value={getArticleLabel(editItem.articleId)} style={{ background: '#f3f4f6', cursor: 'not-allowed' }} />
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
                  {c.type === 'DATE' ? (
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

      {/* Modal suppression */}
      {modal && (
        <div className="modal-overlay">
          <div style={{ background: 'white', borderRadius: '10px', padding: '28px', maxWidth: '420px', width: '100%' }}>
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
