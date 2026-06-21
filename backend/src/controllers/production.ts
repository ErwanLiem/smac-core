import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { hasRole, serializeRoles } from '../utils/roles'
import { enregistrerOperation } from '../utils/operations'

const prisma = new PrismaClient()

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normCode(s: string) {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_').trim()
}

/** Trouve les IDs de tous les statuts ayant un rôle donné pour un site */
async function getStatutIdsByRole(siteId: number, role: string): Promise<number[]> {
  const statuts = await prisma.statut.findMany({ where: { siteId }, select: { id: true, roles: true } })
  return statuts.filter(s => hasRole(s.roles, role)).map(s => s.id)
}

// ─── CONFIG PRODUCTION ───────────────────────────────────────────────────────

export async function getConfig(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const config = await prisma.configProduction.upsert({
      where: { siteId: Number(siteId) },
      create: { siteId: Number(siteId) },
      update: {}
    })
    res.json({
      ...config,
      typesArticleQTE:    config.typesArticleQTE    ? JSON.parse(config.typesArticleQTE)    : [],
      champsAffichageQTE: config.champsAffichageQTE ? JSON.parse(config.champsAffichageQTE) : [],
      champsReceptionSN:  config.champsReceptionSN  ? JSON.parse(config.champsReceptionSN)  : null,
      champsReceptionQTE: config.champsReceptionQTE ? JSON.parse(config.champsReceptionQTE) : null,
    })
  } catch (e) { next(e) }
}

export async function updateConfig(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const { champTypeArticleCode, typesArticleQTE, champsAffichageQTE, quotaSamediActif, champsReceptionSN, champsReceptionQTE } = req.body
    const data = {
      champTypeArticleCode: champTypeArticleCode ?? 'TYPE',
      typesArticleQTE:    typesArticleQTE    !== undefined ? JSON.stringify(typesArticleQTE)    : undefined,
      champsAffichageQTE: champsAffichageQTE !== undefined ? JSON.stringify(champsAffichageQTE) : undefined,
      champsReceptionSN:  champsReceptionSN  !== undefined ? JSON.stringify(champsReceptionSN)  : undefined,
      champsReceptionQTE: champsReceptionQTE !== undefined ? JSON.stringify(champsReceptionQTE) : undefined,
      quotaSamediActif:   quotaSamediActif   !== undefined ? Boolean(quotaSamediActif)          : undefined,
    }
    const config = await prisma.configProduction.upsert({
      where: { siteId: Number(siteId) },
      create: { siteId: Number(siteId), ...data },
      update: data
    })
    res.json({
      ...config,
      typesArticleQTE:    config.typesArticleQTE    ? JSON.parse(config.typesArticleQTE)    : [],
      champsAffichageQTE: config.champsAffichageQTE ? JSON.parse(config.champsAffichageQTE) : [],
      champsReceptionSN:  config.champsReceptionSN  ? JSON.parse(config.champsReceptionSN)  : null,
      champsReceptionQTE: config.champsReceptionQTE ? JSON.parse(config.champsReceptionQTE) : null,
    })
  } catch (e) { next(e) }
}

// ─── ARTICLES FILTRÉS QTE ────────────────────────────────────────────────────

export async function getArticlesQTE(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params

    const config = await prisma.configProduction.findUnique({ where: { siteId: Number(siteId) } })
    const champTypeCode  = config?.champTypeArticleCode ?? 'TYPE'
    const typesAutorisés: string[] = config?.typesArticleQTE ? JSON.parse(config.typesArticleQTE) : []

    const champsArticle = await prisma.champArticle.findMany({ where: { siteId: Number(siteId) } })
    const champType = champsArticle.find(c => normCode(c.code) === normCode(champTypeCode))

    const articles = await prisma.article.findMany({
      where: { siteId: Number(siteId) },
      include: { valeurs: { include: { champ: true } } }
    })

    // Si aucun type configuré → retourner tous les articles
    if (!champType || typesAutorisés.length === 0) {
      return res.json(articles)
    }

    // Filtrer par type
    const filtrés = articles.filter(art => {
      const valType = art.valeurs.find(v => v.champId === champType.id)?.valeur ?? ''
      return typesAutorisés.some(t => normCode(t) === normCode(valType))
    })

    res.json(filtrés)
  } catch (e) { next(e) }
}

