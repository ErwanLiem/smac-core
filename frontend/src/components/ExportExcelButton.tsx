import { useEffect, useRef, useState } from 'react'
import { FileDown } from 'lucide-react'
import * as XLSX from 'xlsx'

export interface ExportColumn {
  key: string
  label: string
}

interface Props {
  columns: ExportColumn[]
  rows: any[]
  getValue: (row: any, key: string) => string | number
  filename: string
  sheetName?: string
}

// Bouton "Exporter Excel" avec sélection des colonnes à inclure (toutes par défaut)
export default function ExportExcelButton({ columns, rows, getValue, filename, sheetName = 'Export' }: Props) {
  const [open, setOpen] = useState(false)
  const [exclues, setExclues] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function toggle(key: string) {
    setExclues(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const colonnesSelectionnees = columns.filter(c => !exclues.has(c.key))

  function exporter() {
    if (colonnesSelectionnees.length === 0) return
    const entetes = colonnesSelectionnees.map(c => c.label)
    const data = rows.map(row => colonnesSelectionnees.map(c => getValue(row, c.key)))
    const ws = XLSX.utils.aoa_to_sheet([entetes, ...data])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, filename)
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(o => !o)} title="Exporter au format Excel">
        <FileDown size={14} /> Exporter
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '4px',
          background: '#1a1d27', border: '1px solid #2d3140', borderRadius: '8px',
          padding: '8px', zIndex: 20, minWidth: '220px', maxWidth: '280px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '2px 6px 8px', borderBottom: '1px solid #2d3140', marginBottom: '6px' }}>
            <button type="button" onClick={() => setExclues(new Set())} style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '12px', cursor: 'pointer', padding: 0 }}>
              Tout sélectionner
            </button>
            <button type="button" onClick={() => setExclues(new Set(columns.map(c => c.key)))} style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '12px', cursor: 'pointer', padding: 0 }}>
              Tout désélectionner
            </button>
          </div>
          <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {columns.map(c => (
              <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', fontSize: '13px', color: '#e2e8f0', cursor: 'pointer', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={!exclues.has(c.key)} onChange={() => toggle(c.key)} />
                {c.label}
              </label>
            ))}
          </div>
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #2d3140' }}>
            <button type="button" className="btn btn-primary" style={{ width: '100%' }} disabled={colonnesSelectionnees.length === 0} onClick={exporter}>
              Exporter ({colonnesSelectionnees.length} colonne{colonnesSelectionnees.length > 1 ? 's' : ''})
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
