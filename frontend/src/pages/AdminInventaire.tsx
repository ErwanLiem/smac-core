import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { get, put } from '../api/client'
import { getPermissions, getSiteId } from '../utils/permissions'
import { COLONNES_INVENTAIRE } from '../constants/colonnesInventaire'

interface ConfigReception {
  champsReceptionSN: string[] | null
}

const COLONNES_CONFIGURABLES = COLONNES_INVENTAIRE.filter(c => c.key !== 'serialNumber')

function defaultsSN(): string[] { return COLONNES_INVENTAIRE.filter(c => c.receptionSN).map(c => c.key) }

export default function AdminInventaire({ embedded }: { embedded?: boolean } = {}) {
  const siteId = getSiteId()
  const { isAdmin } = getPermissions()

  const [config, setConfig]   = useState<ConfigReception>({ champsReceptionSN: null })
  const [modif, setModif]     = useState(false)
  const [succes, setSucces]   = useState(false)
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    get<ConfigReception>(`/production/config/${siteId}`)
      .then(cfg => { setConfig(cfg); setChargement(false) })
  }, [siteId])

  const listeSN = config.champsReceptionSN ?? defaultsSN()

  function toggleSN(key: string) {
    const next = listeSN.includes(key) ? listeSN.filter(k => k !== key) : [...listeSN, key]
    setConfig(c => ({ ...c, champsReceptionSN: next }))
    setModif(true)
  }

  async function save() {
    await put(`/production/config/${siteId}`, { champsReceptionSN: listeSN })
    setModif(false)
    setSucces(true)
    setTimeout(() => setSucces(false), 2000)
  }

  if (!isAdmin) return <div className="card" style={{ padding: '32px', color: '#9ca3af' }}>Accès refusé.</div>

  return (
    <div>
      {!embedded && (
        <div className="page-header">
          <div>
            <h1 className="page-title">Structure inventaire</h1>
            <p className="page-subtitle">Colonnes fixes de la base inventaire</p>
          </div>
        </div>
      )}

      {succes && (
        <div style={{ background: '#052e16', border: '1px solid #16a34a', borderRadius: '8px', padding: '10px 16px', color: '#4ade80', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Check size={15} /> Configuration sauvegardée.
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Cochez les colonnes à afficher dans le formulaire de réception (S/N ou quantité).
          </p>
          {modif && (
            <button className="btn btn-primary" onClick={save} style={{ flexShrink: 0 }}>
              <Check size={14} /> Enregistrer
            </button>
          )}
        </div>

        {chargement ? (
          <div className="loading-container" style={{ minHeight: '120px' }}><div className="loading-spinner" /></div>
        ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Colonne</th>
                <th>Label</th>
                <th>Type</th>
                <th style={{ textAlign: 'center' }}>Réception S/N</th>
              </tr>
            </thead>
            <tbody>
              {COLONNES_CONFIGURABLES.map(c => (
                <tr key={c.key}>
                  <td><code style={{ fontSize: '12px', background: '#1e3a5f', padding: '2px 6px', borderRadius: '4px', color: '#60a5fa' }}>{c.key}</code></td>
                  <td style={{ fontWeight: 500 }}>{c.label}</td>
                  <td><span style={{ fontSize: '12px', color: '#6b7280' }}>{c.type === 'date' ? 'Date' : 'Texte'}</span></td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox"
                      checked={listeSN.includes(c.key)}
                      onChange={() => toggleSN(c.key)}
                      style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#3b82f6' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  )
}
