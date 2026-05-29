import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// --- CHAMPS ---

export async function getChamps(req: Request, res: Response) {
  const siteId = Number(req.params.siteId)
  const champs = await prisma.champPlateforme.findMany({ where: { siteId }, orderBy: { ordre: 'asc' } })
  res.json(champs)
}

export async function createChamp(req: Request, res: Response) {
  const siteId = Number(req.params.siteId)
  const { code, label, type, options, obligatoire, ordre } = req.body
  const champ = await prisma.champPlateforme.create({
    data: { siteId, code, label, type: type ?? 'TEXT', options, obligatoire: obligatoire ?? false, ordre: ordre ?? 0 }
  })
  res.json(champ)
}

export async function updateChamp(req: Request, res: Response) {
  const id = Number(req.params.id)
  const { label, type, options, obligatoire, ordre, actif } = req.body
  const champ = await prisma.champPlateforme.update({ where: { id }, data: { label, type, options, obligatoire, ordre, actif } })
  res.json(champ)
}

export async function deleteChamp(req: Request, res: Response) {
  const id = Number(req.params.id)
  await prisma.valeurChampPlateforme.deleteMany({ where: { champId: id } })
  await prisma.champPlateforme.delete({ where: { id } })
  res.json({ ok: true })
}

// --- PLATEFORMES ---

export async function getPlateformes(req: Request, res: Response) {
  const siteId = Number(req.params.siteId)
  const plateformes = await prisma.plateforme.findMany({
    where: { siteId },
    include: { valeurs: { include: { champ: true } } },
    orderBy: { createdAt: 'desc' }
  })
  res.json(plateformes)
}

export async function getPlateformeById(req: Request, res: Response) {
  const id = Number(req.params.id)
  const plateforme = await prisma.plateforme.findUnique({
    where: { id },
    include: { valeurs: { include: { champ: true } } }
  })
  if (!plateforme) return res.status(404).json({ error: 'Plateforme introuvable' })
  res.json(plateforme)
}

export async function createPlateforme(req: Request, res: Response) {
  const siteId = Number(req.params.siteId)
  const { valeurs } = req.body
  const plateforme = await prisma.plateforme.create({
    data: {
      siteId,
      valeurs: { create: (valeurs ?? []).map((v: { champId: number; valeur: string }) => ({ champId: v.champId, valeur: v.valeur })) }
    },
    include: { valeurs: { include: { champ: true } } }
  })
  res.json(plateforme)
}

export async function updatePlateforme(req: Request, res: Response) {
  const id = Number(req.params.id)
  const { valeurs } = req.body
  if (valeurs) {
    for (const v of valeurs as { champId: number; valeur: string }[]) {
      await prisma.valeurChampPlateforme.upsert({
        where: { plateformeId_champId: { plateformeId: id, champId: v.champId } },
        update: { valeur: v.valeur },
        create: { plateformeId: id, champId: v.champId, valeur: v.valeur }
      })
    }
  }
  const plateforme = await prisma.plateforme.update({
    where: { id },
    data: {},
    include: { valeurs: { include: { champ: true } } }
  })
  res.json(plateforme)
}

export async function deletePlateforme(req: Request, res: Response) {
  const id = Number(req.params.id)
  await prisma.valeurChampPlateforme.deleteMany({ where: { plateformeId: id } })
  await prisma.plateforme.delete({ where: { id } })
  res.json({ ok: true })
}
