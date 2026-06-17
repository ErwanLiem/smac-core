import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { normCode, getISOWeek, getMoisCible, getArticlesQTE } from '../utils/pda'

const prisma = new PrismaClient()

// Tableau récapitulatif des mouvements mensuels des articles suivis en quantité (ex : PDA)
export async function getSuiviPDA(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const site = Number(siteId)

    const { typesAutorises, champType, champDetail, champModel, articlesQTE } = await getArticlesQTE(prisma, site)
    const articleIds = articlesQTE.map(a => a.id)

    if (typesAutorises.length === 0 || !champType) {
      return res.json({ semaines: [], rows: [] })
    }

    const { annee, mois, semaines, debutMois, finMois, estMoisCourant } = getMoisCible(req.query)

    // Stock labo (source de vérité pour les quantités)
    const laboItems = articleIds.length > 0
      ? await prisma.inventaireLabo.findMany({ where: { siteId: site, articleId: { in: articleIds } } })
      : []

    // Transferts QTE validés du mois en cours (consommation hebdomadaire vers production)
    const demandesOut = articleIds.length > 0
      ? await prisma.demandeTransfert.findMany({
          where: { siteId: site, type: 'QTE', statut: 'VALIDEE', articleId: { in: articleIds }, datePlanifiee: { gte: debutMois, lte: finMois } }
        })
      : []

    // Transferts QTE reçus du mois = approvisionnements (Supply)
    const demandesIn = articleIds.length > 0
      ? await prisma.demandeTransfert.findMany({
          where: { siteId: site, type: 'QTE', statut: 'VALIDEE', articleId: { in: articleIds }, createdAt: { gte: debutMois, lte: finMois } }
        })
      : []

    const champsArticle = await prisma.champArticle.findMany({ where: { siteId: site } })
    const champPNArt   = champsArticle.find(c => normCode(c.code) === 'PN')
    const champDetailA = champDetail
    const champModelA  = champModel

    const rows = articlesQTE.map(article => {
      const labo = laboItems.find(l => l.articleId === article.id)

      const hebdo: Record<number, number> = {}
      for (const s of semaines) hebdo[s] = 0
      for (const d of demandesOut) {
        if (d.articleId !== article.id) continue
        const semaine = getISOWeek(new Date(d.datePlanifiee))
        if (semaine in hebdo) hebdo[semaine] += d.quantite
      }
      const monthlyConsumption = Object.values(hebdo).reduce((a, b) => a + b, 0)

      let supply = 0
      for (const d of demandesIn) {
        if (d.articleId === article.id) supply += d.quantite
      }

      const reference = champPNArt   ? (article.valeurs.find(v => v.champId === champPNArt.id)?.valeur   ?? '') : ''
      const detail    = champDetailA  ? (article.valeurs.find(v => v.champId === champDetailA.id)?.valeur  ?? '') : ''
      const range     = champModelA   ? (article.valeurs.find(v => v.champId === champModelA.id)?.valeur   ?? '') : ''

      return {
        articleId: article.id,
        reference,
        additionalReference: detail,
        wording: detail,
        range,
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
      rows
    })
  } catch (e) { next(e) }
}
