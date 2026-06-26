import { useEffect, useState } from 'react'
import { Trash2, Plus, Check, X, Users } from 'lucide-react'
import Tabs from '../components/Tabs'
import { get, post, put, del } from '../api/client'
import { getPermissions, getSiteId } from '../utils/permissions'

interface Config {
  champPNCode: string
  champRMACode: string
  labelPN: string
  labelRMA: string
  champTypeArticleCode: string
  typesArticleQTE: string[]
  champsAffichageQTE: string[]
  quotaSamediActif: boolean
}

interface Technicien {
  id: number
  userId: number
  quotaJournalier: number
  actif: boolean
  utilisateur: { id: number; nom: string; prenom: string; login: string }
}

interface Utilisateur {
  id: number
  nom: string
  prenom: string
  login: string
}

interface ChampInv {
  id: number
  code: string
  label: string
}

export default function AdminProduction() {
  const siteId = getSiteId()
  const { isAdmin } = getPermissions()

  const [chargement, setChargement] = useState(true)
  const [config, setConfig]           = useState<Config>({ champPNCode: 'partNumber', champRMACode: 'rma', labelPN: 'P/N', labelRMA: 'RMA', champTypeArticleCode: 'TYPE', typesArticleQTE: [], champsAffichageQTE: [], quotaSamediActif: false })
  const [champsArticle, setChampsArticle] = useState<ChampInv[]>([])
  const [articlesData, setArticlesData]   = useState<any[]>([])
  const [configModif, setConfigModif] = useState(false)
  const [techniciens, setTechniciens] = useState<Technicien[]>([])
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([])
  const [newTech, setNewTech]         = useState({ userId: 0, quotaJournalier: 10 })
  const [editTech, setEditTech]       = useState<Technicien | null>(null)
  const [confirmDel, setConfirmDel]   = useState<number | null>(null)
  const [succes, setSucces]           = useState('')

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    const [cfg, techs, users, champsArt, arts] = await Promise.all([
      get<Config>(`/production/config/${siteId}`),
      get<Technicien[]>(`/production/techniciens/${siteId}`),
      get<Utilisateur[]>(`/gestion/${siteId}/utilisateurs`),
      get<ChampInv[]>(`/articles/${siteId}/champs`),
      get<any[]>(`/articles/${siteId}`)
    ])
    setConfig(cfg)
    setTechniciens(techs)
    setUtilisateurs(users)
    setChampsArticle(champsArt.filter(c => c.actif !== false))
    setArticlesData(arts)
    setConfigModif(false)
    setChargement(false)
  }

  // Valeurs distinctes du champ type dans les articles existants
  function getValeursDistinctes(codeChamp: string): string[] {
    const champ = champsArticle.find(c => c.code === codeChamp)
    if (!champ) return []
    const vals = new Set<string>()
    for (const art of articlesData) {
      const v = art.valeurs?.find((val: any) => val.champId === champ.id)?.valeur
      if (v) vals.add(v)
    }
    return Array.from(vals).sort()
  }

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault()
    await put(`/production/config/${siteId}`, config)
    setConfigModif(false)
    setSucces('Configuration sauvegardée.')
    setTimeout(() => setSucces(''), 2000)
  }

  async function toggleQuotaSamedi(checked: boolean) {
    const updated = { ...config, quotaSamediActif: checked }
    setConfig(updated)
    await put(`/production/config/${siteId}`, updated)
    setSucces('Configuration sauvegardée.')
    setTimeout(() => setSucces(''), 2000)
  }

  async function addTech(e: React.FormEvent) {
    e.preventDefault()
    await post(`/production/techniciens/${siteId}`, newTech)
    setNewTech({ userId: 0, quotaJournalier: 10 })
    reload()
  }

  async function saveTech(e: React.FormEvent) {
    e.preventDefault()
    if (!editTech) return
    await put(`/production/techniciens/${editTech.id}`, { quotaJournalier: editTech.quotaJournalier, actif: editTech.actif })
    setEditTech(null)
    reload()
  }

  async function deleteTech(id: number) {
    await del(`/production/techniciens/${id}`)
    setConfirmDel(null)
    reload()
  }

  const usersDispos = utilisateurs.filter(u => !techniciens.some(t => t.userId === u.id))

  if (!isAdmin) return <div className="card" style={{ padding: '32px', color: '#9ca3af' }}>Accès refusé.</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Production</h1>
          <p className="page-subtitle">Paramétrez la passerelle logistique → production et les techniciens</p>
        </div>
      </div>

      {succes && (
        <div style={{ background: '#052e16', border: '1px solid #16a34a', borderRadius: '8px', padding: '10px 16px', color: '#4ade80', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Check size={15} /> {succes}
        </div>
      )}

      <Tabs tabs={[
        { key: 'transfert', label: 'Transfert', content: (
      <div className="card" style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
          Définit comment les articles de l'inventaire logistique remontent vers le module production (planning S/N et demandes de quantité).
        </p>
        {chargement ? (
          <div className="loading-container" style={{ minHeight: '160px' }}><div className="loading-spinner" /></div>
        ) : (
        <form onSubmit={saveConfig}>
          {/* Transfert SN */}
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Transfert S/N (Planning)</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Champ P/N <span style={{ color: '#60a5fa', fontWeight: 400 }}>(inventaire)</span></label>
              <input disabled className="form-input" value="partNumber" style={{ background: '#141720', color: '#6b7280', cursor: 'not-allowed' }} />
              <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '3px' }}>Colonne fixe — non configurable</p>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Champ RMA <span style={{ color: '#60a5fa', fontWeight: 400 }}>(inventaire)</span></label>
              <input disabled className="form-input" value="rma" style={{ background: '#141720', color: '#6b7280', cursor: 'not-allowed' }} />
              <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '3px' }}>Colonne fixe — non configurable</p>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Label P/N <span style={{ color: '#6b7280', fontWeight: 400 }}>(affiché)</span></label>
              <input className="form-input" value={config.labelPN} onChange={e => { setConfig(c => ({ ...c, labelPN: e.target.value })); setConfigModif(true) }} placeholder="P/N" />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Label RMA <span style={{ color: '#6b7280', fontWeight: 400 }}>(affiché)</span></label>
              <input className="form-input" value={config.labelRMA} onChange={e => { setConfig(c => ({ ...c, labelRMA: e.target.value })); setConfigModif(true) }} placeholder="RMA" />
            </div>
          </div>

          {/* Transfert QTE */}
          <div style={{ borderTop: '1px solid #1f2937', paddingTop: '16px', marginBottom: '14px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>Transfert quantité (Logistique)</p>

            {champsArticle.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#f59e0b' }}>⚠ Aucun champ catalogue configuré. Allez d'abord dans Config. articles pour créer vos champs.</p>
            ) : (<>
              {/* Étape 1 : choisir le champ filtre */}
              <div className="form-group" style={{ margin: '0 0 16px 0', maxWidth: '340px' }}>
                <label className="form-label">
                  1. Champ de filtrage des articles
                  <span style={{ color: '#6b7280', fontWeight: 400, fontSize: '12px', display: 'block', marginTop: '2px' }}>
                    Quel champ du catalogue identifie le type d'article (ex : TYPE, FAMILLE…) ?
                  </span>
                </label>
                <select className="form-input" value={config.champTypeArticleCode}
                  onChange={e => { setConfig(c => ({ ...c, champTypeArticleCode: e.target.value, typesArticleQTE: [] })); setConfigModif(true) }}>
                  <option value="">— Choisir —</option>
                  {champsArticle.map(c => <option key={c.id} value={c.code}>{c.label}</option>)}
                </select>
              </div>

              {/* Étape 2 : cocher les valeurs autorisées */}
              {config.champTypeArticleCode && (
                <div className="form-group" style={{ margin: '0 0 16px 0' }}>
                  <label className="form-label">
                    2. Valeurs autorisées pour le transfert QTE
                    <span style={{ color: '#6b7280', fontWeight: 400, fontSize: '12px', display: 'block', marginTop: '2px' }}>
                      Cochez les types d'articles qui apparaîtront dans le formulaire de demande QTE
                    </span>
                  </label>
                  {getValeursDistinctes(config.champTypeArticleCode).length === 0 ? (
                    <p style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>Aucune valeur trouvée pour ce champ dans le catalogue.</p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                      {getValeursDistinctes(config.champTypeArticleCode).map(val => {
                        const checked = config.typesArticleQTE.includes(val)
                        return (
                          <label key={val} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '5px 12px', borderRadius: '6px', border: `1px solid ${checked ? '#2563eb' : '#374151'}`, background: checked ? '#1e3a5f' : '#141720', fontSize: '13px', color: checked ? '#60a5fa' : '#9ca3af' }}>
                            <input type="checkbox" checked={checked}
                              onChange={e => {
                                const next = e.target.checked
                                  ? [...config.typesArticleQTE, val]
                                  : config.typesArticleQTE.filter(x => x !== val)
                                setConfig(c => ({ ...c, typesArticleQTE: next }))
                                setConfigModif(true)
                              }} />
                            {val}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Étape 3 : champs à afficher dans la liste */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  3. Informations affichées dans la liste des transferts
                  <span style={{ color: '#6b7280', fontWeight: 400, fontSize: '12px', display: 'block', marginTop: '2px' }}>
                    Cochez les champs à afficher pour chaque demande dans l'onglet "Transfert quantité"
                  </span>
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                  {champsArticle.map(c => {
                    const checked = config.champsAffichageQTE.includes(c.code)
                    return (
                      <label key={c.code} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '5px 12px', borderRadius: '6px', border: `1px solid ${checked ? '#ea580c' : '#374151'}`, background: checked ? '#1c1917' : '#141720', fontSize: '13px', color: checked ? '#fb923c' : '#9ca3af' }}>
                        <input type="checkbox" checked={checked}
                          onChange={e => {
                            const next = e.target.checked
                              ? [...config.champsAffichageQTE, c.code]
                              : config.champsAffichageQTE.filter(x => x !== c.code)
                            setConfig(cfg => ({ ...cfg, champsAffichageQTE: next }))
                            setConfigModif(true)
                          }} />
                        {c.label}
                      </label>
                    )
                  })}
                </div>
              </div>
            </>)}
          </div>

          {configModif && (
            <button type="submit" className="btn btn-primary" style={{ marginTop: '16px' }}><Check size={14} /> Enregistrer</button>
          )}
        </form>
        )}
      </div>
        ) },
        { key: 'techniciens', label: 'Techniciens & quotas', content: (
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Users size={16} style={{ color: '#60a5fa' }} />
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9' }}>Techniciens de production</h2>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
            <input type="checkbox" checked={config.quotaSamediActif} onChange={e => toggleQuotaSamedi(e.target.checked)} style={{ marginTop: '3px' }} />
            <span>
              <span className="form-label" style={{ margin: 0 }}>Activer le quota de production le samedi par défaut</span>
              <span style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                Si désactivé (par défaut), la capacité de chaque samedi est de 0 dans le planning, quels que soient les quotas des techniciens.
                Un samedi en particulier peut ensuite être activé ou désactivé ponctuellement directement depuis le Planning (bouton sur la colonne du samedi).
              </span>
            </span>
          </label>
        </div>

        {chargement ? (
          <div className="loading-container" style={{ minHeight: '160px' }}><div className="loading-spinner" /></div>
        ) : techniciens.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '16px' }}>Aucun technicien configuré.</p>
        ) : (
          <table className="table" style={{ marginBottom: '20px' }}>
            <thead>
              <tr>
                <th>Technicien</th>
                <th>Login</th>
                <th style={{ width: '120px' }}>Quota / jour</th>
                <th style={{ width: '80px' }}>Actif</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {techniciens.map(t => (
                <tr key={t.id}>
                  <td>{t.utilisateur.prenom} {t.utilisateur.nom}</td>
                  <td style={{ color: '#9ca3af', fontSize: '12px' }}>{t.utilisateur.login}</td>
                  <td style={{ fontWeight: 600, color: '#60a5fa' }}>{t.quotaJournalier}</td>
                  <td>
                    <span style={{ fontSize: '11px', padding: '1px 8px', borderRadius: '4px', background: t.actif ? '#052e16' : '#1f2937', color: t.actif ? '#4ade80' : '#6b7280', border: `1px solid ${t.actif ? '#16a34a' : '#374151'}` }}>
                      {t.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-secondary btn-icon" onClick={() => setEditTech(t)} title="Modifier quota"><span style={{ fontSize: '12px' }}>✎</span></button>
                    <button className="btn btn-danger btn-icon" onClick={() => setConfirmDel(t.id)}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Ajout technicien */}
        {usersDispos.length > 0 && (
          <div style={{ borderTop: '1px solid #1f2937', paddingTop: '16px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Ajouter un technicien</p>
            <form onSubmit={addTech} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0, flex: 1 }}>
                <label className="form-label">Utilisateur</label>
                <select required className="form-input" value={newTech.userId} onChange={e => setNewTech(f => ({ ...f, userId: Number(e.target.value) }))}>
                  <option value={0}>— Choisir —</option>
                  {usersDispos.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom} ({u.login})</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0, width: '130px' }}>
                <label className="form-label">Quota / jour</label>
                <input type="number" min={1} max={100} className="form-input" value={newTech.quotaJournalier} onChange={e => setNewTech(f => ({ ...f, quotaJournalier: Number(e.target.value) }))} />
              </div>
              <button type="submit" className="btn btn-primary"><Plus size={14} /> Ajouter</button>
            </form>
          </div>
        )}
      </div>
        ) },
      ]} />

      {/* Modal édition technicien */}
      {editTech && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '10px', padding: '24px', maxWidth: '340px', width: '100%' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Modifier — {editTech.utilisateur.prenom} {editTech.utilisateur.nom}</h3>
            <form onSubmit={saveTech}>
              <div className="form-group">
                <label className="form-label">Quota journalier</label>
                <input type="number" min={0} max={100} required className="form-input" value={editTech.quotaJournalier} onChange={e => setEditTech(t => t ? { ...t, quotaJournalier: Number(e.target.value) } : t)} />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editTech.actif} onChange={e => setEditTech(t => t ? { ...t, actif: e.target.checked } : t)} />
                  <span className="form-label" style={{ margin: 0 }}>Actif</span>
                </label>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditTech(null)}>Annuler</button>
                <button type="submit" className="btn btn-primary"><Check size={14} /> Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression */}
      {confirmDel !== null && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '10px', padding: '24px', maxWidth: '360px', width: '100%' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>Retirer ce technicien ?</h3>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '20px' }}>Il ne sera plus visible dans le planning. Ses absences seront supprimées.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmDel(null)}>Annuler</button>
              <button className="btn btn-danger" onClick={() => deleteTech(confirmDel)}>Retirer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
