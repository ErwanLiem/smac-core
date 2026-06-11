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

/** Normalise un libellé en ne gardant que les lettres/chiffres (ex: "Bon D'envoi" -> "BONDENVOI") */
function normAlnum(s: string) {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '')
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

/** Renseigne la date du jour dans le champ inventaire dont le code correspond (s'il est configuré) */
async function renseignerDateChamp(siteId: number, champsInv: { id: number; code: string }[], inventaireId: number, code: string, dateValeur: string) {
  const champ = champsInv.find(c => normCode(c.code) === code)
  if (!champ) return
  await prisma.valeurChampInventaire.upsert({
    where: { inventaireId_champId: { inventaireId, champId: champ.id } },
    create: { inventaireId, champId: champ.id, valeur: dateValeur },
    update: { valeur: dateValeur }
  })
}

/** Renseigne une valeur libre dans le champ inventaire dont le code (normAlnum) correspond (s'il est configuré) */
async function renseignerValeurChamp(champsInv: { id: number; code: string }[], inventaireId: number, codeAlnum: string, valeur: string) {
  const champ = champsInv.find(c => normAlnum(c.code) === codeAlnum)
  if (!champ) return
  await prisma.valeurChampInventaire.upsert({
    where: { inventaireId_champId: { inventaireId, champId: champ.id } },
    create: { inventaireId, champId: champ.id, valeur },
    update: { valeur }
  })
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
  const champsSN = findChampsSN(champsInv)
  const champSN = champsSN[0]

  // Le "Model" est un champ du catalogue Article (champArticle), pas de l'inventaire
  const champsArticle = await prisma.champArticle.findMany({ where: { siteId } })
  const champModelArticle = champsArticle.find(c => normCode(c.code) === 'MODEL')

  return { champsInv, champPN, champRMA, champDesignation, champClient, champModelArticle, champSN }
}

/**
 * Génère le prochain numéro de Master Box pour un client donné (ex: MB-0001, MB-0002... — séquence propre à chaque client).
 * Les Master Box déjà "EXPEDIEE" ne comptent pas : une fois toutes les Master Box d'un client expédiées,
 * la numérotation repart de MB-0001 au tour suivant.
 */
