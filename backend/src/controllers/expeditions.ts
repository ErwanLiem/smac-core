import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { hasRole } from '../utils/roles'
import { enregistrerOperation } from '../utils/operations'
import { logActivite } from '../utils/historique'

const prisma = new PrismaClient()

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normCode(s: string) {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_').trim()
}

const CODES_SN = ['SN', 'S_N', 'NUMERO_SERIE', 'NUMERO DE SERIE', 'SERIAL']

function normCodeBrut(s: string) {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

/** Champs S/N candidats (mêmes critères que checkSN) */
function findChampsSN(champsInv: { id: number; code: string }[]) {
  return champsInv.filter(c => {
    const n = normCodeBrut(c.code).replace(/\s+/g, '_')
    const ns = normCodeBrut(c.code).replace(/\s+/g, ' ')
    return CODES_SN.includes(n) || CODES_SN.includes(ns) || CODES_SN.includes(normCodeBrut(c.code))
  })
}

function valeurChamp(valeurs: { champId: number; valeur: string | null }[], champ?: { id: number }): string {
  if (!champ) return ''
  return valeurs.find(v => v.champId === champ.id)?.valeur ?? ''
}

/**
 * Trouve le statut "Contrôle qualité" (rôle CONTROL) et la transition de sortie associée
 * (déjà configurés dans le workflow — voir Configuration → Workflow).
 */
async function getTransitionEmballage(siteId: number) {
  const statuts = await prisma.statut.findMany({ where: { siteId } })
  const statutControle = statuts.find(s => hasRole(s.roles, 'CONTROL'))
  if (!statutControle) return null

  const transition = await prisma.transition.findFirst({
    where: { siteId, statutFromId: statutControle.id },
    include: { statutTo: true },
    orderBy: { ordre: 'asc' }
  })
  return transition ? { statutControle, transition } : null
}

/** Champs inventaire utilisés pour l'affichage (P/N, RMA, désignation, modèle, client, S/N) */
async function getChampsAffichage(siteId: number) {
  const champsInv = await prisma.champInventaire.findMany({ where: { siteId } })
  const config = await prisma.configProduction.findUnique({ where: { siteId } })
  const champPN          = champsInv.find(c => normCode(c.code) === normCode(config?.champPNCode ?? 'PN'))
  const champRMA         = champsInv.find(c => normCode(c.code) === normCode(config?.champRMACode ?? 'BL'))
  const champDesignation = champsInv.find(c => normCode(c.code) === 'DESIGNATION')
  const champClient      = champsInv.find(c => normCode(c.code) === 'CLIENT')
  const champModel       = champsInv.find(c => normCode(c.code) === 'TYPE')
  const champsSN = findChampsSN(champsInv)
  const champSN = champsSN[0]
  return { champsInv, champPN, champRMA, champDesignation, champClient, champModel, champSN }
}

/** Génère le prochain numéro de Master Box pour le site (ex: MB-0001, MB-0002...) */
async function genererNumeroMasterBox(siteId: number): Promise<string> {
  const boxes = await prisma.masterBox.findMany({ where: { siteId }, select: { numero: true } })
  let max = 0
  for (const b of boxes) {
    const m = b.numero.match(/^MB-(\d+)$/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `MB-${String(max + 1).padStart(4, '0')}`
}

/**
 * Trouve la "zone" d'un client (champ `ZONE` du module Clients, ex: "A3F" / "Adyen")
 * à partir de la valeur stockée dans le champ inventaire `CLIENT` (qui correspond au
 * champ `NOM` du client). Retourne `null` si non trouvé/non configuré.
 */
async function getZoneClient(siteId: number, clientValeur: string | null): Promise<string | null> {
  if (!clientValeur) return null

  const champNom  = await prisma.champClient.findFirst({ where: { siteId, code: 'NOM' } })
  const champZone = await prisma.champClient.findFirst({ where: { siteId, code: 'ZONE' } })
  if (!champNom || !champZone) return null

  const valeurNom = await prisma.valeurChampClient.findFirst({
    where: { champId: champNom.id, valeur: clientValeur },
    include: { client: { include: { valeurs: true } } }
  })
  if (!valeurNom) return null

  return valeurNom.client.valeurs.find(v => v.champId === champZone.id)?.valeur ?? null
}

// ─── Scan emballage ──────────────────────────────────────────────────────────

export async function scanEmballage(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const sn = String(req.body?.sn ?? '').trim()
    if (!sn) return res.status(400).json({ error: 'S/N requis' })

    const champsInv = await prisma.champInventaire.findMany({ where: { siteId } })
    const champsSN = findChampsSN(champsInv)
    const idsSN = champsSN.length > 0 ? champsSN.map(c => c.id) : champsInv.map(c => c.id)

    const valeur = await prisma.valeurChampInventaire.findFirst({
      where: { champId: { in: idsSN }, valeur: sn },
      include: { inventaire: { include: { statut: true, valeurs: true } } }
    })

    if (!valeur || !valeur.inventaire) {
      return res.status(404).json({ error: `S/N ${sn} introuvable en inventaire` })
    }

    const inv = valeur.inventaire

    if (!hasRole(inv.statut?.roles, 'CONTROL')) {
      return res.status(400).json({
        error: `Ce S/N n'est pas en statut "Contrôle qualité" (statut actuel : ${inv.statut?.label ?? '—'})`,
        statutActuel: inv.statut?.label ?? null
      })
    }

    const result = await getTransitionEmballage(siteId)
    if (!result) {
      return res.status(400).json({ error: 'Aucune transition "Emballage" configurée depuis le statut "Contrôle qualité" (Configuration → Workflow)' })
    }

    await prisma.inventaire.update({
      where: { id: inv.id },
      data: { statutId: result.transition.statutToId }
    })

    await enregistrerOperation({
      siteId,
      inventaireId: inv.id,
      champCode: 'OPE.EMBALLAGE',
      userId: req.user?.id,
      type: 'EMBALLAGE'
    })

    const { champPN, champRMA, champDesignation, champClient } = await getChampsAffichage(siteId)

    res.json({
      ok: true,
      inventaireId: inv.id,
      sn,
      pnValeur: valeurChamp(inv.valeurs, champPN),
      rmaValeur: valeurChamp(inv.valeurs, champRMA),
      designationValeur: valeurChamp(inv.valeurs, champDesignation),
      clientValeur: valeurChamp(inv.valeurs, champClient),
      statut: result.transition.statutTo.label
    })
  } catch (e) { next(e) }
}

// ─── Liste des articles emballés (groupés par RMA × P/N) ────────────────────

export async function getEmballages(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)

    const result = await getTransitionEmballage(siteId)
    if (!result) return res.json([])
    const statutEmballeId = result.transition.statutToId

    const { champPN, champRMA, champDesignation, champClient, champSN } = await getChampsAffichage(siteId)

    const inventaires = await prisma.inventaire.findMany({
      where: { siteId, statutId: statutEmballeId, ligneMasterBox: { is: null } },
      include: { valeurs: true },
      orderBy: { updatedAt: 'desc' }
    })

    const groupes = new Map<string, {
      pnValeur: string; rmaValeur: string; designationValeur: string; clientValeur: string
      ids: number[]; sns: string[]
    }>()

    for (const inv of inventaires) {
      const pnVal     = valeurChamp(inv.valeurs, champPN)
      const rmaVal    = valeurChamp(inv.valeurs, champRMA)
      const desigVal  = valeurChamp(inv.valeurs, champDesignation)
      const clientVal = valeurChamp(inv.valeurs, champClient)
      const snVal     = valeurChamp(inv.valeurs, champSN)
      const key = `${pnVal}__${rmaVal}`
      if (!groupes.has(key)) {
        groupes.set(key, { pnValeur: pnVal, rmaValeur: rmaVal, designationValeur: desigVal, clientValeur: clientVal, ids: [], sns: [] })
      }
      const g = groupes.get(key)!
      g.ids.push(inv.id)
      if (snVal) g.sns.push(snVal)
    }

    const data = Array.from(groupes.values()).map(g => ({
      pnValeur: g.pnValeur,
      rmaValeur: g.rmaValeur,
      designationValeur: g.designationValeur,
      clientValeur: g.clientValeur,
      quantite: g.ids.length,
      sns: g.sns
    }))

    res.json(data)
  } catch (e) { next(e) }
}

