import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// --- CHAMPS ---

export async function getChamps(req: Request, res: Response) {
  const siteId = Number(req.params.siteId)
  const champs = await prisma.champClient.findMany({ where: { siteId }, orderBy: { ordre: 'asc' } })
  res.json(champs)
}

export async function createChamp(req: Request, res: Response) {
  const siteId = Number(req.params.siteId)
  const { code, label, type, options, obligatoire, ordre } = req.body
  const champ = await prisma.champClient.create({
    data: { siteId, code, label, type: type ?? 'TEXT', options, obligatoire: obligatoire ?? false, ordre: ordre ?? 0 }
  })
  res.json(champ)
}

export async function updateChamp(req: Request, res: Response) {
  const id = Number(req.params.id)
  const { label, type, options, obligatoire, ordre, actif } = req.body
  const champ = await prisma.champClient.update({ where: { id }, data: { label, type, options, obligatoire, ordre, actif } })
  res.json(champ)
}

export async function deleteChamp(req: Request, res: Response) {
  const id = Number(req.params.id)
  await prisma.valeurChampClient.deleteMany({ where: { champId: id } })
  await prisma.champClient.delete({ where: { id } })
  res.json({ ok: true })
}

// --- CLIENTS ---

export async function getClients(req: Request, res: Response) {
  const siteId = Number(req.params.siteId)
  const clients = await prisma.client.findMany({
    where: { siteId },
    include: { valeurs: { include: { champ: true } } },
    orderBy: { createdAt: 'desc' }
  })
  res.json(clients)
}

export async function getClientById(req: Request, res: Response) {
  const id = Number(req.params.id)
  const client = await prisma.client.findUnique({
    where: { id },
    include: { valeurs: { include: { champ: true } } }
  })
  if (!client) return res.status(404).json({ error: 'Client introuvable' })
  res.json(client)
}

export async function createClient(req: Request, res: Response) {
  const siteId = Number(req.params.siteId)
  const { valeurs } = req.body
  const client = await prisma.client.create({
    data: {
      siteId,
      valeurs: { create: (valeurs ?? []).map((v: { champId: number; valeur: string }) => ({ champId: v.champId, valeur: v.valeur })) }
    },
    include: { valeurs: { include: { champ: true } } }
  })
  res.json(client)
}

export async function updateClient(req: Request, res: Response) {
  const id = Number(req.params.id)
  const { valeurs } = req.body
  if (valeurs) {
    await Promise.all((valeurs as { champId: number; valeur: string }[]).map(v =>
      prisma.valeurChampClient.upsert({
        where: { clientId_champId: { clientId: id, champId: v.champId } },
        update: { valeur: v.valeur },
        create: { clientId: id, champId: v.champId, valeur: v.valeur }
      })
    ))
  }
  const client = await prisma.client.update({
    where: { id },
    data: {},
    include: { valeurs: { include: { champ: true } } }
  })
  res.json(client)
}

export async function deleteClient(req: Request, res: Response) {
  const id = Number(req.params.id)
  await prisma.valeurChampClient.deleteMany({ where: { clientId: id } })
  await prisma.client.delete({ where: { id } })
  res.json({ ok: true })
}
