import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { normCode, valeurPour, getArticlesQTE } from '../utils/pda'
import { logActivite } from '../utils/historique'
import { enregistrerOperation } from '../utils/operations'

const prisma = new PrismaClient()

async function getConfigRep(siteId: number) {
  const config = await prisma.configProduction.findUnique({ where: { siteId } })
  return {
    champRMACode: config?.champRMACode ?? 'BL',
    champPNCode:  config?.champPNCode  ?? 'PN',
  }
}

async function getStatutAttenteRep(siteId: number) {
  return prisma.statut.findFirst({ where: { siteId, code: 'ATTENTE_REP' } })
}

function buildValeurMap(valeurs: { champId: number; valeur: string | null }[], champs: { id: number; code: string }[]) {
  const map: Record<string, string> = {}
  for (const champ of champs) {
    map[normCode(champ.code)] = valeurs.find(v => v.champId === champ.id)?.valeur ?? ''
  }
  return map
}

// ─── Liste des RMA en attente de réparation ───────────────────────────────────

export async function getRmaList(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const { champRMACode, champPNCode } = await getConfigRep(siteId)
    const statutAttenteRep = await getStatutAttenteRep(siteId)
    if (!statutAttenteRep) return res.json([])

    const champsInv = await prisma.champInventaire.findMany({ where: { siteId } })
    const champRMA  = champsInv.find(c => normCode(c.code) === normCode(champRMACode))
    const champPN   = champsInv.find(c => normCode(c.code) === normCode(champPNCode))
    const champSN   = champsInv.find(c => normCode(c.code) === normCode('NUMERO_DE_SERIE') || normCode(c.code) === normCode('SN'))
    const champClient = champsInv.find(c => normCode(c.code) === 'CLIENT')

    const inventaires = await prisma.inventaire.findMany({
      where: { siteId, statutId: statutAttenteRep.id },
      include: { valeurs: true }
    })

    // Grouper par valeur RMA
    const groupes: Record<string, { rma: string; count: number; client: string; pns: string[] }> = {}
    for (const inv of inventaires) {
      const rma    = valeurPour(inv.valeurs, champRMA) || '(Sans RMA)'
      const pn     = valeurPour(inv.valeurs, champPN)
      const client = valeurPour(inv.valeurs, champClient)
      if (!groupes[rma]) groupes[rma] = { rma, count: 0, client, pns: [] }
      groupes[rma].count++
      if (pn && !groupes[rma].pns.includes(pn)) groupes[rma].pns.push(pn)
    }

    const liste = Object.values(groupes).sort((a, b) => a.rma.localeCompare(b.rma))
    res.json(liste)
  } catch (e) { next(e) }
}

// ─── Inventaires d'un RMA ─────────────────────────────────────────────────────

export async function getInventairesRma(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const rma    = decodeURIComponent(req.params.rma)
    const { champRMACode, champPNCode } = await getConfigRep(siteId)
    const statutAttenteRep = await getStatutAttenteRep(siteId)
    if (!statutAttenteRep) return res.json([])

    const champsInv = await prisma.champInventaire.findMany({ where: { siteId } })
    const champRMA    = champsInv.find(c => normCode(c.code) === normCode(champRMACode))
    const champPN     = champsInv.find(c => normCode(c.code) === normCode(champPNCode))
    const champSN     = champsInv.find(c => normCode(c.code) === 'NUMERO_DE_SERIE' || normCode(c.code) === 'SN')
    const champDesig  = champsInv.find(c => normCode(c.code) === 'DESIGNATION')
    const champClient = champsInv.find(c => normCode(c.code) === 'CLIENT')
    const champPanne  = champsInv.find(c => normCode(c.code) === 'PANNE_CLIENT')
    const champPanneC = champsInv.find(c => normCode(c.code) === 'PANNE_CONSTATE')
    const champNivRep = champsInv.find(c => normCode(c.code) === 'NIVEAU_REP')

    const inventaires = await prisma.inventaire.findMany({
      where: { siteId, statutId: statutAttenteRep.id },
      include: { valeurs: true, statut: true }
    })

    const filtrés = inventaires.filter(inv => {
      const rmaVal = valeurPour(inv.valeurs, champRMA)
      return (rmaVal || '(Sans RMA)') === rma
    })

    const result = filtrés.map(inv => ({
      id: inv.id,
      pn:          valeurPour(inv.valeurs, champPN),
      sn:          valeurPour(inv.valeurs, champSN),
      designation: valeurPour(inv.valeurs, champDesig),
      client:      valeurPour(inv.valeurs, champClient),
      panneClient: valeurPour(inv.valeurs, champPanne),
      panneConstate: valeurPour(inv.valeurs, champPanneC),
      niveauRep:   valeurPour(inv.valeurs, champNivRep),
      statut: inv.statut,
    }))

    res.json(result)
  } catch (e) { next(e) }
}

