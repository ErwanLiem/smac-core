import { useEffect, useState } from 'react'
import { Trash2, Pencil, Check, X } from 'lucide-react'
import { get, post, put, del } from '../api/client'
import { getPermissions } from '../utils/permissions'

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

const ACTION_LABELS: Record<string, string> = {
  view:   'Voir',
  edit:   'Modifier',
  delete: 'Supprimer',
}

interface Page { path: string; label: string; actions: string[] }
interface Permission { page: string; action: string }
interface Role { id: number; code: string; label: string; permissions: Permission[] }

type PermSet = Record<string, string[]> // { '/articles': ['view', 'edit'] }

function toPermSet(permissions: Permission[]): PermSet {
  const set: PermSet = {}
  for (const p of permissions) {
    if (!set[p.page]) set[p.page] = []
    set[p.page].push(p.action)
  }
  return set
}

function fromPermSet(set: PermSet): Permission[] {
  return Object.entries(set).flatMap(([page, actions]) =>
    actions.map(action => ({ page, action }))
  )
}

function toggleAction(set: PermSet, path: string, action: string): PermSet {
  const current = set[path] ?? []
  const next = current.includes(action) ? current.filter(a => a !== action) : [...current, action]
  if (next.length === 0) {
    const { [path]: _, ...rest } = set
    return rest
  }
  return { ...set, [path]: next }
}

function PermissionsEditor({ pages, value, onChange }: { pages: Page[]; value: PermSet; onChange: (v: PermSet) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {pages.map(p => {
        const pageActive = (value[p.path]?.length ?? 0) > 0
        return (
          <div key={p.path} style={{ border: `1px solid ${pageActive ? '#bfdbfe' : '#e5e7eb'}`, borderRadius: '8px', padding: '10px 14px', background: pageActive ? '#f0f7ff' : 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>{p.label}</span>
              <div style={{ display: 'flex', gap: '12px' }}>
                {p.actions.map(action => {
                  const checked = value[p.path]?.includes(action) ?? false
                  return (
                    <label key={action} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: checked ? '#2563eb' : '#6b7280', cursor: 'pointer' }}>
                      <input type="checkbox" checked={checked} onChange={() => onChange(toggleAction(value, p.path, action))} />
                      {ACTION_LABELS[action] ?? action}
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function AdminRoles() {
  const siteId = getSiteId()
  const { isAdmin } = getPermissions()
  const [roles, setRoles] = useState<Role[]>([])
  const [pages, setPages] = useState<Page[]>([])
  const [form, setForm] = useState({ code: '', label: '', permSet: {} as PermSet })
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ label: '', permSet: {} as PermSet })
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await post(`/gestion/${siteId}/roles`, { code: form.code, label: form.label, permissions: fromPermSet(form.permSet) })
    setForm({ code: '', label: '', permSet: {} })
    reload()
  }

  async function handleUpdate(id: number) {
    await put(`/gestion/roles/${id}`, { label: editForm.label, permissions: fromPermSet(editForm.permSet) })
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
          <h1 className="page-title">RÃ´les utilisateurs</h1>
          <p className="page-subtitle">DÃ©finissez les rÃ´les et leurs droits d'accÃ¨s par page</p>
        </div>
      </div>

      {roles.map(role => (
        <div key={role.id} className="card">
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
              <PermissionsEditor pages={pages} value={editForm.permSet} onChange={permSet => setEditForm(f => ({ ...f, permSet }))} />
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <code style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', color: '#475569' }}>{role.code}</code>
                <span style={{ fontWeight: 600, fontSize: '15px' }}>{role.label}</span>
                <span className="badge badge-default">{role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}</span>
                {isAdmin && (
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                    <button className="btn btn-secondary btn-icon" onClick={() => { setEditId(role.id); setEditForm({ label: role.label, permSet: toPermSet(role.permissions) }) }}><Pencil size={14} /></button>
                    <button className="btn btn-danger btn-icon" onClick={() => setModal({ id: role.id })}><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {role.permissions.length === 0
                  ? <span style={{ fontSize: '13px', color: '#9ca3af' }}>Aucun accÃ¨s configurÃ©</span>
                  : role.permissions.map(p => {
                    const page = pages.find(pg => pg.path === p.page)
                    return (
                      <span key={`${p.page}:${p.action}`} className="badge badge-info" style={{ fontSize: '12px' }}>
                        {page?.label ?? p.page} â€” {ACTION_LABELS[p.action] ?? p.action}
                      </span>
                    )
                  })
                }
              </div>
            </>
          )}
        </div>
      ))}

      {/* Formulaire crÃ©ation â€” ADMIN uniquement */}
      {isAdmin && <div className="card">
        <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>CrÃ©er un rÃ´le</h2>
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
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Permissions</p>
          <div style={{ marginBottom: '20px' }}>
            <PermissionsEditor pages={pages} value={form.permSet} onChange={permSet => setForm(f => ({ ...f, permSet }))} />
          </div>
          <button type="submit" className="btn btn-primary">+ CrÃ©er le rÃ´le</button>
        </form>
      </div>}

      {modal && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '10px', padding: '28px', maxWidth: '420px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Confirmer la suppression</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>Ce rÃ´le sera supprimÃ©. Les utilisateurs associÃ©s devront Ãªtre rÃ©assignÃ©s.</p>
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

