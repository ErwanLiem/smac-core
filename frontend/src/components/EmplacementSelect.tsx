import { useEffect, useState } from 'react'
import { get } from '../api/client'
import { getSiteId } from '../utils/permissions'

interface Emplacement {
  id: number
  nom: string
  capaciteMax: number
  remplissage: number
  description?: string | null
}

interface Props {
  value: string
  onChange: (val: string) => void
  required?: boolean
  className?: string
}

function couleurRemplissage(pct: number): { bg: string; bar: string; text: string } {
  if (pct >= 100) return { bg: '#2a1818', bar: '#dc2626', text: '#dc2626' }
  if (pct >= 75)  return { bg: '#2a2118', bar: '#f59e0b', text: '#f59e0b' }
  return { bg: '#1c2a1c', bar: '#22c55e', text: '#22c55e' }
}

export default function EmplacementSelect({ value, onChange, required, className }: Props) {
  const siteId = getSiteId()
  const [emplacements, setEmplacements] = useState<Emplacement[]>([])

  useEffect(() => {
    get<Emplacement[]>(`/emplacements/${siteId}`).then(setEmplacements).catch(() => {})
  }, [siteId])

  const selected = emplacements.find(e => e.nom === value)
  const pct = selected ? Math.round((selected.remplissage / selected.capaciteMax) * 100) : 0
  const couleurs = selected ? couleurRemplissage(pct) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <select
        required={required}
        className={className ?? 'form-input'}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">— Choisir un emplacement —</option>
        {emplacements.map(e => {
          const p = Math.round((e.remplissage / e.capaciteMax) * 100)
          return (
            <option key={e.id} value={e.nom}>
              {e.nom} ({e.remplissage}/{e.capaciteMax} — {p}%)
            </option>
          )
        })}
      </select>

      {selected && couleurs && (
        <div style={{ background: couleurs.bg, borderRadius: '4px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, background: '#374151', borderRadius: '3px', height: '6px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(pct, 100)}%`,
              background: couleurs.bar,
              borderRadius: '3px',
              transition: 'width 0.3s'
            }} />
          </div>
          <span style={{ fontSize: '11px', color: couleurs.text, whiteSpace: 'nowrap', fontWeight: 600 }}>
            {selected.remplissage}/{selected.capaciteMax}
            {pct > 100 && <span style={{ marginLeft: '4px' }}>⚠ +{selected.remplissage - selected.capaciteMax}</span>}
          </span>
        </div>
      )}
    </div>
  )
}
