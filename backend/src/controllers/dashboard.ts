import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function getStats(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)

    const inventaires = await prisma.inventaire.findMany({
      where: { siteId, archive: false },
      include: { statut: true }
    })

    const parStatutMap = new Map<string, { label: string; couleur: string; count: number }>()
    const parClientMap = new Map<string, number>()
    const parClientStatutMap = new Map<string, Map<string, number>>()

    for (const inv of inventaires) {
      const statutLabel = inv.statut?.label ?? 'Sans statut'
      const couleur     = inv.statut?.couleur ?? '#6b7280'
      const key         = inv.statut?.id != null ? String(inv.statut.id) : 'none'
      if (!parStatutMap.has(key)) parStatutMap.set(key, { label: statutLabel, couleur, count: 0 })
      parStatutMap.get(key)!.count++

      const client = inv.customer || 'Sans client'
      parClientMap.set(client, (parClientMap.get(client) ?? 0) + 1)

      if (!parClientStatutMap.has(client)) parClientStatutMap.set(client, new Map())
      const m = parClientStatutMap.get(client)!
      m.set(statutLabel, (m.get(statutLabel) ?? 0) + 1)
    }

    const parStatut = [...parStatutMap.values()].sort((a, b) => b.count - a.count)
    const parClient = [...parClientMap.entries()]
      .map(([client, count]) => ({ client, count }))
      .sort((a, b) => b.count - a.count)
    const parClientStatut = [...parClientStatutMap.entries()]
      .map(([client, m]) => ({
        client,
        total: parClientMap.get(client) ?? 0,
        parStatut: Object.fromEntries(m)
      }))
      .sort((a, b) => b.total - a.total)

    res.json({
      totalArticles: inventaires.length,
      nbClients: parClientMap.size,
      parStatut,
      parClient,
      parClientStatut,
      statutsLabels: parStatut.map(s => s.label)
    })
  } catch (e) { next(e) }
}
