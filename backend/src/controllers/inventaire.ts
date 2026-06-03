import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// CHAMPS INVENTAIRE
export async function getChamps(req: Request, res: Response) {
  const { siteId } = req.params
  const champs = await prisma.champInventaire.findMany({
    where: { siteId: Number(siteId) },
    orderBy: { ordre: 'asc' }
  })
  res.json(champs)
}

export async function createChamp(req: Request, res: Response, next) {
  try {
    const { siteId } = req.params
    const { code, label, type, options, obligatoire, ordre, visibleReceptionSN, visibleReceptionQTE } = req.body
    const champ = await prisma.champInventaire.create({
      data: {
        siteId: Number(siteId),
        code,
        label,
        type: type || 'TEXT',
        options: options || null,
        obligatoire: obligatoire ?? false,
        ordre: ordre ?? 0,
        actif: true,
        visibleReceptionSN: visibleReceptionSN ?? false,
        visibleReceptionQTE: visibleReceptionQTE ?? false,
      }
    })
    res.json(champ)
  } catch (e) {
    next(e)
  }
}

export async function updateChamp(req: Request, res: Response, next) {
  try {
    const { id } = req.params
    const { label, type, options, obligatoire, ordre, actif, visibleReceptionSN, visibleReceptionQTE } = req.body
    const champ = await prisma.champInventaire.update({
      where: { id: Number(id) },
      data: {
        label,
        type,
        options: options || null,
        obligatoire,
        ordre,
        actif,
        visibleReceptionSN,
        visibleReceptionQTE,
      }
    })
    res.json(champ)
  } catch (e) {
    next(e)
  }
}

export async function deleteChamp(req: Request, res: Response, next) {
  try {
    const { id } = req.params
    await prisma.champInventaire.delete({
      where: { id: Number(id) }
    })
    res.json({ success: true })
  } catch (e) {
    next(e)
  }
}

// INVENTAIRE
export async function getAll(req: Request, res: Response) {
  const { siteId } = req.params
  const inventaires = await prisma.inventaire.findMany({
    where: { siteId: Number(siteId) },
    include: {
      article: true,
      statut: true,
      valeurs: {
        include: {
          champ: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
  res.json(inventaires)
}

export async function create(req: Request, res: Response, next) {
  try {
    const { siteId } = req.params
    const { articleId, statutId, valeurs } = req.body
    // valeurs = [{ champId, valeur }]

    const inventaire = await prisma.inventaire.create({
      data: {
        siteId: Number(siteId),
        articleId: Number(articleId),
        statutId: statutId ? Number(statutId) : null,
        valeurs: {
          create: valeurs
        }
      },
      include: {
        article: true,
        statut: true,
        valeurs: {
          include: {
            champ: true
          }
        }
      }
    })
    res.json(inventaire)
  } catch (e) {
    next(e)
  }
}

export async function update(req: Request, res: Response, next) {
  try {
    const { id } = req.params
    const { statutId, valeurs } = req.body

    // Supprimer les anciennes valeurs
    await prisma.valeurChampInventaire.deleteMany({
      where: { inventaireId: Number(id) }
    })

    // Créer les nouvelles valeurs
    const inventaire = await prisma.inventaire.update({
      where: { id: Number(id) },
      data: {
        statutId: statutId ? Number(statutId) : null,
        valeurs: {
          create: valeurs
        }
      },
      include: {
        article: true,
        statut: true,
        valeurs: {
          include: {
            champ: true
          }
        }
      }
    })
    res.json(inventaire)
  } catch (e) {
    next(e)
  }
}

export async function remove(req: Request, res: Response, next) {
  try {
    const { id } = req.params
    await prisma.inventaire.delete({
      where: { id: Number(id) }
    })
    res.json({ success: true })
  } catch (e) {
    next(e)
  }
}
