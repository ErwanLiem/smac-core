import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Package } from 'lucide-react'
import { get } from '../api/client'
import Tabs from '../components/Tabs'
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

interface ColonnesSuivi {
  reference: string
  additionalReference: string
  wording: string
  range: string
}

interface SuiviPDAData {
  annee: number
  mois: number
  estMoisCourant: boolean
  semaines: Semaine[]
  colonnes: ColonnesSuivi
  rows: LignePDA[]
}

interface MouvementQTE {
  id: number
  type: string
  quantite: number
  bl: string | null
  commentaire: string | null
  date: string
  article: {
    id: number
    valeurs: { valeur: string | null; champ: { code: string; label: string } }[]
  }
  plateforme: {
    id: number
    valeurs: { valeur: string | null; champ: { code: string; label: string } }[]
  } | null
  utilisateur: { nom: string; prenom: string; login: string } | null
}

const BADGE_COULEUR: Record<string, { bg: string; color: string; label: string }> = {
  RECEPTION:  { bg: '#1e3a5f', color: '#60a5fa', label: 'Réception'  },
  TRANSFERT:  { bg: '#1a2e1a', color: '#4ade80', label: 'Transfert'  },
  SORTIE:     { bg: '#3d1515', color: '#f87171', label: 'Sortie'     },
}

function getArticleLabel(art: MouvementQTE['article']): string {
  const pn   = art.valeurs.find(v => ['PN','P_N','PART_NUMBER','PART_NO'].includes(v.champ.code.toUpperCase()))?.valeur
  const desc = art.valeurs.find(v => ['DESIGNATION','DESIG','NOM','LIBELLE','DESCRIPTION'].includes(v.champ.code.toUpperCase()))?.valeur
  return [pn, desc].filter(Boolean).join(' — ') || `Article #${art.id}`
}

function getPlatLabel(p: MouvementQTE['plateforme']): string {
  if (!p) return '—'
  return p.valeurs.find(v => v.valeur)?.valeur ?? `Plateforme #${p.id}`
}

type Filtres = { reference: string; additionalReference: string; wording: string; range: string }

// ─── Onglet Suivi mensuel ──────────────────────────────────────────────────────

interface SuiviMensuelProps {
  data: SuiviPDAData | null
  chargement: boolean
  filtres: Filtres
  setFiltres: React.Dispatch<React.SetStateAction<Filtres>>
  col: ColonnesSuivi
  rowsFiltres: LignePDA[]
}

function SuiviMensuel({ data, chargement, filtres, setFiltres, col, rowsFiltres }: SuiviMensuelProps) {
  const inputFiltreStyle: React.CSSProperties = {
    fontSize: '12px', padding: '3px 6px', width: '100%', background: '#0f1117',
    border: '1px solid #2d3148', borderRadius: '4px', color: '#f1f5f9',
    outline: 'none', boxSizing: 'border-box', marginTop: '5px', fontWeight: 400,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
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
                {data.semaines.map(s => <th key={s.numero} style={{ textAlign: 'center' }}>{s.label}</th>)}
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
                  {data.semaines.map(s => <td key={s.numero} style={{ textAlign: 'center' }}>{row.hebdo[s.numero] || 0}</td>)}
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.monthlyConsumption}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: '#4ade80' }}>{row.supply}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  )
}

// ─── Onglet Historique ────────────────────────────────────────────────────────

