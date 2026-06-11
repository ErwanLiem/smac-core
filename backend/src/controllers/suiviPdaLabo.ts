import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function normCode(s: string) {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_').trim()
}

// Numéro de semaine ISO 8601
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
}

// Liste des numéros de semaine ISO couvrant le mois donné
function getSemainesDuMois(annee: number, mois: number): number[] {
  const semaines: number[] = []
  const dernierJour = new Date(annee, mois + 1, 0).getDate()
  for (let jour = 1; jour <= dernierJour; jour++) {
    const semaine = getISOWeek(new Date(annee, mois, jour))
    if (!semaines.includes(semaine)) semaines.push(semaine)
  }
  return semaines
}

function valeurPour(valeurs: { champId: number; valeur: string | null }[], champ?: { id: number }): string {
  if (!champ) return ''
  return valeurs.find(v => v.champId === champ.id)?.valeur ?? ''
}

// Tableau récapitulatif mensuel du stock labo des articles suivis en quantité (ex : PDA)
export async function getSuiviPDALabo(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const site = Number(siteId)

    const config = await prisma.configProduction.findUnique({ where: { siteId: site } })
    const champTypeCode = config?.champTypeArticleCode ?? 'TYPE'
    const typesAutorises: string[] = config?.typesArticleQTE ? JSON.parse(config.typesArticleQTE) : []
    const champPNCode = config?.champPNCode ?? 'PN'

    // Champs articles (catalogue)
    const champsArticle = await prisma.champArticle.findMany({ where: { siteId: site } })
    const champType   = champsArticle.find(c => normCode(c.code) === normCode(champTypeCode))
    const champDetail = champsArticle.find(c => normCode(c.code) === 'DETAIL')
    const champModel  = champsArticle.find(c => normCode(c.code) === 'MODEL')

    // Champs inventaire (pour les infos d'identification de l'article : référence, désignation, emplacement)
    const champsInv = await prisma.champInventaire.findMany({ where: { siteId: site }, orderBy: { ordre: 'asc' } })
    const champPN              = champsInv.find(c => normCode(c.code) === normCode(champPNCode))
    const champEmplacementLabo = champsInv.find(c => normCode(c.code) === normCode('EMPLACEMENT LABO'))
    const champDesignation     = champsInv.find(c => normCode(c.code) === 'DESIGNATION')

    if (typesAutorises.length === 0 || !champType) {
      return res.json({ semaines: [], champEmplacementLaboId: champEmplacementLabo?.id ?? null, rows: [] })
    }

    // Articles dont le type fait partie des types suivis en quantité
    const articles = await prisma.article.findMany({
      where: { siteId: site },
      include: { valeurs: true }
    })
    const articlesQTE = articles.filter(art => {
      const valType = art.valeurs.find(v => v.champId === champType.id)?.valeur ?? ''
      return typesAutorises.some(t => normCode(t) === normCode(valType))
    })
    const articleIds = articlesQTE.map(a => a.id)

    // Mois ciblé (par défaut le mois en cours) — `mois` en paramètre est en base 1 (1 = janvier)
    // Les mois futurs n'ont pas d'intérêt : on plafonne au mois en cours
    const maintenant = new Date()
    let annee = req.query.annee !== undefined ? Number(req.query.annee) : maintenant.getFullYear()
    let mois = req.query.mois !== undefined ? Number(req.query.mois) - 1 : maintenant.getMonth()
    if (annee > maintenant.getFullYear() || (annee === maintenant.getFullYear() && mois > maintenant.getMonth())) {
      annee = maintenant.getFullYear()
      mois = maintenant.getMonth()
    }

    const semaines = getSemainesDuMois(annee, mois)
    const debutMois = new Date(annee, mois, 1)
    const finMois = new Date(annee, mois + 1, 0, 23, 59, 59, 999)
    const estMoisCourant = annee === maintenant.getFullYear() && mois === maintenant.getMonth()

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
