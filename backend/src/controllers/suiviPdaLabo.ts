import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { getMoisCible, getArticlesQTE } from '../utils/pda'

const prisma = new PrismaClient()

// Tableau récapitulatif mensuel du stock labo des articles suivis en quantité (ex : PDA)
export async function getSuiviPDALabo(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const site = Number(siteId)

    const { typesAutorises, champType, champPN, champDetail, champModel, champAddRef, articlesQTE } = await getArticlesQTE(prisma, site)
    const articleIds = articlesQTE.map(a => a.id)

    if (typesAutorises.length === 0 || !champType) {
      return res.json({ semaines: [], rows: [] })
    }

    const { annee, mois, semaines, debutMois, finMois, estMoisCourant } = getMoisCible(req.query)

    // Stock labo
    const laboItems = articleIds.length > 0
      ? await prisma.inventaireLabo.findMany({ where: { siteId: site, articleId: { in: articleIds } } })
      : []

    // Transferts QTE validés vers le labo ce mois-ci (Supply)
    const demandes = articleIds.length > 0
      ? await prisma.demandeTransfert.findMany({
          where: { siteId: site, type: 'QTE', statut: 'VALIDEE', articleId: { in: articleIds }, datePlanifiee: { gte: debutMois, lte: finMois } }
        })
      : []

    const rows = articlesQTE.map(article => {
      const labo = laboItems.find(l => l.articleId === article.id)

      const hebdo: Record<number, number> = {}
      for (const s of semaines) hebdo[s] = 0
      const monthlyConsumption = Object.values(hebdo).reduce((a, b) => a + b, 0)

      let supply = 0
      for (const d of demandes) {
        if (d.articleId === article.id) supply += d.quantite
      }

      const v = (champ?: { id: number }) => champ ? (article.valeurs.find(val => val.champId === champ.id)?.valeur ?? '') : ''

      return {
        articleId: article.id,
        reference:           v(champPN),
        additionalReference: v(champAddRef),
        wording:             v(champDetail),
        range:               v(champModel),
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
      colonnes: {
        reference:           champPN?.label      ?? 'Référence',
        additionalReference: champAddRef?.label  ?? 'Réf. additionnelle',
        wording:             champDetail?.label  ?? 'Désignation',
        range:               champModel?.label   ?? 'Famille',
      },
      rows
    })
  } catch (e) { next(e) }
}
