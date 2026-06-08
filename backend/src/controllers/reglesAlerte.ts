import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function getAll(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const regles = await prisma.regleAlerte.findMany({
      where: { siteId: Number(siteId) },
      orderBy: { createdAt: 'asc' }
    })
    res.json(regles)
  } catch (e) { next(e) }
}

export async function create(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const { nom, codeChampDate, seuilMois, couleurAlerte, champsAutoFill, actif } = req.body
    const regle = await prisma.regleAlerte.create({
      data: {
        siteId: Number(siteId),
        nom,
        codeChampDate: String(codeChampDate).toUpperCase(),
        seuilMois: Number(seuilMois) || 3,
        couleurAlerte: couleurAlerte || '#f59e0b',
        champsAutoFill: champsAutoFill ? JSON.stringify(champsAutoFill) : null,
        actif: actif ?? true,
      }
    })
    res.json(regle)
  } catch (e) { next(e) }
}

export async function update(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const { nom, codeChampDate, seuilMois, couleurAlerte, champsAutoFill, actif } = req.body
    const regle = await prisma.regleAlerte.update({
      where: { id: Number(id) },
      data: {
        nom,
        codeChampDate: codeChampDate ? String(codeChampDate).toUpperCase() : undefined,
        seuilMois: seuilMois !== undefined ? Number(seuilMois) : undefined,
        couleurAlerte,
        champsAutoFill: champsAutoFill !== undefined ? JSON.stringify(champsAutoFill) : undefined,
        actif,
      }
    })
    res.json(regle)
  } catch (e) { next(e) }
}

export async function remove(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    await prisma.regleAlerte.delete({ where: { id: Number(id) } })
    res.json({ success: true })
  } catch (e) { next(e) }
}
