import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function getArticles(req: Request, res: Response) {
  const { statut } = req.query
  const articles = await prisma.article.findMany({
    where: {
      siteId: Number(req.params.siteId),
      ...(statut ? { statut: { code: String(statut) } } : {})
    },
    include: { statut: true },
    orderBy: { updatedAt: 'desc' }
  })
  res.json(articles)
}

export async function getArticleById(req: Request, res: Response) {
  const article = await prisma.article.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      statut: true,
      historique: { include: { statut: true }, orderBy: { createdAt: 'desc' } }
    }
  })
  if (!article) return res.status(404).json({ error: 'Article non trouvé' })
  res.json(article)
}

export async function createArticle(req: Request, res: Response) {
  const { reference, designation, serialNumber, statutId, metadata } = req.body
  const article = await prisma.article.create({
    data: { siteId: Number(req.params.siteId), reference, designation, serialNumber, statutId, metadata },
    include: { statut: true }
  })
  res.status(201).json(article)
}

export async function changerStatut(req: Request, res: Response) {
  const { transitionId, commentaire, userId } = req.body
  const articleId = Number(req.params.id)

  const transition = await prisma.transition.findUnique({ where: { id: transitionId } })
  if (!transition) return res.status(404).json({ error: 'Transition non trouvée' })

  const article = await prisma.article.findUnique({ where: { id: articleId } })
  if (!article) return res.status(404).json({ error: 'Article non trouvé' })

  if (article.statutId !== transition.statutFromId) {
    return res.status(400).json({ error: 'Transition non applicable depuis le statut actuel' })
  }

  const [updated] = await prisma.$transaction([
    prisma.article.update({
      where: { id: articleId },
      data: { statutId: transition.statutToId },
      include: { statut: true }
    }),
    prisma.historiqueStatut.create({
      data: { articleId, statutId: transition.statutToId, commentaire, userId }
    })
  ])

  res.json(updated)
}
