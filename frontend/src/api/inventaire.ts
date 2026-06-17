import { get, post, put, del } from './client'

export const inventaireApi = {
  getAll: (siteId: number) => get(`/inventaire/${siteId}`),
  create: (siteId: number, data: any) => post(`/inventaire/${siteId}`, data),
  update: (id: number, data: any) => put(`/inventaire/${id}`, data),
  delete: (id: number) => del(`/inventaire/${id}`),
  getHistorique: (id: number) => get(`/inventaire/${id}/historique`)
}
