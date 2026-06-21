import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Package, Plus, Check } from 'lucide-react'
import { get, post } from '../api/client'
import ExportExcelButton, { type ExportColumn } from '../components/ExportExcelButton'
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
  reference: string
  additionalReference: string
  wording: string
  range: string
  stockQty: number
  hebdo: Record<number, number>
  monthlyConsumption: number
  supply: number
}

interface ColonnesSuivi {
  reference: string
  additionalReference: string
  wording: string
  range: string
}

interface SuiviPDALaboData {
  annee: number
  mois: number
  estMoisCourant: boolean
  semaines: Semaine[]
  colonnes: ColonnesSuivi
  rows: LignePDALabo[]
}

export default function SuiviPDALabo() {
  const siteId = getSiteId()
  const [data, setData] = useState<SuiviPDALaboData | null>(null)
  const [chargement, setChargement] = useState(true)
  const [filtres, setFiltres] = useState({ reference: '', additionalReference: '', wording: '', range: '' })
  const [articles, setArticles] = useState<Article[]>([])
  const [stockLogistique, setStockLogistique] = useState<Record<number, number>>({})
  const [showQTE, setShowQTE] = useState(false)
  const [formQTE, setFormQTE] = useState({ articleId: 0, quantite: 1, datePlanifiee: new Date().toISOString().split('T')[0] })
  const [erreurQTE, setErreurQTE] = useState('')
  const [articleSearch, setArticleSearch] = useState('')
  const [articleDropdownOpen, setArticleDropdownOpen] = useState(false)
  const [articleDropdownIndex, setArticleDropdownIndex] = useState(0)
  const { periode, moisPrecedent, moisSuivant, moisLabel, estMoisCourant } = usePeriodeMensuelle(data?.estMoisCourant)

  useEffect(() => {
    document.querySelector('.main-content')?.classList.add('page-table')
    return () => { document.querySelector('.main-content')?.classList.remove('page-table') }
  }, [])

  useEffect(() => { reload() }, [siteId, periode])

  useEffect(() => { reloadStockLogistique() }, [siteId])

  async function reload() {
    setChargement(true)
    try {
      const d = await get<SuiviPDALaboData>(`/production/suivi-pda-labo/${siteId}?annee=${periode.annee}&mois=${periode.mois}`)
      setData(d)
    } finally {
      setChargement(false)
    }
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

  const articlesFiltrés = (() => {
    const q = articleSearch.toLowerCase().trim()
    if (!q) return articles.slice(0, 60)
    return articles.filter(a => getArticleOptionLabel(a).toLowerCase().includes(q)).slice(0, 60)
  })()

  function selectArticle(id: number) {
    setFormQTE(f => ({ ...f, articleId: id }))
    setArticleSearch('')
    setArticleDropdownOpen(false)
    setArticleDropdownIndex(0)
    setErreurQTE('')
  }

  function clearArticle() {
    setFormQTE(f => ({ ...f, articleId: 0 }))
    setArticleSearch('')
    setArticleDropdownOpen(false)
    setArticleDropdownIndex(0)
  }

  async function handleQTE(e: React.FormEvent) {
    e.preventDefault()
    setErreurQTE('')
    try {
      await post(`/production/demandes/${siteId}/qte`, formQTE)
      setFormQTE({ articleId: 0, quantite: 1, datePlanifiee: new Date().toISOString().split('T')[0] })
      setArticleSearch('')
      setShowQTE(false)
      reload()
      window.dispatchEvent(new Event('transferts-en-attente:changed'))
    } catch (err: any) {
      setErreurQTE(err.message ?? 'Erreur lors de la création')
    }
  }

  const col = data?.colonnes ?? { reference: 'Référence', additionalReference: 'Réf. additionnelle', wording: 'Désignation', range: 'Famille' }

  const rowsFiltres = (data?.rows ?? []).filter(row =>
    row.reference.toLowerCase().includes(filtres.reference.toLowerCase()) &&
    row.additionalReference.toLowerCase().includes(filtres.additionalReference.toLowerCase()) &&
    row.wording.toLowerCase().includes(filtres.wording.toLowerCase()) &&
    row.range.toLowerCase().includes(filtres.range.toLowerCase())
  )
  const hasFiltres = Object.values(filtres).some(v => v !== '')

  const colonnesExport: ExportColumn[] = [
    { key: 'reference',           label: col.reference },
    { key: 'additionalReference', label: col.additionalReference },
    { key: 'wording',             label: col.wording },
    { key: 'range',               label: col.range },
    { key: 'stockQty',            label: 'Stock Qté' },
    ...(data?.semaines.map(s => ({ key: `s${s.numero}`, label: s.label })) ?? []),
    { key: 'monthlyConsumption',  label: 'Consommation mensuelle' },
    { key: 'supply',              label: 'Approvisionnement' }
  ]

  function valeurExport(row: LignePDALabo, key: string): string | number {
    if (key.startsWith('s')) return row.hebdo[Number(key.slice(1))] || 0
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

  const inputFiltreStyle: React.CSSProperties = {
    fontSize: '12px', padding: '3px 6px', width: '100%', background: '#0f1117',
    border: '1px solid #2d3148', borderRadius: '4px', color: '#f1f5f9',
    outline: 'none', boxSizing: 'border-box', marginTop: '5px', fontWeight: 400,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header" style={{ flexShrink: 0 }}>
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
          {hasFiltres && (
            <button className="btn btn-secondary" style={{ fontSize: '12px' }}
              onClick={() => setFiltres({ reference: '', additionalReference: '', wording: '', range: '' })}>
              × Effacer filtres
            </button>
          )}
          {hasFiltres && data && (
            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              {rowsFiltres.length} / {data.rows.length} article{data.rows.length !== 1 ? 's' : ''}
            </span>
          )}
          {data && data.rows.length > 0 && (
            <ExportExcelButton
              columns={colonnesExport}
              rows={rowsFiltres}
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
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ verticalAlign: 'top' }}>
                  {col.reference}
                  <input style={inputFiltreStyle} placeholder="Filtrer…" value={filtres.reference}
                    onChange={e => setFiltres(f => ({ ...f, reference: e.target.value }))} />
                </th>
                <th style={{ verticalAlign: 'top' }}>
                  {col.additionalReference}
                  <input style={inputFiltreStyle} placeholder="Filtrer…" value={filtres.additionalReference}
                    onChange={e => setFiltres(f => ({ ...f, additionalReference: e.target.value }))} />
                </th>
                <th style={{ verticalAlign: 'top' }}>
                  {col.wording}
                  <input style={inputFiltreStyle} placeholder="Filtrer…" value={filtres.wording}
                    onChange={e => setFiltres(f => ({ ...f, wording: e.target.value }))} />
                </th>
                <th style={{ verticalAlign: 'top' }}>
                  {col.range}
                  <input style={inputFiltreStyle} placeholder="Filtrer…" value={filtres.range}
                    onChange={e => setFiltres(f => ({ ...f, range: e.target.value }))} />
                </th>
                <th style={{ textAlign: 'center' }}>Stock Qté</th>
                {data.semaines.map(s => (
                  <th key={s.numero} style={{ textAlign: 'center' }}>{s.label}</th>
                ))}
                <th style={{ textAlign: 'center' }}>Consommation</th>
                <th style={{ textAlign: 'center' }}>Appro.</th>
              </tr>
            </thead>
            <tbody>
              {rowsFiltres.map(row => (
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
                  {formQTE.articleId > 0 && !articleDropdownOpen ? (
                    <div className="form-input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'default' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {getArticleOptionLabel(articles.find(a => a.id === formQTE.articleId)!)}
                      </span>
                      <button type="button" onClick={clearArticle}
                        style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 0 0 8px', flexShrink: 0 }}>
                        ×
                      </button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input
                        className="form-input"
                        placeholder="Rechercher par désignation, P/N…"
                        value={articleSearch}
                        autoComplete="off"
                        autoFocus={showQTE}
                        onChange={e => { setArticleSearch(e.target.value); setArticleDropdownOpen(true); setArticleDropdownIndex(0) }}
                        onFocus={() => setArticleDropdownOpen(true)}
                        onKeyDown={e => {
                          if (e.key === 'ArrowDown') { e.preventDefault(); setArticleDropdownIndex(i => Math.min(i + 1, articlesFiltrés.length - 1)) }
                          else if (e.key === 'ArrowUp') { e.preventDefault(); setArticleDropdownIndex(i => Math.max(i - 1, 0)) }
                          else if (e.key === 'Enter') {
                            e.preventDefault()
                            const a = articlesFiltrés[articleDropdownIndex] ?? articlesFiltrés[0]
                            if (a) selectArticle(a.id)
                          } else if (e.key === 'Escape') { setArticleDropdownOpen(false) }
                        }}
                      />
                      {articleDropdownOpen && (
                        <div style={{
                          position: 'absolute', zIndex: 100, top: 'calc(100% + 4px)', left: 0, right: 0,
                          background: '#1a1d27', border: '1px solid #2d3148', borderRadius: '8px',
                          maxHeight: '220px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                        }}>
                          {articlesFiltrés.length === 0 ? (
                            <div style={{ padding: '12px 14px', color: '#6b7280', fontSize: '13px' }}>Aucun article trouvé</div>
                          ) : articlesFiltrés.map((a, idx) => (
                            <div key={a.id}
                              onMouseDown={() => selectArticle(a.id)}
                              onMouseEnter={() => setArticleDropdownIndex(idx)}
                              style={{ padding: '9px 14px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #1e2130', background: idx === articleDropdownIndex ? '#1e2130' : 'transparent' }}>
                              {getArticleOptionLabel(a)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
                <button type="button" className="btn btn-secondary" onClick={() => { setShowQTE(false); setErreurQTE(''); clearArticle() }}>Annuler</button>
                <button type="submit" className="btn btn-primary"><Check size={14} /> Créer la demande</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
