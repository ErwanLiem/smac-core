import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { normCode, getArticlesQTE } from '../utils/pda'
import { logActivite, computeResultat } from '../utils/historique'
import { hasRole } from '../utils/roles'
import { ATTENTE_ROLES } from './attenteInfo'

const prisma = new PrismaClient()

/** Renvoie les IDs des statuts n'ayant aucun des rôles système → machines en cours de production */
async function getStatutsEnProduction(siteId: number): Promise<number[]> {
  const statuts = await prisma.statut.findMany({ where: { siteId }, select: { id: true, roles: true } })
  return statuts
    .filter(s => !hasRole(s.roles, 'estStock') && !hasRole(s.roles, 'estTransfert') && !hasRole(s.roles, 'estFinal'))
    .map(s => s.id)
}

// ─── Liste des RMA en cours de réparation ────────────────────────────────────

export async function getRmaList(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const statutIds = await getStatutsEnProduction(siteId)
    if (statutIds.length === 0) return res.json([])

    const inventaires = await prisma.inventaire.findMany({
      where: { siteId, archive: false, statutId: { in: statutIds } },
      select: { id: true, rma: true, partNumber: true, customer: true }
    })

    const groupes: Record<string, { rma: string; count: number; client: string; pns: string[] }> = {}
    for (const inv of inventaires) {
      const rma    = inv.rma    || '(Sans RMA)'
      const pn     = inv.partNumber ?? ''
      const client = inv.customer   ?? ''
      if (!groupes[rma]) groupes[rma] = { rma, count: 0, client, pns: [] }
      groupes[rma].count++
      if (pn && !groupes[rma].pns.includes(pn)) groupes[rma].pns.push(pn)
    }

    res.json(Object.values(groupes).sort((a, b) => a.rma.localeCompare(b.rma)))
  } catch (e) { next(e) }
}

// ─── Inventaires d'un RMA ─────────────────────────────────────────────────────

