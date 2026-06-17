import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { normCode, valeurPour } from '../utils/pda'
import { logActivite } from '../utils/historique'

const prisma = new PrismaClient()

async function getConfigRep(siteId: number) {
  const config = await prisma.configProduction.findUnique({ where: { siteId } })
  return {
    champRMACode: config?.champRMACode ?? 'BL',
    champPNCode:  config?.champPNCode  ?? 'PN',
  }
}

async function getStatutsRepare(siteId: number) {
  return prisma.statut.findMany({ where: { siteId, code: { in: ['REPARE', 'REPARER'] } } })
}

// ─── Liste des RMA en attente de MAJ/Injection ────────────────────────────────

export async function getRmaList(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const { champRMACode, champPNCode } = await getConfigRep(siteId)
    const statutsRepare = await getStatutsRepare(siteId)
    if (!statutsRepare.length) return res.json([])

    const champsInv   = await prisma.champInventaire.findMany({ where: { siteId } })
    const champRMA    = champsInv.find(c => normCode(c.code) === normCode(champRMACode))
    const champPN     = champsInv.find(c => normCode(c.code) === normCode(champPNCode))
    const champClient = champsInv.find(c => normCode(c.code) === 'CLIENT')

    const inventaires = await prisma.inventaire.findMany({
      where: { siteId, statutId: { in: statutsRepare.map(s => s.id) } },
      include: { valeurs: true }
    })

    const groupes: Record<string, { rma: string; count: number; client: string; pns: string[] }> = {}
    for (const inv of inventaires) {
      const rma    = valeurPour(inv.valeurs, champRMA) || '(Sans RMA)'
      const pn     = valeurPour(inv.valeurs, champPN)
      const client = valeurPour(inv.valeurs, champClient)
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
    const { champRMACode, champPNCode } = await getConfigRep(siteId)
    const statutsRepare = await getStatutsRepare(siteId)
    if (!statutsRepare.length) return res.json([])

    const champsInv   = await prisma.champInventaire.findMany({ where: { siteId } })
    const champRMA    = champsInv.find(c => normCode(c.code) === normCode(champRMACode))
    const champPN     = champsInv.find(c => normCode(c.code) === normCode(champPNCode))
    const champSN     = champsInv.find(c => normCode(c.code) === 'NUMERO_DE_SERIE' || normCode(c.code) === 'SN')
    const champDesig  = champsInv.find(c => normCode(c.code) === 'DESIGNATION')
    const champClient = champsInv.find(c => normCode(c.code) === 'CLIENT')
    const champPanne  = champsInv.find(c => normCode(c.code) === 'PANNE_CLIENT')
    const champNivRep = champsInv.find(c => normCode(c.code) === 'NIVEAU_REP')

    const inventaires = await prisma.inventaire.findMany({
      where: { siteId, statutId: { in: statutsRepare.map(s => s.id) } },
      include: { valeurs: true, statut: true }
    })

    const filtrés = inventaires.filter(inv =>
      (valeurPour(inv.valeurs, champRMA) || '(Sans RMA)') === rma
    )

    res.json(filtrés.map(inv => ({
      id:          inv.id,
      pn:          valeurPour(inv.valeurs, champPN),
      sn:          valeurPour(inv.valeurs, champSN),
      designation: valeurPour(inv.valeurs, champDesig),
      client:      valeurPour(inv.valeurs, champClient),
      panneClient: valeurPour(inv.valeurs, champPanne),
      niveauRep:   valeurPour(inv.valeurs, champNivRep),
      statut:      inv.statut,
    })))
  } catch (e) { next(e) }
}

// ─── Scan SN → trouver inventaire ────────────────────────────────────────────

export async function scanInventaire(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const sn     = String(req.query.sn ?? '').trim()
    if (!sn) return res.status(400).json({ error: 'SN manquant' })

    const statutsRepare = await getStatutsRepare(siteId)
    if (!statutsRepare.length) return res.status(404).json({ error: 'Statut REPARE introuvable' })

    const match = await prisma.valeurChampInventaire.findFirst({
      where: {
        valeur: sn,
        inventaire: { siteId, statutId: { in: statutsRepare.map(s => s.id) } }
      },
      include: { inventaire: true }
    })

    if (!match) return res.status(404).json({ error: 'Aucune machine trouvée pour ce SN' })
    res.json({ inventaireId: match.inventaireId })
  } catch (e) { next(e) }
}

// ─── Détail complet d'un inventaire (modal MAJ/Injection) ────────────────────