async function genererNumeroMasterBox(siteId: number, clientValeur: string | null): Promise<string> {
  const boxes = await prisma.masterBox.findMany({ where: { siteId, clientValeur, statut: { not: 'EXPEDIEE' } }, select: { numero: true } })
  let max = 0
  for (const b of boxes) {
    const m = b.numero.match(/^MB-(\d+)$/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `MB-${String(max + 1).padStart(4, '0')}`
}

/**
 * Trouve le statut "Emballé" et la transition de sortie associée vers le statut
 * "Expédié" (ex: transition "Expédition", déjà configurée dans le workflow).
 */
async function getTransitionExpedition(siteId: number) {
  const emballage = await getTransitionEmballage(siteId)
  if (!emballage) return null
  const statutEmballeId = emballage.transition.statutToId

  const transition = await prisma.transition.findFirst({
    where: { siteId, statutFromId: statutEmballeId },
    include: { statutTo: true },
    orderBy: { ordre: 'asc' }
  })
  return transition ? { statutEmballeId, transition } : null
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

/**
 * Trouve la Master Box "ouverte" (en cours de remplissage, statut OUVERTE) du client
 * pour y ajouter un article scanné, ou en crée une nouvelle si aucune n'existe / aucune
 * n'est compatible.
 * Zone Adyen : un carton ne peut contenir qu'un seul P/N pour une seule RMA — on ne
 * réutilise une box existante que si elle est vide ou déjà sur le même couple P/N × RMA,
 * sinon on en crée une nouvelle. Zone A3F (ou non définie) : pas de contrainte, on
 * réutilise simplement la box ouverte la plus récente du client.
 */
async function trouverOuCreerMasterBoxActive(
  siteId: number,
  clientValeur: string | null,
  pnValeur: string | null,
  rmaValeur: string | null,
  zone: string | null,
  champPN: { id: number } | undefined,
  champRMA: { id: number } | undefined,
  userId?: number | null
) {
  const candidates = await prisma.masterBox.findMany({
    where: { siteId, clientValeur, statut: 'OUVERTE' },
    include: { lignes: { include: { inventaire: { include: { valeurs: true } } } } },
    orderBy: { createdAt: 'desc' }
  })

  for (const box of candidates) {
    if (zone === 'Adyen' && box.lignes.length > 0) {
      const premiere = box.lignes[0].inventaire
      const pnBox = valeurChamp(premiere.valeurs, champPN)
      const rmaBox = valeurChamp(premiere.valeurs, champRMA)
      if (pnBox !== (pnValeur || '') || rmaBox !== (rmaValeur || '')) continue
    }
    return box
  }

  const numero = await genererNumeroMasterBox(siteId, clientValeur)
  return prisma.masterBox.create({
    data: { siteId, numero, clientValeur, statut: 'OUVERTE', userId: userId ?? null },
    include: { lignes: true }
  })
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

    const dateAujourdhui = new Date().toISOString().split('T')[0]
    await renseignerDateChamp(siteId, champsInv, inv.id, 'DATE_PACK', dateAujourdhui)
    await renseignerDateChamp(siteId, champsInv, inv.id, 'DATE_CLS', dateAujourdhui)

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

/**
 * Scanne un S/N "Emballé" et l'ajoute à la Master Box active du client correspondant
 * (créée à la volée si besoin). Le statut de l'inventaire reste "Emballé" — seule
 * l'affectation à une Master Box change.
 */
export async function scanMasterBox(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const sn = String(req.body?.sn ?? '').trim()
    if (!sn) return res.status(400).json({ error: 'S/N requis' })

    const champsInv = await prisma.champInventaire.findMany({ where: { siteId } })
    const champsSN = findChampsSN(champsInv)
    const idsSN = champsSN.length > 0 ? champsSN.map(c => c.id) : champsInv.map(c => c.id)

    const valeur = await prisma.valeurChampInventaire.findFirst({
      where: { champId: { in: idsSN }, valeur: sn },
      include: { inventaire: { include: { statut: true, valeurs: true, ligneMasterBox: true } } }
    })

    if (!valeur || !valeur.inventaire) {
      return res.status(404).json({ error: `S/N ${sn} introuvable en inventaire` })
    }

    const inv = valeur.inventaire

    const result = await getTransitionEmballage(siteId)
    if (!result) {
      return res.status(400).json({ error: 'Aucune transition "Emballage" configurée (Configuration → Workflow)' })
    }
    const statutEmballeId = result.transition.statutToId

    if (inv.statutId !== statutEmballeId) {
      return res.status(400).json({
        error: `Ce S/N n'est pas au statut "Emballé" (statut actuel : ${inv.statut?.label ?? '—'})`,
        statutActuel: inv.statut?.label ?? null
      })
    }

    if (inv.ligneMasterBox) {
      return res.status(400).json({ error: `Ce S/N est déjà affecté à une Master Box` })
    }

    const { champPN, champRMA, champDesignation, champClient } = await getChampsAffichage(siteId)
    const clientValeur = valeurChamp(inv.valeurs, champClient) || null
    const pnValeur = valeurChamp(inv.valeurs, champPN) || null
    const rmaValeur = valeurChamp(inv.valeurs, champRMA) || null
    const zone = await getZoneClient(siteId, clientValeur)

    const masterBox = await trouverOuCreerMasterBoxActive(siteId, clientValeur, pnValeur, rmaValeur, zone, champPN, champRMA, req.user?.id)

    await prisma.ligneMasterBox.create({ data: { masterBoxId: masterBox.id, inventaireId: inv.id } })

    await logActivite({ siteId, userId: req.user?.id, type: 'MASTERBOX', entite: 'inventaire', entiteId: inv.id, details: { numero: masterBox.numero } })

    res.json({
      ok: true,
      sn,
      pnValeur: valeurChamp(inv.valeurs, champPN),
      rmaValeur,
      designationValeur: valeurChamp(inv.valeurs, champDesignation),
      clientValeur,
      masterBox: { id: masterBox.id, numero: masterBox.numero }
    })
  } catch (e) { next(e) }
}

/** Master Box "OUVERTE" (en cours de remplissage), avec leur contenu détaillé */
export async function getMasterBoxesEnCours(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)

    const boxes = await prisma.masterBox.findMany({
      where: { siteId, statut: 'OUVERTE' },
      orderBy: [{ clientValeur: 'asc' }, { createdAt: 'asc' }]
    })

    const details = await Promise.all(boxes.map(b => getMasterBoxDetailData(siteId, b.id)))
    res.json(details.filter(Boolean))
  } catch (e) { next(e) }
}

/** Clôture une Master Box "OUVERTE" : passe en "EN_ATTENTE" (enregistrée, prête à expédier) */
export async function enregistrerMasterBox(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const id = Number(req.params.id)

    const box = await prisma.masterBox.findFirst({ where: { id, siteId }, include: { _count: { select: { lignes: true } } } })
    if (!box) return res.status(404).json({ error: 'Master Box introuvable' })
    if (box.statut !== 'OUVERTE') return res.status(400).json({ error: 'Cette Master Box est déjà enregistrée' })
    if (box._count.lignes === 0) return res.status(400).json({ error: 'Cette Master Box est vide' })

    await prisma.masterBox.update({ where: { id }, data: { statut: 'EN_ATTENTE' } })

    res.json({ ok: true })
  } catch (e) { next(e) }
}

