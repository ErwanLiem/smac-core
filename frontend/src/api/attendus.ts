import { get, post, put, del } from './client'


const BASE = '/attendus'

export const attendusApi = {
  getAll:      (siteId: number) => get(`${BASE}/${siteId}`),
  getDetail:   (id: number) => get(`${BASE}/detail/${id}`),
  update:      (id: number, data: any) => put(`${BASE}/${id}`, data),
  scanner:     (id: number, sn: string) => post(`${BASE}/${id}/scanner`, { sn }),
  updateLigne: (id: number, data: any) => put(`${BASE}/ligne/${id}`, data),
  valider:     (id: number) => post(`${BASE}/${id}/valider`, {}),
  cloturer:    (id: number) => post(`${BASE}/${id}/cloturer`, {}),
  rapport:     (id: number) => get(`${BASE}/${id}/rapport`),
  delete:      (id: number) => del(`${BASE}/${id}`),
  descanner:   (id: number) => post(`${BASE}/ligne/${id}/descanner`, {}),

  importExcel: async (siteId: number, file: File, rma: string, bt: string, client: string, dateCreationRMA?: string) => {
    const token = localStorage.getItem('token')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('rma', rma)
    formData.append('bt', bt)
    formData.append('client', client)
    if (dateCreationRMA) formData.append('dateCreationRMA', dateCreationRMA)
    const res = await fetch(`/api/attendus/${siteId}/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }
}
