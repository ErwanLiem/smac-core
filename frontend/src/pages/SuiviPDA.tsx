import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Package } from 'lucide-react'
import { get } from '../api/client'
import ExportExcelButton, { type ExportColumn } from '../components/ExportExcelButton'
import { getSiteId } from '../utils/permissions'
import { usePeriodeMensuelle } from '../hooks/usePeriodeMensuelle'

interface Semaine { numero: number; label: string }

interface LignePDA {
  articleId: number
  reference: string
  additionalReference: string
  wording: string
  range: string
  stockQty: number
  hebdo: Record<number, number>
  monthlyConsumption: number
  supply: number
}

interface SuiviPDAData {
  annee: number
  mois: number
  estMoisCourant: boolean
  semaines: Semaine[]
  rows: LignePDA[]
}

export default function SuiviPDA() {
  const siteId = getSiteId()
  const [data, setData] = useState<SuiviPDAData | null>(null)
  const [chargement, setChargement] = useState(true)
  const { periode, moisPrecedent, moisSuivant, moisLabel, estMoisCourant } = usePeriodeMensuelle(data?.estMoisCourant)

  useEffect(() => { reload() }, [siteId, periode])

  async function reload() {
    setChargement(true)
    try {
      const d = await get<SuiviPDAData>(`/production/suivi-pda/${siteId}?annee=${periode.annee}&mois=${periode.mois}`)
      setData(d)
    } finally {
      setChargement(false)
    }
  }

  // Colonnes proposées pour l'export Excel
  const colonnesExport: ExportColumn[] = [
    { key: 'reference', label: 'Reference' },
    { key: 'additionalReference', label: 'Additional references' },
    { key: 'wording', label: 'Wording' },
    { key: 'range', label: 'Range' },
    { key: 'stockQty', label: 'Stock QTY' },
    ...(data?.semaines.map(s => ({ key: `s${s.numero}`, label: s.label })) ?? []),
    { key: 'monthlyConsumption', label: 'Monthly consumption' },
    { key: 'supply', label: 'Supply' }
  ]

  function valeurExport(row: LignePDA, key: string): string | number {
    if (key.startsWith('s')) {
      const numero = Number(key.slice(1))
      return row.hebdo[numero] || 0
    }
    switch (key) {
      case 'reference': return row.reference
      case 'additionalReference': return row.additionalReference
      case 'wording': return row.wording
      case 'range': return row.range
      case 'stockQty': return row.stockQty
      case 'monthlyConsumption': return row.monthlyConsumption
      case 'supply': return row.supply
      default: return ''
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Suivi PDA</h1>
          <p className="page-subtitle">Mouvements de stock des articles PDA</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="btn btn-secondary btn-icon" onClick={moisPrecedent} title="Mois précédent">
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontWeight: 600, minWidth: '140px', textAlign: 'center' }}>{moisLabel}</span>
          <button className="btn btn-secondary btn-icon" onClick={moisSuivant} disabled={estMoisCourant} title="Mois suivant">
            <ChevronRight size={16} />
          </button>
          {data && data.rows.length > 0 && (
            <ExportExcelButton
              columns={colonnesExport}
              rows={data.rows}
              getValue={valeurExport}
              filename={`suivi-pda_${periode.annee}-${String(periode.mois).padStart(2, '0')}.xlsx`}
              sheetName="Suivi PDA"
            />
          )}
        </div>
      </div>

      {chargement ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : !data || data.rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '56px', color: '#6b7280' }}>
          <Package size={36} style={{ marginBottom: '14px', color: '#374151' }} />
          <p style={{ fontWeight: 500, fontSize: '15px' }}>Aucun article PDA configuré</p>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>Configurez les types d'articles suivis en quantité dans Configuration → Production.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Additional references</th>
                <th>Wording</th>
                <th>Range</th>
                <th style={{ textAlign: 'center' }}>Stock QTY</th>
                {data.semaines.map(s => (
                  <th key={s.numero} style={{ textAlign: 'center' }}>{s.label}</th>
                ))}
                <th style={{ textAlign: 'center' }}>Monthly consumption</th>
                <th style={{ textAlign: 'center' }}>Supply</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map(row => (
                <tr key={row.articleId}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.reference || '—'}</td>
                  <td>{row.additionalReference || '—'}</td>
                  <td>{row.wording || '—'}</td>
                  <td>{row.range || '—'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#60a5fa' }}>{row.stockQty}</td>
                  {data.semaines.map(s => (
                    <td key={s.numero} style={{ textAlign: 'center' }}>{row.hebdo[s.numero] || 0}</td>
                  ))}
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.monthlyConsumption}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: '#4ade80' }}>{row.supply}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
