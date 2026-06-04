import { useEffect, useState } from 'react'
import { Trash2, Plus, Pencil, Check, X } from 'lucide-react'
import { get, post, put, del } from '../api/client'
import { getPermissions } from '../utils/permissions'

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}


interface ChampAttenduConfig {
  code: string
  visible: boolean
  obligatoire: boolean
}

interface ConfigAttendus {
  nomOnglet: string
  obligatoirePNcatalogue: boolean
  statutCloture: string | null
  champsAttendu: ChampAttenduConfig[] | null
}

interface Mapping {
  id: number
  colonneExcel: string
  champInventaireCode: string
  roleSpecial: string | null
  actif: boolean
}

interface ChampInv {
  id: number
  code: string
  label: string
}

interface Statut {
  id: number
  code: string
  label: string
}

export default function AdminAttendus() {
  const siteId = getSiteId()
  const { isAdmin } = getPermissions()

  const defaultChampsAttendu: ChampAttenduConfig[] = []
  const [config, setConfig] = useState<ConfigAttendus>({ nomOnglet: 'Terminal Details', obligatoirePNcatalogue: true, statutCloture: null, champsAttendu: defaultChampsAttendu })
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [champsInv, setChampsInv] = useState<ChampInv[]>([])
  const [statuts, setStatuts] = useState<Statut[]>([])
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Partial<Mapping>>({})
  const [newMapping, setNewMapping] = useState({ colonneExcel: '', champInventaireCode: '', roleSpecial: '' })
  const [configModifiee, setConfigModifiee] = useState(false)
  const [succes, setSucces] = useState(false)

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    const [data, s] = await Promise.all([
      get<any>(`/config-attendus/${siteId}`),
      get<Statut[]>(`/workflow/${siteId}/statuts`)
    ])
    if (data.config) {
      const cfg = data.config
      if (cfg.champsAttendu && typeof cfg.champsAttendu === 'string') {
        try { cfg.champsAttendu = JSON.parse(cfg.champsAttendu) } catch {}
      }
      if (!cfg.champsAttendu) cfg.champsAttendu = defaultChampsAttendu
      setConfig(cfg)
    }
    setMappings(data.mappings)
    setChampsInv(data.champsInv)
    setStatuts(s)
    setConfigModifiee(false)
  }

  function updateChamp(code: string, changes: Partial<ChampAttenduConfig>) {
    const current = config.champsAttendu ?? defaultChampsAttendu
    const exists = current.find(c => c.code === code)
    const updated = exists
      ? current.map(c => c.code === code ? { ...c, ...changes } : c)
      : [...current, { code, visible: false, obligatoire: false, ...changes }]
    setConfig(f => ({ ...f, champsAttendu: updated }))
    setConfigModifiee(true)
  }

  async function handleSaveConfig() {
    await put(`/config-attendus/${siteId}`, config)
    setConfigModifiee(false)
    setSucces(true)
    setTimeout(() => setSucces(false), 2000)
  }

  async function handleAddMapping(e: React.FormEvent) {
    e.preventDefault()
    if (!newMapping.colonneExcel || !newMapping.champInventaireCode) return
    await post(`/config-attendus/${siteId}/mappings`, {
      colonneExcel: newMapping.colonneExcel,
      champInventaireCode: newMapping.champInventaireCode,
      roleSpecial: newMapping.roleSpecial || null
    })
    setNewMapping({ colonneExcel: '', champInventaireCode: '', roleSpecial: '' })
    reload()
  }

  async function handleUpdate(id: number) {
    await put(`/config-attendus/mappings/${id}`, editForm)
    setEditId(null)
    reload()
  }

  async function handleDelete(id: number) {
    await del(`/config-attendus/mappings/${id}`)
    reload()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuration â€” Attendus</h1>
          <p className="page-subtitle">ParamÃ©trez l'import Excel et la clÃ´ture des attendus</p>
        </div>
      </div>

      {/* Config globale */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', color: '#111827' }}>ParamÃ¨tres gÃ©nÃ©raux</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Nom de l'onglet Excel</label>
            <input className="form-input" value={config.nomOnglet}
              onChange={e => { setConfig(c => ({ ...c, nomOnglet: e.target.value })); setConfigModifiee(true) }}
              placeholder="ex: Terminal Details" />
            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>Nom exact de l'onglet Ã  lire dans le fichier Excel client</p>
          </div>
          <div className="form-group">
            <label className="form-label">Statut Ã  la clÃ´ture</label>
            <select className="form-input" value={config.statutCloture ?? ''}
              onChange={e => { setConfig(c => ({ ...c, statutCloture: e.target.value || null })); setConfigModifiee(true) }}>
              <option value="">â€” Recherche automatique (contient "STOCK") â€”</option>
              {statuts.map(s => <option key={s.id} value={s.code}>{s.label} ({s.code})</option>)}
            </select>
            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>Statut assignÃ© aux lignes inventaire lors de la clÃ´ture</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input type="checkbox" id="obligPN" checked={config.obligatoirePNcatalogue}
              onChange={e => { setConfig(c => ({ ...c, obligatoirePNcatalogue: e.target.checked })); setConfigModifiee(true) }} />
            <div>
              <label htmlFor="obligPN" style={{ fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>P/N obligatoire dans le catalogue</label>
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>Si dÃ©cochÃ©, l'import est autorisÃ© mÃªme si le P/N n'existe pas dans les articles</p>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div style={{ marginTop: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleSaveConfig} disabled={!configModifiee}>
              Enregistrer les paramÃ¨tres
            </button>
            {succes && <span style={{ color: '#16a34a', fontSize: '13px' }}>âœ“ EnregistrÃ©</span>}
          </div>
        )}
      </div>

      {/* Champs du formulaire de crÃ©ation */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px', color: '#111827' }}>Champs du formulaire de crÃ©ation</h2>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
          SÃ©lectionnez les champs inventaire Ã  remplir lors de la crÃ©ation d'un attendu. Ces valeurs seront automatiquement injectÃ©es dans l'inventaire Ã  la clÃ´ture.
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Champ inventaire</th>
              <th style={{ color: '#9ca3af', fontWeight: 400, fontSize: '12px' }}>Code</th>
              <th style={{ textAlign: 'center' }}>Visible</th>
              <th style={{ textAlign: 'center' }}>Obligatoire</th>
            </tr>
          </thead>
          <tbody>
            {champsInv.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>Aucun champ inventaire configurÃ©</td></tr>}
            {champsInv.map(champ => {
              const cfg = config.champsAttendu?.find(c => c.code === champ.code) ?? { code: champ.code, visible: false, obligatoire: false }
              return (
                <tr key={champ.code}>
                  <td style={{ fontWeight: 500 }}>{champ.label}</td>
                  <td><code style={{ fontSize: '11px', background: '#1e3a5f', color: '#2563eb', padding: '1px 6px', borderRadius: '4px' }}>{champ.code}</code></td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={cfg.visible} disabled={!isAdmin} onChange={e => updateChamp(champ.code, { visible: e.target.checked, obligatoire: e.target.checked ? cfg.obligatoire : false })} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={cfg.obligatoire} disabled={!cfg.visible || !isAdmin} onChange={e => updateChamp(champ.code, { obligatoire: e.target.checked })} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mapping colonnes Excel */}
      <div className="card">
        <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px', color: '#111827' }}>Mapping colonnes Excel â†’ inventaire</h2>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
          DÃ©finissez quelle colonne Excel correspond Ã  quel champ inventaire. Les rÃ´les <strong>SN</strong> et <strong>PN</strong> sont obligatoires pour identifier les numÃ©ros de sÃ©rie et les rÃ©fÃ©rences produit.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Colonne Excel</th>
                <th>Champ inventaire</th>
                <th>RÃ´le spÃ©cial</th>
                <th>Actif</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {mappings.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>
                  Aucun mapping configurÃ© â€” le systÃ¨me utilise les colonnes par dÃ©faut
                </td></tr>
              )}
              {mappings.map(m => editId === m.id ? (
                <tr key={m.id}>
                  <td><input className="form-input" value={editForm.colonneExcel ?? ''} onChange={e => setEditForm(f => ({ ...f, colonneExcel: e.target.value }))} /></td>
                  <td>
                    <select className="form-input" value={editForm.champInventaireCode ?? ''} onChange={e => setEditForm(f => ({ ...f, champInventaireCode: e.target.value }))}>
                      <option value="">â€” Choisir â€”</option>
                      {champsInv.map(c => <option key={c.id} value={c.code}>{c.label} ({c.code})</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="form-input" value={editForm.roleSpecial ?? ''} onChange={e => setEditForm(f => ({ ...f, roleSpecial: e.target.value || null }))}>
                      <option value="">â€” Aucun â€”</option>
                      <option value="SN">SN (numÃ©ro de sÃ©rie)</option>
                      <option value="PN">PN (rÃ©fÃ©rence produit)</option>
                    </select>
                  </td>
                  <td style={{ textAlign: 'center' }}><input type="checkbox" checked={editForm.actif ?? true} onChange={e => setEditForm(f => ({ ...f, actif: e.target.checked }))} /></td>
                  <td style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-secondary btn-icon" onClick={() => handleUpdate(m.id)}><Check size={14} /></button>
                    <button className="btn btn-secondary btn-icon" onClick={() => setEditId(null)}><X size={14} /></button>
                  </td>
                </tr>
              ) : (
                <tr key={m.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{m.colonneExcel}</td>
                  <td>
                    <code style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{m.champInventaireCode}</code>
                    <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '6px' }}>{champsInv.find(c => c.code === m.champInventaireCode)?.label}</span>
                  </td>
                  <td>
                    {m.roleSpecial ? (
                      <span style={{ background: m.roleSpecial === 'SN' ? '#dbeafe' : '#ede9fe', color: m.roleSpecial === 'SN' ? '#1d4ed8' : '#6d28d9', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                        {m.roleSpecial}
                      </span>
                    ) : <span style={{ color: '#d1d5db' }}>â€”</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {m.actif ? <span className="badge badge-success">Actif</span> : <span style={{ color: '#d1d5db' }}>Inactif</span>}
                  </td>
                  <td style={{ display: 'flex', gap: '6px' }}>
                    {isAdmin && (
                      <>
                        <button className="btn btn-secondary btn-icon" onClick={() => { setEditId(m.id); setEditForm({ colonneExcel: m.colonneExcel, champInventaireCode: m.champInventaireCode, roleSpecial: m.roleSpecial ?? '', actif: m.actif }) }}><Pencil size={14} /></button>
                        <button className="btn btn-danger btn-icon" onClick={() => handleDelete(m.id)}><Trash2 size={14} /></button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isAdmin && (
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginTop: '16px' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ajouter un mapping</p>
            <form onSubmit={handleAddMapping} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '200px' }}>
                <label className="form-label">Colonne Excel *</label>
                <input required className="form-input" placeholder="ex: Serial Number"
                  value={newMapping.colonneExcel} onChange={e => setNewMapping(m => ({ ...m, colonneExcel: e.target.value }))} />
              </div>
              <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '200px' }}>
                <label className="form-label">Champ inventaire *</label>
                <select required className="form-input" value={newMapping.champInventaireCode} onChange={e => setNewMapping(m => ({ ...m, champInventaireCode: e.target.value }))}>
                  <option value="">â€” Choisir â€”</option>
                  {champsInv.map(c => <option key={c.id} value={c.code}>{c.label} ({c.code})</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">RÃ´le spÃ©cial</label>
                <select className="form-input" value={newMapping.roleSpecial} onChange={e => setNewMapping(m => ({ ...m, roleSpecial: e.target.value }))}>
                  <option value="">â€” Aucun â€”</option>
                  <option value="SN">SN (numÃ©ro de sÃ©rie)</option>
                  <option value="PN">PN (rÃ©fÃ©rence produit)</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary">+ Ajouter</button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

