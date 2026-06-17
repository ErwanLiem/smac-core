import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { hasRole } from '../utils/roles'

const prisma = new PrismaClient()

async function calcRemplissage(siteId: number, nomsEmplacements: string[]): Promise<Record<string, number>> {
  if (nomsEmplacements.length === 0) return {}

  // Compte les inventaires en statut estStock dont le genericNotes contient le nom d'emplacement
  // Note: emplacement sera un champ dédié à ajouter si nécessaire
  const statuts = await prisma.statut.findMany({ where: { siteId }, select: { id: true, roles: true } })
  const stockIds = statuts.filter(s => hasRole(s.roles, 'estStock')).map(s => s.id)

  const inventaires = await prisma.inventaire.findMany({
    where: { siteId, archive: false, statutId: { in: stockIds } },
    select: { id: true }
  })

  // TODO: lier emplacement via une colonne dédiée quand ajoutée
  return Object.fromEntries(nomsEmplacements.map(n => [n, 0]))
}

export async function getAll(req: Request, res: Response) {
  const siteId = Number(req.params.siteId)
  const emplacements = await prisma.emplacement.findMany({
    where: { siteId },
    orderBy: { nom: 'asc' }
  })

  const counts = await calcRemplissage(siteId, emplacements.map(e => e.nom))

  res.json(emplacements.map(e => ({
    ...e,
    remplissage: counts[e.nom] ?? 0
  })))
}

export async function create(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const { nom, capaciteMax, description } = req.body
    if (!nom || !nom.trim()) return res.status(400).json({ error: 'Le nom est obligatoire' })
    if (!capaciteMax || capaciteMax < 1) return res.status(400).json({ error: 'La capacité max doit être supérieure à 0' })

    const emp = await prisma.emplacement.create({
      data: { siteId, nom: nom.trim(), capaciteMax: Number(capaciteMax), description: description?.trim() || null }
    })
    res.json({ ...emp, remplissage: 0 })
  } catch (e) { next(e) }
}

export async function update(req: Request, res: Response, next: any) {
  try {
    const id = Number(req.params.id)
    const { nom, capaciteMax, description } = req.body
    if (!nom || !nom.trim()) return res.status(400).json({ error: 'Le nom est obligatoire' })
    if (!capaciteMax || capaciteMax < 1) return res.status(400).json({ error: 'La capacité max doit être supérieure à 0' })

    const emp = await prisma.emplacement.update({
      where: { id },
      data: { nom: nom.trim(), capaciteMax: Number(capaciteMax), description: description?.trim() || null }
    })
    const siteId = emp.siteId
    const counts = await calcRemplissage(siteId, [emp.nom])
    res.json({ ...emp, remplissage: counts[emp.nom] ?? 0 })
  } catch (e) { next(e) }
}

export async function remove(req: Request, res: Response, next: any) {
  try {
    await prisma.emplacement.delete({ where: { id: Number(req.params.id) } })
    res.json({ success: true })
  } catch (e) { next(e) }
}
