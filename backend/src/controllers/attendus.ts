import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import { logActivite } from '../utils/historique'

const prisma = new PrismaClient()

const HEADER_ROW_KEYWORDS = ['serial', 'part number', 's/n', 'sn']
const COL_SN       = ['serial number', 's/n', 'sn', 'serial']
const COL_PN       = ['part number', 'p/n', 'pn', 'partnumber']
const COL_PANNE    = ['reported problem', 'panne', 'problem', 'description']
const COL_GARANTIE = ['status', 'statut', 'warranty']
const SHEET_NAME   = 'terminal details'

function normalize(s: string): string {
  return String(s ?? '').toLowerCase().trim()
}

function findCol(headers: string[], candidates: string[]): number {
  return headers.findIndex(h => candidates.some(c => normalize(h).includes(normalize(c))))
}

function findHeaderRow(data: any[][]): number {
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i] || []
    if (row.some((c: any) => COL_SN.some(k => normalize(String(c ?? '')).includes(k)))) return i
  }
  return 0
}

// GET /api/attendus/:siteId
export async function getAll(req: Request, res: Response) {
  const { siteId } = req.params
  const attendus = await prisma.attendu.findMany({
    where: { siteId: Number(siteId) },
    include: { _count: { select: { lignes: true } } },
    orderBy: { createdAt: 'desc' }
  })
  res.json(attendus)
}

// GET /api/attendus/detail/:id
export async function getDetail(req: Request, res: Response) {
  const { id } = req.params
  const attendu = await prisma.attendu.findUnique({
    where: { id: Number(id) },
    include: { lignes: { orderBy: [{ pn: 'asc' }, { sn: 'asc' }] } }
  })
  if (!attendu) return res.status(404).json({ error: 'Attendu introuvable' })
  res.json(attendu)
}

// POST /api/attendus/:siteId/import — import Excel
export async function importExcel(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const { rma, bt, client } = req.body
    const file = (req as any).file

    if (!file) return res.status(400).json({ error: 'Fichier manquant' })

    const wb = XLSX.readFile(file.path)

    // Trouver le bon onglet (insensible à la casse)
    const sheetName = wb.SheetNames.find(s => normalize(s).includes('terminal')) || wb.SheetNames[0]
    const ws = wb.Sheets[sheetName]
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

    // Trouver la ligne d'en-tête
    const headerRowIdx = findHeaderRow(data)
    const headers = (data[headerRowIdx] || []).map((h: any) => String(h ?? ''))

    // Identifier les colonnes
    const iSN       = findCol(headers, COL_SN)
    const iPN       = findCol(headers, COL_PN)
    const iPanne    = findCol(headers, COL_PANNE)
    const iGarantie = findCol(headers, COL_GARANTIE)

    if (iSN === -1 || iPN === -1) {
      return res.status(400).json({ error: 'Colonnes Serial Number / Part Number introuvables' })
    }

    // Créer l'attendu
    const attendu = await prisma.attendu.create({
      data: {
        siteId: Number(siteId),
        rma: rma || null,
        bt: bt || null,
        client: client || null,
        statut: 'EN_COURS'
      }
    })

    // Importer les lignes (à partir de la ligne après les headers)
    const lignes: any[] = []
    for (let i = headerRowIdx + 1; i < data.length; i++) {
      const row = data[i]
      if (!row || !row[iSN] || !row[iPN]) continue
      const sn = String(row[iSN]).trim()
      const pn = String(row[iPN]).trim()
      if (!sn || !pn || sn === '' || pn === '') continue

      lignes.push({
        attenduId: attendu.id,
        sn,
        pn,
        panneClient: iPanne !== -1 && row[iPanne] ? String(row[iPanne]).trim() : null,
        garantie:    iGarantie !== -1 && row[iGarantie] ? String(row[iGarantie]).trim() : null,
        statut: 'ATTENDU'
      })
    }

    await prisma.ligneAttendue.createMany({ data: lignes })

    // Nettoyer le fichier temporaire
    fs.unlinkSync(file.path)

    res.json({ ...attendu, lignesCount: lignes.length })
  } catch (e) {
    next(e)
  }
}

// PUT /api/attendus/:id — modifier RMA / BT / client
export async function update(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const { rma, bt, client } = req.body
    const attendu = await prisma.attendu.update({
      where: { id: Number(id) },
      data: { rma, bt, client }
    })
    res.json(attendu)
  } catch (e) {
    next(e)
  }
}

// POST /api/attendus/:id/scanner — scanner un SN pour un PN donné
export async function scannerSN(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const { sn, pn, accessoires } = req.body

    const attendu = await prisma.attendu.findUnique({
      where: { id: Number(id) },
      include: { lignes: true }
    })
    if (!attendu) return res.status(404).json({ error: 'Attendu introuvable' })
    if (attendu.statut === 'CLOS') return res.status(400).json({ error: 'Attendu clôturé' })

    const snNorm = String(sn).trim()
    const accessoiresJson = accessoires ? JSON.stringify(accessoires) : null

    // Chercher le SN dans les lignes attendues pour ce PN
    const ligne = attendu.lignes.find(l =>
      l.sn === snNorm && l.statut === 'ATTENDU' && (!pn || l.pn === pn)
    )

    if (ligne) {
      await prisma.ligneAttendue.update({
        where: { id: ligne.id },
        data: { statut: 'RECU', snRecu: snNorm, accessoires: accessoiresJson }
      })
      res.json({ resultat: 'RECU', pn: ligne.pn, garantie: ligne.garantie, panneClient: ligne.panneClient })
    } else {
      // SN non attendu pour ce PN
      const ligneInattendu = await prisma.ligneAttendue.create({
        data: {
          attenduId: Number(id),
          sn: snNorm,
          pn: pn || 'INCONNU',
          statut: 'INATTENDU',
          accessoires: accessoiresJson
        }
      })
      res.json({ resultat: 'INATTENDU', id: ligneInattendu.id })
    }
  } catch (e) {
    next(e)
  }
}

