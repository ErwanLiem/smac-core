import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { logActivite } from '../utils/historique'
import { hasRole } from '../utils/roles'

const prisma = new PrismaClient()

/** Statuts avec rôle estMajInjection (machines en attente de contrôle qualité) */
async function getStatutsMajInjection(siteId: number): Promise<number[]> {
  const statuts = await prisma.statut.findMany({ where: { siteId }, select: { id: true, roles: true } })
  return statuts.filter(s => hasRole(s.roles, 'estMajInjection')).map(s => s.id)
}

// ─── Liste des RMA en attente de contrôle qualité ─────────────────────────────

export async function getRmaList(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const statutIds = await getStatutsMajInjection(siteId)
    if (!statutIds.length) return res.json([])

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
    const statutIds = await getStatutsMajInjection(siteId)
    if (!statutIds.length) return res.json([])

    const rmaFilter = rma === '(Sans RMA)' ? null : rma
    const inventaires = await prisma.inventaire.findMany({
      where: { siteId, archive: false, statutId: { in: statutIds }, rma: rmaFilter ?? undefined },
      include: { statut: true }
    })

    res.json(inventaires.map(inv => ({
      id:                 inv.id,
      pn:                 inv.partNumber         ?? '',
      sn:                 inv.serialNumber       ?? '',
      customer:           inv.customer           ?? '',
      livelloRiparazione: inv.livelloRiparazione ?? '',
      statut:             inv.statut,
    })))
  } catch (e) { next(e) }
}

// ─── Scan SN ──────────────────────────────────────────────────────────────────

export async function scanInventaire(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const sn     = String(req.query.sn ?? '').trim()
    if (!sn) return res.status(400).json({ error: 'SN manquant' })

    const statutIds = await getStatutsMajInjection(siteId)
    const inv = await prisma.inventaire.findFirst({
      where: { siteId, archive: false, serialNumber: sn, statutId: { in: statutIds } }
    })

    if (!inv) return res.status(404).json({ error: 'Aucune machine trouvée pour ce SN' })
    res.json({ inventaireId: inv.id })
  } catch (e) { next(e) }
}

// ─── Détail complet (modal contrôle qualité) ──────────────────────────────────

export async function getDetailInventaire(req: Request, res: Response, next: any) {
  try {
    const siteId       = Number(req.params.siteId)
    const inventaireId = Number(req.params.id)

    const inv = await prisma.inventaire.findUnique({
      where: { id: inventaireId },
      include: { statut: true, pieces: true }
    })
    if (!inv) return res.status(404).json({ error: 'Inventaire introuvable' })

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

    // Statuts disponibles depuis le module CQ
    const tousStatuts = await prisma.statut.findMany({ where: { siteId } })
    const statutsCQ     = tousStatuts.filter(s => hasRole(s.roles, 'estControleQualite'))
    const statutsRetour = tousStatuts.filter(s => hasRole(s.roles, 'estMajInjection') || hasRole(s.roles, 'estRepare'))

    res.json({
      id:                 inv.id,
      serialNumber:       inv.serialNumber       ?? '',
      partNumber:         inv.partNumber         ?? '',
      rma:                inv.rma                ?? '',
      customer:           inv.customer           ?? '',
      livelloRiparazione: inv.livelloRiparazione ?? '',
      statut:             inv.statut,
      pieces:             inv.pieces,
      historique,
      statutsCQ,
      statutsRetour,
    })
  } catch (e) { next(e) }
}

// ─── Valider le contrôle qualité ──────────────────────────────────────────────

export async function validerControle(req: Request, res: Response, next: any) {
  try {
    const siteId       = Number(req.params.siteId)
    const inventaireId = Number(req.params.id)
    const { statutId } = req.body
    const userId       = req.user?.id ?? null

    const [statut, invActuel] = await Promise.all([
      prisma.statut.findUnique({ where: { id: Number(statutId) } }),
      prisma.inventaire.findUnique({ where: { id: inventaireId }, include: { statut: true } })
    ])
    if (!statut) return res.status(404).json({ error: 'Statut introuvable' })
    const labelSource = invActuel?.statut?.label ?? '?'

    await prisma.inventaire.update({
      where: { id: inventaireId },
      data: { statutId: statut.id, dateTest: new Date() }
    })

    await logActivite({
      siteId, userId: userId ?? undefined, type: 'TRANSITION_STATUT', entite: 'inventaire', entiteId: inventaireId,
      details: { label: `${labelSource} → ${statut.label}`, couleur: statut.couleur }
    })

    res.json({ success: true, statut })
  } catch (e) { next(e) }
}

// ─── Retour (→ MAJ/Injection ou → Réparation) ────────────────────────────────

export async function changerStatut(req: Request, res: Response, next: any) {
  try {
    const siteId       = Number(req.params.siteId)
    const inventaireId = Number(req.params.id)
    const { statutId } = req.body
    const userId = req.user?.id ?? null

    const [statut, invActuel] = await Promise.all([
      prisma.statut.findUnique({ where: { id: Number(statutId) } }),
      prisma.inventaire.findUnique({ where: { id: inventaireId }, include: { statut: true } })
    ])
    if (!statut) return res.status(404).json({ error: 'Statut introuvable' })
    const labelSource = invActuel?.statut?.label ?? '?'

    await prisma.inventaire.update({ where: { id: inventaireId }, data: { statutId: statut.id } })

    await logActivite({
      siteId, userId: userId ?? undefined, type: 'TRANSITION_STATUT', entite: 'inventaire', entiteId: inventaireId,
      details: { label: `${labelSource} → ${statut.label}`, couleur: statut.couleur }
    })

    res.json({ success: true, statut })
  } catch (e) { next(e) }
}
