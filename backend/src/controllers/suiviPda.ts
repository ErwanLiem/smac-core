import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { getISOWeek, getMoisCible, getArticlesQTE } from '../utils/pda'

const prisma = new PrismaClient()

// Tableau récapitulatif des mouvements mensuels des articles suivis en quantité (ex : PDA)
export async function getSuiviPDA(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const site = Number(siteId)

    const { typesAutorises, champType, champPN, champDetail, champModel, champAddRef, articlesQTE } = await getArticlesQTE(prisma, site)
    const articleIds = articlesQTE.map(a => a.id)

    if (typesAutorises.length === 0 || !champType) {
      return res.json({ semaines: [], rows: [] })
    }

    const { annee, mois, semaines, debutMois, finMois, estMoisCourant } = getMoisCible(req.query)

    // Tous les mouvements QTE (stock global + hebdo + appro du mois)
    const tousLesMovements = articleIds.length > 0
      ? await prisma.mouvementQTE.findMany({ where: { siteId: site, articleId: { in: articleIds } } })
      : []

    const mouvementsMois = tousLesMovements.filter(m => m.date >= debutMois && m.date <= finMois)

    const rows = articlesQTE.map(article => {
      // Stock = Σ réceptions − Σ transferts − Σ sorties (tous les mouvements)
      const mouvArt = tousLesMovements.filter(m => m.articleId === article.id)
      const stockQty = mouvArt.reduce((acc, m) => {
        if (m.type === 'RECEPTION') return acc + m.quantite
        if (m.type === 'TRANSFERT' || m.type === 'SORTIE') return acc - m.quantite
        return acc
      }, 0)

      // Hebdo = transferts du mois (sorties vers labo)
      const hebdo: Record<number, number> = {}
      for (const s of semaines) hebdo[s] = 0
      for (const m of mouvementsMois) {
        if (m.articleId !== article.id || m.type !== 'TRANSFERT') continue
        const semaine = getISOWeek(new Date(m.date))
        if (semaine in hebdo) hebdo[semaine] += m.quantite
      }
      const monthlyConsumption = Object.values(hebdo).reduce((a, b) => a + b, 0)

      // Appro = réceptions du mois
      const supply = mouvementsMois
        .filter(m => m.articleId === article.id && m.type === 'RECEPTION')
        .reduce((acc, m) => acc + m.quantite, 0)

      const v = (champ?: { id: number }) => champ ? (article.valeurs.find(val => val.champId === champ.id)?.valeur ?? '') : ''

      return {
        articleId: article.id,
        reference:           v(champPN),
        additionalReference: v(champAddRef),
        wording:             v(champDetail),
        range:               v(champModel),
        stockQty,
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
