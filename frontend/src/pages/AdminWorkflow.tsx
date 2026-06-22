import { useEffect, useState } from 'react'
import { Trash2, Pencil, Check, X } from 'lucide-react'
import Tabs from '../components/Tabs'
import { workflowApi } from '../api/workflow'
import type { Statut, Transition } from '../types'
import { getPermissions, getSiteId } from '../utils/permissions'

const COULEURS_PALETTE = [
  '#3b82f6', '#2563eb', '#1e40af', '#0369a1',
  '#10b981', '#059669', '#047857',
  '#ef4444', '#dc2626',
  '#f97316', '#f59e0b', '#eab308',
  '#ec4899', '#a855f7', '#8b5cf6'
]

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

function ColorSquare({ color }: { color: string }) {
  return (
    <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: color, border: '1px solid rgba(0,0,0,0.1)', display: 'inline-block' }} />
  )
}

// ─── Rôles système prédéfinis (ont un comportement particulier dans le code) ──
const ROLES_SYSTEME: Record<string, { label: string; couleur: string; fond: string; desc: string }> = {
  estStock:            { label: 'Stock',            couleur: '#60a5fa', fond: '#1e3a5f', desc: '1er statut après réception d\'un article' },
  estTransfert:        { label: 'Transfert',        couleur: '#fb923c', fond: '#1c1917', desc: 'Attente de transfert vers le labo (planning)' },
  estFinal:            { label: 'Final',            couleur: '#4ade80', fond: '#052e16', desc: 'Statut de sortie définitif' },
  estRepare:              { label: 'Réparé',           couleur: '#a78bfa', fond: '#1e1b4b', desc: 'Machine réparée, prête pour MAJ/Injection' },
  estAttenteReparation:   { label: 'Att. Réparation',  couleur: '#f97316', fond: '#1c1000', desc: 'Machine en attente de prise en charge réparation (ATT REP)' },
  estMaj:              { label: 'MAJ',               couleur: '#06b6d4', fond: '#041f2a', desc: 'Machine en cours de mise à jour logicielle' },
  estMajInjection:     { label: 'MAJ Injection',     couleur: '#0ea5e9', fond: '#041525', desc: 'Machine en cours d\'injection firmware' },
  estControleQualite:  { label: 'Contrôle Qualité',  couleur: '#84cc16', fond: '#0f1f00', desc: 'Machine ayant passé le CQ — visible au poste emballage' },
  estEmballage:        { label: 'Emballage',         couleur: '#f472b6', fond: '#1f0020', desc: 'Machine emballée — en attente d\'expédition' },
  estAttentePiece:     { label: 'Att. Pièce (ASP)', couleur: '#f59e0b', fond: '#1c1400', desc: 'Machine en attente de pièce détachée' },
  estAttenteSoft:      { label: 'Att. Soft (ASW)',  couleur: '#8b5cf6', fond: '#1e1040', desc: 'Machine en attente de firmware/soft' },
  estAttenteTechnique: { label: 'Att. Tech (ENG)',  couleur: '#3b82f6', fond: '#0f1f3a', desc: 'Machine en attente d\'expertise technique' },
  estNonReparable:     { label: 'Non répar. (NLV)', couleur: '#ef4444', fond: '#1f0808', desc: 'Machine déclarée non réparable' },
  estAttenteDevis:     { label: 'Att. Devis (PRV)', couleur: '#10b981', fond: '#042f1c', desc: 'Machine en attente de devis client' },
}

function RoleTag({ code, onRemove }: { code: string; onRemove?: () => void }) {
  const sys = ROLES_SYSTEME[code]
  const couleur = sys?.couleur ?? '#94a3b8'
  const fond    = sys?.fond    ?? '#1a1d27'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px',
      fontSize: '11px', fontWeight: 600, background: fond, color: couleur, border: `1px solid ${couleur}44` }}>
      {sys?.label ?? code}
      {onRemove && (
        <button type="button" onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: couleur, padding: '0', lineHeight: 1, fontSize: '12px' }}>×</button>
      )}
    </span>
  )
}