/** Master Box "EN_ATTENTE" (enregistrées, non encore expédiées), groupées par client */
export async function getMasterBoxesEnregistrees(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const { champPN, champRMA, champDesignation } = await getChampsAffichage(siteId)

    const boxes = await prisma.masterBox.findMany({
      where: { siteId, statut: 'EN_ATTENTE' },
      include: { lignes: { include: { inventaire: { include: { valeurs: true } } } } },
      orderBy: [{ clientValeur: 'asc' }, { createdAt: 'asc' }]
    })

    const parClient = new Map<string, {
      clientValeur: string
      totalQuantite: number
      boxes: { id: number; numero: string; quantite: number; createdAt: Date }[]
      groupesMap: Map<string, { pnValeur: string; rmaValeur: string; designationValeur: string; quantite: number }>
    }>()

    for (const b of boxes) {
      const client = b.clientValeur || 'Sans client'
      if (!parClient.has(client)) {
        parClient.set(client, { clientValeur: client, totalQuantite: 0, boxes: [], groupesMap: new Map() })
      }
      const g = parClient.get(client)!
      g.boxes.push({ id: b.id, numero: b.numero, quantite: b.lignes.length, createdAt: b.createdAt })
      g.totalQuantite += b.lignes.length

      for (const l of b.lignes) {
        const pnVal = valeurChamp(l.inventaire.valeurs, champPN)
        const rmaVal = valeurChamp(l.inventaire.valeurs, champRMA)
        const desigVal = valeurChamp(l.inventaire.valeurs, champDesignation)
        const key = `${pnVal}__${rmaVal}`
        if (!g.groupesMap.has(key)) {
          g.groupesMap.set(key, { pnValeur: pnVal, rmaValeur: rmaVal, designationValeur: desigVal, quantite: 0 })
        }
        g.groupesMap.get(key)!.quantite++
      }
    }

    res.json(Array.from(parClient.values()).map(g => ({
      clientValeur: g.clientValeur,
      totalQuantite: g.totalQuantite,
      boxes: g.boxes,
      groupes: Array.from(g.groupesMap.values())
    })))
  } catch (e) { next(e) }
}

/**
 * Retire un article d'une Master Box pas encore expédiée (cas d'erreur détectée
 * lors du contrôle après validation de la Master Box). Si la Master Box devient
 * vide, elle est supprimée.
 */
export async function retirerLigneMasterBox(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const inventaireId = Number(req.body?.inventaireId)
    if (!inventaireId) return res.status(400).json({ error: 'inventaireId requis' })

    const ligne = await prisma.ligneMasterBox.findUnique({
      where: { inventaireId },
      include: { masterBox: true }
    })
    if (!ligne || ligne.masterBox.siteId !== siteId) {
      return res.status(404).json({ error: 'Cet article n\'est affecté à aucune Master Box' })
    }
    if (ligne.masterBox.statut === 'EXPEDIEE') {
      return res.status(400).json({ error: 'Cette Master Box a déjà été expédiée' })
    }

    await prisma.ligneMasterBox.delete({ where: { inventaireId } })

    const restantes = await prisma.ligneMasterBox.count({ where: { masterBoxId: ligne.masterBoxId } })
    let masterBoxSupprimee = false
    if (restantes === 0) {
      await prisma.masterBox.delete({ where: { id: ligne.masterBoxId } })
      masterBoxSupprimee = true
    }

    await logActivite({ siteId, userId: req.user?.id, type: 'MASTERBOX', entite: 'inventaire', entiteId: inventaireId, details: { numero: ligne.masterBox.numero, action: 'retrait' } })

    res.json({ ok: true, masterBoxSupprimee })
  } catch (e) { next(e) }
}