// ─── Master Box ──────────────────────────────────────────────────────────────

/** Articles "Emballé" pas encore affectés à une Master Box */
export async function getDisponiblesMasterBox(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)

    const result = await getTransitionEmballage(siteId)
    if (!result) return res.json([])
    const statutEmballeId = result.transition.statutToId

    const { champPN, champRMA, champDesignation, champClient, champSN } = await getChampsAffichage(siteId)

    const inventaires = await prisma.inventaire.findMany({
      where: { siteId, statutId: statutEmballeId, ligneMasterBox: { is: null } },
      include: { valeurs: true },
      orderBy: { updatedAt: 'desc' }
    })

    const data = inventaires.map(inv => ({
      id: inv.id,
      sn: valeurChamp(inv.valeurs, champSN),
      pnValeur: valeurChamp(inv.valeurs, champPN),
      rmaValeur: valeurChamp(inv.valeurs, champRMA),
      designationValeur: valeurChamp(inv.valeurs, champDesignation),
      clientValeur: valeurChamp(inv.valeurs, champClient),
    }))

    res.json(data)
  } catch (e) { next(e) }
}

/** Construit le détail d'une Master Box (étiquette + liste des terminaux) */
async function getMasterBoxDetailData(siteId: number, id: number) {
  const masterBox = await prisma.masterBox.findFirst({
    where: { id, siteId },
    include: { lignes: { include: { inventaire: { include: { valeurs: true } } } } }
  })
  if (!masterBox) return null

  const { champPN, champRMA, champDesignation, champClient, champModel, champSN } = await getChampsAffichage(siteId)

  const articles = masterBox.lignes.map(l => ({
    inventaireId: l.inventaireId,
    sn: valeurChamp(l.inventaire.valeurs, champSN),
    pnValeur: valeurChamp(l.inventaire.valeurs, champPN),
    rmaValeur: valeurChamp(l.inventaire.valeurs, champRMA),
    designationValeur: valeurChamp(l.inventaire.valeurs, champDesignation),
    modelValeur: valeurChamp(l.inventaire.valeurs, champModel),
    clientValeur: valeurChamp(l.inventaire.valeurs, champClient),
  }))

  const groupesMap = new Map<string, { pnValeur: string; rmaValeur: string; designationValeur: string; modelValeur: string; quantite: number }>()
  for (const a of articles) {
    const key = `${a.pnValeur}__${a.rmaValeur}`
    if (!groupesMap.has(key)) {
      groupesMap.set(key, { pnValeur: a.pnValeur, rmaValeur: a.rmaValeur, designationValeur: a.designationValeur, modelValeur: a.modelValeur, quantite: 0 })
    }
    groupesMap.get(key)!.quantite++
  }

  const zone = await getZoneClient(siteId, masterBox.clientValeur)

  return {
    id: masterBox.id,
    numero: masterBox.numero,
    clientValeur: masterBox.clientValeur,
    zone,
    statut: masterBox.statut,
    createdAt: masterBox.createdAt,
    quantite: articles.length,
    articles,
    groupes: Array.from(groupesMap.values())
  }
}

