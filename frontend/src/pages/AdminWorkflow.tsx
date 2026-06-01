import { useEffect, useState } from 'react'
import { Trash2, Pencil, Check, X } from 'lucide-react'
import { workflowApi } from '../api/workflow'
import type { Statut, Transition } from '../types'
import { getPermissions } from '../utils/permissions'

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

// Badge sobre : fond coloré à 12% d'opacité + texte coloré
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

function ColorSwatch({ color }: { color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: color, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
      <span style={{ color: '#9ca3af', fontSize: '12px', fontFamily: 'monospace' }}>{color}</span>
    </span>
  )
}

export default function AdminWorkflow() {
  const siteId = getSiteId()
  const { isAdmin } = getPermissions()
  const [statuts, setStatuts] = useState<Statut[]>([])
  const [transitions, setTransitions] = useState<Transition[]>([])
  const [modal, setModal] = useState<{ type: 'deleteStatut' | 'deleteTransition'; id: number } | null>(null)

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

  const labelStatut = (id: number) => {
    const s = statuts.find(s => s.id === id)
    return s ? <StatutBadge statut={s} /> : <span style={{ color: '#9ca3af' }}>?</span>
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin — Workflow</h1>
          <p className="page-subtitle">Configurez les statuts et transitions de votre site</p>
        </div>
      </div>

      {/* STATUTS */}
      <div className="card">
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '16px' }}>Statuts</h2>
        <table className="table" style={{ marginBottom: '20px' }}>
          <thead>
            <tr>
              <th>Ordre</th>
              <th>Code</th>
              <th>Label</th>
              <th>Couleur</th>
              <th>Final</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {statuts.map(s => (
              <tr key={s.id}>
                <td style={{ color: '#9ca3af', width: '60px' }}>{s.ordre}</td>
                <td><code style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#475569' }}>{s.code}</code></td>
                <td><StatutBadge statut={s} /></td>
                <td><ColorSwatch color={s.couleur} /></td>
                <td>{s.estFinal ? <span className="badge badge-info">Final</span> : <span style={{ color: '#d1d5db' }}>—</span>}</td>
                <td style={{ width: '60px', textAlign: 'right' }}>
                  {isAdmin && (
                    <button className="btn btn-danger btn-icon" title="Supprimer" onClick={() => setModal({ type: 'deleteStatut', id: s.id })}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Formulaire ajout statut */}
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ajouter un statut</p>
          <form onSubmit={ajouterStatut} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Code</label>
              <input required value={newStatut.code} onChange={e => setNewStatut(f => ({ ...f, code: e.target.value }))} className="form-input" placeholder="EX_STATUT" style={{ width: '140px' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Label</label>
              <input required value={newStatut.label} onChange={e => setNewStatut(f => ({ ...f, label: e.target.value }))} className="form-input" placeholder="Ex: En réparation" style={{ width: '180px' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Couleur</label>
              <input type="color" value={newStatut.couleur} onChange={e => setNewStatut(f => ({ ...f, couleur: e.target.value }))} style={{ width: '48px', height: '38px', padding: '2px', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Ordre</label>
              <input type="number" value={newStatut.ordre} onChange={e => setNewStatut(f => ({ ...f, ordre: Number(e.target.value) }))} className="form-input" style={{ width: '70px' }} />
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
                <td style={{ width: '60px', textAlign: 'right' }}>
                  {isAdmin && (
                    <button className="btn btn-danger btn-icon" title="Supprimer" onClick={() => setModal({ type: 'deleteTransition', id: t.id })}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Formulaire ajout transition */}
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ajouter une transition</p>
          <form onSubmit={ajouterTransition} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">De</label>
              <select required value={newTransition.statutFromId} onChange={e => setNewTransition(f => ({ ...f, statutFromId: Number(e.target.value) }))} className="form-input" style={{ width: '160px' }}>
                <option value={0}>— choisir —</option>
                {statuts.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Vers</label>
              <select required value={newTransition.statutToId} onChange={e => setNewTransition(f => ({ ...f, statutToId: Number(e.target.value) }))} className="form-input" style={{ width: '160px' }}>
                <option value={0}>— choisir —</option>
                {statuts.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Label bouton</label>
              <input required value={newTransition.labelBouton} onChange={e => setNewTransition(f => ({ ...f, labelBouton: e.target.value }))} className="form-input" placeholder="Ex: Envoyer en réparation" style={{ width: '200px' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Couleur</label>
              <input type="color" value={newTransition.couleurBouton} onChange={e => setNewTransition(f => ({ ...f, couleurBouton: e.target.value }))} style={{ width: '48px', height: '38px', padding: '2px', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }} />
            </div>
            {isAdmin && <button type="submit" className="btn btn-primary">+ Ajouter</button>}
          </form>
        </div>
      </div>

      {/* Modal confirmation */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal" style={{ background: 'white', borderRadius: '10px', padding: '28px', maxWidth: '420px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Confirmer la suppression</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>
              {modal.type === 'deleteStatut'
                ? 'Ce statut sera définitivement supprimé. Les articles associés seront impactés.'
                : 'Cette transition sera définitivement supprimée.'}
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
