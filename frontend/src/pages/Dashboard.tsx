import { useEffect, useState } from 'react'
import { get } from '../api/client'
import { getSiteId } from '../utils/permissions'

function dateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function getLundi(d: Date) {
  const r = new Date(d)
  const day = r.getDay()
  const diff = day === 0 ? -6 : 1 - day
  r.setDate(r.getDate() + diff)
  r.setHours(0, 0, 0, 0)
  return r
}
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

interface StatutCount { label: string; couleur: string; count: number }
interface ClientCount { client: string; count: number }
interface ClientStatutRow { client: string; total: number; parStatut: Record<string, number> }
interface Stats {
  totalArticles: number
  nbClients: number
  parStatut: StatutCount[]
  parClient: ClientCount[]
  parClientStatut: ClientStatutRow[]
  statutsLabels: string[]
}

interface CapaciteJour {
  capacite: number
  techniciens: Array<{
    id: number
    utilisateur: { id: number; nom: string; prenom: string }
    quota: number
    quotaBase: number
    absent: boolean
  }>
}

interface Demande {
  id: number
  statut: string
  datePlanifiee: string
  quantite: number
}

const PALETTE = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#9333ea', '#0891b2', '#db2777', '#65a30d']

/** Graphique en barres horizontales simple, sans dépendance externe */
function BarChartHorizontal({ data }: { data: { label: string; value: number; couleur: string }[] }) {
  const maxVal = Math.max(1, ...data.map(d => d.value))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
            <span>{d.label}</span>
            <span style={{ fontWeight: 600 }}>{d.value}</span>
          </div>
          <div style={{ background: '#1f2937', borderRadius: '4px', height: '12px', overflow: 'hidden' }}>
            <div style={{ width: `${(d.value / maxVal) * 100}%`, height: '100%', background: d.couleur, borderRadius: '4px' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function KpiCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="card" style={{ margin: 0, padding: '16px 18px' }}>
      <div style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: '#f8fafc', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

export default function Dashboard() {
  const siteId = getSiteId()
  const [stats, setStats] = useState<Stats | null>(null)
  const [capacite, setCapacite] = useState<Record<string, CapaciteJour>>({})
  const [demandes, setDemandes] = useState<Demande[]>([])
  const [chargement, setChargement] = useState(true)

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    setChargement(true)
    try {
      const lundi = getLundi(new Date())
      const debut = dateStr(lundi)
      const fin = dateStr(addDays(lundi, 5))
      const [s, cap, dem] = await Promise.all([
        get<Stats>(`/dashboard/${siteId}/stats`),
        get<Record<string, CapaciteJour>>(`/production/capacite/${siteId}?debut=${debut}&fin=${fin}`),
        get<Demande[]>(`/production/demandes/${siteId}`)
      ])
      setStats(s)
      setCapacite(cap)
      setDemandes(dem)
    } finally {
      setChargement(false)
    }
  }

  if (chargement || !stats) {
    return <div className="loading-container"><div className="loading-spinner" /></div>
  }

  const lundi = getLundi(new Date())
  const jours = Array.from({ length: 6 }, (_, i) => addDays(lundi, i))
  const todayStr = dateStr(new Date())

  function getChargeJour(ds: string) {
    return demandes
      .filter(d => d.datePlanifiee?.startsWith(ds) && d.statut !== 'ANNULEE')
      .reduce((s, d) => s + d.quantite, 0)
  }

  const maxJour = Math.max(1, ...jours.map(j => {
    const ds = dateStr(j)
    return Math.max(capacite[ds]?.capacite ?? 0, getChargeJour(ds))
  }))

  const techsAujourdhui = capacite[todayStr]?.techniciens ?? []
  const maxQuotaTech = Math.max(1, ...techsAujourdhui.map(t => Math.max(t.quota, t.quotaBase)))

  const barsStatuts = stats.parStatut.map((s, i) => ({ label: s.label, value: s.count, couleur: s.couleur && s.couleur !== '#6b7280' ? s.couleur : PALETTE[i % PALETTE.length] }))
  const barsClients = stats.parClient.map((c, i) => ({ label: c.client, value: c.count, couleur: PALETTE[i % PALETTE.length] }))

  // Top clients + colonnes statuts (limité pour la lisibilité)
  const topClients = stats.parClientStatut.slice(0, 8)
  const colonnesStatuts = stats.statutsLabels.slice(0, 6)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-subtitle">Vue d'ensemble du site</p>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <KpiCard label="Articles en stock" value={stats.totalArticles} />
        <KpiCard label="Clients actifs" value={stats.nbClients} />
        <KpiCard label="Statuts suivis" value={stats.parStatut.length} />
        <KpiCard label="Capacité du jour" value={capacite[todayStr]?.capacite ?? 0} sub={`Planifié : ${getChargeJour(todayStr)}`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        {/* Répartition par statut */}
        <div className="card" style={{ margin: 0 }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9', marginBottom: '16px' }}>Articles par statut</h2>
          {stats.totalArticles === 0 ? (
            <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '24px' }}>Aucun article en stock</div>
          ) : (
            <BarChartHorizontal data={barsStatuts} />
          )}
        </div>

        {/* Répartition par client */}
        <div className="card" style={{ margin: 0 }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9', marginBottom: '16px' }}>Articles par client</h2>
          {barsClients.length === 0 ? (
            <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '24px' }}>Aucune donnée</div>
          ) : (
            <BarChartHorizontal data={barsClients} />
          )}
        </div>
      </div>

      {/* Charge vs capacité de production */}
      <div className="card" style={{ margin: 0, marginBottom: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9', marginBottom: '4px' }}>Production — charge vs capacité (semaine)</h2>
        <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: '#9ca3af', marginBottom: '14px' }}>
          <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: '#2563eb', marginRight: '5px', verticalAlign: 'middle' }} />Planifié</span>
          <span><span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: '#374151', marginRight: '5px', verticalAlign: 'middle' }} />Capacité</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', height: '160px' }}>
          {jours.map(j => {
            const ds = dateStr(j)
            const cap = capacite[ds]?.capacite ?? 0
            const charge = getChargeJour(ds)
            const isToday = ds === todayStr
            const surCapacite = charge > cap
            return (
              <div key={ds} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ position: 'relative', width: '100%', height: '130px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '4px' }}>
                  <div title={`Capacité : ${cap}`} style={{ width: '40%', height: `${(cap / maxJour) * 100}%`, background: '#374151', borderRadius: '3px 3px 0 0', minHeight: cap > 0 ? '2px' : 0 }} />
                  <div title={`Planifié : ${charge}`} style={{ width: '40%', height: `${(charge / maxJour) * 100}%`, background: surCapacite ? '#dc2626' : '#2563eb', borderRadius: '3px 3px 0 0', minHeight: charge > 0 ? '2px' : 0 }} />
                </div>
                <div style={{ fontSize: '12px', fontWeight: isToday ? 700 : 500, color: isToday ? '#60a5fa' : '#9ca3af', marginTop: '6px' }}>{JOURS[jours.indexOf(j)]}</div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>{charge}/{cap}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) 2fr', gap: '16px' }}>
        {/* Quota techniciens du jour */}
        <div className="card" style={{ margin: 0 }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9', marginBottom: '16px' }}>Production — quota techniciens (aujourd'hui)</h2>
          {techsAujourdhui.length === 0 ? (
            <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '24px' }}>Aucun technicien configuré</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {techsAujourdhui.map(t => (
                <div key={t.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1', marginBottom: '3px' }}>
                    <span>{t.utilisateur.prenom} {t.utilisateur.nom}{t.absent && <span style={{ color: '#f87171' }}> · absent</span>}</span>
                    <span style={{ fontWeight: 600 }}>{t.quota}</span>
                  </div>
                  <div style={{ background: '#1f2937', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                    <div style={{ width: `${(t.quota / maxQuotaTech) * 100}%`, height: '100%', background: t.absent ? '#4b5563' : '#16a34a', borderRadius: '4px' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Articles par client x statut */}
        <div className="card" style={{ margin: 0 }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9', marginBottom: '16px' }}>Détail par client × statut</h2>
          {topClients.length === 0 ? (
            <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '24px' }}>Aucune donnée</div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    {colonnesStatuts.map(label => <th key={label} style={{ textAlign: 'center' }}>{label}</th>)}
                    <th style={{ textAlign: 'center' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {topClients.map(row => (
                    <tr key={row.client}>
                      <td>{row.client}</td>
                      {colonnesStatuts.map(label => (
                        <td key={label} style={{ textAlign: 'center', color: row.parStatut[label] ? '#e2e8f0' : '#4b5563' }}>
                          {row.parStatut[label] ?? 0}
                        </td>
                      ))}
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