// ─── Scan SN → trouver inventaire ────────────────────────────────────────────

export async function scanInventaire(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const sn     = String(req.query.sn ?? '').trim()
    if (!sn) return res.status(400).json({ error: 'SN manquant' })

    const statutAttenteRep = await getStatutAttenteRep(siteId)
    if (!statutAttenteRep) return res.status(404).json({ error: 'Statut ATTENTE_REP introuvable' })

    // Chercher dans toutes les valeurChampInventaire des inventaires en ATTENTE_REP
    const match = await prisma.valeurChampInventaire.findFirst({
      where: {
        valeur: sn,
        inventaire: { siteId, statutId: statutAttenteRep.id }
      },
      include: { inventaire: true }
    })

    if (!match) return res.status(404).json({ error: 'Aucune machine trouvée pour ce SN' })
    res.json({ inventaireId: match.inventaireId })
  } catch (e) { next(e) }
}

// ─── Détail complet d'un inventaire (modal réparation) ───────────────────────

export async function getDetailInventaire(req: Request, res: Response, next: any) {
  try {
    const siteId      = Number(req.params.siteId)
    const inventaireId = Number(req.params.id)
    const { champRMACode, champPNCode } = await getConfigRep(siteId)

    const champsInv = await prisma.champInventaire.findMany({ where: { siteId } })
    const champRMA    = champsInv.find(c => normCode(c.code) === normCode(champRMACode))
    const champPN     = champsInv.find(c => normCode(c.code) === normCode(champPNCode))
    const champSN     = champsInv.find(c => normCode(c.code) === 'NUMERO_DE_SERIE' || normCode(c.code) === 'SN')
    const champDesig  = champsInv.find(c => normCode(c.code) === 'DESIGNATION')
    const champClient = champsInv.find(c => normCode(c.code) === 'CLIENT')
    const champPanne  = champsInv.find(c => normCode(c.code) === 'PANNE_CLIENT')
    const champPanneC = champsInv.find(c => normCode(c.code) === 'PANNE_CONSTATE')
    const champNivRep = champsInv.find(c => normCode(c.code) === 'NIVEAU_REP')
    const champModelInv = champsInv.find(c => normCode(c.code) === 'MODEL')

    const inv = await prisma.inventaire.findUnique({
      where: { id: inventaireId },
      include: { valeurs: true, statut: true, article: { include: { valeurs: { include: { champ: true } } } } }
    })
    if (!inv) return res.status(404).json({ error: 'Inventaire introuvable' })

    // MODEL de la machine : d'abord dans champInventaire, sinon dans l'article lié
    let modelMachine = valeurPour(inv.valeurs, champModelInv)
    if (!modelMachine && inv.article) {
      const champModel = inv.article.valeurs.find(v => normCode(v.champ.code) === 'MODEL')
      modelMachine = champModel?.valeur ?? ''
    }

    // Historique : uniquement historiqueActivite lié à cet inventaireId (évite la contamination croisée via articleId)
    const hActivites = await prisma.historiqueActivite.findMany({
      where: { siteId, entite: 'inventaire', entiteId: inventaireId },
      orderBy: { createdAt: 'asc' }
    })
    const actUserIds = [...new Set(hActivites.filter(h => h.userId).map(h => h.userId!))]
    const actUsers = actUserIds.length
      ? await prisma.utilisateur.findMany({ where: { id: { in: actUserIds } }, select: { id: true, nom: true, prenom: true } })
      : []
    const actUserMap = Object.fromEntries(actUsers.map(u => [u.id, u]))
    const historique = hActivites.map(h => {
      const u = h.userId ? actUserMap[h.userId] : null
      const details = h.details ? JSON.parse(h.details) : {}
      return {
        type: h.type,
        date: h.createdAt,
        label: details.label ?? h.type,
        couleur: details.couleur ?? '#6b7280',
        commentaire: details.commentaire ?? null,
        intervenant: u ? `${u.prenom} ${u.nom}` : null,
      }
    })

    // Articles PDA disponibles, filtrés par MODEL
    const { articlesQTE, champModel: champModelArt, champDetail, champPNCode: pnCode } = await getArticlesQTE(prisma, siteId)
    const champsArticle = await prisma.champArticle.findMany({ where: { siteId } })
    const champNiveauRep = champsArticle.find(c => normCode(c.code) === 'NIVEAU_DE_REP')

    const laboItems = await prisma.inventaireLabo.findMany({
      where: { siteId, articleId: { in: articlesQTE.map(a => a.id) } }
    })

    const pdaDispos = articlesQTE
      .filter(art => {
        // Filtrer par MODEL si on connaît le model de la machine
        if (modelMachine && champModelArt) {
          const artModel = art.valeurs.find(v => v.champId === champModelArt.id)?.valeur ?? ''
          if (artModel && normCode(artModel) !== normCode(modelMachine)) return false
        }
        const stock = laboItems.find(l => l.articleId === art.id)?.quantite ?? 0
        return stock > 0
      })
      .map(art => {
        const stock = laboItems.find(l => l.articleId === art.id)?.quantite ?? 0
        const model = champModelArt ? art.valeurs.find(v => v.champId === champModelArt.id)?.valeur ?? '' : ''
        const detail = champDetail ? art.valeurs.find(v => v.champId === champDetail.id)?.valeur ?? '' : ''
        const niveauRep = champNiveauRep ? art.valeurs.find(v => v.champId === champNiveauRep.id)?.valeur ?? '' : ''
        return { articleId: art.id, reference: art.valeurs[0]?.valeur ?? '', detail, model, niveauRep, stock }
      })

    // Statuts cibles réparation (ASP, ASW, ENG, NLV, PRV)
    const codesAttenteInfo = ['ASP', 'ASW', 'ENG', 'NLV', 'PRV']
    const [statutsAttenteInfo, statutRepareRaw] = await Promise.all([
      prisma.statut.findMany({ where: { siteId, code: { in: codesAttenteInfo } } }),
      prisma.statut.findFirst({ where: { siteId, code: { in: ['REPARE', 'REPARER'] } } })
    ])

    res.json({
      id: inv.id,
      pn:           valeurPour(inv.valeurs, champPN),
      sn:           valeurPour(inv.valeurs, champSN),
      rma:          valeurPour(inv.valeurs, champRMA),
      designation:  valeurPour(inv.valeurs, champDesig),
      client:       valeurPour(inv.valeurs, champClient),
      panneClient:  valeurPour(inv.valeurs, champPanne),
      panneConstate: valeurPour(inv.valeurs, champPanneC),
      niveauRep:    valeurPour(inv.valeurs, champNivRep),
      model:        modelMachine,
      statut:       inv.statut,
      historique,
      pdaDispos,
      statutsAttenteInfo,
      statutRepare: statutRepareRaw ?? null,
    })
  } catch (e) { next(e) }
}