/** Crée une Master Box à partir d'une sélection d'articles "Emballé" (statut inchangé) */
export async function createMasterBox(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const inventaireIds: number[] = Array.isArray(req.body?.inventaireIds)
      ? req.body.inventaireIds.map((v: any) => Number(v)).filter((n: number) => Number.isFinite(n))
      : []

    if (inventaireIds.length === 0) {
      return res.status(400).json({ error: 'Aucun article sélectionné' })
    }

    const result = await getTransitionEmballage(siteId)
    if (!result) {
      return res.status(400).json({ error: 'Aucune transition "Emballage" configurée (Configuration → Workflow)' })
    }
    const statutEmballeId = result.transition.statutToId

    const inventaires = await prisma.inventaire.findMany({
      where: { id: { in: inventaireIds }, siteId },
      include: { valeurs: true, ligneMasterBox: true }
    })

    if (inventaires.length !== inventaireIds.length) {
      return res.status(400).json({ error: 'Certains articles sélectionnés sont introuvables' })
    }

    const dejaBoxe = inventaires.find(i => i.ligneMasterBox)
    if (dejaBoxe) {
      return res.status(400).json({ error: `L'article #${dejaBoxe.id} est déjà affecté à une Master Box` })
    }

    const horsEmballage = inventaires.find(i => i.statutId !== statutEmballeId)
    if (horsEmballage) {
      return res.status(400).json({ error: `L'article #${horsEmballage.id} n'est pas (ou plus) au statut "Emballé"` })
    }

    const { champClient, champRMA } = await getChampsAffichage(siteId)
    const clients = new Set(inventaires.map(i => valeurChamp(i.valeurs, champClient) || ''))
    if (clients.size > 1) {
      return res.status(400).json({ error: 'Les articles sélectionnés appartiennent à des clients différents : une Master Box ne peut concerner qu\'un seul client' })
    }
    const clientValeur = [...clients][0] || null

    // Zone Adyen : un carton ne peut contenir qu'une seule RMA
    const zone = await getZoneClient(siteId, clientValeur)
    if (zone === 'Adyen') {
      const rmas = new Set(inventaires.map(i => valeurChamp(i.valeurs, champRMA) || ''))
      if (rmas.size > 1) {
        return res.status(400).json({ error: 'Pour la zone Adyen, tous les articles d\'une Master Box doivent appartenir à la même RMA' })
      }
    }

    const numero = await genererNumeroMasterBox(siteId)

    const masterBox = await prisma.masterBox.create({
      data: {
        siteId,
        numero,
        clientValeur,
        userId: req.user?.id ?? null,
        lignes: { create: inventaireIds.map(id => ({ inventaireId: id })) }
      }
    })

    for (const inv of inventaires) {
      await logActivite({ siteId, userId: req.user?.id, type: 'MASTERBOX', entite: 'inventaire', entiteId: inv.id, details: { numero } })
    }

    const detail = await getMasterBoxDetailData(siteId, masterBox.id)
    res.status(201).json(detail)
  } catch (e) { next(e) }
}

/** Historique des Master Box créées */
export async function getMasterBoxes(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)

    const masterBoxes = await prisma.masterBox.findMany({
      where: { siteId },
      include: { _count: { select: { lignes: true } } },
      orderBy: { createdAt: 'desc' }
    })

    res.json(masterBoxes.map(mb => ({
      id: mb.id,
      numero: mb.numero,
      clientValeur: mb.clientValeur,
      statut: mb.statut,
      createdAt: mb.createdAt,
      quantite: mb._count.lignes
    })))
  } catch (e) { next(e) }
}

/** Détail d'une Master Box (étiquette + liste des terminaux, pour impression) */
export async function getMasterBoxDetail(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const id = Number(req.params.id)

    const detail = await getMasterBoxDetailData(siteId, id)
    if (!detail) return res.status(404).json({ error: 'Master Box introuvable' })

    res.json(detail)
  } catch (e) { next(e) }
}
