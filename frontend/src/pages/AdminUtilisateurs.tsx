import { useEffect, useState } from 'react'
import { Trash2, Pencil, Check, X, RefreshCw, Copy } from 'lucide-react'
import { get, post, put, del } from '../api/client'
import { getPermissions } from '../utils/permissions'

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

interface Role { id: number; code: string; label: string }
interface Utilisateur { id: number; nom: string; prenom: string; login: string; actif: boolean; doitChangerMdp: boolean; role: Role }

export default function AdminUtilisateurs() {
  const siteId = getSiteId()
  const { isAdmin } = getPermissions()
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [form, setForm] = useState({ nom: '', prenom: '', login: '', roleId: 0 })
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ nom: '', prenom: '', login: '', roleId: 0, actif: true })
  const [modal, setModal] = useState<{ type: 'delete' | 'mdp'; id: number; mdp?: string } | null>(null)

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    const [u, r] = await Promise.all([
      get<Utilisateur[]>(`/gestion/${siteId}/utilisateurs`),
      get<Role[]>(`/gestion/${siteId}/roles`)
    ])
    setUtilisateurs(u)
    setRoles(r)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const result = await post<{ mdpGenere: string }>(`/gestion/${siteId}/utilisateurs`, form)
    setForm({ nom: '', prenom: '', login: '', roleId: 0 })
    setModal({ type: 'mdp', id: 0, mdp: result.mdpGenere })
    reload()
  }

  async function handleUpdate(id: number) {
    await put(`/gestion/utilisateurs/${id}`, editForm)
    setEditId(null)
    reload()
  }

  async function handleDelete(id: number) {
    await del(`/gestion/utilisateurs/${id}`)
    setModal(null)
    reload()
  }

  async function handleReinitMdp(id: number) {
    const result = await post<{ mdpGenere: string }>(`/gestion/utilisateurs/${id}/reinitialiser-mdp`, {})
    setModal({ type: 'mdp', id, mdp: result.mdpGenere })
    reload()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Utilisateurs</h1>
          <p className="page-subtitle">{utilisateurs.length} utilisateur{utilisateurs.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="card">
        <table className="table" style={{ marginBottom: '20px' }}>
          <thead>
            <tr>
              <th>Nom</th><th>PrÃ©nom</th><th>Login</th><th>RÃ´le</th><th>Statut</th><th>Mdp</th><th></th>
            </tr>
          </thead>
          <tbody>
            {utilisateurs.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>Aucun utilisateur</td></tr>
            )}
            {utilisateurs.map(u => (
              <tr key={u.id}>
                {editId === u.id ? (
                  <>
                    <td><input value={editForm.nom} onChange={e => setEditForm(f => ({ ...f, nom: e.target.value }))} className="form-input" /></td>
                    <td><input value={editForm.prenom} onChange={e => setEditForm(f => ({ ...f, prenom: e.target.value }))} className="form-input" /></td>
                    <td><input value={editForm.login} onChange={e => setEditForm(f => ({ ...f, login: e.target.value }))} className="form-input" /></td>
                    <td>
                      <select value={editForm.roleId} onChange={e => setEditForm(f => ({ ...f, roleId: Number(e.target.value) }))} className="form-input">
                        {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                        <input type="checkbox" checked={editForm.actif} onChange={e => setEditForm(f => ({ ...f, actif: e.target.checked }))} />
                        Actif
                      </label>
                    </td>
                    <td></td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-primary btn-icon" onClick={() => handleUpdate(u.id)}><Check size={14} /></button>
                        <button className="btn btn-secondary btn-icon" onClick={() => setEditId(null)}><X size={14} /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ fontWeight: 500 }}>{u.nom}</td>
                    <td>{u.prenom}</td>
                    <td><code style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#475569' }}>{u.login}</code></td>
                    <td><span className="badge badge-default">{u.role?.label ?? 'â€”'}</span></td>
                    <td><span className={`badge ${u.actif ? 'badge-success' : 'badge-danger'}`}>{u.actif ? 'Actif' : 'Inactif'}</span></td>
                    <td>{u.doitChangerMdp ? <span className="badge badge-warning">Ã€ changer</span> : <span style={{ color: '#d1d5db' }}>â€”</span>}</td>
                    <td>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn-secondary btn-icon" title="Modifier" onClick={() => { setEditId(u.id); setEditForm({ nom: u.nom, prenom: u.prenom, login: u.login, roleId: u.role?.id, actif: u.actif }) }}><Pencil size={14} /></button>
                          <button className="btn btn-secondary btn-icon" title="RÃ©initialiser le mot de passe" onClick={() => handleReinitMdp(u.id)}><RefreshCw size={14} /></button>
                          <button className="btn btn-danger btn-icon" title="Supprimer" onClick={() => setModal({ type: 'delete', id: u.id })}><Trash2 size={14} /></button>
                        </div>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Formulaire crÃ©ation */}
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CrÃ©er un utilisateur</p>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Nom</label>
              <input required value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} className="form-input" style={{ width: '130px' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">PrÃ©nom</label>
              <input required value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} className="form-input" style={{ width: '130px' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Login</label>
              <input required value={form.login} onChange={e => setForm(f => ({ ...f, login: e.target.value }))} className="form-input" style={{ width: '130px' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">RÃ´le</label>
              <select required value={form.roleId} onChange={e => setForm(f => ({ ...f, roleId: Number(e.target.value) }))} className="form-input" style={{ width: '150px' }}>
                <option value={0}>â€” choisir â€”</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            {isAdmin && <button type="submit" className="btn btn-primary">+ CrÃ©er</button>}
          </form>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '10px' }}>Un mot de passe sÃ©curisÃ© sera gÃ©nÃ©rÃ© automatiquement et affichÃ© une seule fois.</p>
        </div>
      </div>

      {/* Modal mot de passe gÃ©nÃ©rÃ© */}
      {modal?.type === 'mdp' && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '10px', padding: '28px', maxWidth: '460px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Mot de passe gÃ©nÃ©rÃ©</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '20px' }}>
              Communiquez ce mot de passe Ã  l'utilisateur. Il lui sera demandÃ© de le modifier Ã  sa premiÃ¨re connexion.
            </p>
            <div style={{ background: '#141720', border: '1px solid #2d3148', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <code style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '2px', color: '#111827' }}>{modal.mdp}</code>
              <button className="btn btn-secondary btn-icon" title="Copier" onClick={() => navigator.clipboard.writeText(modal.mdp ?? '')}>
                <Copy size={16} />
              </button>
            </div>
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '6px', padding: '10px 14px', marginBottom: '20px' }}>
              <p style={{ fontSize: '13px', color: '#92400e' }}>âš ï¸ Ce mot de passe ne sera plus affichÃ©. Notez-le avant de fermer.</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setModal(null)}>J'ai notÃ© le mot de passe</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal suppression */}
      {modal?.type === 'delete' && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '10px', padding: '28px', maxWidth: '420px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Supprimer cet utilisateur ?</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>Cette action est irrÃ©versible.</p>
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

