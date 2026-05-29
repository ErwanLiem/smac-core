import { useEffect, useState } from 'react'
import { Trash2, Plus, X, Check } from 'lucide-react'
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
}

export default function BaseList({ titre, sousTitre, baseUrl, siteId }: Props) {
  const [champs, setChamps] = useState<Champ[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formValeurs, setFormValeurs] = useState<Record<number, string>>({})
  const [modal, setModal] = useState<{ id: number } | null>(null)

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    const [c, i] = await Promise.all([
      get<Champ[]>(`${baseUrl}/${siteId}/champs`),
      get<Item[]>(`${baseUrl}/${siteId}`)
    ])
    setChamps(c.filter(ch => ch.actif))
    setItems(i)
  }

  function getValeur(item: Item, champId: number) {
    return item.valeurs.find(v => v.champId === champId)?.valeur ?? '—'
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{titre}</h1>
          <p className="page-subtitle">{items.length} enregistrement{items.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {champs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
          <p style={{ marginBottom: '8px', fontWeight: 500 }}>Aucun champ configuré</p>
          <p style={{ fontSize: '13px' }}>Configurez d'abord les champs dans la section Configuration.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                {champs.map(c => <th key={c.id}>{c.label}</th>)}
                <th>Ajouté le</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={champs.length + 2} style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>Aucune donnée</td></tr>
              )}
              {items.map(item => (
                <tr key={item.id}>
                  {champs.map(c => (
                    <td key={c.id}>{getValeur(item, c.id) || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                  ))}
                  <td style={{ color: '#9ca3af', fontSize: '13px' }}>
                    {new Date(item.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td>
                    <button className="btn btn-danger btn-icon" onClick={() => setModal({ id: item.id })}>
                      <Trash2 size={14} />
                    </button>
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
          <div style={{ background: 'white', borderRadius: '10px', padding: '28px', maxWidth: '520px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Ajouter — {titre}</h3>
            <form onSubmit={handleCreate}>
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
                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setFormValeurs({}) }}>Annuler</button>
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
