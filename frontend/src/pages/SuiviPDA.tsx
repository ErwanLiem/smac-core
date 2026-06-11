import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Package, Check } from 'lucide-react'
import { get } from '../api/client'
import { inventaireApi } from '../api/inventaire'
import ExportExcelButton, { type ExportColumn } from '../components/ExportExcelButton'
import { getSiteId } from '../utils/permissions'

interface Semaine { numero: number; label: string }

interface LignePDA {
  articleId: number
  inventaireId: number | null
  reference: string
  location: string
  additionalReference: string
  wording: string
  range: string
  stockQty: number
  hebdo: Record<number, number>
  transfer: number
  monthlyConsumption: number
  supply: number
}

interface SuiviPDAData {
  annee: number
  mois: number
  estMoisCourant: boolean
  semaines: Semaine[]
  champTransferId: number
  champEmplacementId: number | null
  rows: LignePDA[]
}

const MOIS_COURANT = (() => {
  const now = new Date()
  return { annee: now.getFullYear(), mois: now.getMonth() + 1 }
})()

export default function SuiviPDA() {
  const siteId = getSiteId()
  const [periode, setPeriode] = useState(MOIS_COURANT)
  const [data, setData] = useState<SuiviPDAData | null>(null)
  const [chargement, setChargement] = useState(true)
  const [transferts, setTransferts] = useState<Record<number, string>>({})
  const [emplacements, setEmplacements] = useState<Record<number, string>>({})
  const [emplacementsEnregistres, setEmplacementsEnregistres] = useState<Record<number, string>>({})

  useEffect(() => { reload() }, [siteId, periode])

  async function reload() {
    setChargement(true)
    try {
      const d = await get<SuiviPDAData>(`/production/suivi-pda/${siteId}?annee=${periode.annee}&mois=${periode.mois}`)
      setData(d)
      const init: Record<number, string> = {}
      const initEmpl: Record<number, string> = {}
      for (const row of d.rows) if (row.inventaireId) {
        init[row.inventaireId] = String(row.transfer)
        initEmpl[row.inventaireId] = row.location
      }
      setTransferts(init)
      setEmplacements(initEmpl)
      setEmplacementsEnregistres(initEmpl)
    } finally {
      setChargement(false)
    }
  }

  async function validerTransfer(inventaireId: number) {
    if (!data) return
    const valeur = transferts[inventaireId] ?? '0'
    await inventaireApi.updateValeurChamp(inventaireId, data.champTransferId, valeur)
  }

  async function validerEmplacement(inventaireId: number) {
    if (!data || !data.champEmplacementId) return
    const valeur = emplacements[inventaireId] ?? ''
    await inventaireApi.updateValeurChamp(inventaireId, data.champEmplacementId, valeur)
    setEmplacementsEnregistres(f => ({ ...f, [inventaireId]: valeur }))
  }

  function annulerEmplacement(inventaireId: number) {
    setEmplacements(f => ({ ...f, [inventaireId]: emplacementsEnregistres[inventaireId] ?? '' }))
  }

  function moisPrecedent() {
    setPeriode(p => p.mois === 1 ? { annee: p.annee - 1, mois: 12 } : { annee: p.annee, mois: p.mois - 1 })
  }

  function moisSuivant() {
    setPeriode(p => p.mois === 12 ? { annee: p.annee + 1, mois: 1 } : { annee: p.annee, mois: p.mois + 1 })
  }

  const moisLabel = (() => {
    const label = new Date(periode.annee, periode.mois - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  })()

  const estMoisCourant = data?.estMoisCourant ?? (periode.annee === MOIS_COURANT.annee && periode.mois === MOIS_COURANT.mois)

  // Colonnes proposées pour l'export Excel
  const colonnesExport: ExportColumn[] = [
    { key: 'reference', label: 'Reference' },
    { key: 'location', label: 'Code Stock Location' },
    { key: 'additionalReference', label: 'Additional references' },
    { key: 'wording', label: 'Wording' },
    { key: 'range', label: 'Range' },
    { key: 'stockQty', label: 'Stock QTY' },
    ...(data?.semaines.map(s => ({ key: `s${s.numero}`, label: s.label })) ?? []),
    { key: 'transfer', label: 'Transfer' },
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
      case 'location': return row.inventaireId ? (emplacements[row.inventaireId] ?? row.location) : row.location
      case 'additionalReference': return row.additionalReference
      case 'wording': return row.wording
      case 'range': return row.range
      case 'stockQty': return row.stockQty
      case 'transfer': return row.inventaireId ? Number(transferts[row.inventaireId] ?? row.transfer ?? 0) : row.transfer
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
                <th>Code Stock Location</th>
                <th>Additional references</th>
                <th>Wording</th>
                <th>Range</th>
                <th style={{ textAlign: 'center' }}>Stock QTY</th>
                {data.semaines.map(s => (
                  <th key={s.numero} style={{ textAlign: 'center' }}>{s.label}</th>
                ))}
                <th style={{ textAlign: 'center' }}>Transfer</th>
                <th style={{ textAlign: 'center' }}>Monthly consumption</th>
                <th style={{ textAlign: 'center' }}>Supply</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map(row => (
                <tr key={row.articleId}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.reference || '—'}</td>
                  <td>
                    {row.inventaireId && data.champEmplacementId ? (() => {
                      const id = row.inventaireId!
                      const valeur = emplacements[id] ?? ''
                      const modifie = valeur !== (emplacementsEnregistres[id] ?? '')
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="text"
                            className="form-input"
                            style={{ minWidth: '90px', padding: '4px 6px' }}
                            value={valeur}
                            onChange={e => setEmplacements(f => ({ ...f, [id]: e.target.value }))}
                            onKeyDown={async e => {
                              if (e.key === 'Enter') {
                                const target = e.target as HTMLInputElement
                                await validerEmplacement(id)
                                target.blur()
                              } else if (e.key === 'Escape') {
                                annulerEmplacement(id)
                                ;(e.target as HTMLInputElement).blur()
                              }
                            }}
                            onBlur={() => annulerEmplacement(id)}
                          />
                          {modifie && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-icon"
                              title="Valider l'emplacement"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => validerEmplacement(id)}
                              style={{ padding: '4px', flexShrink: 0 }}
                            >
                              <Check size={14} />
                            </button>
                          )}
                        </div>
                      )
                    })() : (row.location || '—')}
                  </td>
                  <td>{row.additionalReference || '—'}</td>
                  <td>{row.wording || '—'}</td>
                  <td>{row.range || '—'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#60a5fa' }}>{row.stockQty}</td>
                  {data.semaines.map(s => (
                    <td key={s.numero} style={{ textAlign: 'center' }}>{row.hebdo[s.numero] || 0}</td>
                  ))}
                  <td style={{ textAlign: 'center' }}>
                    {row.inventaireId ? (
                      <input
                        type="number"
                        className="form-input"
                        style={{ width: '70px', textAlign: 'center', padding: '4px 6px' }}
                        value={transferts[row.inventaireId] ?? '0'}
                        onChange={e => setTransferts(f => ({ ...f, [row.inventaireId!]: e.target.value }))}
                        onBlur={() => validerTransfer(row.inventaireId!)}
                      />
                    ) : '—'}
                  </td>
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
