import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { normCode, getISOWeek, valeurPour, getMoisCible, getArticlesQTE } from '../utils/pda'

const prisma = new PrismaClient()

// Tableau récapitulatif des mouvements mensuels des articles suivis en quantité (ex : PDA)
export async function getSuiviPDA(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const site = Number(siteId)

    const { typesAutorises, champPNCode, champType, champDetail, champModel, articlesQTE } = await getArticlesQTE(prisma, site)
    const articleIds = articlesQTE.map(a => a.id)

    // Champs inventaire
    const champsInv = await prisma.champInventaire.findMany({ where: { siteId: site }, orderBy: { ordre: 'asc' } })
    const champPN          = champsInv.find(c => normCode(c.code) === normCode(champPNCode))
    const champEmplacement = champsInv.find(c => normCode(c.code) === 'EMPLACEMENT')
    const champDesignation = champsInv.find(c => normCode(c.code) === 'DESIGNATION')
    const champQuantite    = champsInv.find(c => ['QUANTITE', 'QTE', 'QUANTITY'].includes(normCode(c.code)))

    // Champ TRANSFER : créé automatiquement à la première utilisation
    let champTransfer = champsInv.find(c => normCode(c.code) === 'TRANSFER')
    if (!champTransfer) {
      const ordreMax = champsInv.reduce((max, c) => Math.max(max, c.ordre), 0)
      champTransfer = await prisma.champInventaire.create({
        data: { siteId: site, code: 'TRANSFER', label: 'Transfert', type: 'NUMBER', ordre: ordreMax + 1, actif: true }
      })
    }

    if (typesAutorises.length === 0 || !champType) {
      return res.json({ semaines: [], champTransferId: champTransfer.id, champEmplacementId: champEmplacement?.id ?? null, rows: [] })
    }

    // Mois ciblé (par défaut le mois en cours) — `mois` en paramètre est en base 1 (1 = janvier)
    // Les mois futurs n'ont pas d'intérêt (rien à consommer/réceptionner) : on plafonne au mois en cours
    const { annee, mois, semaines, debutMois, finMois, estMoisCourant } = getMoisCible(req.query)

    // Lignes d'inventaire correspondantes
    const inventaires = articleIds.length > 0
      ? await prisma.inventaire.findMany({
          where: { siteId: site, articleId: { in: articleIds } },
          include: { valeurs: true }
        })
      : []

    // Transferts QTE validés du mois en cours (consommation hebdomadaire)
    const demandes = articleIds.length > 0
      ? await prisma.demandeTransfert.findMany({
          where: {
            siteId: site, type: 'QTE', statut: 'VALIDEE',
            articleId: { in: articleIds },
            datePlanifiee: { gte: debutMois, lte: finMois }
          }
        })
      : []

    // Réceptions du mois en cours (colonne Supply)
    const inventaireIds = inventaires.map(i => i.id)
    const historiques = inventaireIds.length > 0
      ? await prisma.historiqueActivite.findMany({
          where: {
            siteId: site, entite: 'inventaire', type: 'RECEPTION',
            entiteId: { in: inventaireIds },
            createdAt: { gte: debutMois, lte: finMois }
          }
        })
      : []

    const rows = articlesQTE.map(article => {
      const inv = inventaires.find(i => i.articleId === article.id)

      const hebdo: Record<number, number> = {}
      for (const s of semaines) hebdo[s] = 0
      for (const d of demandes) {
        if (d.articleId !== article.id) continue
        const semaine = getISOWeek(new Date(d.datePlanifiee))
        if (semaine in hebdo) hebdo[semaine] += d.quantite
      }
      const monthlyConsumption = Object.values(hebdo).reduce((a, b) => a + b, 0)

      let supply = 0
      if (inv) {
        for (const h of historiques) {
          if (h.entiteId !== inv.id) continue
          try {
            const details = h.details ? JSON.parse(h.details) : null
            if (!details) continue
            if (typeof details.quantiteRecue === 'number') {
              supply += details.quantiteRecue
            } else if (Array.isArray(details.valeurs) && champQuantite) {
              const v = details.valeurs.find((x: any) => x.champId === champQuantite.id)
              if (v) supply += parseInt(v.valeur ?? '0') || 0
            }
          } catch {}
        }
      }

      return {
        articleId: article.id,
        inventaireId: inv?.id ?? null,
        reference: valeurPour(inv?.valeurs ?? [], champPN),
        location: valeurPour(inv?.valeurs ?? [], champEmplacement),
        additionalReference: valeurPour(article.valeurs, champDetail),
        wording: valeurPour(inv?.valeurs ?? [], champDesignation),
        range: valeurPour(article.valeurs, champModel),
        stockQty: parseInt(valeurPour(inv?.valeurs ?? [], champQuantite) || '0') || 0,
        hebdo,
        transfer: parseInt(valeurPour(inv?.valeurs ?? [], champTransfer) || '0') || 0,
        monthlyConsumption,
        supply
      }
    })

    res.json({
      annee,
      mois: mois + 1,
      estMoisCourant,
      semaines: semaines.map(s => ({ numero: s, label: `S${s}` })),
      champTransferId: champTransfer.id,
      champEmplacementId: champEmplacement?.id ?? null,
      rows
    })
  } catch (e) { next(e) }
}
