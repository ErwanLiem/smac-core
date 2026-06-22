import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const INCLUDE_DETAIL = {
  article:     { include: { valeurs: { include: { champ: true } } } },
  plateforme:  { include: { valeurs: { include: { champ: true } } } },
  utilisateur: { select: { id: true, nom: true, prenom: true, login: true } },
} as const

export async function getAll(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const mouvements = await prisma.mouvementQTE.findMany({
      where:   { siteId: Number(siteId) },
      include: INCLUDE_DETAIL,
      orderBy: { date: 'desc' }
    })
    res.json(mouvements)
  } catch (e) { next(e) }
}

export async function create(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const { articleId, type, quantite, bl, plateformeId, commentaire, date } = req.body
    const mouvement = await prisma.mouvementQTE.create({
      data: {
        siteId:       Number(siteId),
        articleId:    Number(articleId),
        type:         type ?? 'RECEPTION',
        quantite:     Number(quantite),
        bl:           bl          || null,
        plateformeId: plateformeId ? Number(plateformeId) : null,
        commentaire:  commentaire  || null,
        date:         date ? new Date(date) : new Date(),
        userId:       (req as any).user?.id ?? null,
      },
      include: INCLUDE_DETAIL,
    })
    res.json(mouvement)
  } catch (e) { next(e) }
}

export async function remove(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    await prisma.mouvementQTE.delete({ where: { id: Number(id) } })
    res.json({ success: true })
  } catch (e) { next(e) }
}
