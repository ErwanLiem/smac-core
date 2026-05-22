import { useEffect, useState } from 'react'
import { workflowApi } from '../api/workflow'
import type { Statut, Transition } from '../types'

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

export default function AdminWorkflow() {
  const siteId = getSiteId()
  const [statuts, setStatuts] = useState<Statut[]>([])
  const [transitions, setTransitions] = useState<Transition[]>([])

  // Formulaire statut
  const [newStatut, setNewStatut] = useState({ code: '', label: '', couleur: '#6b7280', ordre: 0, estFinal: false })

  // Formulaire transition
  const [newTransition, setNewTransition] = useState({ statutFromId: 0, statutToId: 0, labelBouton: '', couleurBouton: '#3b82f6' })

  useEffect(() => {
    reload()
  }, [siteId])

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
    if (!confirm('Supprimer ce statut ?')) return
    await workflowApi.deleteStatut(id)
    reload()
  }

  async function ajouterTransition(e: React.FormEvent) {
    e.preventDefault()
    await workflowApi.createTransition(siteId, newTransition)
    setNewTransition({ statutFromId: 0, statutToId: 0, labelBouton: '', couleurBouton: '#3b82f6' })
    reload()
  }

  async function supprimerTransition(id: number) {
    if (!confirm('Supprimer cette transition ?')) return
    await workflowApi.deleteTransition(id)
    reload()
  }

  const labelStatut = (id: number) => statuts.find(s => s.id === id)?.label ?? '?'

  return (
    <div style={{ padding: '2rem', maxWidth: '900px' }}>
      <h1>Admin — Workflow</h1>

      {/* Statuts */}
      <section style={{ marginTop: '2rem' }}>
        <h2>Statuts</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              <th style={th}>Code</th><th style={th}>Label</th><th style={th}>Couleur</th><th style={th}>Ordre</th><th style={th}>Final</th><th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {statuts.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={td}><code>{s.code}</code></td>
                <td style={td}><span style={{ background: s.couleur, color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem' }}>{s.label}</span></td>
                <td style={td}>{s.couleur}</td>
                <td style={td}>{s.ordre}</td>
                <td style={td}>{s.estFinal ? 'Oui' : '—'}</td>
                <td style={td}><button onClick={() => supprimerStatut(s.id)} style={btnDanger}>Suppr.</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={ajouterStatut} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><label style={lbl}>Code</label><input required value={newStatut.code} onChange={e => setNewStatut(f => ({ ...f, code: e.target.value }))} style={input} /></div>
          <div><label style={lbl}>Label</label><input required value={newStatut.label} onChange={e => setNewStatut(f => ({ ...f, label: e.target.value }))} style={input} /></div>
          <div><label style={lbl}>Couleur</label><input type="color" value={newStatut.couleur} onChange={e => setNewStatut(f => ({ ...f, couleur: e.target.value }))} style={{ ...input, width: '60px', padding: '2px' }} /></div>
          <div><label style={lbl}>Ordre</label><input type="number" value={newStatut.ordre} onChange={e => setNewStatut(f => ({ ...f, ordre: Number(e.target.value) }))} style={{ ...input, width: '70px' }} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <input type="checkbox" checked={newStatut.estFinal} onChange={e => setNewStatut(f => ({ ...f, estFinal: e.target.checked }))} id="estFinal" />
            <label htmlFor="estFinal" style={{ fontSize: '0.875rem' }}>Final</label>
          </div>
          <button type="submit" style={btnPrimary}>+ Ajouter</button>
        </form>
      </section>

      {/* Transitions */}
      <section style={{ marginTop: '3rem' }}>
        <h2>Transitions</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              <th style={th}>De</th><th style={th}>Vers</th><th style={th}>Bouton</th><th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {transitions.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={td}>{labelStatut(t.statutFromId)}</td>
                <td style={td}>{labelStatut(t.statutToId)}</td>
                <td style={td}><span style={{ background: t.couleurBouton, color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem' }}>{t.labelBouton}</span></td>
                <td style={td}><button onClick={() => supprimerTransition(t.id)} style={btnDanger}>Suppr.</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <form onSubmit={ajouterTransition} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={lbl}>De</label>
            <select required value={newTransition.statutFromId} onChange={e => setNewTransition(f => ({ ...f, statutFromId: Number(e.target.value) }))} style={input}>
              <option value={0}>— choisir —</option>
              {statuts.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Vers</label>
            <select required value={newTransition.statutToId} onChange={e => setNewTransition(f => ({ ...f, statutToId: Number(e.target.value) }))} style={input}>
              <option value={0}>— choisir —</option>
              {statuts.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div><label style={lbl}>Label bouton</label><input required value={newTransition.labelBouton} onChange={e => setNewTransition(f => ({ ...f, labelBouton: e.target.value }))} style={input} /></div>
          <div><label style={lbl}>Couleur</label><input type="color" value={newTransition.couleurBouton} onChange={e => setNewTransition(f => ({ ...f, couleurBouton: e.target.value }))} style={{ ...input, width: '60px', padding: '2px' }} /></div>
          <button type="submit" style={btnPrimary}>+ Ajouter</button>
        </form>
      </section>
    </div>
  )
}

const th: React.CSSProperties = { padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem' }
const td: React.CSSProperties = { padding: '0.75rem 1rem', fontSize: '0.875rem' }
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem', color: '#6b7280' }
const input: React.CSSProperties = { padding: '0.4rem 0.6rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }
const btnPrimary: React.CSSProperties = { background: '#2563eb', color: '#fff', border: 'none', padding: '0.45rem 1rem', borderRadius: '4px', cursor: 'pointer' }
const btnDanger: React.CSSProperties = { background: '#ef4444', color: '#fff', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }
