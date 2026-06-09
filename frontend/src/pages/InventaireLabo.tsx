import { useEffect, useMemo, useState } from 'react'
import { Package } from 'lucide-react'
import { get } from '../api/client'

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

interface ChampInfo {
  id: number
  code: string
  label: string
  ordre: number
}

interface ValeurChamp {
  id: number
  champId: number
  valeur: string
  champ: ChampInfo
}

interface InventaireLaboItem {
  id: number
  articleId: number
  quantite: number
  updatedAt: string
  article: { id: number; valeurs: ValeurChamp[] }
}

interface Config {
  colonnesLabo: string[] | null
}

export default function InventaireLabo() {
  const siteId = getSiteId()
  const [items, setItems] = useState<InventaireLaboItem[]>([])
  const [colonnesConfig, setColonnesConfig] = useState<string[] | null>(null) // null = toutes
  const [chargement, setChargement] = useState(true)

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    const [data, cfg] = await Promise.all([
      get<InventaireLaboItem[]>(`/production/inventaire-labo/${siteId}`),
      get<Config>(`/production/config/${siteId}`)
    ])
    setItems(data)
    setColonnesConfig(cfg.colonnesLabo ?? null)
    setChargement(false)
  }

  // Dériver toutes les colonnes disponibles depuis les données
  const tousLesChamps = useMemo<ChampInfo[]>(() => {
    const map = new Map<number, ChampInfo>()
    for (const item of items) {
      for (const v of item.article.valeurs) {
        if (v.champ && !map.has(v.champ.id)) {
          map.set(v.champ.id, v.champ)
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
  }, [items])

  // Colonnes affichées selon la config admin (null = toutes)
  const champsAffiches = useMemo<ChampInfo[]>(() => {
    if (!colonnesConfig || colonnesConfig.length === 0) return tousLesChamps
    return tousLesChamps.filter(c => colonnesConfig.includes(c.code))
  }, [tousLesChamps, colonnesConfig])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventaire labo</h1>
          <p className="page-subtitle">Stock d'articles disponibles en production</p>
        </div>
        {!chargement && colonnesConfig && colonnesConfig.length > 0 && (
          <span style={{ fontSize: '11px', color: '#6b7280', background: '#1a1d27', border: '1px solid #2d3148', borderRadius: '6px', padding: '4px 10px' }}>
            {colonnesConfig.length} colonne{colonnesConfig.length > 1 ? 's' : ''} configurée{colonnesConfig.length > 1 ? 's' : ''} — modifiable dans Admin → Données → Inventaire
          </span>
        )}
      </div>

      {chargement ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '56px', color: '#6b7280' }}>
          <Package size={36} style={{ marginBottom: '14px', color: '#374151' }} />
          <p style={{ fontWeight: 500, fontSize: '15px' }}>Inventaire labo vide</p>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>Les transferts quantité validés depuis la section Attente transfert apparaîtront ici.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                {champsAffiches.map(c => <th key={c.id}>{c.label}</th>)}
                <th style={{ textAlign: 'center' }}>Quantité en stock</th>
                <th>Dernière mise à jour</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  {champsAffiches.map(c => {
                    const val = item.article.valeurs.find(v => v.champ?.id === c.id)?.valeur
                    return <td key={c.id} style={{ fontSize: '13px' }}>{val || <span style={{ color: '#4b5563' }}>—</span>}</td>
                  })}
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '16px', color: item.quantite > 0 ? '#60a5fa' : '#6b7280' }}>
                      {item.quantite}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: '#6b7280' }}>
                    {new Date(item.updatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
