import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { normCode, valeurPour, getMoisCible, getArticlesQTE } from '../utils/pda'

const prisma = new PrismaClient()

// Tableau récapitulatif mensuel du stock labo des articles suivis en quantité (ex : PDA)
export async function getSuiviPDALabo(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const site = Number(siteId)

    const { typesAutorises, champPNCode, champType, champDetail, champModel, articlesQTE } = await getArticlesQTE(prisma, site)
    const articleIds = articlesQTE.map(a => a.id)

    // Champs inventaire (pour les infos d'identification de l'article : référence, désignation, emplacement)
    const champsInv = await prisma.champInventaire.findMany({ where: { siteId: site }, orderBy: { ordre: 'asc' } })
    const champPN              = champsInv.find(c => normCode(c.code) === normCode(champPNCode))
    const champEmplacementLabo = champsInv.find(c => normCode(c.code) === normCode('EMPLACEMENT LABO'))
    const champDesignation     = champsInv.find(c => normCode(c.code) === 'DESIGNATION')

    if (typesAutorises.length === 0 || !champType) {
      return res.json({ semaines: [], champEmplacementLaboId: champEmplacementLabo?.id ?? null, rows: [] })
    }

    // Mois ciblé (par défaut le mois en cours) — `mois` en paramètre est en base 1 (1 = janvier)
    // Les mois futurs n'ont pas d'intérêt : on plafonne au mois en cours
    const { annee, mois, semaines, debutMois, finMois, estMoisCourant } = getMoisCible(req.query)

    // Lignes d'inventaire (stock) correspondantes — pour les colonnes d'identification
    const inventaires = articleIds.length > 0
      ? await prisma.inventaire.findMany({
          where: { siteId: site, articleId: { in: articleIds } },
          include: { valeurs: true }
        })
      : []

    // Stock labo
    const laboItems = articleIds.length > 0
      ? await prisma.inventaireLabo.findMany({ where: { siteId: site, articleId: { in: articleIds } } })
      : []

    // Transferts QTE validés du mois en cours -> approvisionnement du labo (colonne Supply)
    const demandes = articleIds.length > 0
      ? await prisma.demandeTransfert.findMany({
          where: {
            siteId: site, type: 'QTE', statut: 'VALIDEE',
            articleId: { in: articleIds },
            datePlanifiee: { gte: debutMois, lte: finMois }
          }
        })
      : []

    const rows = articlesQTE.map(article => {
      const inv = inventaires.find(i => i.articleId === article.id)
      const labo = laboItems.find(l => l.articleId === article.id)

      // Consommation hebdomadaire par les techniciens en production — branché plus tard
      const hebdo: Record<number, number> = {}
      for (const s of semaines) hebdo[s] = 0
      const monthlyConsumption = Object.values(hebdo).reduce((a, b) => a + b, 0)

      // Supply = transferts validés vers le labo ce mois-ci
      let supply = 0
      for (const d of demandes) {
        if (d.articleId !== article.id) continue
        supply += d.quantite
      }

      return {
        articleId: article.id,
        inventaireId: inv?.id ?? null,
        reference: valeurPour(inv?.valeurs ?? [], champPN),
        location: valeurPour(inv?.valeurs ?? [], champEmplacementLabo),
        additionalReference: valeurPour(article.valeurs, champDetail),
        wording: valeurPour(inv?.valeurs ?? [], champDesignation),
        range: valeurPour(article.valeurs, champModel),
        stockQty: labo?.quantite ?? 0,
        hebdo,
        monthlyConsumption,
        supply
      }
    })

    res.json({
      annee,
      mois: mois + 1,
      estMoisCourant,
      semaines: semaines.map(s => ({ numero: s, label: `S${s}` })),
      champEmplacementLaboId: champEmplacementLabo?.id ?? null,
      rows
    })
  } catch (e) { next(e) }
}