// PUT /api/attendus/ligne/:id — mettre à jour une ligne (PN, accessoires, etc.)
export async function updateLigne(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const data = req.body
    const ligne = await prisma.ligneAttendue.update({
      where: { id: Number(id) },
      data
    })
    res.json(ligne)
  } catch (e) {
    next(e)
  }
}

// POST /api/attendus/:id/valider — valider et injecter dans inventaire
export async function valider(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params

    const attendu = await prisma.attendu.findUnique({
      where: { id: Number(id) },
      include: { lignes: true }
    })
    if (!attendu) return res.status(404).json({ error: 'Attendu introuvable' })

    // Récupérer les champs inventaire pour le mapping
    const champsInv = await prisma.champInventaire.findMany({
      where: { siteId: attendu.siteId, actif: true }
    })

    function findChampId(codes: string[]): number | null {
      const c = champsInv.find(ch =>
        codes.some(code => ch.code.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '') ===
          code.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))
      )
      return c ? c.id : null
    }

    const idSN         = findChampId(['SN', 'NUMERO_SERIE', 'NUMERO DE SERIE'])
    const idPN         = findChampId(['PN', 'P_N', 'PART_NUMBER', 'PART_NO'])
    const idGarantie   = findChampId(['GARANTIE'])
    const idPanneClient = findChampId(['PANNE_CLIENT', 'PANNE'])
    const idBL         = findChampId(['BL', 'RMA'])
    const idBT         = findChampId(['BT', 'BT_RECEP'])

    // Récupérer le statut "En stock"
    const statutStock = await prisma.statut.findFirst({
      where: {
        siteId: attendu.siteId,
        OR: [
          { code: { contains: 'STOCK' } },
          { label: { contains: 'stock' } }
        ]
      }
    })

    // Injecter les lignes RECU dans l'inventaire
    const lignesRecues = attendu.lignes.filter(l => l.statut === 'RECU')

    for (const ligne of lignesRecues) {
      const valeurs: { champId: number; valeur: string }[] = []
      if (idSN && ligne.sn)          valeurs.push({ champId: idSN, valeur: ligne.sn })
      if (idPN && ligne.pn)          valeurs.push({ champId: idPN, valeur: ligne.pn })
      if (idGarantie && ligne.garantie) valeurs.push({ champId: idGarantie, valeur: ligne.garantie })
      if (idPanneClient && ligne.panneClient) valeurs.push({ champId: idPanneClient, valeur: ligne.panneClient })
      if (idBL && attendu.rma)       valeurs.push({ champId: idBL, valeur: attendu.rma })
      if (idBT && attendu.bt)        valeurs.push({ champId: idBT, valeur: attendu.bt })

      await prisma.inventaire.create({
        data: {
          siteId: attendu.siteId,
          articleId: 1, // À adapter selon la logique article
          statutId: statutStock?.id ?? null,
          valeurs: { create: valeurs }
        }
      })
    }

    await logActivite({
      siteId: attendu.siteId,
      userId: (req as any).user?.id,
      type: 'RECEPTION',
      entite: 'inventaire',
      details: { attenduId: Number(id), lignesInjectees: lignesRecues.length }
    })

    res.json({ success: true, lignesInjectees: lignesRecues.length })
  } catch (e) {
    next(e)
  }
}

// POST /api/attendus/:id/cloturer — clôturer l'attendu
export async function cloturer(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const attendu = await prisma.attendu.update({
      where: { id: Number(id) },
      data: { statut: 'CLOS', closedAt: new Date() }
    })

    // Marquer les lignes encore ATTENDU comme NON_RECU
    await prisma.ligneAttendue.updateMany({
      where: { attenduId: Number(id), statut: 'ATTENDU' },
      data: { statut: 'NON_RECU' }
    })

    res.json(attendu)
  } catch (e) {
    next(e)
  }
}

// GET /api/attendus/:id/rapport — rapport d'écart
export async function rapport(req: Request, res: Response) {
  const { id } = req.params
  const attendu = await prisma.attendu.findUnique({
    where: { id: Number(id) },
    include: { lignes: { orderBy: [{ pn: 'asc' }, { sn: 'asc' }] } }
  })
  if (!attendu) return res.status(404).json({ error: 'Attendu introuvable' })

  const nonRecus    = attendu.lignes.filter(l => l.statut === 'NON_RECU' || l.statut === 'ATTENDU')
  const inattendus  = attendu.lignes.filter(l => l.statut === 'INATTENDU')
  const recus       = attendu.lignes.filter(l => l.statut === 'RECU')

  res.json({ nonRecus, inattendus, recus, total: attendu.lignes.length })
}
