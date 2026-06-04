import { useEffect, useState } from 'react'
import { Trash2, Pencil, Check, X } from 'lucide-react'
import { workflowApi } from '../api/workflow'
import type { Statut, Transition } from '../types'
import { getPermissions } from '../utils/permissions'

const COULEURS_PALETTE = [
  '#3b82f6', '#2563eb', '#1e40af', '#0369a1',
  '#10b981', '#059669', '#047857',
  '#ef4444', '#dc2626',
  '#f97316', '#f59e0b', '#eab308',
  '#ec4899', '#a855f7', '#8b5cf6'
]

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

// Badge sobre : fond colorÃ© Ã  12% d'opacitÃ© + texte colorÃ©
function StatutBadge({ statut }: { statut: Statut }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '3px 10px',
      borderRadius: '5px',
      fontSize: '12px',
      fontWeight: 500,
      background: statut.couleur + '1F',
      color: statut.couleur,
      border: `1px solid ${statut.couleur}33`,
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statut.couleur, flexShrink: 0 }} />
      {statut.label}
    </span>
  )
}

function ColorSquare({ color }: { color: string }) {
  return (
    <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: color, border: '1px solid rgba(0,0,0,0.1)', display: 'inline-block' }} />
  )
}

export default function AdminWorkflow() {
  const siteId = getSiteId()
  const { isAdmin } = getPermissions()
  const [statuts, setStatuts] = useState<Statut[]>([])
  const [transitions, setTransitions] = useState<Transition[]>([])
  const [modal, setModal] = useState<{ type: 'deleteStatut' | 'deleteTransition'; id: number } | null>(null)
  const [editStatut, setEditStatut] = useState<Statut | null>(null)
  const [editTransition, setEditTransition] = useState<Transition | null>(null)

  const [newStatut, setNewStatut] = useState({ code: '', label: '', couleur: '#6b7280', ordre: 0, estFinal: false })
  const [newTransition, setNewTransition] = useState({ statutFromId: 0, statutToId: 0, labelBouton: '', couleurBouton: '#3b82f6' })

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    const [s, t] = await Promise.all([
      workflowApi.getStatuts(siteId),
      workflowApi.getTransitions(siteId)
    ])
    setStatuts(s)
    setTransitions(t)
  }

  async function ajouterStatut(e: React.FormEvent) {
    e.preventDefault()
    await workflowApi.createStatut(siteId, newStatut)
    setNewStatut({ code: '', label: '', couleur: '#6b7280', ordre: 0, estFinal: false })
    reload()
  }

  async function supprimerStatut(id: number) {
    await workflowApi.deleteStatut(id)
    setModal(null)
    reload()
  }

  async function ajouterTransition(e: React.FormEvent) {
    e.preventDefault()
    await workflowApi.createTransition(siteId, newTransition)
    setNewTransition({ statutFromId: 0, statutToId: 0, labelBouton: '', couleurBouton: '#3b82f6' })
    reload()
  }

  async function supprimerTransition(id: number) {
    await workflowApi.deleteTransition(id)
    setModal(null)
    reload()
  }

  async function sauvegarderStatut(e: React.FormEvent) {
    e.preventDefault()
    if (!editStatut) return
    await workflowApi.updateStatut(editStatut.id, {
      label: editStatut.label,
      couleur: editStatut.couleur,
      ordre: editStatut.ordre,
      estFinal: editStatut.estFinal
    })
    setEditStatut(null)
    reload()
  }

  async function sauvegarderTransition(e: React.FormEvent) {
    e.preventDefault()
    if (!editTransition) return
    await workflowApi.updateTransition(editTransition.id, {
      statutFromId: editTransition.statutFromId,
      statutToId: editTransition.statutToId,
      labelBouton: editTransition.labelBouton,
      couleurBouton: editTransition.couleurBouton
    })
    setEditTransition(null)
    reload()
  }

  const labelStatut = (id: number) => {
    const s = statuts.find(s => s.id === id)
    return s ? <StatutBadge statut={s} /> : <span style={{ color: '#9ca3af' }}>?</span>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin â€” Workflow</h1>
          <p className="page-subtitle">Configurez les statuts et transitions de votre site</p>
        </div>
      </div>

      {/* STATUTS */}
      <div className="card">
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '16px' }}>Statuts</h2>
        <table className="table" style={{ marginBottom: '20px' }}>
          <thead>
            <tr>
              <th style={{ width: '50px', textAlign: 'center' }}>Ordre</th>
              <th>Code</th>
              <th>Label</th>
              <th style={{ width: '40px' }}>Couleur</th>
              <th>Final</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {statuts.map(s => (
              <tr key={s.id}>
                <td style={{ textAlign: 'center', color: '#9ca3af' }}>{s.ordre}</td>
                <td><code style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#475569' }}>{s.code}</code></td>
                <td><StatutBadge statut={s} /></td>
                <td style={{ textAlign: 'center' }}><ColorSquare color={s.couleur} /></td>
                <td>{s.estFinal ? <span className="badge badge-info">Final</span> : <span style={{ color: '#d1d5db' }}>â€”</span>}</td>
                <td style={{ width: '80px', textAlign: 'right', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                  {isAdmin && (<>
                    <button className="btn btn-secondary btn-icon" title="Modifier" onClick={() => setEditStatut(s)}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn btn-danger btn-icon" title="Supprimer" onClick={() => setModal({ type: 'deleteStatut', id: s.id })}>
                      <Trash2 size={14} />
                    </button>
                  </>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Formulaire ajout statut */}
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ajouter un statut</p>
          <form onSubmit={ajouterStatut} style={{ display: 'grid', gridTemplateColumns: '140px 180px 120px 80px auto auto', gap: '10px', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Code</label>
              <input required value={newStatut.code} onChange={e => setNewStatut(f => ({ ...f, code: e.target.value }))} className="form-input" placeholder="EX_STATUT" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Label</label>
              <input required value={newStatut.label} onChange={e => setNewStatut(f => ({ ...f, label: e.target.value }))} className="form-input" placeholder="Ex: En rÃ©paration" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Couleur</label>
              <select value={newStatut.couleur} onChange={e => setNewStatut(f => ({ ...f, couleur: e.target.value }))} className="form-input">
                {COULEURS_PALETTE.map(c => (
                  <option key={c} value={c} style={{ background: c, color: '#fff' }}>{c}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Ordre</label>
              <input type="number" value={newStatut.ordre} onChange={e => setNewStatut(f => ({ ...f, ordre: Number(e.target.value) }))} className="form-input" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '2px' }}>
              <input type="checkbox" id="estFinal" checked={newStatut.estFinal} onChange={e => setNewStatut(f => ({ ...f, estFinal: e.target.checked }))} />
              <label htmlFor="estFinal" style={{ fontSize: '13px', color: '#374151' }}>Final</label>
            </div>
            {isAdmin && <button type="submit" className="btn btn-primary">+ Ajouter</button>}
          </form>
        </div>
      </div>

      {/* TRANSITIONS */}
      <div className="card">
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '16px' }}>Transitions</h2>
        <table className="table" style={{ marginBottom: '20px' }}>
          <thead>
            <tr>
              <th>De</th>
              <th>Vers</th>
              <th>Bouton</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {transitions.map(t => (
              <tr key={t.id}>
                <td>{labelStatut(t.statutFromId)}</td>
                <td>{labelStatut(t.statutToId)}</td>
                <td>
                  <span style={{
                    display: 'inline-block',
                    background: t.couleurBouton + '1F',
                    color: t.couleurBouton,
                    border: `1px solid ${t.couleurBouton}33`,
                    padding: '3px 10px',
                    borderRadius: '5px',
                    fontSize: '12px',
                    fontWeight: 500
                  }}>
                    {t.labelBouton}
                  </span>
                </td>
                <td style={{ width: '80px', textAlign: 'right', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                  {isAdmin && (<>
                    <button className="btn btn-secondary btn-icon" title="Modifier" onClick={() => setEditTransition(t)}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn btn-danger btn-icon" title="Supprimer" onClick={() => setModal({ type: 'deleteTransition', id: t.id })}>
                      <Trash2 size={14} />
                    </button>
                  </>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Formulaire ajout transition */}
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ajouter une transition</p>
          <form onSubmit={ajouterTransition} style={{ display: 'grid', gridTemplateColumns: '160px 160px 200px 120px auto', gap: '10px', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">De</label>
              <select required value={newTransition.statutFromId} onChange={e => setNewTransition(f => ({ ...f, statutFromId: Number(e.target.value) }))} className="form-input">
                <option value={0}>â€” choisir â€”</option>
                {statuts.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Vers</label>
              <select required value={newTransition.statutToId} onChange={e => setNewTransition(f => ({ ...f, statutToId: Number(e.target.value) }))} className="form-input">
                <option value={0}>â€” choisir â€”</option>
                {statuts.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Label bouton</label>
              <input required value={newTransition.labelBouton} onChange={e => setNewTransition(f => ({ ...f, labelBouton: e.target.value }))} className="form-input" placeholder="Ex: Envoyer en rÃ©paration" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Couleur</label>
              <select value={newTransition.couleurBouton} onChange={e => setNewTransition(f => ({ ...f, couleurBouton: e.target.value }))} className="form-input">
                {COULEURS_PALETTE.map(c => (
                  <option key={c} value={c} style={{ background: c, color: '#fff' }}>{c}</option>
                ))}
              </select>
            </div>
            {isAdmin && <button type="submit" className="btn btn-primary">+ Ajouter</button>}
          </form>
        </div>
      </div>

      {/* Modal Ã©dition statut */}
      {editStatut && (
        <div className="modal-overlay">
          <div className="modal" style={{ background: '#1a1d27', borderRadius: '10px', padding: '24px', maxWidth: '460px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Modifier le statut</h3>
            <form onSubmit={sauvegarderStatut}>
              <div className="form-group">
                <label className="form-label">Code</label>
                <input className="form-input" value={editStatut.code} disabled style={{ background: '#f1f5f9', color: '#9ca3af' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Label</label>
                <input required className="form-input" value={editStatut.label} onChange={e => setEditStatut(s => s ? { ...s, label: e.target.value } : s)} />
              </div>
              <div className="form-group">
                <label className="form-label">Couleur</label>
                <select value={editStatut.couleur} onChange={e => setEditStatut(s => s ? { ...s, couleur: e.target.value } : s)} className="form-input">
                  {COULEURS_PALETTE.map(c => (
                    <option key={c} value={c} style={{ background: c, color: '#fff' }}>{c}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Ordre</label>
                  <input type="number" className="form-input" value={editStatut.ordre} onChange={e => setEditStatut(s => s ? { ...s, ordre: Number(e.target.value) } : s)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '26px' }}>
                  <input type="checkbox" id="editFinal" checked={editStatut.estFinal} onChange={e => setEditStatut(s => s ? { ...s, estFinal: e.target.checked } : s)} />
                  <label htmlFor="editFinal" style={{ fontSize: '13px', color: '#374151' }}>Final</label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditStatut(null)}>Annuler</button>
                <button type="submit" className="btn btn-primary"><Check size={14} style={{ marginRight: '4px' }} />Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ã©dition transition */}
      {editTransition && (
        <div className="modal-overlay">
          <div className="modal" style={{ background: '#1a1d27', borderRadius: '10px', padding: '24px', maxWidth: '460px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Modifier la transition</h3>
            <form onSubmit={sauvegarderTransition}>
              <div className="form-group">
                <label className="form-label">De</label>
                <select required className="form-input" value={editTransition.statutFromId} onChange={e => setEditTransition(t => t ? { ...t, statutFromId: Number(e.target.value) } : t)}>
                  {statuts.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Vers</label>
                <select required className="form-input" value={editTransition.statutToId} onChange={e => setEditTransition(t => t ? { ...t, statutToId: Number(e.target.value) } : t)}>
                  {statuts.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Label bouton</label>
                <input required className="form-input" value={editTransition.labelBouton} onChange={e => setEditTransition(t => t ? { ...t, labelBouton: e.target.value } : t)} />
              </div>
              <div className="form-group">
                <label className="form-label">Couleur</label>
                <select value={editTransition.couleurBouton} onChange={e => setEditTransition(t => t ? { ...t, couleurBouton: e.target.value } : t)} className="form-input">
                  {COULEURS_PALETTE.map(c => (
                    <option key={c} value={c} style={{ background: c, color: '#fff' }}>{c}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditTransition(null)}>Annuler</button>
                <button type="submit" className="btn btn-primary"><Check size={14} style={{ marginRight: '4px' }} />Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmation */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal" style={{ background: '#1a1d27', borderRadius: '10px', padding: '28px', maxWidth: '420px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Confirmer la suppression</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>
              {modal.type === 'deleteStatut'
                ? 'Ce statut sera dÃ©finitivement supprimÃ©. Les articles associÃ©s seront impactÃ©s.'
                : 'Cette transition sera dÃ©finitivement supprimÃ©e.'}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Annuler</button>
              <button
                className="btn btn-danger"
                style={{ background: '#dc2626', color: 'white', borderColor: '#dc2626' }}
                onClick={() => modal.type === 'deleteStatut' ? supprimerStatut(modal.id) : supprimerTransition(modal.id)}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

