import { useEffect, useRef, useState } from 'react'
import { Columns3 } from 'lucide-react'

interface ColonneOption {
  id: number
  label: string
}

interface Props {
  champs: ColonneOption[]
  colonnesCachees: Set<number>
  onToggle: (id: number) => void
}

export default function ColonnesToggle({ champs, colonnesCachees, onToggle }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(o => !o)} title="Afficher ou masquer des colonnes">
        <Columns3 size={14} /> Colonnes
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '4px',
          background: '#1a1d27', border: '1px solid #2d3140', borderRadius: '8px',
          padding: '8px', zIndex: 20, minWidth: '180px', maxHeight: '320px',
          overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          {champs.map(c => (
            <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer', borderRadius: '4px', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={!colonnesCachees.has(c.id)} onChange={() => onToggle(c.id)} />
              {c.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
