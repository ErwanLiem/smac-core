import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Package, Plus, Check } from 'lucide-react'
import { get, post } from '../api/client'
import { inventaireApi } from '../api/inventaire'
import ExportExcelButton, { type ExportColumn } from '../components/ExportExcelButton'
import EmplacementCell from '../components/EmplacementCell'
import { getSiteId } from '../utils/permissions'
import { usePeriodeMensuelle } from '../hooks/usePeriodeMensuelle'

const CODES_DESIG = ['DESIGNATION', 'DESIG', 'NOM', 'LIBELLE']
const CODES_PN = ['PN', 'P_N', 'PART_NUMBER', 'PART_NO']

function getArticleOptionLabel(art: Article): string {
  if (!art) return '—'
  const pn   = art.valeurs?.find((v: any) => CODES_PN.includes(v.champ?.code?.toUpperCase?.() ?? ''))?.valeur
  const desig = art.valeurs?.find((v: any) => CODES_DESIG.includes(v.champ?.code?.toUpperCase?.() ?? ''))?.valeur
  if (pn && desig) return `${pn} — ${desig}`
  if (pn)   return pn
  if (desig) return desig
  return `Article #${art.id}`
}

interface Article { id: number; valeurs: any[] }

interface Semaine { numero: number; label: string }

interface LignePDALabo {
  articleId: number
  inventaireId: number | null
  reference: string
  location: string
  additionalReference: string
  wording: string
  range: string
  stockQty: number
  hebdo: Record<number, number>
  monthlyConsumption: number
  supply: number
}

interface SuiviPDALaboData {
  annee: number
  mois: number
  estMoisCourant: boolean
  semaines: Semaine[]
  champEmplacementLaboId: number | null
  rows: LignePDALabo[]
}

