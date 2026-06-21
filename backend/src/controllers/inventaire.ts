import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { logActivite } from '../utils/historique'
import { verifierReglesAlerte } from '../utils/reglesAlerte'
import { enregistrerOperation } from '../utils/operations'
import { getArticlesQTE } from '../utils/pda'

const prisma = new PrismaClient()

// ─── Vérification SN ─────────────────────────────────────────────────────────

export async function checkSN(req: Request, res: Response) {
  const { siteId, sn } = req.params

  const existants = await prisma.inventaire.findMany({
    where: { siteId: Number(siteId), serialNumber: sn },
    include: { statut: true }
  })

  if (existants.length === 0) return res.json({ existe: false })

  const actif = existants.find(e => {
    const r = e.statut?.roles
    try { return r ? !JSON.parse(r).includes('estFinal') : true } catch { return true }
  })
  const reference = actif ?? existants[existants.length - 1]
  const estFinal = !actif

  res.json({
    existe: true,
    estFinal,
    statut: reference.statut?.label ?? null,
    rma: reference.rma ?? null
  })
}

// ─── Inventaire ───────────────────────────────────────────────────────────────

export async function getAll(req: Request, res: Response) {
  const { siteId } = req.params
  const site = Number(siteId)

  const { articlesQTE } = await getArticlesQTE(prisma, site)
  const idsQTE = articlesQTE.map(a => a.id)

  const inventaires = await prisma.inventaire.findMany({
    where: {
      siteId: site,
      archive: false,
      ...(idsQTE.length > 0 ? { NOT: { articleId: { in: idsQTE } } } : {})
    },
    include: { article: true, statut: true, pieces: true, emplacement: true },
    orderBy: { createdAt: 'desc' }
  })
  res.json(inventaires)
}

export async function create(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const {
      articleId, statutId,
      serialNumber, partNumber, rma, bt, customer, productFamily, mercurySn,
      warranty, rmaCreationDate, dateRic, defectFromCustomer, genericNotes,
      caisse, emplacementId,
    } = req.body

    const alerte = await verifierReglesAlerte(prisma, Number(siteId), serialNumber ?? null)

    // Appliquer les champsAutoFill de la règle (écriture directe sur les colonnes fixes)
    const autoFillData: Record<string, any> = {}
    if (alerte?.champsAutoFill?.length) {
      for (const af of alerte.champsAutoFill) {
        autoFillData[af.colonne] = af.valeur
      }
    }

    const inventaire = await prisma.inventaire.create({
      data: {
        siteId: Number(siteId),
        articleId: articleId ? Number(articleId) : null,
        statutId: statutId ? Number(statutId) : null,
        serialNumber: serialNumber ?? null,
        partNumber: partNumber ?? null,
        rma: rma ?? null,
        bt: bt ?? null,
        customer: customer ?? null,
        productFamily: productFamily ?? null,
        mercurySn: mercurySn ?? null,
        warranty: warranty ?? null,
        rmaCreationDate: rmaCreationDate ? new Date(rmaCreationDate) : null,
        dateRic: dateRic ? new Date(dateRic) : null,
        defectFromCustomer: defectFromCustomer ?? null,
        genericNotes: genericNotes ?? null,
        caisse: caisse ?? null,
        emplacementId: emplacementId ? Number(emplacementId) : null,
        couleurAlerte: alerte?.couleurAlerte ?? null,
        regleAlerteId: alerte?.regleAlerteId ?? null,
        ...autoFillData,
      },
      include: { article: true, statut: true }
    })

    await enregistrerOperation({
      siteId: Number(siteId),
      inventaireId: inventaire.id,
      userId: (req as any).user?.id,
      type: 'RECEPTION',
      details: { label: 'Réception', couleur: '#10b981' }
    })

    res.json(inventaire)
  } catch (e) {
    next(e)
  }
}

export async function update(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const { statutId, ...champs } = req.body

    // Filtrer les colonnes autorisées pour éviter d'écraser des champs sensibles
    const colonnesAutorisees = [
      'serialNumber', 'partNumber', 'rma', 'customer', 'productFamily',
      'mercurySn', 'warranty', 'rmaCreationDate', 'dateRic',
      'defectFromCustomer', 'defectCodeCastles', 'descrCode', 'repaireNotes', 'genericNotes',
      'dateRip', 'techLabo', 'livelloRiparazione',
      'dateLav', 'dateAsp', 'dateLab', 'datePrv', 'datePrr', 'datePrf',
      'datePra', 'dateEng', 'dateAsw', 'dateBsf', 'dateBsfn', 'dateNlv',
      'codeStatut', 'dateMaj', 'dateInjection', 'dateTest', 'datePack', 'dateCls', 'dateSHP', 'archive',
    ]
    const colonnesDate = [
      'rmaCreationDate', 'dateRic', 'dateRip', 'dateLav', 'dateAsp', 'dateLab',
      'datePrv', 'datePrr', 'datePrf', 'datePra', 'dateEng', 'dateAsw',
      'dateBsf', 'dateBsfn', 'dateNlv', 'dateMaj', 'dateInjection', 'dateTest',
      'datePack', 'dateCls', 'dateSHP',
    ]
    const data: Record<string, any> = {}
    for (const col of colonnesAutorisees) {
      if (champs[col] === undefined) continue
      if (colonnesDate.includes(col)) {
        data[col] = champs[col] ? new Date(champs[col]) : null
      } else {
        data[col] = champs[col]
      }
    }
    if (statutId !== undefined) data.statutId = statutId ? Number(statutId) : null

    const inventaire = await prisma.inventaire.update({
      where: { id: Number(id) },
      data,
      include: { article: true, statut: true, pieces: true }
    })

    await logActivite({
      siteId: inventaire.siteId,
      userId: (req as any).user?.id,
      type: 'MODIFICATION',
      entite: 'inventaire',
      entiteId: inventaire.id,
      details: { label: 'Modification', couleur: '#6b7280' }
    })

    res.json(inventaire)
  } catch (e) {
    next(e)
  }
}

export async function getHistorique(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const entrees = await prisma.historiqueActivite.findMany({
      where: { entite: 'inventaire', entiteId: Number(id) },
      orderBy: { createdAt: 'desc' }
    })

    const userIds = [...new Set(entrees.map(e => e.userId).filter((id): id is number => id != null))]
    const utilisateurs = userIds.length > 0
      ? await prisma.utilisateur.findMany({ where: { id: { in: userIds } }, select: { id: true, login: true, nom: true, prenom: true } })
      : []
    const utilisateursMap = new Map(utilisateurs.map(u => [u.id, u]))

    res.json(entrees.map(e => ({
      id: e.id,
      type: e.type,
      createdAt: e.createdAt,
      details: e.details ? JSON.parse(e.details) : null,
      operateur: e.userId != null ? utilisateursMap.get(e.userId) ?? null : null
    })))
  } catch (e) {
    next(e)
  }
}

export async function remove(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const inv = await prisma.inventaire.findUnique({ where: { id: Number(id) } })
    await prisma.inventaire.delete({ where: { id: Number(id) } })
    if (inv) {
      await logActivite({
        siteId: inv.siteId,
        userId: (req as any).user?.id,
        type: 'SUPPRESSION',
        entite: 'inventaire',
        entiteId: Number(id),
        details: { label: 'Suppression', couleur: '#ef4444' }
      })
    }
    res.json({ success: true })
  } catch (e) {
    next(e)
  }
}
