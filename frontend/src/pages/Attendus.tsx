import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Upload, FileText, Lock, Clock, Trash2 } from 'lucide-react'
import { attendusApi } from '../api/attendus'
import { get } from '../api/client'

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

interface Attendu {
  id: number
  rma: string | null
  bt: string | null
  client: string | null
  statut: string
  createdAt: string
  closedAt: string | null
  _count: { lignes: number }
}

export default function Attendus() {
  const siteId = getSiteId()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [attendus, setAttendus] = useState<Attendu[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [champsClients, setChampsClients] = useState<any[]>([])
  const [showImport, setShowImport] = useState(false)
  const [rma, setRma] = useState('')
  const [bt, setBt] = useState('')
  const [client, setClient] = useState('')
  const [dateCreationRMA, setDateCreationRMA] = useState('')
  const [fichier, setFichier] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [modalDelete, setModalDelete] = useState<Attendu | null>(null)
  const [configChamps, setConfigChamps] = useState<{ code: string; visible: boolean; obligatoire: boolean }[]>([])

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    const [data, cl, cc, cfg] = await Promise.all([
      attendusApi.getAll(siteId),
      get<any[]>(`/clients/${siteId}`),
      get<any[]>(`/clients/${siteId}/champs`),
      get<any>(`/config-attendus/${siteId}`)
    ])
    setAttendus(data)
    setClients(cl)
    setChampsClients(cc.filter((c: any) => c.actif))
    // Config champs attendu
    if (cfg?.config?.champsAttendu) {
      try {
        const parsed = typeof cfg.config.champsAttendu === 'string' ? JSON.parse(cfg.config.champsAttendu) : cfg.config.champsAttendu
        setConfigChamps(parsed)
      } catch {}
    }
  }

  const CODES_NOM = ['NOM', 'NAME', 'LIBELLE', 'RAISON_SOCIALE']

  function getClientLabel(cl: any): string {
    const champNom = champsClients.find((c: any) => CODES_NOM.includes(c.code.toUpperCase()))
    if (champNom) {
      const val = cl.valeurs?.find((v: any) => v.champId === champNom.id)?.valeur
      if (val) return val
    }
    return cl.valeurs?.map((v: any) => v.valeur).filter(Boolean)[0] || `Client #${cl.id}`
  }

  async function handleDelete(a: Attendu) {
    try {
      await attendusApi.delete(a.id)
      setModalDelete(null)
      reload()
    } catch (e: any) {
      try { alert(JSON.parse(e.message)?.error ?? 'Erreur') } catch { alert('Erreur') }
    }
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    if (!fichier) return
    setLoading(true)
    setErreur(null)
    try {
      const result = await attendusApi.importExcel(siteId, fichier, rma, bt, client, dateCreationRMA)
      setShowImport(false)
      setRma(''); setBt(''); setClient(''); setDateCreationRMA(''); setFichier(null)
      reload()
      navigate(`/attendus/${result.id}`)
    } catch (e: any) {
      try {
        const parsed = JSON.parse(e.message)
        setErreur(parsed?.error ?? 'Erreur import')
      } catch { setErreur('Erreur import') }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendus</h1>
          <p className="page-subtitle">{attendus.length} attendu{attendus.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowImport(true)}>
          <Plus size={16} /> Nouvel attendu
        </button>
      </div>

      {attendus.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
          <FileText size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ fontWeight: 500, marginBottom: '8px' }}>Aucun attendu</p>
          <p style={{ fontSize: '13px' }}>Importez un fichier Excel client pour démarrer</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Statut</th>
                <th>RMA</th>
                <th>BT</th>
                <th>Client</th>
                <th>Lignes</th>
                <th>Date import</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {attendus.map((a, idx) => (
                <tr key={a.id} style={{ background: idx % 2 === 0 ? 'white' : '#e8f0fe', cursor: 'pointer' }}
                  onClick={() => navigate(`/attendus/${a.id}`)}>
                  <td>
                    {a.statut === 'CLOS'
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '4px' }}><Lock size={11} /> Clôturé</span>
                      : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '4px' }}><Clock size={11} /> En cours</span>
                    }
                  </td>
                  <td style={{ fontWeight: 500 }}>{a.rma || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                  <td>{a.bt || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                  <td>{a.client || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                  <td><span style={{ background: '#eff6ff', color: '#2563eb', borderRadius: '4px', padding: '2px 8px', fontSize: '12px', fontWeight: 600 }}>{a._count.lignes}</span></td>
                  <td style={{ color: '#9ca3af', fontSize: '13px' }}>{new Date(a.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td onClick={e => e.stopPropagation()}>
                    {a.statut === 'EN_COURS' && (
                      <button className="btn btn-danger btn-icon" onClick={e => { e.stopPropagation(); setModalDelete(a) }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal suppression */}
      {modalDelete && (
        <div className="modal-overlay">
          <div style={{ background: 'white', borderRadius: '10px', padding: '28px', maxWidth: '420px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Supprimer l'attendu ?</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>
              L'attendu <strong>{modalDelete.rma || `#${modalDelete.id}`}</strong> et toutes ses lignes seront définitivement supprimés.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setModalDelete(null)}>Annuler</button>
              <button className="btn btn-danger" style={{ background: '#dc2626', color: 'white', borderColor: '#dc2626' }} onClick={() => handleDelete(modalDelete)}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal import */}
      {showImport && (
        <div className="modal-overlay">
          <div style={{ background: 'white', borderRadius: '12px', padding: '28px', maxWidth: '480px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Nouvel attendu — Import Excel</h3>
            <form onSubmit={handleImport}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Champs dynamiques depuis la config */}
                {(configChamps.length === 0
                  ? [{ code: 'rma', visible: true, obligatoire: false }, { code: 'client', visible: true, obligatoire: false }, { code: 'dateCreationRMA', visible: true, obligatoire: false }]
                  : configChamps
                ).filter(c => c.visible).map(cc => {
                  if (cc.code === 'rma') return (
                    <div key="rma" className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">N° RMA{cc.obligatoire && <span style={{ color: '#dc2626' }}> *</span>}</label>
                      <input required={cc.obligatoire} className="form-input" placeholder="RMA-XXXX" value={rma} onChange={e => setRma(e.target.value)} />
                    </div>
                  )
                  if (cc.code === 'bt') return (
                    <div key="bt" className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">N° BT{cc.obligatoire && <span style={{ color: '#dc2626' }}> *</span>}</label>
                      <input required={cc.obligatoire} className="form-input" placeholder="BT-XXXX" value={bt} onChange={e => setBt(e.target.value)} />
                    </div>
                  )
                  if (cc.code === 'dateCreationRMA') return (
                    <div key="dateCreationRMA" className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Date création RMA{cc.obligatoire && <span style={{ color: '#dc2626' }}> *</span>}</label>
                      <input type="date" required={cc.obligatoire} className="form-input" value={dateCreationRMA} onChange={e => setDateCreationRMA(e.target.value)} />
                    </div>
                  )
                  if (cc.code === 'client') return (
                    <div key="client" className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Client{cc.obligatoire && <span style={{ color: '#dc2626' }}> *</span>}</label>
                      <select required={cc.obligatoire} className="form-input" value={client} onChange={e => setClient(e.target.value)}>
                        <option value="">— Choisir un client —</option>
                        {clients.map(cl => <option key={cl.id} value={getClientLabel(cl)}>{getClientLabel(cl)}</option>)}
                      </select>
                    </div>
                  )
                  if (cc.code === 'plateforme') return (
                    <div key="plateforme" className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Plateforme{cc.obligatoire && <span style={{ color: '#dc2626' }}> *</span>}</label>
                      <input required={cc.obligatoire} className="form-input" placeholder="Plateforme" value={bt} onChange={e => setBt(e.target.value)} />
                    </div>
                  )
                  return null
                })}
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Fichier Excel *</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{ border: '2px dashed #bfdbfe', borderRadius: '8px', padding: '20px', textAlign: 'center', cursor: 'pointer', background: fichier ? '#eff6ff' : '#f8faff' }}>
                  <Upload size={24} style={{ margin: '0 auto 8px', color: '#2563eb' }} />
                  {fichier
                    ? <p style={{ color: '#2563eb', fontWeight: 500, fontSize: '13px' }}>{fichier.name}</p>
                    : <p style={{ color: '#9ca3af', fontSize: '13px' }}>Cliquez pour sélectionner le fichier Excel client</p>
                  }
                </div>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                  onChange={e => setFichier(e.target.files?.[0] ?? null)} />
              </div>

              {erreur && (
                <div style={{ padding: '10px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>
                  {erreur}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowImport(false); setErreur(null) }}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={!fichier || loading}>
                  {loading ? 'Import en cours...' : <><Upload size={15} /> Importer</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
