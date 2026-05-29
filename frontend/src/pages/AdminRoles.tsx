import { useEffect, useState } from 'react'
import { Trash2, Pencil, Check, X } from 'lucide-react'
import { get, post, put, del } from '../api/client'

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

interface Page { path: string; label: string }
interface Role { id: number; code: string; label: string; permissions: { page: string }[] }

export default function AdminRoles() {
  const siteId = getSiteId()
  const [roles, setRoles] = useState<Role[]>([])
  const [pages, setPages] = useState<Page[]>([])
  const [form, setForm] = useState({ code: '', label: '', pages: [] as string[] })
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ label: '', pages: [] as string[] })
  const [modal, setModal] = useState<{ id: number } | null>(null)

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    const [r, p] = await Promise.all([
      get<Role[]>(`/gestion/${siteId}/roles`),
      get<Page[]>('/gestion/pages')
    ])
    setRoles(r)
    setPages(p)
  }

  function togglePage(list: string[], page: string) {
    return list.includes(page) ? list.filter(p => p !== page) : [...list, page]
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await post(`/gestion/${siteId}/roles`, form)
    setForm({ code: '', label: '', pages: [] })
    reload()
  }

  async function handleUpdate(id: number) {
    await put(`/gestion/roles/${id}`, editForm)
    setEditId(null)
    reload()
  }

  async function handleDelete(id: number) {
    await del(`/gestion/roles/${id}`)
    setModal(null)
    reload()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Rôles utilisateurs</h1>
          <p className="page-subtitle">Définissez les rôles et leurs droits d'accès par page</p>
        </div>
      </div>

      {roles.map(role => (
        <div key={role.id} className="card" style={{ marginBottom: '16px' }}>
          {editId === role.id ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <code style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', color: '#475569' }}>{role.code}</code>
                <input value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))} className="form-input" style={{ width: '200px' }} />
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                  <button className="btn btn-primary btn-icon" onClick={() => handleUpdate(role.id)}><Check size={14} /></button>
                  <button className="btn btn-secondary btn-icon" onClick={() => setEditId(null)}><X size={14} /></button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
                {pages.map(p => (
                  <label key={p.path} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', background: editForm.pages.includes(p.path) ? '#eff6ff' : 'white', borderColor: editForm.pages.includes(p.path) ? '#bfdbfe' : '#e5e7eb' }}>
                    <input type="checkbox" checked={editForm.pages.includes(p.path)} onChange={() => setEditForm(f => ({ ...f, pages: togglePage(f.pages, p.path) }))} />
                    <span style={{ fontSize: '13px' }}>{p.label}</span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <code style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', color: '#475569' }}>{role.code}</code>
                <span style={{ fontWeight: 600, fontSize: '15px' }}>{role.label}</span>
                <span className="badge badge-default" style={{ marginLeft: '4px' }}>{role.permissions.length} page{role.permissions.length !== 1 ? 's' : ''}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                  <button className="btn btn-secondary btn-icon" onClick={() => { setEditId(role.id); setEditForm({ label: role.label, pages: role.permissions.map(p => p.page) }) }}><Pencil size={14} /></button>
                  <button className="btn btn-danger btn-icon" onClick={() => setModal({ id: role.id })}><Trash2 size={14} /></button>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {role.permissions.length === 0
                  ? <span style={{ fontSize: '13px', color: '#9ca3af' }}>Aucun accès configuré</span>
                  : role.permissions.map(p => {
                    const page = pages.find(pg => pg.path === p.page)
                    return <span key={p.page} className="badge badge-info" style={{ fontSize: '12px' }}>{page?.label ?? p.page}</span>
                  })
                }
              </div>
            </>
          )}
        </div>
      ))}

      {/* Formulaire création */}
      <div className="card">
        <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Créer un rôle</h2>
        <form onSubmit={handleCreate}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Code</label>
              <input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '_') }))} className="form-input" placeholder="EX: TECHNICIEN" style={{ width: '160px' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Label</label>
              <input required value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} className="form-input" placeholder="Ex: Technicien" style={{ width: '200px' }} />
            </div>
          </div>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pages accessibles</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px', marginBottom: '20px' }}>
            {pages.map(p => (
              <label key={p.path} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', background: form.pages.includes(p.path) ? '#eff6ff' : 'white', borderColor: form.pages.includes(p.path) ? '#bfdbfe' : '#e5e7eb' }}>
                <input type="checkbox" checked={form.pages.includes(p.path)} onChange={() => setForm(f => ({ ...f, pages: togglePage(f.pages, p.path) }))} />
                <span style={{ fontSize: '13px' }}>{p.label}</span>
              </label>
            ))}
          </div>
          <button type="submit" className="btn btn-primary">+ Créer le rôle</button>
        </form>
      </div>

      {modal && (
        <div className="modal-overlay">
          <div style={{ background: 'white', borderRadius: '10px', padding: '28px', maxWidth: '420px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Confirmer la suppression</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>Ce rôle sera supprimé. Les utilisateurs associés devront être réassignés.</p>
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