export async function getDetailInventaire(req: Request, res: Response, next: any) {
  try {
    const siteId       = Number(req.params.siteId)
    const inventaireId = Number(req.params.id)
    const { champRMACode, champPNCode } = await getConfigRep(siteId)

    const champsInv   = await prisma.champInventaire.findMany({ where: { siteId } })
    const champRMA    = champsInv.find(c => normCode(c.code) === normCode(champRMACode))
    const champPN     = champsInv.find(c => normCode(c.code) === normCode(champPNCode))
    const champSN     = champsInv.find(c => normCode(c.code) === 'NUMERO_DE_SERIE' || normCode(c.code) === 'SN')
    const champDesig  = champsInv.find(c => normCode(c.code) === 'DESIGNATION')
    const champClient = champsInv.find(c => normCode(c.code) === 'CLIENT')
    const champPanne  = champsInv.find(c => normCode(c.code) === 'PANNE_CLIENT')
    const champNivRep = champsInv.find(c => normCode(c.code) === 'NIVEAU_REP')

    const inv = await prisma.inventaire.findUnique({
      where: { id: inventaireId },
      include: { valeurs: true, statut: true }
    })
    if (!inv) return res.status(404).json({ error: 'Inventaire introuvable' })

    // Historique uniquement par inventaireId
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

    const [statutMajInjection, statutAttenteRep] = await Promise.all([
      prisma.statut.findFirst({ where: { siteId, code: 'MAJINJECTION' } }),
      prisma.statut.findFirst({ where: { siteId, code: 'ATTENTE_REP' } }),
    ])

    res.json({
      id:          inv.id,
      pn:          valeurPour(inv.valeurs, champPN),
      sn:          valeurPour(inv.valeurs, champSN),
      rma:         valeurPour(inv.valeurs, champRMA),
      designation: valeurPour(inv.valeurs, champDesig),
      client:      valeurPour(inv.valeurs, champClient),
      panneClient: valeurPour(inv.valeurs, champPanne),
      niveauRep:   valeurPour(inv.valeurs, champNivRep),
      statut:      inv.statut,
      historique,
      statutMajInjection: statutMajInjection ?? null,
      statutAttenteRep:   statutAttenteRep   ?? null,
    })
  } catch (e) { next(e) }
}

// ─── Valider MAJ/Injection ────────────────────────────────────────────────────

export async function validerMajInjection(req: Request, res: Response, next: any) {
  try {
    const siteId       = Number(req.params.siteId)
    const inventaireId = Number(req.params.id)
    const userId       = req.user?.id ?? null

    const statut = await prisma.statut.findFirst({ where: { siteId, code: 'MAJINJECTION' } })
    if (!statut) return res.status(404).json({ error: 'Statut MAJINJECTION introuvable' })

    const invActuel = await prisma.inventaire.findUnique({ where: { id: inventaireId }, include: { statut: true } })
    const labelSource = invActuel?.statut?.label ?? '?'

    await prisma.inventaire.update({
      where: { id: inventaireId },
      data: { statutId: statut.id },
    })

    const dateAujourdhui = new Date().toISOString().slice(0, 10)

    const [champDateClean, champOpeMaj] = await Promise.all([
      prisma.champInventaire.findFirst({ where: { siteId, code: 'DATE_CLEAN' } }),
      prisma.champInventaire.findFirst({ where: { siteId, code: 'OPE.MAJ' } }),
    ])

    const upserts: Promise<any>[] = []

    if (champDateClean) {
      upserts.push(prisma.valeurChampInventaire.upsert({
        where: { inventaireId_champId: { inventaireId, champId: champDateClean.id } },
        create: { inventaireId, champId: champDateClean.id, valeur: dateAujourdhui },
        update: { valeur: dateAujourdhui },
      }))
    }

    if (champOpeMaj && userId) {
      const utilisateur = await prisma.utilisateur.findUnique({ where: { id: userId }, select: { login: true } })
      if (utilisateur) {
        upserts.push(prisma.valeurChampInventaire.upsert({
          where: { inventaireId_champId: { inventaireId, champId: champOpeMaj.id } },
          create: { inventaireId, champId: champOpeMaj.id, valeur: utilisateur.login },
          update: { valeur: utilisateur.login },
        }))
      }
    }

    await Promise.all(upserts)

    await logActivite({
      siteId, userId: userId ?? undefined, type: 'TRANSITION_STATUT', entite: 'inventaire', entiteId: inventaireId,
      details: { label: `${labelSource} → ${statut.label}`, couleur: statut.couleur }
    })

    res.json({ success: true, statut })
  } catch (e) { next(e) }
}

// ─── Retour technicien (→ ATTENTE_REP) ───────────────────────────────────────

export async function changerStatut(req: Request, res: Response, next: any) {
  try {
    const siteId       = Number(req.params.siteId)
    const inventaireId = Number(req.params.id)
    const { statutCode } = req.body
    const userId = req.user?.id ?? null

    const [statut, invActuel] = await Promise.all([
      prisma.statut.findFirst({ where: { siteId, code: statutCode } }),
      prisma.inventaire.findUnique({ where: { id: inventaireId }, include: { statut: true } })
    ])
    if (!statut) return res.status(404).json({ error: `Statut ${statutCode} introuvable` })
    const labelSource = invActuel?.statut?.label ?? '?'

    await prisma.inventaire.update({ where: { id: inventaireId }, data: { statutId: statut.id } })

    await logActivite({
      siteId, userId: userId ?? undefined, type: 'TRANSITION_STATUT', entite: 'inventaire', entiteId: inventaireId,
      details: { label: `${labelSource} → ${statut.label}`, couleur: statut.couleur }
    })

    res.json({ success: true, statut })
  } catch (e) { next(e) }
}
