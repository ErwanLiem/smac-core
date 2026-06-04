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
    const { rma, bt, client, dateCreationRMA } = req.body
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

    // Extraire les lignes d'abord pour vérifier les PN
    const lignesRaw: any[] = []
    for (let i = headerRowIdx + 1; i < data.length; i++) {
      const row = data[i]
      if (!row || !row[iSN] || !row[iPN]) continue
      const sn = String(row[iSN]).trim()
      const pn = String(row[iPN]).trim()
      if (!sn || !pn) continue
      lignesRaw.push({
        sn, pn,
        panneClient: iPanne !== -1 && row[iPanne] ? String(row[iPanne]).trim() : null,
        garantie:    iGarantie !== -1 && row[iGarantie] ? String(row[iGarantie]).trim() : null,
      })
    }

    // Vérifier que tous les PN existent dans le catalogue articles
    const pnsUniques = [...new Set(lignesRaw.map(l => l.pn))]
    const champsPNArt = await prisma.champArticle.findMany({
      where: { siteId: Number(siteId) }
    })
    const champsPNIds = champsPNArt
      .filter(c => ['PN', 'P_N', 'PART_NUMBER', 'PART_NO'].includes(c.code.toUpperCase()))
      .map(c => c.id)

    const articlesExistants = await prisma.article.findMany({
      where: { siteId: Number(siteId) },
      include: { valeurs: { where: { champId: { in: champsPNIds } } } }
    })
    const pnsCatalogue = new Set(
      articlesExistants.flatMap(a => a.valeurs.map(v => v.valeur)).filter(Boolean)
    )

    const pnsInconnus = pnsUniques.filter(pn => !pnsCatalogue.has(pn))
    if (pnsInconnus.length > 0) {
      fs.unlinkSync(file.path)
      return res.status(400).json({
        error: `Les P/N suivants n'existent pas dans le catalogue articles : ${pnsInconnus.join(', ')}`,
        pnsInconnus
      })
    }

    // Créer l'attendu
    const attendu = await prisma.attendu.create({
      data: {
        siteId: Number(siteId),
        rma: rma || null,
        bt: bt || null,
        client: client || null,
        dateCreationRMA: dateCreationRMA || null,
        statut: 'EN_COURS'
      }
    })

    const lignes = lignesRaw.map(l => ({ ...l, attenduId: attendu.id, statut: 'ATTENDU' }))
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
    const { rma, bt, client, dateCreationRMA } = req.body
    const attendu = await prisma.attendu.update({
      where: { id: Number(id) },
      data: { rma, bt, client, dateCreationRMA }
    })
    res.json(attendu)
  } catch (e) {
    next(e)
  }
}