// ─── TECHNICIENS ─────────────────────────────────────────────────────────────

export async function getTechniciens(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const techniciens = await prisma.technicienProduction.findMany({
      where: { siteId: Number(siteId) },
      include: { utilisateur: { select: { id: true, nom: true, prenom: true, login: true } } },
      orderBy: { utilisateur: { nom: 'asc' } }
    })
    res.json(techniciens)
  } catch (e) { next(e) }
}

export async function createTechnicien(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const { userId, quotaJournalier } = req.body
    const tech = await prisma.technicienProduction.create({
      data: { siteId: Number(siteId), userId: Number(userId), quotaJournalier: Number(quotaJournalier) || 10 },
      include: { utilisateur: { select: { id: true, nom: true, prenom: true, login: true } } }
    })
    res.json(tech)
  } catch (e) { next(e) }
}

export async function updateTechnicien(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const { quotaJournalier, actif } = req.body
    const tech = await prisma.technicienProduction.update({
      where: { id: Number(id) },
      data: { quotaJournalier: quotaJournalier !== undefined ? Number(quotaJournalier) : undefined, actif },
      include: { utilisateur: { select: { id: true, nom: true, prenom: true, login: true } } }
    })
    res.json(tech)
  } catch (e) { next(e) }
}

export async function deleteTechnicien(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    await prisma.technicienProduction.delete({ where: { id: Number(id) } })
    res.json({ success: true })
  } catch (e) { next(e) }
}

// ─── ABSENCES ────────────────────────────────────────────────────────────────

export async function getAbsences(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const { debut, fin } = req.query
    const absences = await prisma.absenceTechnicien.findMany({
      where: {
        technicien: { siteId: Number(siteId) },
        ...(debut && fin ? { date: { gte: new Date(String(debut)), lte: new Date(String(fin)) } } : {})
      },
      include: {
        technicien: {
          include: { utilisateur: { select: { id: true, nom: true, prenom: true } } }
        }
      }
    })
    res.json(absences)
  } catch (e) { next(e) }
}

export async function upsertAbsence(req: Request, res: Response, next: any) {
  try {
    const { technicienId, date, motif, quotaOverride } = req.body
    const dateObj = new Date(date)
    const absence = await prisma.absenceTechnicien.upsert({
      where: { technicienId_date: { technicienId: Number(technicienId), date: dateObj } },
      create: { technicienId: Number(technicienId), date: dateObj, motif, quotaOverride: quotaOverride !== undefined ? Number(quotaOverride) : null },
      update: { motif, quotaOverride: quotaOverride !== undefined ? Number(quotaOverride) : null }
    })
    res.json(absence)
  } catch (e) { next(e) }
}

export async function deleteAbsence(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    await prisma.absenceTechnicien.delete({ where: { id: Number(id) } })
    res.json({ success: true })
  } catch (e) { next(e) }
}

// ─── CAPACITÉ JOURNALIÈRE ────────────────────────────────────────────────────