// ─── Saisir panne constatée ───────────────────────────────────────────────────

export async function saisirPanneConstatee(req: Request, res: Response, next: any) {
  try {
    const siteId      = Number(req.params.siteId)
    const inventaireId = Number(req.params.id)
    const { valeur }  = req.body
    const userId      = req.user?.id ?? null

    const champ = await prisma.champInventaire.findFirst({ where: { siteId, code: 'PANNE_CONSTATE' } })
    if (!champ) return res.status(404).json({ error: 'Champ PANNE_CONSTATE introuvable' })

    await prisma.valeurChampInventaire.upsert({
      where: { inventaireId_champId: { inventaireId, champId: champ.id } },
      create: { inventaireId, champId: champ.id, valeur },
      update: { valeur }
    })

    await logActivite({ siteId, userId: userId ?? undefined, type: 'MODIFICATION', entite: 'inventaire', entiteId: inventaireId, details: { label: `Panne constatée : ${valeur}`, couleur: '#f59e0b' } })

    res.json({ success: true })
  } catch (e) { next(e) }
}

// ─── Utiliser une pièce PDA ───────────────────────────────────────────────────

export async function utiliserPDA(req: Request, res: Response, next: any) {
  try {
    const siteId      = Number(req.params.siteId)
    const inventaireId = Number(req.params.id)
    const { articleId, quantite = 1 } = req.body
    const userId = req.user?.id ?? null

    const laboItem = await prisma.inventaireLabo.findFirst({ where: { siteId, articleId: Number(articleId) } })
    if (!laboItem || laboItem.quantite < quantite) {
      return res.status(400).json({ error: 'Stock insuffisant' })
    }

    // Décrémenter le stock labo
    await prisma.inventaireLabo.update({
      where: { id: laboItem.id },
      data: { quantite: { decrement: Number(quantite) } }
    })

    // Lire NIVEAU_DE_REP sur l'article PDA
    const champsArticle = await prisma.champArticle.findMany({ where: { siteId } })
    const champNiveauDep = champsArticle.find(c => normCode(c.code) === 'NIVEAU_DE_REP')
    let niveauRep = ''
    if (champNiveauDep) {
      const valNiv = await prisma.valeurChamp.findFirst({ where: { articleId: Number(articleId), champId: champNiveauDep.id } })
      niveauRep = valNiv?.valeur ?? ''
    }

    // Écrire NIVEAU_REP sur l'inventaire de la machine si valeur définie
    if (niveauRep) {
      const champInvNivRep = await prisma.champInventaire.findFirst({ where: { siteId, code: 'NIVEAU_REP' } })
      if (champInvNivRep) {
        await prisma.valeurChampInventaire.upsert({
          where: { inventaireId_champId: { inventaireId, champId: champInvNivRep.id } },
          create: { inventaireId, champId: champInvNivRep.id, valeur: niveauRep },
          update: { valeur: niveauRep }
        })
      }
    }

    // Récupérer le label de l'article PDA pour le log
    const champPNArt = champsArticle.find(c => normCode(c.code) === normCode('PN'))
    const valPN = champPNArt
      ? await prisma.valeurChamp.findFirst({ where: { articleId: Number(articleId), champId: champPNArt.id } })
      : null
    const labelPDA = valPN?.valeur ?? `Article #${articleId}`

    await logActivite({
      siteId, userId: userId ?? undefined, type: 'MODIFICATION', entite: 'inventaire', entiteId: inventaireId,
      details: { label: `PDA utilisé : ${labelPDA} ×${quantite}${niveauRep ? ` → Niv. ${niveauRep}` : ''}`, couleur: '#8b5cf6' }
    })

    res.json({ success: true, niveauRep })
  } catch (e) { next(e) }
}

