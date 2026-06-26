import { get, post, put, del } from './client'
import type { Statut, Transition } from '../types'

export const workflowApi = {
  getStatuts: (siteId: number) => get<Statut[]>(`/workflow/${siteId}/statuts`),
  createStatut: (siteId: number, data: Partial<Statut>) => post<Statut>(`/workflow/${siteId}/statuts`, data),
  updateStatut: (id: number, data: Partial<Statut>) => put<Statut>(`/workflow/statuts/${id}`, data),
  deleteStatut: (id: number) => del(`/workflow/statuts/${id}`),

  getTransitions: (siteId: number) => get<Transition[]>(`/workflow/${siteId}/transitions`),
  createTransition: (siteId: number, data: Partial<Transition>) => post<Transition>(`/workflow/${siteId}/transitions`, data),
  updateTransition: (id: number, data: Partial<Transition>) => put<Transition>(`/workflow/transitions/${id}`, data),
  deleteTransition: (id: number) => del(`/workflow/transitions/${id}`)
}
