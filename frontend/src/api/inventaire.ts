import { get, post, put, del } from './client'

export const inventaireApi = {
  // Champs
  getChamps: (siteId: number) => get(`/api/inventaire/${siteId}/champs`),
  createChamp: (siteId: number, data: any) => post(`/api/inventaire/${siteId}/champs`, data),
  updateChamp: (id: number, data: any) => put(`/api/inventaire/champs/${id}`, data),
  deleteChamp: (id: number) => del(`/api/inventaire/champs/${id}`),

  // Inventaire
  getAll: (siteId: number) => get(`/api/inventaire/${siteId}`),
  create: (siteId: number, data: any) => post(`/api/inventaire/${siteId}`, data),
  update: (id: number, data: any) => put(`/api/inventaire/${id}`, data),
  delete: (id: number) => del(`/api/inventaire/${id}`)
}
