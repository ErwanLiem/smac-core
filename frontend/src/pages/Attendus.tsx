import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Upload, FileText, Lock, Clock, Trash2 } from 'lucide-react'
import { attendusApi } from '../api/attendus'
import { get } from '../api/client'
import { getSiteId } from '../utils/permissions'
import { COLONNES_INVENTAIRE, getLabelColonne } from '../constants/colonnesInventaire'

interface Attendu {
  id: number; rma: string | null; bt: string | null; statut: string
  createdAt: string; closedAt: string | null; _count: { lignes: number }
  donneesCommunes: string | null
}

const CODES_NOM = ['NOM', 'NAME', 'LIBELLE', 'RAISON_SOCIALE', 'SOCIETE']
const CODES_CLIENT    = ['CLIENT', 'CLIENTS', 'CUSTOMER']
const CODES_PLATEFORME = ['PLATEFORME', 'PLATEFORMES']

function parseOptions(raw: string | null): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

export default function Attendus() {
  const siteId = getSiteId()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [chargement, setChargement] = useState(true)
  const [attendus, setAttendus] = useState<Attendu[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [champsClients, setChampsClients] = useState<any[]>([])
  const [plateformes, setPlateformes] = useState<any[]>([])
  const [champsPlateformes, setChampsPlateformes] = useState<any[]>([])
  const [showImport, setShowImport] = useState(false)
  const [rma, setRma] = useState('')
  const [bt, setBt] = useState('')
  const [donneesCommunes, setDonneesCommunes] = useState<Record<string, string>>({})
  const [fichier, setFichier] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [modalDelete, setModalDelete] = useState<Attendu | null>(null)
  const [configChamps, setConfigChamps] = useState<{ code: string; visible: boolean; obligatoire: boolean; visibleListe: boolean }[]>([])

  useEffect(() => {
    document.querySelector('.main-content')?.classList.add('page-table')
    return () => { document.querySelector('.main-content')?.classList.remove('page-table') }
  }, [])

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    const [data, cl, cc, pl, cp, cfg] = await Promise.all([
      attendusApi.getAll(siteId),
      get<any[]>(`/clients/${siteId}`),
      get<any[]>(`/clients/${siteId}/champs`),
      get<any[]>(`/plateformes/${siteId}`),
      get<any[]>(`/plateformes/${siteId}/champs`),
      get<any>(`/config-attendus/${siteId}`)
    ])
    setAttendus(data)
    setClients(cl); setChampsClients(cc.filter((c: any) => c.actif))
    setPlateformes(pl); setChampsPlateformes(cp.filter((c: any) => c.actif))
    if (cfg?.config?.champsAttendu) {
      try {
        const parsed = typeof cfg.config.champsAttendu === 'string' ? JSON.parse(cfg.config.champsAttendu) : cfg.config.champsAttendu
        setConfigChamps(parsed)
      } catch {}
    }
    setChargement(false)
  }

  function getEntiteLabel(entite: any, champs: any[]): string {
    const champNom = champs.find((c: any) => CODES_NOM.includes(c.code.toUpperCase()))
    const val = champNom ? entite.valeurs?.find((v: any) => v.champId === champNom.id)?.valeur : null
    return val || entite.valeurs?.map((v: any) => v.valeur).filter(Boolean)[0] || `#${entite.id}`
  }

  function getClientLabel(cl: any): string { return getEntiteLabel(cl, champsClients) }

  function getDonneeByCode(attendu: Attendu, code: string): string {
    if (!attendu.donneesCommunes) return ''
    try {
      const d = JSON.parse(attendu.donneesCommunes)
      return d[code] ?? ''
    } catch { return '' }
  }

  const colonnesListe = configChamps.filter(c => c.visibleListe)

  async function handleDelete(a: Attendu) {
    try {
      await attendusApi.delete(a.id)
      setModalDelete(null)
      reload()
    } catch (e: any) {
      alert(e.data?.error ?? e.message ?? 'Erreur')
    }
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    if (!fichier) return
    setLoading(true)
    setErreur(null)
    try {
      const result = await attendusApi.importExcel(siteId, fichier, rma, bt, donneesCommunes)
      setShowImport(false)
      setRma(''); setBt(''); setDonneesCommunes({}); setFichier(null)
      reload()
      navigate(`/attendus/${result.id}`)
    } catch (e: any) {
      setErreur(e.data?.error ?? e.message ?? 'Erreur import')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <h1 className="page-title">Réceptions attendues</h1>
          <p className="page-subtitle">{attendus.length} réception{attendus.length !== 1 ? 's' : ''} prévue{attendus.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowImport(true)}>
          <Plus size={16} /> Nouvel attendu
        </button>
      </div>

      {chargement ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : attendus.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
          <FileText size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ fontWeight: 500, marginBottom: '8px' }}>Aucun attendu</p>
          <p style={{ fontSize: '13px' }}>Importez un fichier Excel client pour démarrer</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Statut</th>
                {colonnesListe.map(c => (
                  <th key={c.code}>{getLabelColonne(c.code)}</th>
                ))}
                <th>Lignes</th>
                <th>Date import</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {attendus.map((a, idx) => (
                <tr key={a.id} style={{ background: idx % 2 === 0 ? '#1a1d27' : '#141720', cursor: 'pointer' }}
                  onClick={() => navigate(`/attendus/${a.id}`)}>
                  <td>
                    {a.statut === 'CLOS'
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: '#1e2130', color: '#94a3b8', padding: '2px 8px', borderRadius: '4px' }}><Lock size={11} /> Clôturé</span>
                      : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: '#1e3a1e', color: '#4ade80', padding: '2px 8px', borderRadius: '4px' }}><Clock size={11} /> En cours</span>
                    }
                  </td>
                  {colonnesListe.map(c => (
                    <td key={c.code}>{getDonneeByCode(a, c.code) || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                  ))}
                  <td><span style={{ background: '#1e3a5f', color: '#60a5fa', borderRadius: '4px', padding: '2px 8px', fontSize: '12px', fontWeight: 600 }}>{a._count.lignes}</span></td>
                  <td>{new Date(a.createdAt).toLocaleDateString('fr-FR')}</td>
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
        </div>
      )}

      {/* Modal suppression */}
      {modalDelete && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '10px', padding: '28px', maxWidth: '420px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Supprimer l'attendu ?</h3>
            <p style={{ color: '#cbd5e1', fontSize: '14px', marginBottom: '24px' }}>
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
          <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '28px', maxWidth: '480px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Nouvel attendu — Import Excel</h3>
            <form onSubmit={handleImport}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Champs inventaire configurés */}
                {configChamps.filter(cc => cc.visible).map(cc => {
                  const colDef = COLONNES_INVENTAIRE.find(c => c.key === cc.code)
                  const label = colDef?.label ?? getLabelColonne(cc.code)
                  const isClient = CODES_CLIENT.includes(cc.code.toUpperCase())
                  const isPlateforme = CODES_PLATEFORME.includes(cc.code.toUpperCase())
                  const isDate = colDef?.type === 'date'
                  return (
                    <div key={cc.code} className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">{label}{cc.obligatoire && <span style={{ color: '#dc2626' }}> *</span>}</label>
                      {isClient ? (
                        <select required={cc.obligatoire} className="form-input" value={donneesCommunes[cc.code] ?? ''} onChange={e => setDonneesCommunes(d => ({ ...d, [cc.code]: e.target.value }))}>
                          <option value="">— Choisir un client —</option>
                          {clients.map(cl => <option key={cl.id} value={getEntiteLabel(cl, champsClients)}>{getEntiteLabel(cl, champsClients)}</option>)}
                        </select>
                      ) : isPlateforme ? (
                        <select required={cc.obligatoire} className="form-input" value={donneesCommunes[cc.code] ?? ''} onChange={e => setDonneesCommunes(d => ({ ...d, [cc.code]: e.target.value }))}>
                          <option value="">— Choisir une plateforme —</option>
                          {plateformes.map(pl => <option key={pl.id} value={getEntiteLabel(pl, champsPlateformes)}>{getEntiteLabel(pl, champsPlateformes)}</option>)}
                        </select>
                      ) : isDate ? (
                        <input type="date" required={cc.obligatoire} className="form-input"
                          value={donneesCommunes[cc.code] ?? ''}
                          onChange={e => setDonneesCommunes(d => ({ ...d, [cc.code]: e.target.value }))} />
                      ) : (
                        <input type="text" required={cc.obligatoire} className="form-input" value={donneesCommunes[cc.code] ?? ''} onChange={e => setDonneesCommunes(d => ({ ...d, [cc.code]: e.target.value }))} />
                      )}
                    </div>
                  )
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
                    : <p style={{ color: '#94a3b8', fontSize: '13px' }}>Cliquez pour sélectionner le fichier Excel client</p>
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