export async function getCapacite(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const { debut, fin } = req.query

    const [techniciens, config, exceptions] = await Promise.all([
      prisma.technicienProduction.findMany({
        where: { siteId: Number(siteId), actif: true },
        include: {
          utilisateur: { select: { id: true, nom: true, prenom: true } },
          absences: debut && fin
            ? { where: { date: { gte: new Date(String(debut)), lte: new Date(String(fin)) } } }
            : {}
        }
      }),
      prisma.configProduction.findUnique({ where: { siteId: Number(siteId) } }),
      debut && fin
        ? prisma.exceptionCapaciteJour.findMany({
            where: { siteId: Number(siteId), date: { gte: new Date(String(debut)), lte: new Date(String(fin)) } }
          })
        : Promise.resolve([])
    ])
    const quotaSamediActif = config?.quotaSamediActif ?? false

    // Pour chaque jour de la période, calculer la capacité
    const dateDebut = new Date(String(debut))
    const dateFin = new Date(String(fin))
    const jours: Record<string, { capacite: number; techniciens: any[]; actif: boolean }> = {}

    for (let d = new Date(dateDebut); d <= dateFin; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      const exception = exceptions.find(e => e.date.toISOString().split('T')[0] === dateStr)
      const jourActif = exception ? exception.actif : (d.getDay() === 6 ? quotaSamediActif : true)
      let capaciteJour = 0
      const techJour: any[] = []

      for (const tech of techniciens) {
        const absence = tech.absences.find((a: any) => a.date.toISOString().split('T')[0] === dateStr)
        const quota = !jourActif ? 0 : (absence
          ? (absence.quotaOverride !== null ? absence.quotaOverride : 0)
          : tech.quotaJournalier)
        capaciteJour += quota
        techJour.push({
          id: tech.id,
          utilisateur: tech.utilisateur,
          quota,
          quotaBase: tech.quotaJournalier,
          absent: absence ? (absence.quotaOverride === null) : false,
          absenceId: absence?.id ?? null,
          absenceMotif: absence?.motif ?? null,
        })
      }
      jours[dateStr] = { capacite: capaciteJour, techniciens: techJour, actif: jourActif }
    }

    res.json(jours)
  } catch (e) { next(e) }
}

export async function toggleJourCapacite(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const { date } = req.body
    if (!date) return res.status(400).json({ error: 'date requise' })

    const dateObj = new Date(String(date))
    const config = await prisma.configProduction.findUnique({ where: { siteId: Number(siteId) } })
    const defautActif = dateObj.getDay() === 6 ? (config?.quotaSamediActif ?? false) : true

    const existante = await prisma.exceptionCapaciteJour.findUnique({
      where: { siteId_date: { siteId: Number(siteId), date: dateObj } }
    })
    const actifActuel = existante ? existante.actif : defautActif
    const nouvelActif = !actifActuel

    if (nouvelActif === defautActif) {
      // Retour au comportement par défaut : suppression de l'exception si elle existe
      if (existante) await prisma.exceptionCapaciteJour.delete({ where: { id: existante.id } })
    } else {
      await prisma.exceptionCapaciteJour.upsert({
        where: { siteId_date: { siteId: Number(siteId), date: dateObj } },
        create: { siteId: Number(siteId), date: dateObj, actif: nouvelActif },
        update: { actif: nouvelActif }
      })
    }

    res.json({ ok: true, actif: nouvelActif })
  } catch (e) { next(e) }
}

// ─── CARTES (groupes P/N × RMA en stock) ─────────────────────────────────────

