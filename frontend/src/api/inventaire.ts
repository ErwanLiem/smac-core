import { get, post, put, del } from './client'

export const inventaireApi = {
  // Champs
  getChamps: (siteId: number) => get(`/inventaire/${siteId}/champs`),
  createChamp: (siteId: number, data: any) => post(`/inventaire/${siteId}/champs`, data),
  updateChamp: (id: number, data: any) => put(`/inventaire/champs/${id}`, data),
  deleteChamp: (id: number) => del(`/inventaire/champs/${id}`),

  // Inventaire
  getAll: (siteId: number) => get(`/inventaire/${siteId}`),
  create: (siteId: number, data: any) => post(`/inventaire/${siteId}`, data),
  update: (id: number, data: any) => put(`/inventaire/${id}`, data),
  receptionQte: (id: number, data: { champId: number; quantite: number }) => put(`/inventaire/${id}/reception-qte`, data),
  updateValeurChamp: (id: number, champId: number, valeur: string) => put(`/inventaire/${id}/champ/${champId}`, { valeur }),
  delete: (id: number) => del(`/inventaire/${id}`),
  getHistorique: (id: number) => get(`/inventaire/${id}/historique`)
}
