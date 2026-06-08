import { useEffect, useState } from 'react'
import { Package } from 'lucide-react'
import { get } from '../api/client'

function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

interface InventaireLaboItem {
  id: number
  articleId: number
  quantite: number
  updatedAt: string
  article: { id: number; valeurs: any[] }
}

const CODES_DESIG = ['DESIGNATION', 'DESIG', 'NOM', 'LIBELLE']

function getArticleLabel(art: any): string {
  if (!art) return '—'
  const desig = art.valeurs?.find((v: any) =>
    CODES_DESIG.includes(v.champ?.code?.toUpperCase?.() ?? '')
  )?.valeur
  return desig || art.valeurs?.[0]?.valeur || `Article #${art.id}`
}

export default function InventaireLabo() {
  const siteId = getSiteId()
  const [items, setItems] = useState<InventaireLaboItem[]>([])

  useEffect(() => { reload() }, [siteId])

  async function reload() {
    const data = await get<InventaireLaboItem[]>(`/production/inventaire-labo/${siteId}`)
    setItems(data)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventaire labo</h1>
          <p className="page-subtitle">Stock d'articles à la quantité disponibles en production</p>
        </div>
      </div>

      {items.length === 0 ? (
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
                <th>Article</th>
                <th style={{ textAlign: 'center' }}>Quantité en stock</th>
                <th>Dernière mise à jour</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 500, fontSize: '13px' }}>{getArticleLabel(item.article)}</td>
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