export async function getCartes(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params

    const stockIds = await getStatutIdsByRole(Number(siteId), 'estStock')

    const champFamille = await prisma.champArticle.findFirst({
      where: { siteId: Number(siteId), code: { in: ['FAMILLE', 'FAMILY'] } }
    })

    const inventaires = await prisma.inventaire.findMany({
      where: {
        siteId: Number(siteId),
        archive: false,
        statutId: stockIds.length > 0 ? { in: stockIds } : undefined
      },
      include: {
        article: champFamille ? { include: { valeurs: { where: { champId: champFamille.id } } } } : true
      }
    })

    // SLA par client (recherche insensible à la casse)
    const champsClient = await prisma.champClient.findMany({ where: { siteId: Number(siteId) } })
    const champClientSLA = champsClient.find(c => c.code.toUpperCase() === 'SLA' || c.label.toUpperCase().includes('SLA'))
    const champClientNOM = champsClient.find(c => ['NOM', 'NOM_CLIENT', 'RAISON_SOCIALE', 'CLIENT', 'NOM_SOCIETE', 'SOCIETE'].includes(c.code.toUpperCase()))
    const slaParClient: Record<string, number> = {}
    if (champClientSLA && champClientNOM) {
      const clients = await prisma.client.findMany({
        where: { siteId: Number(siteId) },
        include: { valeurs: { where: { champId: { in: [champClientSLA.id, champClientNOM.id] } } } }
      })
      for (const cl of clients) {
        const nom = cl.valeurs.find(v => v.champId === champClientNOM!.id)?.valeur
        const sla = cl.valeurs.find(v => v.champId === champClientSLA!.id)?.valeur
        if (nom && sla && !isNaN(Number(sla))) slaParClient[nom] = Number(sla)
      }
    }

    // Grouper par RMA × customer → articles par PN
    type GroupePN = { pnValeur: string; designationValeur: string; ids: number[]; quantite: number; caisseMap: Map<string, number> }
    type GroupeRMA = { rmaValeur: string; clientValeur: string; dateRic: Date | null; articles: Map<string, GroupePN> }
    const groupesRMA = new Map<string, GroupeRMA>()

    for (const inv of inventaires) {
      const pnVal     = inv.partNumber ?? ''
      const rmaVal    = inv.rma       ?? ''
      const clientVal = inv.customer  ?? ''
      const desgVal   = (champFamille ? (inv as any).article?.valeurs?.[0]?.valeur : null) ?? inv.productFamily ?? ''
      const keyRMA = `${rmaVal}__${clientVal}`
      if (!groupesRMA.has(keyRMA)) {
        groupesRMA.set(keyRMA, { rmaValeur: rmaVal, clientValeur: clientVal, dateRic: inv.dateRic, articles: new Map() })
      }
      const gr = groupesRMA.get(keyRMA)!
      if (inv.dateRic && (!gr.dateRic || inv.dateRic < gr.dateRic)) gr.dateRic = inv.dateRic

      if (!gr.articles.has(pnVal)) {
        gr.articles.set(pnVal, { pnValeur: pnVal, designationValeur: desgVal, ids: [], quantite: 0, caisseMap: new Map() })
      }
      const ga = gr.articles.get(pnVal)!
      ga.ids.push(inv.id)
      ga.quantite++
      if (inv.caisse) ga.caisseMap.set(inv.caisse, (ga.caisseMap.get(inv.caisse) ?? 0) + 1)
    }

    const result = Array.from(groupesRMA.values()).map(gr => ({
      rmaValeur: gr.rmaValeur,
      clientValeur: gr.clientValeur,
      dateRic: gr.dateRic,
      slaJours: gr.clientValeur ? (slaParClient[gr.clientValeur] ?? null) : null,
      totalQuantite: Array.from(gr.articles.values()).reduce((s, a) => s + a.quantite, 0),
      articles: Array.from(gr.articles.values()).map(a => ({
        pnValeur: a.pnValeur,
        designationValeur: a.designationValeur,
        ids: a.ids,
        quantite: a.quantite,
        caisses: Array.from(a.caisseMap.entries()).map(([numero, quantite]) => ({ numero, quantite }))
      })).sort((a, b) => a.pnValeur.localeCompare(b.pnValeur))
    }))

    res.json(result)
  } catch (e) { next(e) }
}

// ─── DEMANDES DE TRANSFERT ───────────────────────────────────────────────────

export async function getDemandes(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const { statut } = req.query
    const demandes = await prisma.demandeTransfert.findMany({
      where: {
        siteId: Number(siteId),
        ...(statut ? { statut: String(statut) } : {})
      },
      include: {
        article: { include: { valeurs: { include: { champ: true } } } },
        lignes: { include: { inventaire: { include: { statut: true, pieces: true } } } }
      },
      orderBy: [{ datePlanifiee: 'asc' }, { createdAt: 'desc' }]
    })
    res.json(demandes)
  } catch (e) { next(e) }
}

