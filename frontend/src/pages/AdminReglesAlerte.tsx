import { useEffect, useState } from 'react'
import { Trash2, Plus, Pencil, Check, X, AlertTriangle } from 'lucide-react'
import { get, post, put, del } from '../api/client'
import { getPermissions, getSiteId } from '../utils/permissions'
import { COLONNES_INVENTAIRE, COLONNES_DATE } from '../constants/colonnesInventaire'

interface AutoFillItem {
  colonne: string
  valeur: string
}

interface RegleAlerte {
  id: number
  nom: string
  codeChampDate: string
  seuilMois: number
  couleurAlerte: string
  champsAutoFill: AutoFillItem[] | null
  actif: boolean
}

const FORM_VIDE = {
  nom: '',
  codeChampDate: '',
  seuilMois: 3,
  couleurAlerte: '#f59e0b',
  champsAutoFill: [] as AutoFillItem[],
  actif: true,
}

const CHAMPS_DATE_LABELS = COLONNES_DATE.reduce((acc, c) => { acc[c.key] = c.label; return acc }, {} as Record<string, string>)

export default function AdminReglesAlerte({ embedded }: { embedded?: boolean } = {}) {
  const siteId = getSiteId()
  const { isAdmin } = getPermissions()

  const [chargement, setChargement] = useState(true)
  const [regles, setRegles] = useState<RegleAlerte[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ ...FORM_VIDE })
  const [confirmDel, setConfirmDel] = useState<number | null>(null)
  const [succes, setSucces] = useState(false)

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    const r = await get<RegleAlerte[]>(`/regles-alerte/${siteId}`)
    setRegles(r.map(regle => ({
      ...regle,
      champsAutoFill: regle.champsAutoFill
        ? (typeof regle.champsAutoFill === 'string' ? JSON.parse(regle.champsAutoFill) : regle.champsAutoFill)
        : []
    })))
    setChargement(false)
  }

  function openCreate() {
    setEditId(null)
    setForm({ ...FORM_VIDE })
    setShowForm(true)
  }

  function openEdit(r: RegleAlerte) {
    setEditId(r.id)
    setForm({
      nom: r.nom,
      codeChampDate: r.codeChampDate,
      seuilMois: r.seuilMois,
      couleurAlerte: r.couleurAlerte,
      champsAutoFill: r.champsAutoFill ?? [],
      actif: r.actif,
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditId(null)
    setForm({ ...FORM_VIDE })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const payload = { ...form }
    if (editId !== null) {
      await put(`/regles-alerte/${editId}`, payload)
    } else {
      await post(`/regles-alerte/${siteId}`, payload)
    }
    closeForm()
    setSucces(true)
    setTimeout(() => setSucces(false), 2000)
    reload()
  }

  async function handleDelete(id: number) {
    await del(`/regles-alerte/${id}`)
    setConfirmDel(null)
    reload()
  }

  function addAutoFill() {
    setForm(f => ({ ...f, champsAutoFill: [...f.champsAutoFill, { colonne: '', valeur: '' }] }))
  }

  function updateAutoFill(idx: number, key: keyof AutoFillItem, value: string) {
    setForm(f => ({
      ...f,
      champsAutoFill: f.champsAutoFill.map((af, i) => i === idx ? { ...af, [key]: value } : af)
    }))
  }

  function removeAutoFill(idx: number) {
    setForm(f => ({ ...f, champsAutoFill: f.champsAutoFill.filter((_, i) => i !== idx) }))
  }

  if (!isAdmin) return <div className="card" style={{ padding: '32px', color: '#9ca3af' }}>Accès refusé.</div>

  return (
    <div>
      {embedded ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9' }}>Règles d'alerte date</h2>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> Nouvelle règle
          </button>
        </div>
      ) : (
        <div className="page-header">
          <div>
            <h1 className="page-title">Règles d'alerte date</h1>
            <p className="page-subtitle">Colorez automatiquement les lignes d'inventaire selon des critères de date</p>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> Nouvelle règle
          </button>
        </div>
      )}

      {succes && (
        <div style={{ background: '#052e16', border: '1px solid #16a34a', borderRadius: '8px', padding: '10px 16px', color: '#4ade80', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check size={16} /> Règle sauvegardée.
        </div>
      )}

      {/* Explication */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', background: '#1a1d27', borderLeft: '4px solid #f59e0b' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '13px', color: '#d1d5db', lineHeight: '1.6' }}>
            <strong style={{ color: '#f3f4f6' }}>Condition d'alerte :</strong> lors d'une réception (attendu ou classique), si le S/N reçu existe déjà en inventaire avec un <strong style={{ color: '#f3f4f6' }}>statut final</strong>, on vérifie les dates de cette entrée existante. Si le champ date surveillé est dans la fenêtre <em>dateChamp ≤ aujourd'hui ≤ dateChamp + X mois</em>, la nouvelle ligne est colorée et les champs auto-fill sont remplis.
            <br />
            Exemple : seuil 3 mois, DATE_SHP = 01/01 dans l'entrée existante → alerte si réception ≤ 01/04.
          </div>
        </div>
      </div>

      {chargement ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : regles.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
          <AlertTriangle size={32} style={{ color: '#6b7280', marginBottom: '12px' }} />
          <p style={{ fontWeight: 500 }}>Aucune règle configurée</p>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>Créez une règle pour colorer automatiquement les lignes sensibles à la réception.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Champ date</th>
                <th>Seuil</th>
                <th>Couleur</th>
                <th>Champs auto-fill</th>
                <th>Actif</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {regles.map(r => (
                <tr key={r.id}>
                  <td>{r.nom}</td>
                  <td><code style={{ background: '#0f172a', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{CHAMPS_DATE_LABELS[r.codeChampDate] ?? r.codeChampDate}</code></td>
                  <td>{r.seuilMois} mois</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: r.couleurAlerte, border: '1px solid rgba(255,255,255,0.1)' }} />
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>{r.couleurAlerte}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: '12px', color: '#9ca3af' }}>
                    {r.champsAutoFill && r.champsAutoFill.length > 0
                      ? r.champsAutoFill.map(af => `${af.colonne} = "${af.valeur}"`).join(', ')
                      : <span style={{ color: '#4b5563' }}>—</span>
                    }
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '1px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500,
                      background: r.actif ? '#052e16' : '#1f2937', color: r.actif ? '#4ade80' : '#6b7280',
                      border: `1px solid ${r.actif ? '#16a34a' : '#374151'}`
                    }}>
                      {r.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-secondary btn-icon" onClick={() => openEdit(r)}><Pencil size={14} /></button>
                    <button className="btn btn-danger btn-icon" onClick={() => setConfirmDel(r.id)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal formulaire */}
      {showForm && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '28px', maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>
              {editId ? 'Modifier la règle' : 'Nouvelle règle d\'alerte'}
            </h3>
            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Nom de la règle *</label>
                  <input className="form-input" required value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="ex: Garantie proche" />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Colonne date à surveiller *</label>
                  <select required className="form-input" value={form.codeChampDate} onChange={e => setForm(f => ({ ...f, codeChampDate: e.target.value }))}>
                    <option value="">— Choisir —</option>
                    {COLONNES_DATE.map(c => <option key={c.key} value={c.key}>{c.label} ({c.key})</option>)}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Seuil en mois *</label>
                  <input type="number" min={1} max={120} required className="form-input"
                    value={form.seuilMois} onChange={e => setForm(f => ({ ...f, seuilMois: Number(e.target.value) }))} />
                  <span style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px', display: 'block' }}>
                    Alerte si la date est dans les {form.seuilMois} derniers mois
                  </span>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Couleur de la ligne *</label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input type="color" value={form.couleurAlerte}
                      onChange={e => setForm(f => ({ ...f, couleurAlerte: e.target.value }))}
                      style={{ width: '48px', height: '36px', padding: '2px', background: 'transparent', border: '1px solid #374151', borderRadius: '6px', cursor: 'pointer' }} />
                    <div style={{ height: '36px', flex: 1, borderRadius: '6px', background: form.couleurAlerte + '33', borderLeft: `4px solid ${form.couleurAlerte}`, display: 'flex', alignItems: 'center', paddingLeft: '12px', fontSize: '13px', color: '#d1d5db' }}>
                      Aperçu de la ligne en inventaire
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Champs auto-fill <span style={{ fontWeight: 400, color: '#6b7280' }}>(optionnel)</span></label>
                    <button type="button" className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={addAutoFill}>
                      <Plus size={13} /> Ajouter
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {form.champsAutoFill.map((af, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select className="form-input" style={{ flex: 1 }} value={af.colonne}
                          onChange={e => updateAutoFill(idx, 'colonne', e.target.value)}>
                          <option value="">— Colonne —</option>
                          {COLONNES_INVENTAIRE.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                        <span style={{ color: '#6b7280', flexShrink: 0 }}>=</span>
                        <input className="form-input" style={{ flex: 1 }} placeholder="Valeur à écrire"
                          value={af.valeur} onChange={e => updateAutoFill(idx, 'valeur', e.target.value)} />
                        <button type="button" className="btn btn-danger btn-icon" onClick={() => removeAutoFill(idx)}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {form.champsAutoFill.length === 0 && (
                      <p style={{ fontSize: '12px', color: '#4b5563', fontStyle: 'italic' }}>Aucun champ auto-fill — la règle colorera la ligne sans modifier les valeurs.</p>
                    )}
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.actif} onChange={e => setForm(f => ({ ...f, actif: e.target.checked }))} />
                    <span className="form-label" style={{ margin: 0 }}>Règle active</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={closeForm}>Annuler</button>
                <button type="submit" className="btn btn-primary"><Check size={14} /> Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression */}
      {confirmDel !== null && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '10px', padding: '24px', maxWidth: '380px', width: '100%' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Supprimer cette règle ?</h3>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '20px' }}>Les lignes d'inventaire déjà colorées ne seront pas affectées.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDel(null)}>Annuler</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDel)}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