export async function getInventairesRma(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const rma    = decodeURIComponent(req.params.rma)
    const statutIds = await getStatutsEnProduction(siteId)
    if (statutIds.length === 0) return res.json([])

    const rmaFilter = rma === '(Sans RMA)' ? null : rma
    const inventaires = await prisma.inventaire.findMany({
      where: { siteId, archive: false, statutId: { in: statutIds }, rma: rmaFilter ?? undefined },
      include: { statut: true }
    })

    const result = inventaires.map(inv => ({
      id: inv.id,
      pn:              inv.partNumber        ?? '',
      sn:              inv.serialNumber      ?? '',
      customer:        inv.customer          ?? '',
      descrCode:       inv.descrCode         ?? '',
      repaireNotes:    inv.repaireNotes      ?? '',
      livelloRiparazione: inv.livelloRiparazione ?? '',
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

    const statutIds = await getStatutsEnProduction(siteId)
    const inv = await prisma.inventaire.findFirst({
      where: { siteId, archive: false, serialNumber: sn, statutId: { in: statutIds } }
    })

    if (!inv) return res.status(404).json({ error: 'Aucune machine trouvée pour ce SN' })
    res.json({ inventaireId: inv.id })
  } catch (e) { next(e) }
}

// ─── Détail complet d'un inventaire (modal réparation) ───────────────────────

export async function getDetailInventaire(req: Request, res: Response, next: any) {
  try {
    const siteId       = Number(req.params.siteId)
    const inventaireId = Number(req.params.id)

    const inv = await prisma.inventaire.findUnique({
      where: { id: inventaireId },
      include: {
        statut: true,
        pieces: true,
        article: { include: { valeurs: { include: { champ: true } } } }
      }
    })
    if (!inv) return res.status(404).json({ error: 'Inventaire introuvable' })

    // DESIGNATION et FAMILLE depuis l'article lié
    let designationMachine = ''
    let modelMachine = ''
    if (inv.article) {
      designationMachine = inv.article.valeurs.find(v => normCode(v.champ.code) === 'DESIGNATION')?.valeur ?? ''
      modelMachine       = inv.article.valeurs.find(v => normCode(v.champ.code) === 'FAMILLE')?.valeur    ?? ''
    }

    // Historique activité
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

    // Articles PDA disponibles filtrés par MODEL
    const { articlesQTE, champModel: champModelArt, champDetail } = await getArticlesQTE(prisma, siteId)
    const champsArticle = await prisma.champArticle.findMany({ where: { siteId } })
    const champNiveauRep = champsArticle.find(c => normCode(c.code) === 'NIVEAU_DE_REP')

    const laboItems = await prisma.inventaireLabo.findMany({
      where: { siteId, articleId: { in: articlesQTE.map(a => a.id) } }
    })

    const pdaDispos = articlesQTE
      .filter(art => {
        if (modelMachine && champModelArt) {
          const artModel = art.valeurs.find(v => v.champId === champModelArt.id)?.valeur ?? ''
          if (artModel && normCode(artModel) !== normCode(modelMachine)) return false
        }
        return (laboItems.find(l => l.articleId === art.id)?.quantite ?? 0) > 0
      })
      .map(art => {
        const stock      = laboItems.find(l => l.articleId === art.id)?.quantite ?? 0
        const model      = champModelArt  ? art.valeurs.find(v => v.champId === champModelArt.id)?.valeur  ?? '' : ''
        const detail     = champDetail    ? art.valeurs.find(v => v.champId === champDetail.id)?.valeur    ?? '' : ''
        const niveauRep  = champNiveauRep ? art.valeurs.find(v => v.champId === champNiveauRep.id)?.valeur ?? '' : ''
        const reference  = art.valeurs[0]?.valeur ?? ''
        return { articleId: art.id, reference, detail, model, niveauRep, stock }
      })

    // Statuts disponibles pour changer le statut depuis le module réparation
    const tousStatutsProduction = await prisma.statut.findMany({
      where: { siteId, id: { in: await getStatutsEnProduction(siteId) } }
    })
    const statutRepare       = tousStatutsProduction.find(s => hasRole(s.roles, 'estRepare')) ?? null
    const statutsAttenteInfo = tousStatutsProduction.filter(s =>
      ATTENTE_ROLES.some(role => hasRole(s.roles, role))
    )

    res.json({
      id:           inv.id,
      pn:           inv.partNumber         ?? '',
      sn:           inv.serialNumber       ?? '',
      rma:          inv.rma                ?? '',
      designation:  designationMachine,
      client:       inv.customer           ?? '',
      panneClient:  inv.defectFromCustomer ?? '',
      panneConstate:inv.descrCode          ?? '',
      niveauRep:    inv.livelloRiparazione ?? '',
      model:        modelMachine,
      statut:       inv.statut,
      historique,
      pdaDispos,
      statutRepare,
      statutsAttenteInfo,
    })
  } catch (e) { next(e) }
}

// ─── Saisir descr. Code (panne constatée) ────────────────────────────────────

export async function saisirPanneConstatee(req: Request, res: Response, next: any) {
  try {
    const inventaireId = Number(req.params.id)
    const siteId       = Number(req.params.siteId)
    const { valeur }   = req.body
    const userId       = req.user?.id ?? null

    const inv = await prisma.inventaire.update({
      where: { id: inventaireId },
      data: { descrCode: valeur ?? null }
    })

    await logActivite({
      siteId, userId: userId ?? undefined, type: 'MODIFICATION', entite: 'inventaire', entiteId: inventaireId,
      details: { label: `Descr. code : ${valeur}`, couleur: '#f59e0b' }
    })

    res.json({ success: true, descrCode: inv.descrCode })
  } catch (e) { next(e) }
}

// ─── Utiliser une pièce PDA ───────────────────────────────────────────────────

export async function utiliserPDA(req: Request, res: Response, next: any) {
  try {
    const siteId       = Number(req.params.siteId)
    const inventaireId = Number(req.params.id)
    const { articleId, quantite = 1, pn, pnType, sp, status } = req.body
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

    // Récupérer NIVEAU_DE_REP sur l'article PDA
    const champsArticle = await prisma.champArticle.findMany({ where: { siteId } })
    const champNiveauDep = champsArticle.find(c => normCode(c.code) === 'NIVEAU_DE_REP')
    let niveauRep = ''
    if (champNiveauDep) {
      const valNiv = await prisma.valeurChamp.findFirst({ where: { articleId: Number(articleId), champId: champNiveauDep.id } })
      niveauRep = valNiv?.valeur ?? ''
    }

    // Créer l'enregistrement dans piecesUtilisees + écrire livelloRiparazione
    const updates: Promise<any>[] = [
      prisma.piecesUtilisees.create({
        data: { inventaireId, pn: pn ?? null, pnType: pnType ?? null, sp: sp ?? null, status: status ?? null }
      })
    ]
    if (niveauRep) {
      updates.push(prisma.inventaire.update({ where: { id: inventaireId }, data: { livelloRiparazione: niveauRep } }))
    }
    await Promise.all(updates)

    // Label de l'article pour le log
    const champPNArt = champsArticle.find(c => normCode(c.code) === 'PN')
    const valPN = champPNArt
      ? await prisma.valeurChamp.findFirst({ where: { articleId: Number(articleId), champId: champPNArt.id } })
      : null
    const labelPDA = pn ?? valPN?.valeur ?? `Article #${articleId}`

    await logActivite({
      siteId, userId: userId ?? undefined, type: 'MODIFICATION', entite: 'inventaire', entiteId: inventaireId,
      details: { label: `PDA utilisé : ${labelPDA} ×${quantite}${niveauRep ? ` → Niv. ${niveauRep}` : ''}`, couleur: '#8b5cf6' }
    })

    res.json({ success: true, niveauRep })
  } catch (e) { next(e) }
}

// ─── Changer le statut d'un inventaire (ASP, ASW, REPARE, etc.) ──────────────

export async function changerStatutReparation(req: Request, res: Response, next: any) {
  try {
    const siteId       = Number(req.params.siteId)
    const inventaireId = Number(req.params.id)
    const { statutCode } = req.body
    const userId = req.user?.id ?? null

    const [statut, invActuel] = await Promise.all([
      prisma.statut.findUnique({ where: { siteId_code: { siteId, code: statutCode } } }),
      prisma.inventaire.findUnique({ where: { id: inventaireId }, include: { statut: true } })
    ])
    if (!statut) return res.status(404).json({ error: 'Statut introuvable' })

    const labelSource = invActuel?.statut?.label ?? '?'

    // Si la réparation est terminée : horodater dateRip + enregistrer techLabo
    const data: Record<string, any> = { statutId: statut.id }
    if (hasRole(statut.roles, 'estFinal') || hasRole(statut.roles, 'estRepare')) {
      data.dateRip = new Date()
      if (userId) {
        const utilisateur = await prisma.utilisateur.findUnique({ where: { id: userId }, select: { login: true } })
        if (utilisateur) data.techLabo = utilisateur.login
      }
    }

    await prisma.inventaire.update({ where: { id: inventaireId }, data })

    const resultat = await computeResultat(inventaireId, invActuel?.statut?.ordre ?? 0, statut.ordre, statut.label)
    await logActivite({
      siteId, userId: userId ?? undefined, type: 'TRANSITION_STATUT', entite: 'inventaire', entiteId: inventaireId,
      details: { label: `${labelSource} → ${statut.label}`, couleur: statut.couleur, statutAvant: labelSource, statutApres: statut.label },
      resultat
    })

    res.json({ success: true, statut })
  } catch (e) { next(e) }
}
