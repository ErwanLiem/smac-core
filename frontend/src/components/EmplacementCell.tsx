import { Check } from 'lucide-react'

interface EmplacementCellProps {
  valeur: string
  modifie: boolean
  onChange: (valeur: string) => void
  onValider: () => void | Promise<void>
  onAnnuler: () => void
}

// Cellule "Code Stock Location" éditable (Suivi PDA / Suivi PDA Labo) :
// validation par Entrée ou bouton ✓, annulation par Échap ou perte de focus.
export default function EmplacementCell({ valeur, modifie, onChange, onValider, onAnnuler }: EmplacementCellProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <input
        type="text"
        className="form-input"
        style={{ minWidth: '90px', padding: '4px 6px' }}
        value={valeur}
        onChange={e => onChange(e.target.value)}
        onKeyDown={async e => {
          if (e.key === 'Enter') {
            const target = e.target as HTMLInputElement
            await onValider()
            target.blur()
          } else if (e.key === 'Escape') {
            onAnnuler()
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        onBlur={onAnnuler}
      />
      {modifie && (
        <button
          type="button"
          className="btn btn-secondary btn-icon"
          title="Valider l'emplacement"
          onMouseDown={e => e.preventDefault()}
          onClick={onValider}
          style={{ padding: '4px', flexShrink: 0 }}
        >
          <Check size={14} />
        </button>
      )}
    </div>
  )
}
