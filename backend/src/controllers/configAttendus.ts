import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/config-attendus/:siteId — récupérer la config + le mapping
export async function getConfig(req: Request, res: Response) {
  const { siteId } = req.params
  const sid = Number(siteId)

  const [config, mappings] = await Promise.all([
    prisma.configAttendus.findUnique({ where: { siteId: sid } }),
    prisma.configImportExcel.findMany({ where: { siteId: sid }, orderBy: { colonneExcel: 'asc' } }),
  ])

  res.json({ config, mappings })
}

// PUT /api/config-attendus/:siteId — sauvegarder la config globale
export async function saveConfig(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const { nomOnglet, obligatoirePNcatalogue, statutCloture, champsAttendu } = req.body
    const config = await prisma.configAttendus.upsert({
      where: { siteId: Number(siteId) },
      create: { siteId: Number(siteId), nomOnglet, obligatoirePNcatalogue, statutCloture, champsAttendu: champsAttendu ? JSON.stringify(champsAttendu) : null },
      update: { nomOnglet, obligatoirePNcatalogue, statutCloture, champsAttendu: champsAttendu ? JSON.stringify(champsAttendu) : null }
    })
    res.json(config)
  } catch (e) { next(e) }
}

// POST /api/config-attendus/:siteId/mappings — ajouter un mapping
export async function addMapping(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const { colonneExcel, colonneInventaire, roleSpecial } = req.body
    const mapping = await prisma.configImportExcel.create({
      data: { siteId: Number(siteId), colonneExcel, colonneInventaire, roleSpecial: roleSpecial || null }
    })
    res.json(mapping)
  } catch (e) { next(e) }
}

// PUT /api/config-attendus/mappings/:id — modifier un mapping
export async function updateMapping(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const { colonneExcel, colonneInventaire, roleSpecial, actif } = req.body
    const mapping = await prisma.configImportExcel.update({
      where: { id: Number(id) },
      data: { colonneExcel, colonneInventaire, roleSpecial: roleSpecial || null, actif }
    })
    res.json(mapping)
  } catch (e) { next(e) }
}

// DELETE /api/config-attendus/mappings/:id — supprimer un mapping
export async function deleteMapping(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    await prisma.configImportExcel.delete({ where: { id: Number(id) } })
    res.json({ success: true })
  } catch (e) { next(e) }
}
