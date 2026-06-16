import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function getConfig(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const config = await prisma.configSite.findUnique({ where: { siteId } })
    res.json(config ?? {
      nomSociete: '', adresse: '', ville: '', codePostal: '', pays: '',
      tel: '', email: '', siteWeb: '', tva: '', capitalSocial: ''
    })
  } catch (e) { next(e) }
}

export async function saveConfig(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const { nomSociete, adresse, ville, codePostal, pays, tel, email, siteWeb, tva, capitalSocial } = req.body
    const config = await prisma.configSite.upsert({
      where: { siteId },
      create: { siteId, nomSociete, adresse, ville, codePostal, pays, tel, email, siteWeb, tva, capitalSocial },
      update: { nomSociete, adresse, ville, codePostal, pays, tel, email, siteWeb, tva, capitalSocial }
    })
    res.json(config)
  } catch (e) { next(e) }
}

export async function getNextBl(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const annee = new Date().getFullYear()

    const compteur = await prisma.$transaction(async (tx) => {
      const existing = await tx.compteurBL.findUnique({ where: { siteId_annee: { siteId, annee } } })
      if (existing) {
        return tx.compteurBL.update({
          where: { siteId_annee: { siteId, annee } },
          data: { dernier: { increment: 1 } }
        })
      }
      return tx.compteurBL.create({ data: { siteId, annee, dernier: 1 } })
    })

    const padded = compteur.dernier.toString().padStart(4, '0')
    res.json({ numero: `BL-${annee}-${padded}` })
  } catch (e) { next(e) }
}
