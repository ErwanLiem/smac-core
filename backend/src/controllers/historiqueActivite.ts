import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PAGE_SIZE = 50

export async function getHistorique(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const { type, entite, userId, dateDebut, dateFin, page = '1' } = req.query

    const where: any = { siteId }
    if (type)      where.type    = String(type)
    if (entite)    where.entite  = String(entite)
    if (userId)    where.userId  = Number(userId)
    if (dateDebut || dateFin) {
      where.createdAt = {}
      if (dateDebut) where.createdAt.gte = new Date(String(dateDebut))
      if (dateFin)   where.createdAt.lte = new Date(String(dateFin) + 'T23:59:59')
    }

    const skip = (Number(page) - 1) * PAGE_SIZE

    const [total, lignes] = await Promise.all([
      prisma.historiqueActivite.count({ where }),
      prisma.historiqueActivite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
      })
    ])

    // Résoudre les noms d'utilisateurs
    const userIds = [...new Set(lignes.filter(l => l.userId).map(l => l.userId!))]
    const users = userIds.length
      ? await prisma.utilisateur.findMany({ where: { id: { in: userIds } }, select: { id: true, nom: true, prenom: true, login: true } })
      : []
    const userMap = Object.fromEntries(users.map(u => [u.id, u]))

    // Résoudre le SN pour les lignes entite=inventaire via colonne fixe
    const invIds = [...new Set(lignes.filter(l => l.entite === 'inventaire' && l.entiteId).map(l => l.entiteId!))]
    const snMap: Record<number, string> = {}
    if (invIds.length) {
      const inventaires = await prisma.inventaire.findMany({
        where: { id: { in: invIds } },
        select: { id: true, serialNumber: true }
      })
      for (const inv of inventaires) {
        if (inv.serialNumber) snMap[inv.id] = inv.serialNumber
      }
    }

    const rows = lignes.map(l => {
      const u = l.userId ? userMap[l.userId] : null
      const details = l.details ? (() => { try { return JSON.parse(l.details!) } catch { return {} } })() : {}
      return {
        id:          l.id,
        type:        l.type,
        entite:      l.entite,
        entiteId:    l.entiteId,
        sn:          l.entite === 'inventaire' && l.entiteId ? (snMap[l.entiteId] ?? null) : null,
        label:       details.label ?? null,
        couleur:     details.couleur ?? '#6b7280',
        commentaire: details.commentaire ?? null,
        createdAt:   l.createdAt,
        intervenant: u ? `${u.prenom} ${u.nom}` : null,
        login:       u?.login ?? null,
      }
    })

    res.json({ total, page: Number(page), pageSize: PAGE_SIZE, pages: Math.ceil(total / PAGE_SIZE), rows })
  } catch (e) { next(e) }
}

export async function getTypesDisponibles(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const types = await prisma.historiqueActivite.findMany({
      where: { siteId },
      select: { type: true },
      distinct: ['type'],
      orderBy: { type: 'asc' }
    })
    res.json(types.map(t => t.type))
  } catch (e) { next(e) }
}

export async function getUtilisateursActifs(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const userIds = await prisma.historiqueActivite.findMany({
      where: { siteId, userId: { not: null } },
      select: { userId: true },
      distinct: ['userId'],
    })
    const ids = userIds.map(u => u.userId!)
    const users = ids.length
      ? await prisma.utilisateur.findMany({ where: { id: { in: ids } }, select: { id: true, nom: true, prenom: true, login: true } })
      : []
    res.json(users)
  } catch (e) { next(e) }
}