// DELETE /api/attendus/:id — supprimer un attendu non commencé
export async function deleteAttendu(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const attendu = await prisma.attendu.findUnique({
      where: { id: Number(id) },
      include: { lignes: true }
    })
    if (!attendu) return res.status(404).json({ error: 'Attendu introuvable' })

    const aCommence = attendu.lignes.some(l => l.statut === 'RECU' || l.statut === 'INATTENDU')
    if (aCommence) return res.status(400).json({ error: 'Impossible de supprimer un attendu en cours de traitement.' })

    await prisma.attendu.delete({ where: { id: Number(id) } })
    res.json({ success: true })
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

    // Vérifier si le S/N est déjà en inventaire BDD
    const champsInv = await prisma.champInventaire.findMany({ where: { siteId: attendu.siteId } })
    const champSN = champsInv.find(c => ['SN', 'S_N', 'NUMERO_SERIE'].includes(c.code.toUpperCase()))
    let dejaEnInventaire = false
    if (champSN) {
      const existing = await prisma.valeurChampInventaire.findFirst({
        where: { champId: champSN.id, valeur: snNorm }
      })
      dejaEnInventaire = !!existing
    }

    if (ligne) {
      // S/N attendu et pas encore scanné → RECU
      await prisma.ligneAttendue.update({
        where: { id: ligne.id },
        data: { statut: 'RECU', snRecu: snNorm, accessoires: accessoiresJson }
      })
      res.json({ resultat: 'RECU', pn: ligne.pn, garantie: ligne.garantie, panneClient: ligne.panneClient, dejaEnInventaire })
    } else {
      // Vérifier si déjà scanné dans cet attendu (statut RECU)
      const dejaScanne = attendu.lignes.find(l => l.sn === snNorm && l.statut === 'RECU')

      if (dejaScanne) {
        // Pas de ligne INATTENDU — juste un retour info
        res.json({ resultat: 'DEJA_SCANNE', pn: dejaScanne.pn, dejaEnInventaire })
      } else {
        // S/N vraiment inattendu → créer une ligne
        await prisma.ligneAttendue.create({
          data: {
            attenduId: Number(id),
            sn: snNorm,
            pn: pn || 'INCONNU',
            statut: 'INATTENDU',
            accessoires: accessoiresJson
          }
        })
        res.json({ resultat: 'INATTENDU', dejaEnInventaire })
      }
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
    const idBL          = findChampId(['BL', 'RMA'])
    const idBT          = findChampId(['BT', 'BT_RECEP'])
    const idRMACreation = findChampId(['RMA_CREATION', 'DATE_CREATION_BL', 'DATE_BL'])
    const idDateRIC     = findChampId(['DATE_RIC', 'DATE_RECEPTION', 'DATE_REC'])
    const dateAujourdhui = new Date().toISOString().split('T')[0]

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

    // Charger les articles du site pour trouver par PN
    const champsPNArticle = await prisma.champArticle.findMany({
      where: { siteId: attendu.siteId, code: { in: ['PN', 'P_N', 'PART_NUMBER', 'PART_NO'] } }
    })
    const articlesAvecValeurs = await prisma.article.findMany({
      where: { siteId: attendu.siteId },
      include: { valeurs: true }
    })

    function trouverArticleParPN(pn: string): number | null {
      if (!pn || !champsPNArticle.length) return null
      const champIds = champsPNArticle.map(c => c.id)
      const art = articlesAvecValeurs.find(a =>
        a.valeurs.some(v => champIds.includes(v.champId) && v.valeur === pn)
      )
      return art?.id ?? null
    }

    // Charger les champs de l'article pour auto-remplissage
    const champsArticle = await prisma.champArticle.findMany({
      where: { siteId: attendu.siteId, actif: true }
    })

    // Vérifier les S/N déjà en inventaire
    const idSNInv = champsInv.find(c => ['SN', 'S_N', 'NUMERO_SERIE', 'NUMÉRO DE SÉRIE'].some(code =>
      c.code.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '') === code.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    ))?.id

    const snsExistants = idSNInv ? await prisma.valeurChampInventaire.findMany({
      where: { champId: idSNInv }
    }) : []
    const snsDejaPresents = new Set(snsExistants.map(v => v.valeur))

    // Injecter les lignes RECU dans l'inventaire
    const lignesRecues = attendu.lignes.filter(l => l.statut === 'RECU')
    const snDoublons: string[] = []

    for (const ligne of lignesRecues) {
      // Vérifier doublon S/N
      if (idSNInv && snsDejaPresents.has(ligne.sn)) {
        snDoublons.push(ligne.sn)
        continue
      }

      const articleId = trouverArticleParPN(ligne.pn)
      const article = articlesAvecValeurs.find(a => a.id === articleId)

      const valeurs: { champId: number; valeur: string }[] = []

      // Auto-remplir depuis l'article
      if (article) {
        for (const valArt of article.valeurs) {
          const champArt = champsArticle.find(c => c.id === valArt.champId)
          if (!champArt || !valArt.valeur) continue
          // Trouver le champ inventaire correspondant au même code
          const champInvCorr = champsInv.find(c =>
            c.code.toUpperCase() === champArt.code.toUpperCase()
          )
          if (champInvCorr) valeurs.push({ champId: champInvCorr.id, valeur: valArt.valeur })
        }
      }

      // Champs spécifiques à la réception
      if (idSN && ligne.sn)                  valeurs.push({ champId: idSN, valeur: ligne.sn })
      if (idPN && ligne.pn)                  valeurs.push({ champId: idPN, valeur: ligne.pn })
      if (idGarantie && ligne.garantie)      valeurs.push({ champId: idGarantie, valeur: ligne.garantie })
      if (idPanneClient && ligne.panneClient) valeurs.push({ champId: idPanneClient, valeur: ligne.panneClient })
      if (idBL && attendu.rma)                      valeurs.push({ champId: idBL, valeur: attendu.rma })
      if (idBT && attendu.bt)                       valeurs.push({ champId: idBT, valeur: attendu.bt })
      if (idRMACreation && attendu.dateCreationRMA) valeurs.push({ champId: idRMACreation, valeur: attendu.dateCreationRMA })
      if (idDateRIC)                                valeurs.push({ champId: idDateRIC, valeur: dateAujourdhui })

      // Dédupliquer : les champs explicites écrasent l'auto-remplissage
      const valeursMap = new Map<number, string>()
      for (const v of valeurs) valeursMap.set(v.champId, v.valeur)
      const valeursDedupliquees = Array.from(valeursMap.entries()).map(([champId, valeur]) => ({ champId, valeur }))

      await prisma.inventaire.create({
        data: {
          siteId: attendu.siteId,
          articleId: articleId,
          statutId: statutStock?.id ?? null,
          valeurs: { create: valeursDedupliquees }
        }
      })
    }

    if (snDoublons.length > 0) {
      return res.json({ success: true, lignesInjectees: lignesRecues.length - snDoublons.length, snDoublons })
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

// POST /api/attendus/:id/cloturer — clôturer ET injecter dans inventaire
export async function cloturer(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params

    const attendu = await prisma.attendu.findUnique({
      where: { id: Number(id) },
      include: { lignes: true }
    })
    if (!attendu) return res.status(404).json({ error: 'Attendu introuvable' })

    // ---- Vérifier qu'aucun S/N reçu n'est déjà en inventaire ----
    const champsInvCheck = await prisma.champInventaire.findMany({ where: { siteId: attendu.siteId } })
    const champSNCheck = champsInvCheck.find(c => ['SN', 'S_N', 'NUMERO_SERIE'].includes(c.code.toUpperCase()))
    if (champSNCheck) {
      const lignesRecues = attendu.lignes.filter(l => l.statut === 'RECU')
      const snsRecus = lignesRecues.map(l => l.sn)
      const existants = await prisma.valeurChampInventaire.findMany({
        where: { champId: champSNCheck.id, valeur: { in: snsRecus } }
      })
      if (existants.length > 0) {
        return res.status(400).json({
          error: `Clôture impossible : ${existants.length} S/N déjà présent${existants.length > 1 ? 's' : ''} en inventaire.`,
          snsEnDoublon: existants.map(e => e.valeur)
        })
      }
    }

    // Marquer les lignes encore ATTENDU comme NON_RECU
    await prisma.ligneAttendue.updateMany({
      where: { attenduId: Number(id), statut: 'ATTENDU' },
      data: { statut: 'NON_RECU' }
    })

    // ---- Injection inventaire (même logique que valider) ----
    const champsInv = await prisma.champInventaire.findMany({ where: { siteId: attendu.siteId, actif: true } })

    function findChampId(codes: string[]): number | null {
      const c = champsInv.find(ch => codes.some(code =>
        ch.code.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '') === code.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      ))
      return c ? c.id : null
    }

    const idSN          = findChampId(['SN', 'NUMERO_SERIE', 'NUMERO DE SERIE'])
    const idPN          = findChampId(['PN', 'P_N', 'PART_NUMBER', 'PART_NO'])
    const idGarantie    = findChampId(['GARANTIE'])
    const idPanneClient = findChampId(['PANNE_CLIENT', 'PANNE'])
    const idBL          = findChampId(['BL', 'RMA'])
    const idBT          = findChampId(['BT', 'BT_RECEP'])
    const idRMACreation = findChampId(['RMA_CREATION', 'DATE_CREATION_BL', 'DATE_BL'])
    const idDateRIC     = findChampId(['DATE_RIC', 'DATE_RECEPTION', 'DATE_REC'])
    const dateAujourdhui = new Date().toISOString().split('T')[0]

    const statutStock = await prisma.statut.findFirst({
      where: { siteId: attendu.siteId, OR: [{ code: { contains: 'STOCK' } }, { label: { contains: 'stock' } }] }
    })

    const champsPNArt = await prisma.champArticle.findMany({ where: { siteId: attendu.siteId } })
    const champsPNIds = champsPNArt.filter(c => ['PN', 'P_N', 'PART_NUMBER', 'PART_NO'].includes(c.code.toUpperCase())).map(c => c.id)
    const articlesAvecValeurs = await prisma.article.findMany({
      where: { siteId: attendu.siteId },
      include: { valeurs: true }
    })
    const champsArticle = await prisma.champArticle.findMany({ where: { siteId: attendu.siteId, actif: true } })

    function trouverArticleParPN(pn: string) {
      return articlesAvecValeurs.find(a => a.valeurs.some(v => champsPNIds.includes(v.champId) && v.valeur === pn)) ?? null
    }

    // Récupérer S/N déjà en inventaire pour éviter doublons
    const snsExistants = idSN ? await prisma.valeurChampInventaire.findMany({ where: { champId: idSN } }) : []
    const snsDejaPresents = new Set(snsExistants.map(v => v.valeur))

    const lignesRecues = attendu.lignes.filter(l => l.statut === 'RECU')
    let lignesInjectees = 0
    const snDoublons: string[] = []

    for (const ligne of lignesRecues) {
      if (idSN && snsDejaPresents.has(ligne.sn)) { snDoublons.push(ligne.sn); continue }

      const article = trouverArticleParPN(ligne.pn)
      const valeurs: { champId: number; valeur: string }[] = []

      if (article) {
        for (const valArt of article.valeurs) {
          const champArt = champsArticle.find(c => c.id === valArt.champId)
          if (!champArt || !valArt.valeur) continue
          const champInvCorr = champsInv.find(c => c.code.toUpperCase() === champArt.code.toUpperCase())
          if (champInvCorr) valeurs.push({ champId: champInvCorr.id, valeur: valArt.valeur })
        }
      }

      if (idSN && ligne.sn)                       valeurs.push({ champId: idSN, valeur: ligne.sn })
      if (idPN && ligne.pn)                        valeurs.push({ champId: idPN, valeur: ligne.pn })
      if (idGarantie && ligne.garantie)            valeurs.push({ champId: idGarantie, valeur: ligne.garantie })
      if (idPanneClient && ligne.panneClient)      valeurs.push({ champId: idPanneClient, valeur: ligne.panneClient })
      if (idBL && attendu.rma)                     valeurs.push({ champId: idBL, valeur: attendu.rma })
      if (idBT && attendu.bt)                      valeurs.push({ champId: idBT, valeur: attendu.bt })
      if (idRMACreation && attendu.dateCreationRMA) valeurs.push({ champId: idRMACreation, valeur: attendu.dateCreationRMA })
      if (idDateRIC)                               valeurs.push({ champId: idDateRIC, valeur: dateAujourdhui })

      const valeursMap = new Map<number, string>()
      for (const v of valeurs) valeursMap.set(v.champId, v.valeur)
      const valeursDedupliquees = Array.from(valeursMap.entries()).map(([champId, valeur]) => ({ champId, valeur }))

      await prisma.inventaire.create({
        data: {
          siteId: attendu.siteId,
          articleId: article?.id ?? null,
          statutId: statutStock?.id ?? null,
          valeurs: { create: valeursDedupliquees }
        }
      })
      lignesInjectees++
    }

    // Clôturer l'attendu
    await prisma.attendu.update({
      where: { id: Number(id) },
      data: { statut: 'CLOS', closedAt: new Date() }
    })

    res.json({ success: true, lignesInjectees, snDoublons })
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
