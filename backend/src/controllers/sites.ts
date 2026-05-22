import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function getSites(req: Request, res: Response) {
  const sites = await prisma.site.findMany({ orderBy: { nom: 'asc' } })
  res.json(sites)
}

export async function getSiteBySlug(req: Request, res: Response) {
  const site = await prisma.site.findUnique({ where: { slug: req.params.slug } })
  if (!site) return res.status(404).json({ error: 'Site non trouvé' })
  res.json(site)
}

export async function createSite(req: Request, res: Response) {
  const { nom, slug } = req.body
  const site = await prisma.site.create({ data: { nom, slug } })
  res.status(201).json(site)
}

export async function updateSite(req: Request, res: Response) {
  const { nom, actif } = req.body
  const site = await prisma.site.update({
    where: { id: Number(req.params.id) },
    data: { nom, actif }
  })
  res.json(site)
}
