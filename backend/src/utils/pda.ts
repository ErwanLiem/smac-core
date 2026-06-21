import { PrismaClient } from '@prisma/client'

export function normCode(s: string) {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_').trim()
}

// Numéro de semaine ISO 8601
export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
}

// Liste des numéros de semaine ISO couvrant le mois donné
export function getSemainesDuMois(annee: number, mois: number): number[] {
  const semaines: number[] = []
  const dernierJour = new Date(annee, mois + 1, 0).getDate()
  for (let jour = 1; jour <= dernierJour; jour++) {
    const semaine = getISOWeek(new Date(annee, mois, jour))
    if (!semaines.includes(semaine)) semaines.push(semaine)
  }
  return semaines
}

export function valeurPour(valeurs: { champId: number; valeur: string | null }[], champ?: { id: number }): string {
  if (!champ) return ''
  return valeurs.find(v => v.champId === champ.id)?.valeur ?? ''
}

// Résout le mois ciblé par la requête (par défaut le mois en cours), plafonné au mois en cours
export function getMoisCible(query: { annee?: unknown; mois?: unknown }) {
  const maintenant = new Date()
  let annee = query.annee !== undefined ? Number(query.annee) : maintenant.getFullYear()
  let mois = query.mois !== undefined ? Number(query.mois) - 1 : maintenant.getMonth()
  if (annee > maintenant.getFullYear() || (annee === maintenant.getFullYear() && mois > maintenant.getMonth())) {
    annee = maintenant.getFullYear()
    mois = maintenant.getMonth()
  }
  return {
    annee,
    mois,
    semaines: getSemainesDuMois(annee, mois),
    debutMois: new Date(annee, mois, 1),
    finMois: new Date(annee, mois + 1, 0, 23, 59, 59, 999),
    estMoisCourant: annee === maintenant.getFullYear() && mois === maintenant.getMonth()
  }
}

const CODES_PN      = ['PN', 'P_N', 'PART_NUMBER', 'PART_NO', 'REFERENCE', 'REF']
const CODES_WORDING = ['DESIGNATION', 'DESIG', 'WORDING', 'NOM', 'LIBELLE', 'DESCRIPTION', 'DETAIL']
const CODES_RANGE   = ['FAMILLE', 'TYPE_PIECE', 'RANGE', 'MODEL', 'MODELE', 'GAMME']
const CODES_ADD_REF = ['CONSTRUCTEUR', 'MARQUE', 'FABRICANT', 'ADDITIONAL_REFERENCE', 'REF_ADDITIONNELLE']

function findChamp(champs: { id: number; code: string; label: string }[], codes: string[]) {
  return champs.find(c => codes.includes(normCode(c.code)))
}

// Articles dont le type (champ configurable) fait partie des types suivis en quantité (config Production)
export async function getArticlesQTE(prisma: PrismaClient, siteId: number) {
  const config = await prisma.configProduction.findUnique({ where: { siteId } })
  const champTypeCode = config?.champTypeArticleCode ?? 'TYPE'
  const typesAutorises: string[] = config?.typesArticleQTE ? JSON.parse(config.typesArticleQTE) : []
  const champsArticle = await prisma.champArticle.findMany({ where: { siteId } })
  const champType   = champsArticle.find(c => normCode(c.code) === normCode(champTypeCode))
  const champPN     = findChamp(champsArticle, CODES_PN)
  const champDetail = findChamp(champsArticle, CODES_WORDING)
  const champModel  = findChamp(champsArticle, CODES_RANGE)
  const champAddRef = findChamp(champsArticle, CODES_ADD_REF)

  let articlesQTE: Awaited<ReturnType<typeof prisma.article.findMany<{ where: { siteId: number }; include: { valeurs: true } }>>> = []
  if (typesAutorises.length > 0 && champType) {
    const articles = await prisma.article.findMany({
      where: { siteId },
      include: { valeurs: true }
    })
    articlesQTE = articles.filter(art => {
      const valType = art.valeurs.find(v => v.champId === champType.id)?.valeur ?? ''
      return typesAutorises.some(t => normCode(t) === normCode(valType))
    })
  }

  return { typesAutorises, champType, champPN, champDetail, champModel, champAddRef, articlesQTE }
}