/**
 * Expédie toutes les Master Box "EN_ATTENTE" d'un client : applique la transition
 * "Emballé -> Expédié" à tous les articles concernés (tracée via OPE.EXPEDITION) et
 * passe les Master Box au statut "EXPEDIEE".
 */
export async function envoyerMasterBoxes(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const raw = req.body?.clientValeur
    const clientValeur = (raw === null || raw === undefined || raw === '') ? null : String(raw)
    const bonEnvoiRaw = req.body?.bonEnvoi
    const bonEnvoi = (bonEnvoiRaw === null || bonEnvoiRaw === undefined) ? '' : String(bonEnvoiRaw).trim()

    const expedition = await getTransitionExpedition(siteId)
    if (!expedition) {
      return res.status(400).json({ error: 'Aucune transition "Expédition" configurée depuis le statut "Emballé" (Configuration → Workflow)' })
    }

    const boxes = await prisma.masterBox.findMany({
      where: { siteId, statut: 'EN_ATTENTE', clientValeur },
      include: { lignes: true }
    })

    if (boxes.length === 0) {
      return res.status(400).json({ error: 'Aucune Master Box en attente pour ce client' })
    }

    const champsInv = await prisma.champInventaire.findMany({ where: { siteId } })
    const dateAujourdhui = new Date().toISOString().split('T')[0]

    let nbArticles = 0
    for (const box of boxes) {
      for (const ligne of box.lignes) {
        await prisma.inventaire.update({
          where: { id: ligne.inventaireId },
          data: { statutId: expedition.transition.statutToId }
        })
        await renseignerDateChamp(siteId, champsInv, ligne.inventaireId, 'DATE_SHP', dateAujourdhui)
        if (bonEnvoi) {
          await renseignerValeurChamp(champsInv, ligne.inventaireId, 'BONDENVOI', bonEnvoi)
        }
        await enregistrerOperation({
          siteId,
          inventaireId: ligne.inventaireId,
          champCode: 'OPE.EXPEDITION',
          userId: req.user?.id,
          type: 'EXPEDITION'
        })
        nbArticles++
      }
      await prisma.masterBox.update({ where: { id: box.id }, data: { statut: 'EXPEDIEE' } })
    }

    res.json({ ok: true, nbBoxes: boxes.length, nbArticles })
  } catch (e) { next(e) }
}

/**
 * Liste des champs inventaire et des articles (avec leurs valeurs) contenus dans
 * les Master Box "EN_ATTENTE" d'un client — utilisé pour l'export Excel de l'onglet Envoi.
 */
export async function getArticlesMasterBoxEnregistrees(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const raw = req.query.clientValeur
    const clientValeur = (raw === undefined || raw === null || raw === '' || raw === 'Sans client') ? null : String(raw)

    const champs = await prisma.champInventaire.findMany({ where: { siteId, actif: true }, orderBy: { ordre: 'asc' } })

    const lignes = await prisma.ligneMasterBox.findMany({
      where: { masterBox: { siteId, statut: 'EN_ATTENTE', clientValeur } },
      include: { inventaire: { include: { valeurs: true, statut: true } } }
    })

    const articles = lignes.map(l => ({
      id: l.inventaire.id,
      statut: l.inventaire.statut ? { label: l.inventaire.statut.label } : null,
      valeurs: l.inventaire.valeurs.map(v => ({ champId: v.champId, valeur: v.valeur }))
    }))

    res.json({ champs, articles })
  } catch (e) { next(e) }
}

/** Construit le détail d'une Master Box (étiquette + liste des terminaux) */
async function getMasterBoxDetailData(siteId: number, id: number) {
  const masterBox = await prisma.masterBox.findFirst({
    where: { id, siteId },
    include: { lignes: { include: { inventaire: { include: { valeurs: true, article: { include: { valeurs: true } } } } } } }
  })
  if (!masterBox) return null

  const { champPN, champRMA, champDesignation, champClient, champModelArticle, champSN } = await getChampsAffichage(siteId)

  const articles = masterBox.lignes.map(l => ({
    inventaireId: l.inventaireId,
    sn: valeurChamp(l.inventaire.valeurs, champSN),
    pnValeur: valeurChamp(l.inventaire.valeurs, champPN),
    rmaValeur: valeurChamp(l.inventaire.valeurs, champRMA),
    designationValeur: valeurChamp(l.inventaire.valeurs, champDesignation),
    modelValeur: valeurChamp(l.inventaire.article?.valeurs ?? [], champModelArticle),
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