export default function SuiviPDALabo() {
  const siteId = getSiteId()
  const [data, setData] = useState<SuiviPDALaboData | null>(null)
  const [chargement, setChargement] = useState(true)
  const [articles, setArticles] = useState<Article[]>([])
  const [stockLogistique, setStockLogistique] = useState<Record<number, number>>({})
  const [showQTE, setShowQTE] = useState(false)
  const [formQTE, setFormQTE] = useState({ articleId: 0, quantite: 1, datePlanifiee: new Date().toISOString().split('T')[0] })
  const [erreurQTE, setErreurQTE] = useState('')
  const [emplacements, setEmplacements] = useState<Record<number, string>>({})
  const [emplacementsEnregistres, setEmplacementsEnregistres] = useState<Record<number, string>>({})
  const { periode, moisPrecedent, moisSuivant, moisLabel, estMoisCourant } = usePeriodeMensuelle(data?.estMoisCourant)

  useEffect(() => { reload() }, [siteId, periode])

  useEffect(() => { reloadStockLogistique() }, [siteId])

  async function reload() {
    setChargement(true)
    try {
      const d = await get<SuiviPDALaboData>(`/production/suivi-pda-labo/${siteId}?annee=${periode.annee}&mois=${periode.mois}`)
      setData(d)
      const initEmpl: Record<number, string> = {}
      for (const row of d.rows) if (row.inventaireId) initEmpl[row.inventaireId] = row.location
      setEmplacements(initEmpl)
      setEmplacementsEnregistres(initEmpl)
    } finally {
      setChargement(false)
    }
  }

  async function validerEmplacement(inventaireId: number) {
    if (!data || !data.champEmplacementLaboId) return
    const valeur = emplacements[inventaireId] ?? ''
    await inventaireApi.updateValeurChamp(inventaireId, data.champEmplacementLaboId, valeur)
    setEmplacementsEnregistres(f => ({ ...f, [inventaireId]: valeur }))
  }

  function annulerEmplacement(inventaireId: number) {
    setEmplacements(f => ({ ...f, [inventaireId]: emplacementsEnregistres[inventaireId] ?? '' }))
  }

  async function reloadStockLogistique() {
    const [arts, suiviLogistique] = await Promise.all([
      get<Article[]>(`/production/articles-qte/${siteId}`),
      get<{ rows: Array<{ articleId: number; stockQty: number }> }>(`/production/suivi-pda/${siteId}`)
    ])
    setArticles(arts)
    const map: Record<number, number> = {}
    for (const row of suiviLogistique.rows) map[row.articleId] = row.stockQty
    setStockLogistique(map)
  }

  async function handleQTE(e: React.FormEvent) {
    e.preventDefault()
    setErreurQTE('')
    try {
      await post(`/production/demandes/${siteId}/qte`, formQTE)
      setFormQTE({ articleId: 0, quantite: 1, datePlanifiee: new Date().toISOString().split('T')[0] })
      setShowQTE(false)
      reload()
      window.dispatchEvent(new Event('transferts-en-attente:changed'))
    } catch (err: any) {
      setErreurQTE(err.message ?? 'Erreur lors de la création')
    }
  }

  // Colonnes proposées pour l'export Excel
  const colonnesExport: ExportColumn[] = [
    { key: 'reference', label: 'Reference' },
    { key: 'location', label: 'Code Stock Location' },
    { key: 'additionalReference', label: 'Additional references' },
    { key: 'wording', label: 'Wording' },
    { key: 'range', label: 'Range' },
    { key: 'stockQty', label: 'Stock QTY' },
    ...(data?.semaines.map(s => ({ key: `s${s.numero}`, label: s.label })) ?? []),
    { key: 'monthlyConsumption', label: 'Monthly consumption' },
    { key: 'supply', label: 'Supply' }
  ]

  function valeurExport(row: LignePDALabo, key: string): string | number {
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
      case 'monthlyConsumption': return row.monthlyConsumption
      case 'supply': return row.supply
      default: return ''
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Suivi PDA Labo</h1>
          <p className="page-subtitle">Stock et mouvements labo des articles PDA</p>
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
              filename={`suivi-pda-labo_${periode.annee}-${String(periode.mois).padStart(2, '0')}.xlsx`}
              sheetName="Suivi PDA Labo"
            />
          )}
          <button className="btn btn-primary" onClick={() => setShowQTE(true)}>
            <Plus size={15} /> Demande de transfert
          </button>
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
                <th style={{ textAlign: 'center' }}>Monthly consumption</th>
                <th style={{ textAlign: 'center' }}>Supply</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map(row => (
                <tr key={row.articleId}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{row.reference || '—'}</td>
                  <td>
                    {row.inventaireId && data.champEmplacementLaboId ? (() => {
                      const id = row.inventaireId!
                      const valeur = emplacements[id] ?? ''
                      const modifie = valeur !== (emplacementsEnregistres[id] ?? '')
                      return (
                        <EmplacementCell
                          valeur={valeur}
                          modifie={modifie}
                          onChange={v => setEmplacements(f => ({ ...f, [id]: v }))}
                          onValider={() => validerEmplacement(id)}
                          onAnnuler={() => annulerEmplacement(id)}
                        />
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
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.monthlyConsumption}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: '#4ade80' }}>{row.supply}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal demande de transfert QTE */}
      {showQTE && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1d27', borderRadius: '12px', padding: '28px', maxWidth: '400px', width: '100%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Demande de transfert quantité</h3>
            <form onSubmit={handleQTE}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Article *</label>
                  <select required className="form-input" value={formQTE.articleId} onChange={e => { setFormQTE(f => ({ ...f, articleId: Number(e.target.value) })); setErreurQTE('') }}>
                    <option value={0}>— Choisir un article —</option>
                    {articles.map(a => <option key={a.id} value={a.id}>{getArticleOptionLabel(a)}</option>)}
                  </select>
                </div>
                {formQTE.articleId > 0 && (
                  <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', color: '#9ca3af' }}>
                    Stock magasin (Suivi PDA Logistique) :{' '}
                    <span style={{ fontWeight: 700, color: (stockLogistique[formQTE.articleId] ?? 0) > 0 ? '#4ade80' : '#ef4444' }}>
                      {stockLogistique[formQTE.articleId] ?? 0}
                    </span>
                  </div>
                )}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Quantité *</label>
                  <input type="number" min={1} required className="form-input" value={formQTE.quantite} onChange={e => { setFormQTE(f => ({ ...f, quantite: Number(e.target.value) })); setErreurQTE('') }} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Date planifiée *</label>
                  <input type="date" required className="form-input" value={formQTE.datePlanifiee} onChange={e => setFormQTE(f => ({ ...f, datePlanifiee: e.target.value }))} />
                </div>
              </div>
              {erreurQTE && (
                <div style={{ background: '#1f0a0a', border: '1px solid #dc2626', borderRadius: '6px', padding: '10px 14px', color: '#ef4444', fontSize: '13px', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ⚠ {erreurQTE}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowQTE(false); setErreurQTE('') }}>Annuler</button>
                <button type="submit" className="btn btn-primary"><Check size={14} /> Créer la demande</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
