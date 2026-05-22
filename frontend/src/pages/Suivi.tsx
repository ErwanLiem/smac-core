import { useEffect, useState } from 'react'
import { articlesApi } from '../api/articles'
import { workflowApi } from '../api/workflow'
import type { Article, Transition } from '../types'

// Récupère le siteId depuis le token stocké (provisoire)
function getSiteId(): number {
  const raw = localStorage.getItem('utilisateur')
  if (!raw) return 1
  return JSON.parse(raw)?.site?.id ?? 1
}

export default function Suivi() {
  const siteId = getSiteId()
  const [articles, setArticles] = useState<Article[]>([])
  const [transitions, setTransitions] = useState<Transition[]>([])

  useEffect(() => {
    articlesApi.getArticles(siteId).then(setArticles)
    workflowApi.getTransitions(siteId).then(setTransitions)
  }, [siteId])

  async function handleTransition(article: Article, transitionId: number) {
    const updated = await articlesApi.changerStatut(article.id, transitionId)
    setArticles(prev => prev.map(a => a.id === updated.id ? updated : a))
  }

  function getTransitionsDisponibles(article: Article) {
    return transitions.filter(t => t.statutFromId === article.statutId)
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Suivi articles</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1.5rem' }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={th}>Référence</th>
            <th style={th}>Désignation</th>
            <th style={th}>N° Série</th>
            <th style={th}>Statut</th>
            <th style={th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {articles.map(article => (
            <tr key={article.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={td}>{article.reference}</td>
              <td style={td}>{article.designation}</td>
              <td style={td}>{article.serialNumber ?? '—'}</td>
              <td style={td}>
                <span style={{
                  background: article.statut.couleur,
                  color: '#fff',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  fontSize: '0.8rem'
                }}>
                  {article.statut.label}
                </span>
              </td>
              <td style={td}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {getTransitionsDisponibles(article).map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleTransition(article, t.id)}
                      style={{
                        background: t.couleurBouton,
                        color: '#fff',
                        border: 'none',
                        padding: '0.3rem 0.75rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      {t.labelBouton}
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
          {articles.length === 0 && (
            <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#9ca3af' }}>Aucun article</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

const th: React.CSSProperties = { padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem' }
const td: React.CSSProperties = { padding: '0.75rem 1rem', fontSize: '0.875rem' }
