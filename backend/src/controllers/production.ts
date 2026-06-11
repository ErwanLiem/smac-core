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
    })
  } catch (e) { next(e) }
}

export async function updateConfig(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const { champPNCode, champRMACode, labelPN, labelRMA, champTypeArticleCode, typesArticleQTE, champsAffichageQTE } = req.body
    const data = {
      champPNCode, champRMACode, labelPN, labelRMA,
      champTypeArticleCode: champTypeArticleCode ?? 'TYPE',
      typesArticleQTE: typesArticleQTE !== undefined ? JSON.stringify(typesArticleQTE) : undefined,
      champsAffichageQTE: champsAffichageQTE !== undefined ? JSON.stringify(champsAffichageQTE) : undefined,
    }
    const config = await prisma.configProduction.upsert({
      where: { siteId: Number(siteId) },
      create: { siteId: Number(siteId), ...data },
      update: data
    })
    // Parser les JSON avant de retourner
    res.json({
      ...config,
      typesArticleQTE: config.typesArticleQTE ? JSON.parse(config.typesArticleQTE) : [],
      champsAffichageQTE: config.champsAffichageQTE ? JSON.parse(config.champsAffichageQTE) : [],
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

    const techniciens = await prisma.technicienProduction.findMany({
      where: { siteId: Number(siteId), actif: true },
      include: {
        utilisateur: { select: { id: true, nom: true, prenom: true } },
        absences: debut && fin
          ? { where: { date: { gte: new Date(String(debut)), lte: new Date(String(fin)) } } }
          : {}
      }
    })

    // Pour chaque jour de la période, calculer la capacité
    const dateDebut = new Date(String(debut))
    const dateFin = new Date(String(fin))
    const jours: Record<string, { capacite: number; techniciens: any[] }> = {}

    for (let d = new Date(dateDebut); d <= dateFin; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      let capaciteJour = 0
      const techJour: any[] = []

      for (const tech of techniciens) {
        const absence = tech.absences.find((a: any) => a.date.toISOString().split('T')[0] === dateStr)
        const quota = absence
          ? (absence.quotaOverride !== null ? absence.quotaOverride : 0)
          : tech.quotaJournalier
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
      jours[dateStr] = { capacite: capaciteJour, techniciens: techJour }
    }

    res.json(jours)
  } catch (e) { next(e) }
}

// ─── CARTES (groupes P/N × RMA en stock) ─────────────────────────────────────

export async function getCartes(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params

    const config = await prisma.configProduction.findUnique({ where: { siteId: Number(siteId) } })
    const champPNCode  = config?.champPNCode  ?? 'PN'
    const champRMACode = config?.champRMACode ?? 'BL'

    const champsInv = await prisma.champInventaire.findMany({ where: { siteId: Number(siteId) } })
    const champPN  = champsInv.find(c => normCode(c.code) === normCode(champPNCode))
    const champRMA = champsInv.find(c => normCode(c.code) === normCode(champRMACode))

    if (!champPN || !champRMA) {
      return res.json([])
    }

    const champCAISSE      = champsInv.find(c => normCode(c.code) === 'CAISSE')
    const champDESIGNATION = champsInv.find(c => normCode(c.code) === 'DESIGNATION')
    const champCLIENT      = champsInv.find(c => normCode(c.code) === 'CLIENT')

    // Récupérer tous les inventaires avec statut rôle 'estStock'
    const stockIds = await getStatutIdsByRole(Number(siteId), 'estStock')
    const inventaires = await prisma.inventaire.findMany({
      where: {
        siteId: Number(siteId),
        statutId: stockIds.length > 0 ? { in: stockIds } : undefined
      },
      include: { valeurs: true }
    })

    // Grouper par P/N × RMA × Client
    const groupes = new Map<string, { pnValeur: string; rmaValeur: string; designationValeur: string; clientValeur: string; ids: number[]; quantite: number; caisseMap: Map<string, number> }>()

    for (const inv of inventaires) {
      const pnVal     = inv.valeurs.find(v => v.champId === champPN.id)?.valeur    ?? ''
      const rmaVal    = inv.valeurs.find(v => v.champId === champRMA.id)?.valeur   ?? ''
      const caisseVal = champCAISSE      ? (inv.valeurs.find(v => v.champId === champCAISSE.id)?.valeur      ?? '') : ''
      const desgVal   = champDESIGNATION ? (inv.valeurs.find(v => v.champId === champDESIGNATION.id)?.valeur ?? '') : ''
      const clientVal = champCLIENT      ? (inv.valeurs.find(v => v.champId === champCLIENT.id)?.valeur      ?? '') : ''
      const key = `${pnVal}__${rmaVal}__${clientVal}`
      if (!groupes.has(key)) {
        groupes.set(key, { pnValeur: pnVal, rmaValeur: rmaVal, designationValeur: desgVal, clientValeur: clientVal, ids: [], quantite: 0, caisseMap: new Map() })
      }
      const g = groupes.get(key)!
      g.ids.push(inv.id)
      g.quantite++
      if (caisseVal) g.caisseMap.set(caisseVal, (g.caisseMap.get(caisseVal) ?? 0) + 1)
    }

    const result = Array.from(groupes.values()).map(g => ({
      pnValeur: g.pnValeur,
      rmaValeur: g.rmaValeur,
      designationValeur: g.designationValeur,
      clientValeur: g.clientValeur,
      ids: g.ids,
      quantite: g.quantite,
      caisses: Array.from(g.caisseMap.entries()).map(([numero, quantite]) => ({ numero, quantite }))
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
        lignes: { include: { inventaire: { include: { statut: true, valeurs: { include: { champ: { select: { id: true, code: true } } } } } } } }
      },
      orderBy: [{ datePlanifiee: 'asc' }, { createdAt: 'desc' }]
    })
    res.json(demandes)
  } catch (e) { next(e) }
}

export async function createDemandeSN(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const { datePlanifiee, quantite, pnValeur, rmaValeur, clientValeur, caisseValeur, force } = req.body

    const config = await prisma.configProduction.findUnique({ where: { siteId: Number(siteId) } })
    const champPNCode  = config?.champPNCode  ?? 'PN'
    const champRMACode = config?.champRMACode ?? 'BL'

    const champsInv = await prisma.champInventaire.findMany({ where: { siteId: Number(siteId) } })
    const champPN     = champsInv.find(c => normCode(c.code) === normCode(champPNCode))
    const champRMA    = champsInv.find(c => normCode(c.code) === normCode(champRMACode))
    const champCAISSE = champsInv.find(c => normCode(c.code) === 'CAISSE')
    const champCLIENT = champsInv.find(c => normCode(c.code) === 'CLIENT')

    if (!champPN || !champRMA) return res.status(400).json({ error: 'Champs P/N ou RMA non configurés' })

    // Trouver les inventaires rôle 'estStock' pour ce P/N × RMA × Client (+ caisse si fournie)
    const stockIds2 = await getStatutIdsByRole(Number(siteId), 'estStock')
    const candidats = await prisma.inventaire.findMany({
      where: { siteId: Number(siteId), statutId: stockIds2.length > 0 ? { in: stockIds2 } : undefined },
      include: { valeurs: true }
    })
    const matches = candidats.filter(inv => {
      const pn     = inv.valeurs.find(v => v.champId === champPN!.id)?.valeur  ?? ''
      const rma    = inv.valeurs.find(v => v.champId === champRMA!.id)?.valeur ?? ''
      if (pn !== pnValeur || rma !== rmaValeur) return false
      if (champCLIENT) {
        const client = inv.valeurs.find(v => v.champId === champCLIENT.id)?.valeur ?? ''
        if (client !== (clientValeur ?? '')) return false
      }
      if (caisseValeur) {
        const caisse = champCAISSE ? (inv.valeurs.find(v => v.champId === champCAISSE.id)?.valeur ?? '') : ''
        return caisse === caisseValeur
      }
      return true
    })

    const qteDemandee = Math.min(Number(quantite), matches.length)
    if (qteDemandee === 0) return res.status(400).json({ error: 'Aucun article disponible pour ce P/N × RMA' })

    let selectionnes: typeof matches = []
    if (caisseValeur || force) {
      // Caisse explicitement choisie, ou dispatch exceptionnel (force) :
      // on prélève directement dans la sélection, quitte à scinder une caisse physique.
      selectionnes = matches.slice(0, qteDemandee)
    } else {
      // Pas de caisse choisie : ne jamais découper une caisse physique.
      // On ne dispatche que les caisses entièrement transférables dans la quantité demandée,
      // les articles sans caisse peuvent être pris à l'unité.
      const groupesCaisses = new Map<string, typeof matches>()
      const sansCaisse: typeof matches = []
      for (const inv of matches) {
        const caisse = champCAISSE ? (inv.valeurs.find(v => v.champId === champCAISSE.id)?.valeur ?? '') : ''
        if (caisse) {
          if (!groupesCaisses.has(caisse)) groupesCaisses.set(caisse, [])
          groupesCaisses.get(caisse)!.push(inv)
        } else {
          sansCaisse.push(inv)
        }
      }
      let restant = qteDemandee
      for (const items of groupesCaisses.values()) {
        if (items.length <= restant) {
          selectionnes.push(...items)
          restant -= items.length
        }
      }
      for (const inv of sansCaisse) {
        if (restant <= 0) break
        selectionnes.push(inv)
        restant--
      }

      if (selectionnes.length === 0) {
        return res.status(400).json({
          error: `Impossible de planifier : la capacité disponible (${qteDemandee}) ne permet de transférer aucune caisse complète et une caisse ne peut pas être scindée.`
        })
      }
    }

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

    // Vérifier le stock disponible en inventaire pour cet article
    // Pour les articles QTE (PDAs etc.), on ne filtre pas sur le statut :
    // ils n'ont pas forcément de workflow, on compte simplement ce qui est en inventaire.
    const champsInv = await prisma.champInventaire.findMany({ where: { siteId: Number(siteId) } })
    const champQte = champsInv.find(c => ['QUANTITE', 'QTE', 'QUANTITY'].includes(normCode(c.code)))

    const inventaireItems = await prisma.inventaire.findMany({
      where: { siteId: Number(siteId), articleId: Number(articleId) },
      include: { valeurs: true }
    })

    if (inventaireItems.length === 0) {
      return res.status(400).json({ error: `Aucun stock trouvé en inventaire pour cet article.` })
    }

    let stockDisponible = 0
    if (champQte) {
      for (const item of inventaireItems) {
        const val = item.valeurs.find(v => v.champId === champQte.id)?.valeur
        stockDisponible += parseInt(val ?? '0') || 0
      }
    } else {
      stockDisponible = inventaireItems.length
    }

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
          await prisma.inventaire.updateMany({ where: { id: { in: invIds } }, data: { statutId: transition.statutToId } })

          // Transition vers Attente réparation : horodater le passage au lavage (DATE LAV)
          if (hasRole(transition.statutTo.roles, 'ATTENTE_RÉPARATION')) {
            const champsInv = await prisma.champInventaire.findMany({ where: { siteId: demande.siteId } })
            const champDateLav = champsInv.find(c => normCode(c.code) === 'DATE_LAV')
            if (champDateLav) {
              const dateAujourdhui = new Date().toISOString().split('T')[0]
              for (const inventaireId of invIds) {
                await prisma.valeurChampInventaire.upsert({
                  where: { inventaireId_champId: { inventaireId, champId: champDateLav.id } },
                  create: { inventaireId, champId: champDateLav.id, valeur: dateAujourdhui },
                  update: { valeur: dateAujourdhui }
                })
              }
            }
          }
        }
      }

      // Tracer l'opérateur ayant validé le transfert
      for (const inventaireId of invIds) {
        await enregistrerOperation({
          siteId: demande.siteId,
          inventaireId,
          champCode: 'OPE.TRANSFERT',
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

      // Décrémenter le stock de l'inventaire source
      const champsInv = await prisma.champInventaire.findMany({ where: { siteId: demande.siteId } })
      const champQte = champsInv.find(c => ['QUANTITE', 'QTE', 'QUANTITY'].includes(normCode(c.code)))
      if (champQte) {
        const invItem = await prisma.inventaire.findFirst({ where: { siteId: demande.siteId, articleId: demande.articleId } })
        if (invItem) {
          const valQte = await prisma.valeurChampInventaire.findFirst({ where: { inventaireId: invItem.id, champId: champQte.id } })
          if (valQte) {
            const nouvQte = Math.max(0, (parseInt(valQte.valeur ?? '0') || 0) - (demande.quantite ?? 0))
            await prisma.valeurChampInventaire.update({ where: { id: valQte.id }, data: { valeur: String(nouvQte) } })
          }
        }
      }
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

    // Remettre les inventaires SN en statut Stock (rôle 'estStock')
    // — que la demande soit EN_ATTENTE ou VALIDEE (retour arrière)
    if (demande.type === 'SN' && demande.lignes.length > 0) {
      const stockIds = await getStatutIdsByRole(demande.siteId, 'estStock')
      const statutStock = stockIds.length > 0 ? await prisma.statut.findFirst({ where: { id: { in: stockIds } } }) : null
      if (statutStock) {
        await prisma.inventaire.updateMany({
          where: { id: { in: demande.lignes.map(l => l.inventaireId) } },
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

