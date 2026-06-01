import { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// --- CHAMPS ARTICLE ---

export async function getChamps(req: Request, res: Response, next: NextFunction) {
  try {
    const siteId = Number(req.params.siteId)
    const champs = await prisma.champArticle.findMany({ where: { siteId }, orderBy: { ordre: 'asc' } })
    res.json(champs)
  } catch (e) { next(e) }
}

export async function createChamp(req: Request, res: Response, next: NextFunction) {
  try {
    const siteId = Number(req.params.siteId)
    const { code, label, type, options, obligatoire, ordre } = req.body
    const champ = await prisma.champArticle.create({
      data: { siteId, code, label, type: type ?? 'TEXT', options, obligatoire: obligatoire ?? false, ordre: ordre ?? 0 }
    })
    res.json(champ)
  } catch (e) { next(e) }
}

export async function updateChamp(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    const { label, type, options, obligatoire, ordre, actif } = req.body
    const champ = await prisma.champArticle.update({ where: { id }, data: { label, type, options, obligatoire, ordre, actif } })
    res.json(champ)
  } catch (e) { next(e) }
}

export async function deleteChamp(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    await prisma.valeurChamp.deleteMany({ where: { champId: id } })
    await prisma.champArticle.delete({ where: { id } })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// --- ARTICLES ---

export async function getArticles(req: Request, res: Response) {
  const siteId = Number(req.params.siteId)
  const articles = await prisma.article.findMany({
    where: { siteId },
    include: {
      statut: true,
      valeurs: { include: { champ: true } }
    },
    orderBy: { createdAt: 'desc' }
  })
  res.json(articles)
}

export async function getArticleById(req: Request, res: Response) {
  const id = Number(req.params.id)
  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      statut: true,
      valeurs: { include: { champ: true } },
      historiquestatut: { include: { statut: true }, orderBy: { createdAt: 'desc' } }
    }
  })
  if (!article) return res.status(404).json({ error: 'Article introuvable' })
  res.json(article)
}

export async function createArticle(req: Request, res: Response) {
  const siteId = Number(req.params.siteId)
  const { statutId, valeurs } = req.body
  // valeurs = [{ champId, valeur }]

  const article = await prisma.article.create({
    data: {
      siteId,
      statutId,
      valeurs: {
        create: (valeurs ?? []).map((v: { champId: number; valeur: string }) => ({
          champId: v.champId,
          valeur: v.valeur
        }))
      }
    },
    include: {
      statut: true,
      valeurs: { include: { champ: true } }
    }
  })
  res.json(article)
}

export async function updateArticle(req: Request, res: Response) {
  const id = Number(req.params.id)
  const { statutId, valeurs } = req.body

  if (valeurs) {
    for (const v of valeurs as { champId: number; valeur: string }[]) {
      await prisma.valeurChamp.upsert({
        where: { articleId_champId: { articleId: id, champId: v.champId } },
        update: { valeur: v.valeur },
        create: { articleId: id, champId: v.champId, valeur: v.valeur }
      })
    }
  }

  const article = await prisma.article.update({
    where: { id },
    data: { ...(statutId ? { statutId } : {}) },
    include: {
      statut: true,
      valeurs: { include: { champ: true } }
    }
  })
  res.json(article)
}

export async function deleteArticle(req: Request, res: Response) {
  const id = Number(req.params.id)
  await prisma.valeurChamp.deleteMany({ where: { articleId: id } })
  await prisma.historiquestatut.deleteMany({ where: { articleId: id } })
  await prisma.article.delete({ where: { id } })
  res.json({ ok: true })
}

export async function changerStatut(req: Request, res: Response) {
  const id = Number(req.params.id)
  const { transitionId, commentaire, userId } = req.body

  const transition = await prisma.transition.findUnique({ where: { id: transitionId } })
  if (!transition) return res.status(404).json({ error: 'Transition introuvable' })

  const article = await prisma.article.findUnique({ where: { id } })
  if (!article) return res.status(404).json({ error: 'Article introuvable' })

  if (article.statutId !== transition.statutFromId) {
    return res.status(400).json({ error: 'Transition non applicable depuis le statut actuel' })
  }

  const [updated] = await prisma.$transaction([
    prisma.article.update({
      where: { id },
      data: { statutId: transition.statutToId },
      include: { statut: true, valeurs: { include: { champ: true } } }
    }),
    prisma.historiquestatut.create({
      data: { articleId: id, statutId: transition.statutToId, commentaire, userId }
    })
  ])

  res.json(updated)
}
