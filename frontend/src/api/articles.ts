import { get, post } from './client'
import type { Article } from '../types'

export const articlesApi = {
  getArticles: (siteId: number, statut?: string) =>
    get<Article[]>(`/articles/${siteId}${statut ? `?statut=${statut}` : ''}`),
  getArticle: (id: number) => get<Article>(`/articles/detail/${id}`),
  createArticle: (siteId: number, data: Partial<Article>) => post<Article>(`/articles/${siteId}`, data),
  changerStatut: (id: number, transitionId: number, commentaire?: string) =>
    post<Article>(`/articles/${id}/transition`, { transitionId, commentaire })
}
