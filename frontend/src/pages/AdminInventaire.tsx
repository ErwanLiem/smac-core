import { useEffect, useRef, useState } from 'react'
import { Trash2, Pencil, Check, X, Plus } from 'lucide-react'
import { inventaireApi } from '../api/inventaire'
import { getPermissions } from '../utils/permissions'

function parseOptions(raw: string | null | undefined): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

function OptionsEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [options, setOptions] = useState<string[]>(() => {
    const parsed = parseOptions(value)
    return Array.isArray(parsed) ? parsed : []
  })
  const [newOption, setNewOption] = useState('')
  const prevValue = useRef(value)

  useEffect(() => {
    if (value !== prevValue.current) {
      const parsed = parseOptions(value)
      setOptions(Array.isArray(parsed) ? parsed : [])
      prevValue.current = value
    }
  }, [value])

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
          <span key={opt} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px', fontSize: '12px' }}>
            {opt}
            <button type="button" onClick={() => remove(opt)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', padding: 0 }}><X size={11} /></button>
          </span>
        ))}
        {options.length === 0 && <span style={{ color: '#9ca3af', fontSize: '12px' }}>Aucune option</span>}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input className="form-input" placeholder="Nouvelle option..." value={newOption}
          onChange={e => setNewOption(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          style={{ fontSize: '12px', padding: '4px 8px' }} />
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
  visibleReceptionSN: boolean
  visibleReceptionQTE: boolean
}

const typeLabels: Record<ChampType, string> = {
  TEXT: 'Texte',
  NUMBER: 'Nombre',
  DATE: 'Date',
  DATE_TODAY: 'Date du jour',
  SELECT: 'Liste déroulante'
}

const emptyChamp = { code: '', label: '', type: 'TEXT' as ChampType, options: '', obligatoire: false, ordre: 0, visibleReceptionSN: false, visibleReceptionQTE: false }

function Oui({ val }: { val: boolean }) {
  return val ? <span className="badge badge-success">✓</span> : <span style={{ color: '#d1d5db' }}>—</span>
}

export default function AdminInventaire() {
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
    const data = await inventaireApi.getChamps(siteId)
    setChamps(data)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    try {
      setErreur(null)
      await inventaireApi.createChamp(siteId, form)
      setForm(emptyChamp)
      reload()
    } catch (e: any) {
      try { setErreur(JSON.parse(e.message)?.error ?? 'Erreur inconnue') } catch { setErreur('Erreur inconnue') }
    }
  }

  async function handleUpdate(id: number) {
    await inventaireApi.updateChamp(id, editForm)
    setEditId(null)
    reload()
  }

  async function handleDelete(id: number) {
    await inventaireApi.deleteChamp(id)
    setModal(null)
    reload()
  }

  function startEdit(champ: Champ) {
    setEditId(champ.id)
    setEditForm({
      label: champ.label, type: champ.type, options: champ.options ?? '',
      obligatoire: champ.obligatoire, ordre: champ.ordre, actif: champ.actif,
      visibleReceptionSN: champ.visibleReceptionSN,
      visibleReceptionQTE: champ.visibleReceptionQTE
    })
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Structure inventaire</h1>
          <p className="page-subtitle">Configurez les champs de votre base inventaire</p>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '16px' }}>Champs configurés</h2>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ marginBottom: '20px', minWidth: 'max-content' }}>
            <thead>
              <tr>
                <th>Ordre</th>
                <th>Code</th>
                <th>Label</th>
                <th>Type</th>
                <th>Obligatoire</th>
                <th>Actif</th>
                <th title="Visible pour les réceptions S/N">Visible S/N</th>
                <th title="Visible pour les réceptions quantité">Visible QTE</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {champs.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>Aucun champ configuré</td></tr>}
              {champs.map(c => editId === c.id ? (
                <tr key={c.id}>
                  <td><input type="number" className="form-input" style={{ width: '60px' }} value={editForm.ordre ?? 0} onChange={e => setEditForm({ ...editForm, ordre: Number(e.target.value) })} /></td>
                  <td><code style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{c.code}</code></td>
                  <td><input className="form-input" value={editForm.label ?? ''} onChange={e => setEditForm({ ...editForm, label: e.target.value })} /></td>
                  <td>
                    <select className="form-input" style={{ fontSize: '13px' }} value={editForm.type ?? c.type} onChange={e => setEditForm({ ...editForm, type: e.target.value as ChampType })}>
                      {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    {editForm.type === 'SELECT' && (
                      <OptionsEditor value={editForm.options ?? ''} onChange={v => setEditForm(f => ({ ...f, options: v }))} />
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}><input type="checkbox" checked={editForm.obligatoire ?? false} onChange={e => setEditForm({ ...editForm, obligatoire: e.target.checked })} /></td>
                  <td style={{ textAlign: 'center' }}><input type="checkbox" checked={editForm.actif ?? true} onChange={e => setEditForm({ ...editForm, actif: e.target.checked })} /></td>
                  <td style={{ textAlign: 'center' }}><input type="checkbox" checked={editForm.visibleReceptionSN ?? false} onChange={e => setEditForm({ ...editForm, visibleReceptionSN: e.target.checked })} /></td>
                  <td style={{ textAlign: 'center' }}><input type="checkbox" checked={editForm.visibleReceptionQTE ?? false} onChange={e => setEditForm({ ...editForm, visibleReceptionQTE: e.target.checked })} /></td>
                  <td style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-secondary btn-icon" onClick={() => handleUpdate(c.id)}><Check size={14} /></button>
                    <button className="btn btn-secondary btn-icon" onClick={() => setEditId(null)}><X size={14} /></button>
                  </td>
                </tr>
              ) : (
                <tr key={c.id}>
                  <td style={{ color: '#9ca3af', fontSize: '13px' }}>{c.ordre}</td>
                  <td><code style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{c.code}</code></td>
                  <td>{c.label}</td>
                  <td><span style={{ fontSize: '13px', color: '#6b7280' }}>{typeLabels[c.type as ChampType]}</span></td>
                  <td style={{ textAlign: 'center' }}><Oui val={c.obligatoire} /></td>
                  <td style={{ textAlign: 'center' }}>{c.actif ? <span className="badge badge-success">Actif</span> : <span style={{ color: '#d1d5db' }}>Inactif</span>}</td>
                  <td style={{ textAlign: 'center' }}><Oui val={c.visibleReceptionSN} /></td>
                  <td style={{ textAlign: 'center' }}><Oui val={c.visibleReceptionQTE} /></td>
                  <td style={{ display: 'flex', gap: '6px' }}>
                    {isAdmin && (
                      <>
                        <button className="btn btn-secondary btn-icon" onClick={() => startEdit(c)}><Pencil size={14} /></button>
                        <button className="btn btn-danger btn-icon" onClick={() => setModal({ id: c.id })}><Trash2 size={14} /></button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isAdmin && (
          <>
            <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginTop: '28px', marginBottom: '16px' }}>Ajouter un champ</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Code *</label>
                <input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="form-input" placeholder="EX_CHAMP" style={{ width: '130px' }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Label *</label>
                <input required value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} className="form-input" placeholder="Ex: Numéro de série" style={{ width: '160px' }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as ChampType, options: '' })} className="form-input">
                  {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {form.type === 'SELECT' && (
                  <div style={{ marginTop: '6px' }}>
                    <label className="form-label">Options</label>
                    <OptionsEditor value={form.options} onChange={v => setForm(f => ({ ...f, options: v }))} />
                  </div>
                )}
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Ordre</label>
                <input type="number" value={form.ordre} onChange={e => setForm({ ...form, ordre: Number(e.target.value) })} className="form-input" style={{ width: '70px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '2px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#374151' }}>
                  <input type="checkbox" checked={form.obligatoire} onChange={e => setForm({ ...form, obligatoire: e.target.checked })} /> Obligatoire
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#374151' }}>
                  <input type="checkbox" checked={form.visibleReceptionSN} onChange={e => setForm({ ...form, visibleReceptionSN: e.target.checked })} /> Visible S/N
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#374151' }}>
                  <input type="checkbox" checked={form.visibleReceptionQTE} onChange={e => setForm({ ...form, visibleReceptionQTE: e.target.checked })} /> Visible QTE
                </label>
              </div>
              <button type="submit" className="btn btn-primary">+ Ajouter</button>
            </form>

            {erreur && (
              <div style={{ marginTop: '16px', padding: '12px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626', fontSize: '13px' }}>
                {erreur}
              </div>
            )}
          </>
        )}
      </div>

      {modal && (
        <div className="modal-overlay">
          <div style={{ background: 'white', borderRadius: '10px', padding: '28px', maxWidth: '420px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Confirmer la suppression</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>Ce champ et toutes ses valeurs seront définitivement supprimés.</p>
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