export async function createDemandeSN(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const { datePlanifiee, quantite, pnValeur, rmaValeur, clientValeur } = req.body

    const stockIds2 = await getStatutIdsByRole(Number(siteId), 'estStock')
    const matches = await prisma.inventaire.findMany({
      where: {
        siteId: Number(siteId),
        archive: false,
        statutId: stockIds2.length > 0 ? { in: stockIds2 } : undefined,
        partNumber: pnValeur ?? undefined,
        rma: rmaValeur ?? undefined,
        customer: clientValeur ?? undefined,
      }
    })

    const qteDemandee = Math.min(Number(quantite), matches.length)
    if (qteDemandee === 0) return res.status(400).json({ error: 'Aucun article disponible pour ce P/N × RMA' })

    const selectionnes = matches.slice(0, qteDemandee)
    const qte = selectionnes.length

    // Trouver le statut avec rôle 'estTransfert'
    const transfertIds = await getStatutIdsByRole(Number(siteId), 'estTransfert')
    const statutTransfert = transfertIds.length > 0
      ? await prisma.statut.findFirst({ where: { id: { in: transfertIds } } })
      : null
    if (!statutTransfert) return res.status(400).json({ error: 'Aucun statut avec rôle Transfert configuré dans le workflow' })

    // Créer la demande + lignes + changer les statuts
    const demande = await prisma.demandeTransfert.create({
      data: {
        siteId: Number(siteId),
        type: 'SN',
        datePlanifiee: new Date(datePlanifiee),
        quantite: qte,
        pnValeur,
        rmaValeur,
        clientValeur: clientValeur ?? null,
        lignes: { create: selectionnes.map(inv => ({ inventaireId: inv.id })) }
      },
      include: { lignes: true }
    })

    // Passer les inventaires en statut Transfert
    await prisma.inventaire.updateMany({
      where: { id: { in: selectionnes.map(inv => inv.id) } },
      data: { statutId: statutTransfert.id }
    })

    res.json({ ...demande, quantiteDemandee: qteDemandee })
  } catch (e) { next(e) }
}

export async function createDemandeQTE(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const { datePlanifiee, quantite, articleId } = req.body
    const qte = Number(quantite)

    // Vérifier le stock logistique disponible (mouvementQTE : RECEPTION + TRANSFERT/SORTIE -)
    const mouvements = await prisma.mouvementQTE.findMany({
      where: { siteId: Number(siteId), articleId: Number(articleId) }
    })
    const stockDisponible = mouvements.reduce((acc, m) => {
      if (m.type === 'RECEPTION') return acc + m.quantite
      if (m.type === 'TRANSFERT' || m.type === 'SORTIE') return acc - m.quantite
      return acc
    }, 0)

    if (stockDisponible < qte) {
      return res.status(400).json({
        error: `Stock insuffisant : ${stockDisponible} unité${stockDisponible > 1 ? 's' : ''} disponible${stockDisponible > 1 ? 's' : ''}, ${qte} demandée${qte > 1 ? 's' : ''}.`
      })
    }

    const demande = await prisma.demandeTransfert.create({
      data: {
        siteId: Number(siteId),
        type: 'QTE',
        datePlanifiee: new Date(datePlanifiee),
        quantite: qte,
        articleId: Number(articleId)
      },
      include: { article: true }
    })
    res.json(demande)
  } catch (e) { next(e) }
}