// ─── Changer le statut d'un inventaire (vers ASP, ASW, etc.) ─────────────────

export async function changerStatutReparation(req: Request, res: Response, next: any) {
  try {
    const siteId      = Number(req.params.siteId)
    const inventaireId = Number(req.params.id)
    const { statutCode, commentaire } = req.body
    const userId = req.user?.id ?? null

    const statut = await prisma.statut.findFirst({ where: { siteId, code: statutCode } })
    if (!statut) return res.status(404).json({ error: `Statut ${statutCode} introuvable` })

    const invActuel = await prisma.inventaire.findUnique({ where: { id: inventaireId }, include: { statut: true } })
    const labelSource = invActuel?.statut?.label ?? '?'

    await prisma.inventaire.update({
      where: { id: inventaireId },
      data: { statutId: statut.id },
    })

    // Remplissage automatique à la validation de réparation
    const estRepare = ['REPARE', 'REPARER'].includes(statutCode)
    if (estRepare) {
      const dateAujourdhui = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

      const [champDateRip, champOpeRep] = await Promise.all([
        prisma.champInventaire.findFirst({ where: { siteId, code: 'DATE_RIP' } }),
        prisma.champInventaire.findFirst({ where: { siteId, code: 'OPE.REP' } }),
      ])

      const upserts: Promise<any>[] = []

      if (champDateRip) {
        upserts.push(prisma.valeurChampInventaire.upsert({
          where: { inventaireId_champId: { inventaireId, champId: champDateRip.id } },
          create: { inventaireId, champId: champDateRip.id, valeur: dateAujourdhui },
          update: { valeur: dateAujourdhui },
        }))
      }

      if (champOpeRep && userId) {
        const utilisateur = await prisma.utilisateur.findUnique({ where: { id: userId }, select: { login: true } })
        if (utilisateur) {
          upserts.push(prisma.valeurChampInventaire.upsert({
            where: { inventaireId_champId: { inventaireId, champId: champOpeRep.id } },
            create: { inventaireId, champId: champOpeRep.id, valeur: utilisateur.login },
            update: { valeur: utilisateur.login },
          }))
        }
      }

      await Promise.all(upserts)
    }

    await logActivite({
      siteId, userId: userId ?? undefined, type: 'TRANSITION_STATUT', entite: 'inventaire', entiteId: inventaireId,
      details: { label: `${labelSource} → ${statut.label}`, couleur: statut.couleur, commentaire }
    })

    res.json({ success: true, statut })
  } catch (e) { next(e) }
}
