import { useEffect, useState } from 'react'
import { Trash2, Pencil, Check, X, Plus } from 'lucide-react'
import { get, post, put, del } from '../api/client'
import { getPermissions } from '../utils/permissions'

function parseOptions(raw: string | null | undefined): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

function OptionsEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [options, setOptions] = useState<string[]>(parseOptions(value))
  const [newOption, setNewOption] = useState('')

  function sync(opts: string[]) {
    setOptions(opts)
    onChange(JSON.stringify(opts))
  }

  function add() {
    const trimmed = newOption.trim()
    if (!trimmed || options.includes(trimmed)) return
    sync([...options, trimmed])
    setNewOption('')
  }

  function remove(opt: string) {
    sync(options.filter(o => o !== opt))
  }

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
        {options.map(opt => (
          <span key={opt} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#1e3a5f', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px', fontSize: '12px' }}>
            {opt}
            <button type="button" onClick={() => remove(opt)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', display: 'flex', alignItems: 'center', padding: 0 }}><X size={11} /></button>
          </span>
        ))}
        {options.length === 0 && <span style={{ color: '#9ca3af', fontSize: '12px' }}>Aucune option</span>}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          className="form-input"
          placeholder="Nouvelle option..."
          value={newOption}
          onChange={e => setNewOption(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          style={{ fontSize: '12px', padding: '4px 8px' }}
        />
        <button type="button" className="btn btn-secondary btn-icon" onClick={add}><Plus size={14} /></button>
      </div>
    </div>
  )
}

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

type ChampType = 'TEXT' | 'NUMBER' | 'DATE' | 'DATE_TODAY' | 'SELECT'

interface Champ {
  id: number
  code: string
  label: string
  type: ChampType
  options: string | null
  obligatoire: boolean
  ordre: number
  actif: boolean
}

const typeLabels: Record<ChampType, string> = {
  TEXT: 'Texte',
  NUMBER: 'Nombre',
  DATE: 'Date',
  DATE_TODAY: 'Date du jour',
  SELECT: 'Liste déroulante'
}

const emptyChamp = { code: '', label: '', type: 'TEXT' as ChampType, options: '', obligatoire: false, ordre: 0 }

export default function AdminArticles() {
  const siteId = getSiteId()
  const { isAdmin } = getPermissions()
  const [champs, setChamps] = useState<Champ[]>([])
  const [form, setForm] = useState(emptyChamp)
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Partial<Champ>>({})
  const [modal, setModal] = useState<{ id: number } | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    const data = await get<Champ[]>(`/articles/${siteId}/champs`)
    setChamps(data)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    try {
      setErreur(null)
      await post(`/articles/${siteId}/champs`, form)
      setForm(emptyChamp)
      reload()
    } catch (e: any) {
      try { setErreur(JSON.parse(e.message)?.error ?? 'Erreur inconnue') } catch { setErreur('Erreur inconnue') }
    }
  }

  async function handleUpdate(id: number) {
    await put(`/articles/champs/${id}`, editForm)
    setEditId(null)
    reload()
  }

  async function handleDelete(id: number) {
    await del(`/articles/champs/${id}`)
    setModal(null)
    reload()
  }

  function startEdit(champ: Champ) {
    setEditId(champ.id)
    setEditForm({ label: champ.label, type: champ.type, options: champ.options ?? '', obligatoire: champ.obligatoire, ordre: champ.ordre, actif: champ.actif })
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Articles</h1>
          <p className="page-subtitle">Configurez les champs de votre base articles</p>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '16px' }}>Champs configurés</h2>
        <table className="table" style={{ marginBottom: '20px' }}>
          <thead>
            <tr>
              <th>Ordre</th>
              <th>Code</th>
              <th>Label</th>
              <th>Type</th>
              <th>Obligatoire</th>
              <th>Actif</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {champs.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>Aucun champ configuré</td></tr>
            )}
            {champs.map(champ => (
              <tr key={champ.id}>
                {editId === champ.id ? (
                  <>
                    <td><input type="number" value={editForm.ordre} onChange={e => setEditForm(f => ({ ...f, ordre: Number(e.target.value) }))} className="form-input" style={{ width: '60px' }} /></td>
                    <td><code style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#475569' }}>{champ.code}</code></td>
                    <td><input value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))} className="form-input" style={{ width: '160px' }} /></td>
                    <td>
                      <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value as ChampType }))} className="form-input" style={{ width: '140px' }}>
                        {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      {editForm.type === 'SELECT' && (
                        <OptionsEditor value={editForm.options ?? ''} onChange={v => setEditForm(f => ({ ...f, options: v }))} />
                      )}
                    </td>
                    <td><input type="checkbox" checked={editForm.obligatoire} onChange={e => setEditForm(f => ({ ...f, obligatoire: e.target.checked }))} /></td>
                    <td><input type="checkbox" checked={editForm.actif} onChange={e => setEditForm(f => ({ ...f, actif: e.target.checked }))} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-primary btn-icon" title="Valider" onClick={() => handleUpdate(champ.id)}><Check size={14} /></button>
                        <button className="btn btn-secondary btn-icon" title="Annuler" onClick={() => setEditId(null)}><X size={14} /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ color: '#9ca3af' }}>{champ.ordre}</td>
                    <td><code style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#475569' }}>{champ.code}</code></td>
                    <td style={{ fontWeight: 500 }}>{champ.label}</td>
                    <td><span className="badge badge-default">{typeLabels[champ.type]}</span></td>
                    <td>{champ.obligatoire ? <span className="badge badge-info">Oui</span> : <span style={{ color: '#d1d5db' }}>—</span>}</td>
                    <td>
                      <span className={`badge ${champ.actif ? 'badge-success' : 'badge-danger'}`}>
                        {champ.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn-secondary btn-icon" title="Modifier" onClick={() => startEdit(champ)}><Pencil size={14} /></button>
                          <button className="btn btn-danger btn-icon" title="Supprimer" onClick={() => setModal({ id: champ.id })}><Trash2 size={14} /></button>
                        </div>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Formulaire ajout */}
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ajouter un champ</p>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Code</label>
              <input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '_') }))} className="form-input" placeholder="EX: NUMERO_RMA" style={{ width: '160px' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Label</label>
              <input required value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} className="form-input" placeholder="Ex: N° RMA" style={{ width: '160px' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ChampType, options: '' }))} className="form-input">
                {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {form.type === 'SELECT' && (
              <div className="form-group" style={{ margin: 0, minWidth: '220px' }}>
                <label className="form-label">Options de la liste</label>
                <OptionsEditor value={form.options} onChange={v => setForm(f => ({ ...f, options: v }))} />
              </div>
            )}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Ordre</label>
              <input type="number" value={form.ordre} onChange={e => setForm(f => ({ ...f, ordre: Number(e.target.value) }))} className="form-input" style={{ width: '70px' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '2px' }}>
              <input type="checkbox" id="obligatoire" checked={form.obligatoire} onChange={e => setForm(f => ({ ...f, obligatoire: e.target.checked }))} />
              <label htmlFor="obligatoire" style={{ fontSize: '13px', color: '#374151' }}>Obligatoire</label>
            </div>
            {isAdmin && <button type="submit" className="btn btn-primary">+ Ajouter</button>}
          </form>
          {erreur && (
            <div style={{ marginTop: '12px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#dc2626', fontSize: '13px' }}>
              ⚠️ {erreur}
            </div>
          )}
        </div>
      </div>

      {/* Modal suppression */}
      {modal && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '10px', padding: '28px', maxWidth: '420px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Confirmer la suppression</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>
              Toutes les valeurs associées à ce champ seront définitivement supprimées.
            </p>
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
