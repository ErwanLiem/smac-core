import { useEffect, useState } from 'react'
import { Building2, Save } from 'lucide-react'
import { get, put } from '../api/client'
import { getSiteId } from '../utils/permissions'

interface Config {
  nomSociete: string
  adresse: string
  ville: string
  codePostal: string
  pays: string
  tel: string
  email: string
  siteWeb: string
  tva: string
  capitalSocial: string
}

const EMPTY: Config = {
  nomSociete: '', adresse: '', ville: '', codePostal: '', pays: '',
  tel: '', email: '', siteWeb: '', tva: '', capitalSocial: ''
}

export default function ConfigSite() {
  const siteId = getSiteId()
  const [config, setConfig] = useState<Config>(EMPTY)
  const [chargement, setChargement] = useState(true)
  const [sauvegarde, setSauvegarde] = useState(false)
  const [succes, setSucces] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    get<Config>(`/config-site/${siteId}`)
      .then(data => setConfig({ ...EMPTY, ...data }))
      .catch(() => {})
      .finally(() => setChargement(false))
  }, [siteId])

  function champ(key: keyof Config) {
    return {
      value: config[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setConfig(c => ({ ...c, [key]: e.target.value }))
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSauvegarde(true)
    setErreur(null)
    setSucces(false)
    try {
      await put(`/config-site/${siteId}`, config)
      setSucces(true)
      setTimeout(() => setSucces(false), 3000)
    } catch (err: any) {
      setErreur(err.message || 'Erreur lors de la sauvegarde')
    } finally {
      setSauvegarde(false)
    }
  }

  if (chargement) return <div className="loading-container"><div className="loading-spinner" /></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuration société</h1>
          <p className="page-subtitle">Informations de votre société utilisées sur les bons de livraison</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '640px' }}>
        <form onSubmit={handleSave}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Building2 size={20} color="#2563eb" />
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9' }}>Informations légales</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Nom de la société *</label>
              <input className="form-input" required {...champ('nomSociete')} placeholder="ACME Corp" />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Adresse</label>
              <input className="form-input" {...champ('adresse')} placeholder="123 rue de la Paix" />
            </div>

            <div className="form-group">
              <label className="form-label">Code postal</label>
              <input className="form-input" {...champ('codePostal')} placeholder="75001" />
            </div>

            <div className="form-group">
              <label className="form-label">Ville</label>
              <input className="form-input" {...champ('ville')} placeholder="Paris" />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Pays</label>
              <input className="form-input" {...champ('pays')} placeholder="France" />
            </div>

            <div className="form-group">
              <label className="form-label">Téléphone</label>
              <input className="form-input" {...champ('tel')} placeholder="+33 1 23 45 67 89" />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" {...champ('email')} placeholder="contact@societe.fr" />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Site web</label>
              <input className="form-input" {...champ('siteWeb')} placeholder="www.societe.fr" />
            </div>

            <div className="form-group">
              <label className="form-label">N° TVA intracommunautaire</label>
              <input className="form-input" {...champ('tva')} placeholder="FR12 345678901" />
            </div>

            <div className="form-group">
              <label className="form-label">Capital social</label>
              <input className="form-input" {...champ('capitalSocial')} placeholder="10 000 €" />
            </div>
          </div>

          {erreur && (
            <div style={{ padding: '10px', background: '#3b0d0d', border: '1px solid #dc2626', borderRadius: '6px', color: '#fca5a5', fontSize: '13px', marginTop: '16px' }}>
              {erreur}
            </div>
          )}

          {succes && (
            <div style={{ padding: '10px', background: '#052e16', border: '1px solid #16a34a', borderRadius: '6px', color: '#4ade80', fontSize: '13px', marginTop: '16px' }}>
              Configuration sauvegardée avec succès.
            </div>
          )}

          <div style={{ marginTop: '20px' }}>
            <button type="submit" className="btn btn-primary" disabled={sauvegarde}>
              <Save size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              {sauvegarde ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
