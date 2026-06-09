import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { serializeRoles } from '../utils/roles'

const prisma = new PrismaClient()

// --- STATUTS ---

export async function getStatuts(req: Request, res: Response) {
  const statuts = await prisma.statut.findMany({
    where: { siteId: Number(req.params.siteId) },
    orderBy: { ordre: 'asc' }
  })
  // Transformer roles (JSON string) en tableau pour le frontend
  res.json(statuts.map(s => ({
    ...s,
    roles: (() => { try { return JSON.parse(s.roles || '[]') } catch { return [] } })()
  })))
}

export async function createStatut(req: Request, res: Response) {
  const { code, label, couleur, icone, ordre, roles } = req.body
  const statut = await prisma.statut.create({
    data: {
      siteId: Number(req.params.siteId),
      code, label, couleur, icone,
      ordre: ordre ?? 0,
      roles: serializeRoles(roles ?? [])
    }
  })
  res.status(201).json({ ...statut, roles: JSON.parse(statut.roles || '[]') })
}

export async function updateStatut(req: Request, res: Response) {
  const { label, couleur, icone, ordre, roles } = req.body
  const statut = await prisma.statut.update({
    where: { id: Number(req.params.id) },
    data: {
      label, couleur, icone, ordre,
      roles: serializeRoles(roles ?? [])
    }
  })
  res.json({ ...statut, roles: JSON.parse(statut.roles || '[]') })
}

export async function deleteStatut(req: Request, res: Response) {
  await prisma.statut.delete({ where: { id: Number(req.params.id) } })
  res.status(204).send()
}

// --- TRANSITIONS ---

export async function getTransitions(req: Request, res: Response) {
  const transitions = await prisma.transition.findMany({
    where: { siteId: Number(req.params.siteId) },
    include: { statutFrom: true, statutTo: true },
    orderBy: { ordre: 'asc' }
  })
  res.json(transitions)
}

export async function createTransition(req: Request, res: Response) {
  const { statutFromId, statutToId, labelBouton, couleurBouton, ordre } = req.body
  const transition = await prisma.transition.create({
    data: { siteId: Number(req.params.siteId), statutFromId, statutToId, labelBouton, couleurBouton, ordre }
  })
  res.status(201).json(transition)
}

export async function updateTransition(req: Request, res: Response) {
  const { labelBouton, couleurBouton, ordre } = req.body
  const transition = await prisma.transition.update({
    where: { id: Number(req.params.id) },
    data: { labelBouton, couleurBouton, ordre }
  })
  res.json(transition)
}

export async function deleteTransition(req: Request, res: Response) {
  await prisma.transition.delete({ where: { id: Number(req.params.id) } })
  res.status(204).send()
}
