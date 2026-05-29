import { useEffect, useState } from 'react'
import { articlesApi } from '../api/articles'
import { workflowApi } from '../api/workflow'
import type { Article, Transition } from '../types'

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
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Suivi articles</h1>
          <p className="page-subtitle">{articles.length} article{articles.length !== 1 ? 's' : ''} en cours</p>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Référence</th>
              <th>Désignation</th>
              <th>N° Série</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {articles.map(article => (
              <tr key={article.id}>
                <td style={{ fontWeight: 500 }}>{article.reference}</td>
                <td>{article.designation}</td>
                <td style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: '13px' }}>{article.serialNumber ?? '—'}</td>
                <td>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 10px',
                    borderRadius: '5px',
                    fontSize: '12px',
                    fontWeight: 500,
                    background: article.statut.couleur + '1F',
                    color: article.statut.couleur,
                    border: `1px solid ${article.statut.couleur}33`,
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: article.statut.couleur }} />
                    {article.statut.label}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {getTransitionsDisponibles(article).map(t => (
                      <button
                        key={t.id}
                        onClick={() => handleTransition(article, t.id)}
                        style={{
                          background: t.couleurBouton + '1F',
                          color: t.couleurBouton,
                          border: `1px solid ${t.couleurBouton}33`,
                          padding: '3px 10px',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 500,
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = t.couleurBouton + '30' }}
                        onMouseLeave={e => { e.currentTarget.style.background = t.couleurBouton + '1F' }}
                      >
                        {t.labelBouton}
                      </button>
                    ))}
                    {getTransitionsDisponibles(article).length === 0 && (
                      <span style={{ color: '#d1d5db', fontSize: '13px' }}>—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {articles.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>
                  Aucun article
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