function RolesEditor({
  roles, onChange, disabled
}: { roles: string[]; onChange: (r: string[]) => void; disabled?: boolean }) {
  const [input, setInput] = useState('')

  function addRole(code: string) {
    const clean = code.trim().replace(/\s+/g, '_').toUpperCase()
    // Normaliser les rôles système
    const sys = Object.entries(ROLES_SYSTEME).find(([k]) => k.toUpperCase() === clean || ROLES_SYSTEME[k].label.toUpperCase() === clean)
    const finalCode = sys ? sys[0] : clean
    if (finalCode && !roles.includes(finalCode)) onChange([...roles, finalCode])
    setInput('')
  }

  function removeRole(code: string) { onChange(roles.filter(r => r !== code)) }

  function toggleSys(code: string) {
    if (roles.includes(code)) removeRole(code)
    else onChange([...roles, code])
  }

  return (
    <div>
      {/* Boutons rôles système */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {Object.entries(ROLES_SYSTEME).map(([code, info]) => {
          const actif = roles.includes(code)
          return (
            <button key={code} type="button" disabled={disabled} onClick={() => toggleSys(code)} style={{
              padding: '3px 10px', borderRadius: '4px', border: `1px solid ${actif ? info.couleur : info.couleur + '44'}`,
              background: actif ? info.fond : 'transparent', color: actif ? info.couleur : '#6b7280',
              fontSize: '11px', fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
              transition: 'all 0.15s', opacity: disabled ? 0.5 : 1
            }} title={info.desc}>
              {actif ? '✓' : '○'} {info.label}
            </button>
          )
        })}
      </div>
      {/* Rôles personnalisés déjà ajoutés */}
      {roles.filter(r => !ROLES_SYSTEME[r]).length > 0 && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
          {roles.filter(r => !ROLES_SYSTEME[r]).map(r => (
            <RoleTag key={r} code={r} onRemove={disabled ? undefined : () => removeRole(r)} />
          ))}
        </div>
      )}
      {/* Champ pour ajouter un rôle custom */}
      {!disabled && (
        <div style={{ display: 'flex', gap: '6px' }}>
          <input className="form-input" style={{ fontSize: '12px', flex: 1 }}
            placeholder="Ajouter un rôle custom (ex: EST_REPARATION)…"
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (input.trim()) addRole(input) } }}
          />
          <button type="button" className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }}
            onClick={() => { if (input.trim()) addRole(input) }}>
            Ajouter
          </button>
        </div>
      )}
    </div>
  )
}

