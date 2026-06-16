import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { get, post, put, del } from '../api/client'
import { getSiteId } from '../utils/permissions'

interface Emplacement {
  id: number
  nom: string
  capaciteMax: number
  description: string | null
  remplissage: number
}

interface FormData { nom: string; capaciteMax: string; description: string }
const emptyForm: FormData = { nom: '', capaciteMax: '', description: '' }

function BarreRemplissage({ remplissage, capaciteMax }: { remplissage: number; capaciteMax: number }) {
  const pct = capaciteMax > 0 ? (remplissage / capaciteMax) * 100 : 0
  const clamp = Math.min(pct, 100)
  const bar   = pct >= 100 ? '#dc2626' : pct >= 75 ? '#f59e0b' : '#22c55e'
  const text  = bar

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: '#9ca3af' }}>
          {remplissage} / {capaciteMax} article{capaciteMax !== 1 ? 's' : ''}
        </span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: text }}>
          {Math.round(pct)}%
          {pct > 100 && <span style={{ marginLeft: '6px', fontSize: '11px' }}>⚠ +{remplissage - capaciteMax}</span>}
        </span>
      </div>
      <div style={{ background: '#374151', borderRadius: '4px', height: '8px', overflow: 'visible', position: 'relative' }}>
        <div style={{
          height: '100%',
          width: `${clamp}%`,
          background: bar,
          borderRadius: '4px',
          transition: 'width 0.4s ease',
          position: 'relative'
        }} />
        {pct > 100 && (
          <div style={{
            position: 'absolute', right: 0, top: '-2px',
            width: '4px', height: '12px',
            background: '#dc2626', borderRadius: '2px'
          }} />
        )}
      </div>
    </div>
  )
}

export default function Emplacements() {
  const siteId = getSiteId()
  const [emplacements, setEmplacements] = useState<Emplacement[]>([])
  const [chargement, setChargement]     = useState(true)
  const [erreur, setErreur]             = useState<string | null>(null)

  const [showForm, setShowForm]     = useState(false)
  const [editId, setEditId]         = useState<number | null>(null)
  const [form, setForm]             = useState<FormData>(emptyForm)
  const [saving, setSaving]         = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    setChargement(true)
    try {
      const data = await get<Emplacement[]>(`/emplacements/${siteId}`)
      setEmplacements(data)
    } finally {
      setChargement(false)
    }
  }

  function openCreate() {
    setEditId(null)
    setForm(emptyForm)
    setErreur(null)
    setShowForm(true)
  }

  function openEdit(e: Emplacement) {
    setEditId(e.id)
    setForm({ nom: e.nom, capaciteMax: String(e.capaciteMax), description: e.description ?? '' })
    setErreur(null)
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditId(null); setForm(emptyForm); setErreur(null) }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!form.nom.trim()) return setErreur('Le nom est obligatoire')
    const cap = Number(form.capaciteMax)
    if (!cap || cap < 1) return setErreur('La capacité max doit être supérieure à 0')

    setSaving(true)
    setErreur(null)
    try {
      const payload = { nom: form.nom.trim(), capaciteMax: cap, description: form.description.trim() || null }
      if (editId) {
        await put(`/emplacements/${siteId}/${editId}`, payload)
      } else {
        await post(`/emplacements/${siteId}`, payload)
      }
      closeForm()
      reload()
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    try {
      await del(`/emplacements/${siteId}/${id}`)
      setConfirmDelete(null)
      reload()
    } catch {
      setErreur('Erreur lors de la suppression')
      setConfirmDelete(null)
    }
  }

  const totalArticles = emplacements.reduce((s, e) => s + e.remplissage, 0)
  const totalCapacite = emplacements.reduce((s, e) => s + e.capaciteMax, 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Emplacements</h1>
          <p className="page-subtitle">Gestion des emplacements de stockage</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> Nouvel emplacement
        </button>
      </div>

      {/* Stats globales */}
      {emplacements.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Emplacements</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{emplacements.length}</div>
          </div>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Articles stockés</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{totalArticles}</div>
          </div>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Capacité totale</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{totalCapacite}</div>
          </div>
        </div>
      )}

      {chargement ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : emplacements.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📦</div>
          <p style={{ marginBottom: '16px' }}>Aucun emplacement défini</p>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={15} /> Créer le premier emplacement
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {emplacements.map(emp => {
            const pct = emp.capaciteMax > 0 ? (emp.remplissage / emp.capaciteMax) * 100 : 0
            const borderColor = pct >= 100 ? '#dc2626' : pct >= 75 ? '#f59e0b' : '#2d3148'
            return (
              <div key={emp.id} className="card" style={{ padding: '16px', borderLeft: `3px solid ${borderColor}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px' }}>{emp.nom}</div>
                    {emp.description && (
                      <div style={{ fontSize: '12px', color: '#9ca3af' }}>{emp.description}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => openEdit(emp)}
                      style={{ background: 'none', border: '1px solid #374151', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#9ca3af' }}>
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setConfirmDelete(emp.id)}
                      style={{ background: 'none', border: '1px solid #374151', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#dc2626' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <BarreRemplissage remplissage={emp.remplissage} capaciteMax={emp.capaciteMax} />
              </div>
            )
          })}
        </div>
      )}

      {/* Modal création / édition */}
      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '28px', maxWidth: '440px', width: '100%' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>
                {editId ? 'Modifier l\'emplacement' : 'Nouvel emplacement'}
              </h3>
              <button onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nom <span style={{ color: '#dc2626' }}>*</span></label>
                <input className="form-input" required value={form.nom}
                  onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  placeholder="Ex : Zone A, Rack 01..." />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Capacité max <span style={{ color: '#dc2626' }}>*</span></label>
                <input className="form-input" type="number" min={1} required value={form.capaciteMax}
                  onChange={e => setForm(f => ({ ...f, capaciteMax: e.target.value }))}
                  placeholder="Nombre d'articles maximum" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Description</label>
                <input className="form-input" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Description optionnelle..." />
              </div>
              {erreur && (
                <div style={{ padding: '8px 12px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626', fontSize: '13px' }}>
                  {erreur}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button type="button" className="btn btn-secondary" onClick={closeForm}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Check size={15} /> {editId ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression */}
      {confirmDelete !== null && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '28px', maxWidth: '380px', width: '100%' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Supprimer l'emplacement ?</h3>
            <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '20px' }}>
              Cette action est irréversible. Les articles qui référencent cet emplacement conserveront la valeur en texte dans leur inventaire.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Annuler</button>
              <button className="btn" style={{ background: '#dc2626', color: '#fff' }} onClick={() => handleDelete(confirmDelete)}>
                <Trash2 size={14} /> Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
