import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { hasRole } from '../utils/roles'
import { logActivite, computeResultat } from '../utils/historique'

const prisma = new PrismaClient()

// Rôle → code onglet
const ROLE_TYPE: Record<string, string> = {
  estAttentePiece:     'ASP',
  estAttenteSoft:      'ASW',
  estAttenteTechnique: 'ENG',
  estNonReparable:     'NLV',
  estAttenteDevis:     'PRV',
}

// Type → champ date inventaire (à l'entrée en attente)
const TYPE_DATE_ENTREE: Record<string, string> = {
  ASP: 'dateAsp',
  ASW: 'dateAsw',
  ENG: 'dateEng',
  NLV: 'dateNlv',
  PRV: 'datePrv',
}

// Type → champ date inventaire (à la sortie d'attente)
const TYPE_DATE_SORTIE: Record<string, string> = {
  ASP: 'dateLab',
  ASW: 'dateLab',
  ENG: 'dateLab',
  PRV: 'datePrr',
  // NLV : pas de date de sortie
}
const TYPE_ROLE: Record<string, string> = Object.fromEntries(
  Object.entries(ROLE_TYPE).map(([role, type]) => [type, role])
)

export const ATTENTE_ROLES = Object.keys(ROLE_TYPE)

// ─── Liste par type d'onglet ──────────────────────────────────────────────────

export async function getAttenteInfoByType(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const type   = req.params.type.toUpperCase()

    const items = await prisma.attenteInfo.findMany({
      where: { siteId, type },
      orderBy: { createdAt: 'desc' },
      include: {
        inventaire: {
          include: {
            statut: true,
            article: { include: { valeurs: { include: { champ: true } } } }
          }
        },
        utilisateur: { select: { nom: true, prenom: true } }
      }
    })

    const result = items.map(ai => {
      const inv = ai.inventaire
      const designation = inv.article?.valeurs.find(v => v.champ.code.toUpperCase() === 'DESIGNATION')?.valeur ?? ''
      const model       = inv.article?.valeurs.find(v => v.champ.code.toUpperCase() === 'FAMILLE')?.valeur ?? ''
      return {
        attenteInfoId: ai.id,
        inventaireId:  inv.id,
        pn:            inv.partNumber    ?? '',
        sn:            inv.serialNumber  ?? '',
        rma:           inv.rma           ?? '',
        client:        inv.customer      ?? '',
        designation,
        model,
        statut:        inv.statut ? { id: inv.statut.id, code: inv.statut.code, label: inv.statut.label, couleur: inv.statut.couleur } : null,
        commentaire:   ai.commentaire,
        technicien:    ai.utilisateur ? `${ai.utilisateur.prenom} ${ai.utilisateur.nom}` : null,
        createdAt:     ai.createdAt,
      }
    })

    res.json(result)
  } catch (e) { next(e) }
}

// ─── Entrer en attente info (appelé depuis ModalReparation) ──────────────────

export async function entrerAttenteInfo(req: Request, res: Response, next: any) {
  try {
    const siteId       = Number(req.params.siteId)
    const inventaireId = Number(req.params.id)
    const { statutCode, commentaire } = req.body as { statutCode: string; commentaire: string }
    const userId = req.user?.id ?? null

    if (!commentaire?.trim()) return res.status(400).json({ error: 'Un commentaire est obligatoire.' })

    const statut = await prisma.statut.findUnique({ where: { siteId_code: { siteId, code: statutCode } } })
    if (!statut) return res.status(400).json({ error: `Statut introuvable : ${statutCode}` })

    // Déduire le type (ASP/ASW/...) depuis le rôle du statut
    const roleStatut = ATTENTE_ROLES.find(r => hasRole(statut.roles, r))
    if (!roleStatut) return res.status(400).json({ error: `Le statut "${statutCode}" n'a pas de rôle d'attente info.` })
    const type = ROLE_TYPE[roleStatut]

    const invActuel = await prisma.inventaire.findUnique({ where: { id: inventaireId }, include: { statut: true } })
    if (!invActuel) return res.status(404).json({ error: 'Inventaire introuvable' })

    const champDate = TYPE_DATE_ENTREE[type]
    const dataInv: Record<string, any> = { statutId: statut.id }
    if (champDate) dataInv[champDate] = new Date()

    await prisma.$transaction([
      prisma.inventaire.update({ where: { id: inventaireId }, data: dataInv }),
      prisma.attenteInfo.upsert({
        where: { inventaireId },
        create: { siteId, inventaireId, type: type.toUpperCase(), commentaire: commentaire.trim(), userId },
        update: { type: type.toUpperCase(), commentaire: commentaire.trim(), userId, createdAt: new Date() },
      }),
    ])

    const resultat = await computeResultat(inventaireId, invActuel.statut?.ordre ?? 0, statut.ordre, statut.label)
    await logActivite({
      siteId, userId: userId ?? undefined, type: 'TRANSITION_STATUT', entite: 'inventaire', entiteId: inventaireId,
      details: { label: `${invActuel.statut?.label ?? '?'} → ${statut.label}`, couleur: statut.couleur, commentaire: commentaire.trim(), statutAvant: invActuel.statut?.label ?? '?', statutApres: statut.label },
      resultat
    })

    res.json({ success: true, statut })
  } catch (e) { next(e) }
}

// ─── Retour en production depuis le module attente info ───────────────────────

export async function retourProduction(req: Request, res: Response, next: any) {
  try {
    const siteId       = Number(req.params.siteId)
    const inventaireId = Number(req.params.inventaireId)
    const userId = req.user?.id ?? null

    const [tousStatuts, invActuel, attenteExistante] = await Promise.all([
      prisma.statut.findMany({ where: { siteId } }),
      prisma.inventaire.findUnique({ where: { id: inventaireId }, include: { statut: true } }),
      prisma.attenteInfo.findUnique({ where: { inventaireId } }),
    ])

    if (!invActuel) return res.status(404).json({ error: 'Inventaire introuvable' })
    if (!attenteExistante) return res.status(400).json({ error: 'Cet article n\'est pas en attente info.' })

    const statutCible = tousStatuts.find(s => hasRole(s.roles, 'estAttenteReparation'))
    if (!statutCible) return res.status(400).json({ error: 'Aucun statut "Attente réparation" (rôle estAttenteReparation) configuré dans le workflow.' })

    const champDateSortie = TYPE_DATE_SORTIE[attenteExistante.type]
    const dataInv: Record<string, any> = { statutId: statutCible.id }
    if (champDateSortie) dataInv[champDateSortie] = new Date()

    await prisma.$transaction([
      prisma.inventaire.update({ where: { id: inventaireId }, data: dataInv }),
      prisma.attenteInfo.delete({ where: { inventaireId } }),
    ])

    const resultat = await computeResultat(inventaireId, invActuel.statut?.ordre ?? 0, statutCible.ordre, statutCible.label)
    await logActivite({
      siteId, userId: userId ?? undefined, type: 'TRANSITION_STATUT', entite: 'inventaire', entiteId: inventaireId,
      details: { label: `${invActuel.statut?.label ?? '?'} → ${statutCible.label}`, couleur: statutCible.couleur, statutAvant: invActuel.statut?.label ?? '?', statutApres: statutCible.label },
      resultat
    })

    res.json({ success: true })
  } catch (e) { next(e) }
}