export async function validerDemande(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const demande = await prisma.demandeTransfert.findUnique({
      where: { id: Number(id) },
      include: { lignes: true }
    })
    if (!demande) return res.status(404).json({ error: 'Demande introuvable' })
    if (demande.statut !== 'EN_ATTENTE') return res.status(400).json({ error: 'Demande déjà traitée' })

    if (demande.type === 'SN' && demande.lignes.length > 0) {
      // Déclencher la transition workflow depuis le statut estTransfert
      const invIds = demande.lignes.map(l => l.inventaireId)
      const premierInv = await prisma.inventaire.findFirst({ where: { id: { in: invIds } }, select: { statutId: true } })
      if (premierInv?.statutId) {
        const transition = await prisma.transition.findFirst({
          where: { siteId: demande.siteId, statutFromId: premierInv.statutId },
          include: { statutTo: true }
        })
        if (transition) {
          const today = new Date()
          await prisma.inventaire.updateMany({
            where: { id: { in: invIds } },
            data: { statutId: transition.statutToId, dateLav: today }
          })
        }
      }

      // Tracer l'opérateur ayant validé le transfert
      for (const inventaireId of invIds) {
        await enregistrerOperation({
          siteId: demande.siteId,
          inventaireId,
          userId: req.user?.id,
          type: 'TRANSFERT',
          details: { demandeId: demande.id }
        })
      }
    }

    if (demande.type === 'QTE' && demande.articleId) {
      // Incrémenter l'inventaire labo
      await prisma.inventaireLabo.upsert({
        where: { siteId_articleId: { siteId: demande.siteId, articleId: demande.articleId } },
        create: { siteId: demande.siteId, articleId: demande.articleId, quantite: demande.quantite },
        update: { quantite: { increment: demande.quantite } }
      })
      // Créer le mouvement de sortie logistique (décrémente le stock Suivi PDA)
      await prisma.mouvementQTE.create({
        data: {
          siteId: demande.siteId,
          articleId: demande.articleId,
          type: 'TRANSFERT',
          quantite: demande.quantite,
          userId: (req as any).user?.id ?? null,
        }
      })
    }

    const updated = await prisma.demandeTransfert.update({
      where: { id: Number(id) },
      data: { statut: 'VALIDEE' }
    })
    res.json(updated)
  } catch (e) { next(e) }
}

export async function annulerDemande(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const demande = await prisma.demandeTransfert.findUnique({
      where: { id: Number(id) },
      include: { lignes: true }
    })
    if (!demande) return res.status(404).json({ error: 'Demande introuvable' })
    if (demande.statut === 'ANNULEE') return res.status(400).json({ error: 'Demande déjà annulée' })

    // Remettre en statut Stock (rôle 'estStock') uniquement les inventaires SN dont le
    // statut actuel permet encore une annulation sans rien fausser dans le circuit :
    // - 'estTransfert' : la machine n'a pas encore bougé physiquement, rien n'a été fait dessus.
    // - 'ATTENTE_RÉPARATION' : la machine est en production mais rien n'a encore été fait dessus.
    // Pour tout autre statut (déjà réparée, expédiée, etc.), l'annulation est refusée :
    // la demande reste valide et visible au planning.
    if (demande.type === 'SN' && demande.lignes.length > 0) {
      const transfertIds = await getStatutIdsByRole(demande.siteId, 'estTransfert')
      const attenteReparationIds = await getStatutIdsByRole(demande.siteId, 'ATTENTE_RÉPARATION')
      const annulableIds = [...new Set([...transfertIds, ...attenteReparationIds])]
      const stockIds = await getStatutIdsByRole(demande.siteId, 'estStock')
      const statutStock = stockIds.length > 0 ? await prisma.statut.findFirst({ where: { id: { in: stockIds } } }) : null

      const enAttenteOuReparation = annulableIds.length > 0
        ? await prisma.inventaire.count({
            where: { id: { in: demande.lignes.map(l => l.inventaireId) }, statutId: { in: annulableIds } }
          })
        : 0

      if (enAttenteOuReparation === 0) {
        return res.status(400).json({ error: 'Le statut actuel de cette commande ne permet pas son annulation.' })
      }

      if (statutStock) {
        await prisma.inventaire.updateMany({
          where: { id: { in: demande.lignes.map(l => l.inventaireId) }, statutId: { in: annulableIds } },
          data: { statutId: statutStock.id }
        })
      }
    }

    const updated = await prisma.demandeTransfert.update({
      where: { id: Number(id) },
      data: { statut: 'ANNULEE' }
    })
    res.json(updated)
  } catch (e) { next(e) }
}

