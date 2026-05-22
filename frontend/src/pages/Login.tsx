import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Warehouse } from 'lucide-react'
import { post } from '../api/client'

const SITE_SLUG = 'smac-vallery'

export default function Login() {
  const navigate = useNavigate()
  const [login, setLogin] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await post<{ token: string; utilisateur: unknown }>('/auth/login', {
        login,
        motDePasse,
        siteSlug: SITE_SLUG
      })
      localStorage.setItem('token', data.token as string)
      localStorage.setItem('utilisateur', JSON.stringify(data.utilisateur))
      navigate('/')
    } catch {
      setError('Identifiants incorrects')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f9fafb', padding: '16px'
    }}>
      <div style={{ maxWidth: '420px', width: '100%' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '64px', height: '64px', background: '#2563eb', borderRadius: '12px', marginBottom: '16px'
          }}>
            <Warehouse size={32} color="white" />
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>SMAC</h1>
          <p style={{ color: '#6b7280' }}>Gestion industrielle — Vallery</p>
        </div>

        {/* Formulaire */}
        <div className="card">
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px' }}>Connexion</h2>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Identifiant</label>
              <input
                value={login}
                onChange={e => setLogin(e.target.value)}
                className="form-input"
                placeholder="admin"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mot de passe</label>
              <input
                type="password"
                value={motDePasse}
                onChange={e => setMotDePasse(e.target.value)}
                className="form-input"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div style={{
                background: '#fee2e2', color: '#991b1b',
                padding: '12px 16px', borderRadius: '8px',
                fontSize: '14px', marginBottom: '16px'
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