function Historique({ siteId }: { siteId: number }) {
  const [mouvements, setMouvements] = useState<MouvementQTE[]>([])
  const [chargement, setChargement] = useState(true)
  const [filtreType, setFiltreType] = useState('')
  const [filtreArticle, setFiltreArticle] = useState('')

  useEffect(() => {
    get<MouvementQTE[]>(`/production/mouvement-qte/${siteId}`)
      .then(data => { setMouvements(data); setChargement(false) })
  }, [siteId])

  const filtrés = mouvements.filter(m => {
    if (filtreType && m.type !== filtreType) return false
    if (filtreArticle && !getArticleLabel(m.article).toLowerCase().includes(filtreArticle.toLowerCase())) return false
    return true
  })

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexShrink: 0 }}>
        <select className="form-input" style={{ maxWidth: '160px' }} value={filtreType} onChange={e => setFiltreType(e.target.value)}>
          <option value="">Tous les types</option>
          <option value="RECEPTION">Réception</option>
          <option value="TRANSFERT">Transfert</option>
          <option value="SORTIE">Sortie</option>
        </select>
        <input className="form-input" placeholder="Filtrer par article…" value={filtreArticle}
          onChange={e => setFiltreArticle(e.target.value)} style={{ maxWidth: '260px' }} />
      </div>

      {chargement ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : filtrés.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '56px', color: '#6b7280' }}>
          <Package size={36} style={{ marginBottom: '14px', color: '#374151' }} />
          <p style={{ fontWeight: 500, fontSize: '15px' }}>Aucun mouvement enregistré</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Article</th>
                <th style={{ textAlign: 'center' }}>Qté</th>
                <th>BL</th>
                <th>Plateforme</th>
                <th>Commentaire</th>
                <th>Opérateur</th>
              </tr>
            </thead>
            <tbody>
              {filtrés.map(m => {
                const badge = BADGE_COULEUR[m.type] ?? { bg: '#1e2130', color: '#9ca3af', label: m.type }
                return (
                  <tr key={m.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: '#9ca3af' }}>{formatDate(m.date)}</td>
                    <td>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{getArticleLabel(m.article)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#60a5fa' }}>{m.quantite}</td>
                    <td style={{ fontSize: '13px', fontFamily: 'monospace', color: '#9ca3af' }}>{m.bl || '—'}</td>
                    <td style={{ fontSize: '13px' }}>{getPlatLabel(m.plateforme)}</td>
                    <td style={{ fontSize: '13px', color: '#9ca3af', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.commentaire || '—'}
                    </td>
                    <td style={{ fontSize: '12px', color: '#6b7280' }}>
                      {m.utilisateur ? `${m.utilisateur.prenom} ${m.utilisateur.nom}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function SuiviPDA() {
  const siteId = getSiteId()
  const [ongletActif, setOngletActif] = useState('mensuel')
  const [data, setData] = useState<SuiviPDAData | null>(null)
  const [chargement, setChargement] = useState(true)
  const [filtres, setFiltres] = useState<Filtres>({ reference: '', additionalReference: '', wording: '', range: '' })
  const { periode, moisPrecedent, moisSuivant, moisLabel, estMoisCourant } = usePeriodeMensuelle(data?.estMoisCourant)

  useEffect(() => {
    document.querySelector('.main-content')?.classList.add('page-table')
    return () => { document.querySelector('.main-content')?.classList.remove('page-table') }
  }, [])

  useEffect(() => { reload() }, [siteId, periode])

  async function reload() {
    setChargement(true)
    try {
      const d = await get<SuiviPDAData>(`/production/suivi-pda/${siteId}?annee=${periode.annee}&mois=${periode.mois}`)
      setData(d)
    } finally { setChargement(false) }
  }

  const col: ColonnesSuivi = data?.colonnes ?? { reference: 'Référence', additionalReference: 'Réf. additionnelle', wording: 'Désignation', range: 'Famille' }

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

  function valeurExport(row: LignePDA, key: string): string | number {
    if (key.startsWith('s')) return row.hebdo[Number(key.slice(1))] || 0
    switch (key) {
      case 'reference':           return row.reference
      case 'additionalReference': return row.additionalReference
      case 'wording':             return row.wording
      case 'range':               return row.range
      case 'stockQty':            return row.stockQty
      case 'monthlyConsumption':  return row.monthlyConsumption
      case 'supply':              return row.supply
      default: return ''
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <h1 className="page-title">Suivi PDA</h1>
          <p className="page-subtitle">Mouvements de stock des articles PDA</p>
        </div>
        {ongletActif === 'mensuel' && (
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
                filename={`suivi-pda_${periode.annee}-${String(periode.mois).padStart(2, '0')}.xlsx`}
                sheetName="Suivi PDA"
              />
            )}
          </div>
        )}
      </div>

      <Tabs
        flex
        active={ongletActif}
        onChange={setOngletActif}
        tabs={[
          {
            key: 'mensuel',
            label: 'Suivi mensuel',
            content: (
              <SuiviMensuel
                data={data}
                chargement={chargement}
                filtres={filtres}
                setFiltres={setFiltres}
                col={col}
                rowsFiltres={rowsFiltres}
              />
            )
          },
          { key: 'historique', label: 'Historique mouvements', content: <Historique siteId={siteId} /> },
        ]}
      />
    </div>
  )
}