export default function AdminWorkflow() {
  const siteId = getSiteId()
  const { isAdmin } = getPermissions()
  const [chargement, setChargement] = useState(true)
  const [statuts, setStatuts] = useState<Statut[]>([])
  const [transitions, setTransitions] = useState<Transition[]>([])
  const [modal, setModal] = useState<{ type: 'deleteStatut' | 'deleteTransition'; id: number } | null>(null)
  const [editStatut, setEditStatut] = useState<Statut | null>(null)
  const [editTransition, setEditTransition] = useState<Transition | null>(null)

  const [newStatut, setNewStatut] = useState({ code: '', label: '', couleur: '#6b7280', ordre: 0, roles: [] as string[] })
  const [newTransition, setNewTransition] = useState({ statutFromId: 0, statutToId: 0, labelBouton: '', couleurBouton: '#3b82f6' })

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    const [s, t] = await Promise.all([
      workflowApi.getStatuts(siteId),
      workflowApi.getTransitions(siteId)
    ])
    setStatuts(s)
    setTransitions(t)
    setChargement(false)
  }

  async function ajouterStatut(e: React.FormEvent) {
    e.preventDefault()
    await workflowApi.createStatut(siteId, newStatut)
    setNewStatut({ code: '', label: '', couleur: '#6b7280', ordre: 0, roles: [] })
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
      roles: editStatut.roles,
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
          <h1 className="page-title">Workflow</h1>
          <p className="page-subtitle">Configurez les statuts et transitions de votre site</p>
        </div>
      </div>

      <Tabs tabs={[
        { key: 'statuts', label: 'Statuts', content: (
      <div className="card">
        {chargement ? (
          <div className="loading-container" style={{ minHeight: '160px' }}><div className="loading-spinner" /></div>
        ) : (
        <table className="table" style={{ marginBottom: '20px' }}>
          <thead>
            <tr>
              <th style={{ width: '50px', textAlign: 'center' }}>Ordre</th>
              <th>Code</th>
              <th>Label</th>
              <th style={{ width: '40px' }}>Couleur</th>
              <th>Rôles</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {statuts.map(s => (
              <tr key={s.id}>
                <td style={{ textAlign: 'center', color: '#9ca3af' }}>{s.ordre}</td>
                <td><code style={{ fontSize: '12px', background: '#1e3a5f', padding: '2px 6px', borderRadius: '4px', color: '#60a5fa' }}>{s.code}</code></td>
                <td><StatutBadge statut={s} /></td>
                <td style={{ textAlign: 'center' }}><ColorSquare color={s.couleur} /></td>
                <td style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {(s.roles ?? []).length > 0
                    ? (s.roles ?? []).map(r => <RoleTag key={r} code={r} />)
                    : <span style={{ color: '#4b5563' }}>—</span>
                  }
                </td>
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
        )}

        {/* Alertes rôles manquants */}
        {!chargement && isAdmin && (() => {
          const manquants: { label: string; couleur: string; fond: string; desc: string }[] = []
          if (!statuts.some(s => (s.roles ?? []).includes('estStock')))
            manquants.push({ label: 'Stock', couleur: '#60a5fa', fond: '#1e3a5f', desc: 'Statut attribué lors de la réception d\'un article' })
          if (!statuts.some(s => (s.roles ?? []).includes('estTransfert')))
            manquants.push({ label: 'Transfert', couleur: '#fb923c', fond: '#1c1917', desc: 'Statut des articles en attente de transfert vers le labo' })
          if (!statuts.some(s => (s.roles ?? []).includes('estFinal')))
            manquants.push({ label: 'Final', couleur: '#4ade80', fond: '#052e16', desc: 'Statut de sortie définitif' })
          if (manquants.length === 0) return null
          return (
            <div style={{ margin: '12px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {manquants.map(m => (
                <div key={m.label} style={{ background: m.fond, border: `1px solid ${m.couleur}44`, borderRadius: '6px', padding: '8px 12px', fontSize: '12px', color: m.couleur, display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>⚠️ Rôle manquant :</span>
                  <span style={{ background: m.couleur + '22', border: `1px solid ${m.couleur}55`, borderRadius: '4px', padding: '1px 7px', fontWeight: 600 }}>{m.label}</span>
                  <span style={{ color: '#9ca3af' }}>— {m.desc}. Éditez un statut et cochez ce rôle.</span>
                </div>
              ))}
            </div>
          )
        })()}

        {/* Formulaire ajout statut */}
        <div style={{ borderTop: '1px solid #1f2937', paddingTop: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ajouter un statut</p>
          <form onSubmit={ajouterStatut}>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 180px 120px 60px auto', gap: '10px', alignItems: 'flex-end', marginBottom: '10px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Code</label>
                <input required value={newStatut.code} onChange={e => setNewStatut(f => ({ ...f, code: e.target.value }))} className="form-input" placeholder="EX_STATUT" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Label</label>
                <input required value={newStatut.label} onChange={e => setNewStatut(f => ({ ...f, label: e.target.value }))} className="form-input" placeholder="Ex: En réparation" />
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
              {isAdmin && <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>+ Ajouter</button>}
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Rôles</label>
              <RolesEditor roles={newStatut.roles} onChange={roles => setNewStatut(f => ({ ...f, roles }))} disabled={!isAdmin} />
            </div>
          </form>
        </div>
      </div>
        ) },
        { key: 'transitions', label: 'Transitions', content: (
      <div className="card">
        {chargement ? (
          <div className="loading-container" style={{ minHeight: '160px' }}><div className="loading-spinner" /></div>
        ) : (
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
        )}

        {/* Formulaire ajout transition */}
        <div style={{ borderTop: '1px solid #1f2937', paddingTop: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ajouter une transition</p>
          <form onSubmit={ajouterTransition} style={{ display: 'grid', gridTemplateColumns: '160px 160px 200px 120px auto', gap: '10px', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">De</label>
              <select required value={newTransition.statutFromId} onChange={e => setNewTransition(f => ({ ...f, statutFromId: Number(e.target.value) }))} className="form-input">
                <option value={0}>— choisir —</option>
                {statuts.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Vers</label>
              <select required value={newTransition.statutToId} onChange={e => setNewTransition(f => ({ ...f, statutToId: Number(e.target.value) }))} className="form-input">
                <option value={0}>— choisir —</option>
                {statuts.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Label bouton</label>
              <input required value={newTransition.labelBouton} onChange={e => setNewTransition(f => ({ ...f, labelBouton: e.target.value }))} className="form-input" placeholder="Ex: Envoyer en réparation" />
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
        ) },
      ]} />

      {/* Modal édition statut */}
      {editStatut && (
        <div className="modal-overlay">
          <div className="modal" style={{ background: '#1a1d27', borderRadius: '10px', padding: '24px', maxWidth: '460px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Modifier le statut</h3>
            <form onSubmit={sauvegarderStatut}>
              <div className="form-group">
                <label className="form-label">Code</label>
                <input className="form-input" value={editStatut.code} disabled style={{ background: '#141720', color: '#6b7280' }} />
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
              <div className="form-group">
                <label className="form-label">Ordre</label>
                <input type="number" className="form-input" value={editStatut.ordre} onChange={e => setEditStatut(s => s ? { ...s, ordre: Number(e.target.value) } : s)} />
              </div>
              <div className="form-group">
                <label className="form-label">Rôles</label>
                <RolesEditor
                  roles={editStatut.roles ?? []}
                  onChange={roles => setEditStatut(s => s ? { ...s, roles } : s)}
                  disabled={!isAdmin}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditStatut(null)}>Annuler</button>
                <button type="submit" className="btn btn-primary"><Check size={14} style={{ marginRight: '4px' }} />Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal édition transition */}
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
