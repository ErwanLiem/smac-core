import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { post } from '../api/client'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ login: '', motDePasse: '', siteSlug: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await post<{ token: string; utilisateur: unknown }>('/auth/login', form)
      localStorage.setItem('token', data.token)
      localStorage.setItem('utilisateur', JSON.stringify(data.utilisateur))
      navigate('/')
    } catch {
      setError('Identifiants invalides')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f3f4f6' }}>
      <form onSubmit={handleSubmit} style={{ background: '#fff', padding: '2rem', borderRadius: '8px', width: '320px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h1 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>SMAC Core</h1>

        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Site</label>
        <input
          value={form.siteSlug}
          onChange={e => setForm(f => ({ ...f, siteSlug: e.target.value }))}
          placeholder="ex: smac-rennes"
          required
          style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
        />

        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Login</label>
        <input
          value={form.login}
          onChange={e => setForm(f => ({ ...f, login: e.target.value }))}
          required
          style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
        />

        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Mot de passe</label>
        <input
          type="password"
          value={form.motDePasse}
          onChange={e => setForm(f => ({ ...f, motDePasse: e.target.value }))}
          required
          style={{ width: '100%', padding: '0.5rem', marginBottom: '1.5rem', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
        />

        {error && <p style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: '0.625rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem' }}
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </div>
  )
}
