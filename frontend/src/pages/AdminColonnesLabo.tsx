import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { get, put } from '../api/client'
import { getPermissions } from '../utils/permissions'

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

interface ChampArticle {
  id: number
  code: string
  label: string
  actif: boolean
}

export default function AdminColonnesLabo({ embedded }: { embedded?: boolean }) {
  const siteId = getSiteId()
  const { isAdmin } = getPermissions()
  const [champs, setChamps] = useState<ChampArticle[]>([])
  const [colonnes, setColonnes] = useState<string[] | null>(null) // null = tous
  const [modif, setModif] = useState(false)
  const [succes, setSucces] = useState(false)
  const [chargement, setChargement] = useState(true)

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    const [cfg, arts] = await Promise.all([
      get<{ colonnesLabo: string[] | null }>(`/production/config/${siteId}`),
      get<ChampArticle[]>(`/articles/${siteId}/champs`)
    ])
    setColonnes(cfg.colonnesLabo ?? null)
    setChamps(arts.filter(c => c.actif !== false))
    setModif(false)
    setChargement(false)
  }

  async function sauvegarder() {
    await put(`/production/config/${siteId}`, { colonnesLabo: colonnes })
    setModif(false)
    setSucces(true)
    setTimeout(() => setSucces(false), 2000)
  }

  function toggleColonne(code: string, checked: boolean) {
    const current = colonnes ?? []
    const next = checked ? [...current, code] : current.filter(x => x !== code)
    setColonnes(next.length > 0 ? next : null)
    setModif(true)
  }

  const content = (
    <div>
      <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '14px' }}>
        Sélectionnez les champs à afficher comme colonnes dans la page <strong style={{ color: '#e2e8f0' }}>Inventaire Labo</strong>.
        Si aucun n'est coché, tous les champs disponibles seront affichés.
      </p>

      {chargement ? (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#6b7280', fontSize: '13px' }}>
          <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> Chargement…
        </div>
      ) : champs.length === 0 ? (
        <p style={{ color: '#f59e0b', fontSize: '13px' }}>⚠ Aucun champ article configuré. Configurez-les dans l'onglet Articles.</p>
      ) : (
        <>
          {succes && (
            <div style={{ background: '#052e16', border: '1px solid #16a34a', borderRadius: '6px', padding: '8px 14px', color: '#4ade80', fontSize: '13px', marginBottom: '12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
              <Check size={14} /> Configuration enregistrée.
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            {champs.map(c => {
              const checked = colonnes ? colonnes.includes(c.code) : false
              return (
                <label key={c.code} style={{
                  display: 'flex', alignItems: 'center', gap: '6px', cursor: isAdmin ? 'pointer' : 'default',
                  padding: '5px 12px', borderRadius: '6px', fontSize: '13px', userSelect: 'none',
                  border: `1px solid ${checked ? '#16a34a' : '#374151'}`,
                  background: checked ? '#052e16' : '#141720',
                  color: checked ? '#4ade80' : '#9ca3af',
                  opacity: isAdmin ? 1 : 0.6
                }}>
                  <input type="checkbox" checked={checked} disabled={!isAdmin}
                    onChange={e => toggleColonne(c.code, e.target.checked)} />
                  {c.label}
                </label>
              )
            })}
            {colonnes && colonnes.length > 0 && isAdmin && (
              <button type="button" className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 10px' }}
                onClick={() => { setColonnes(null); setModif(true) }}>
                Tout afficher
              </button>
            )}
          </div>

          {colonnes === null && (
            <p style={{ fontSize: '11px', color: '#4b5563', fontStyle: 'italic' }}>
              Tous les champs seront affichés (aucun filtre actif).
            </p>
          )}

          {isAdmin && modif && (
            <button className="btn btn-primary" style={{ marginTop: '8px' }} onClick={sauvegarder}>
              <Check size={14} /> Enregistrer
            </button>
          )}
        </>
      )}
    </div>
  )

  if (embedded) return content

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Colonnes Inventaire Labo</h1>
          <p className="page-subtitle">Champs affichés dans la vue Inventaire Labo</p>
        </div>
      </div>
      <div className="card">{content}</div>
    </div>
  )
}
