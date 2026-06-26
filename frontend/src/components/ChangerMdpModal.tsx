import { useState } from 'react'
import { post } from '../api/client'

interface Props {
  onSuccess: () => void
}

export default function ChangerMdpModal({ onSuccess }: Props) {
  const [form, setForm] = useState({ ancienMdp: '', nouveauMdp: '', confirmation: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const regles = [
    { label: '10 caractères minimum', ok: form.nouveauMdp.length >= 10 },
    { label: 'Une majuscule', ok: /[A-Z]/.test(form.nouveauMdp) },
    { label: 'Une minuscule', ok: /[a-z]/.test(form.nouveauMdp) },
    { label: 'Un chiffre', ok: /\d/.test(form.nouveauMdp) },
    { label: 'Un caractère spécial (@#$%&!)', ok: /[@#$%&!]/.test(form.nouveauMdp) },
    { label: 'Confirmation identique', ok: form.nouveauMdp === form.confirmation && form.confirmation.length > 0 },
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.nouveauMdp !== form.confirmation) { setError('Les mots de passe ne correspondent pas'); return }
    setLoading(true)
    try {
      await post('/auth/changer-mdp', { ancienMdp: form.ancienMdp, nouveauMdp: form.nouveauMdp })
      // Mettre à jour le flag en local
      const raw = localStorage.getItem('utilisateur')
      if (raw) {
        const u = JSON.parse(raw)
        localStorage.setItem('utilisateur', JSON.stringify({ ...u, doitChangerMdp: false }))
      }
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors du changement de mot de passe')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div style={{ background: '#1a1d27', borderRadius: '10px', padding: '32px', maxWidth: '480px', width: '100%' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Changement de mot de passe requis</h2>
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>
          Pour des raisons de sécurité, vous devez définir un nouveau mot de passe avant de continuer.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Mot de passe actuel (provisoire)</label>
            <input type="password" required value={form.ancienMdp} onChange={e => setForm(f => ({ ...f, ancienMdp: e.target.value }))} className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label">Nouveau mot de passe</label>
            <input type="password" required value={form.nouveauMdp} onChange={e => setForm(f => ({ ...f, nouveauMdp: e.target.value }))} className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label">Confirmer le nouveau mot de passe</label>
            <input type="password" required value={form.confirmation} onChange={e => setForm(f => ({ ...f, confirmation: e.target.value }))} className="form-input" />
          </div>

          {/* Règles de sécurité */}
          <div style={{ background: '#141720', border: '1px solid #2d3148', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Règles de sécurité</p>
            {regles.map(r => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '4px', color: r.ok ? '#059669' : '#9ca3af' }}>
                <span>{r.ok ? '✓' : '○'}</span>
                <span>{r.label}</span>
              </div>
            ))}
          </div>

          {error && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || !regles.every(r => r.ok)} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: regles.every(r => r.ok) ? 1 : 0.5 }}>
            {loading ? 'Enregistrement...' : 'Définir mon mot de passe'}
          </button>
        </form>
      </div>
    </div>
  )
}
