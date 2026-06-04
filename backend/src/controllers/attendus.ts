import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as fs from 'fs'

const prisma = new PrismaClient()

// ─── Constantes colonnes Excel ───────────────────────────────────────────────
const COL_SN       = ['serial number', 's/n', 'sn', 'serial']
const COL_PN       = ['part number', 'p/n', 'pn', 'partnumber']
const COL_PANNE    = ['reported problem', 'panne', 'problem', 'description']
const COL_GARANTIE = ['status', 'statut', 'warranty']

const CODES_SN = [
  'SN', 'S_N', 'SERIAL', 'SERIAL_NUMBER',
  'NUMERO_SERIE', 'NUMERO DE SERIE', 'NUMERO_DE_SERIE',
  'NUMÉRO DE SÉRIE', 'NUMÉRO_DE_SÉRIE'
]

// ─── Helpers normalization ────────────────────────────────────────────────────
function normalize(s: string): string {
  return String(s ?? '').toLowerCase().trim()
}

function normalizeCode(code: string): string {
  return code.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
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

// ─── Helper : IDs des champs SN dans l'inventaire ────────────────────────────
function getIdsSN(champsInv: any[]): number[] {
  const trouvés = champsInv.filter(c => {
    const n  = normalizeCode(c.code).replace(/\s+/g, '_')
    const ns = normalizeCode(c.code).replace(/\s+/g, ' ')
    return CODES_SN.includes(n) || CODES_SN.includes(ns) || CODES_SN.includes(normalizeCode(c.code))
  })
  return trouvés.length > 0 ? trouvés.map(c => c.id) : champsInv.map(c => c.id)
}

// ─── Helper : findChampId dans une liste de champs ───────────────────────────
function makeChampFinder(champs: any[]) {
  return function findChampId(codes: string[]): number | null {
    const c = champs.find(ch =>
      codes.some(code =>
        normalizeCode(ch.code).replace(/\s+/g, '_') === normalizeCode(code).replace(/\s+/g, '_') ||
        normalizeCode(ch.code).replace(/\s+/g, ' ') === normalizeCode(code).replace(/\s+/g, ' ')
      )
    )
    return c ? c.id : null
  }
}

// ─── Helper : injection d'une ligne dans l'inventaire ────────────────────────
async function creerEntreeInventaire(params: {
  siteId: number
  ligne: any
  attendu: any
  article: any | null
  champsInv: any[]
  champsArticle: any[]
  statutStockId: number | null
  dateAujourdhui: string
}) {
  const { siteId, ligne, attendu, article, champsInv, champsArticle, statutStockId, dateAujourdhui } = params
  const findChampId = makeChampFinder(champsInv)

  const idSN          = findChampId(['SN', 'NUMERO_SERIE', 'NUMERO DE SERIE'])
  const idPN          = findChampId(['PN', 'P_N', 'PART_NUMBER', 'PART_NO'])
  const idGarantie    = findChampId(['GARANTIE'])
  const idPanneClient = findChampId(['PANNE_CLIENT', 'PANNE'])
  const idBL          = findChampId(['BL', 'RMA'])
  const idBT          = findChampId(['BT', 'BT_RECEP'])
  const idRMACreation = findChampId(['RMA_CREATION', 'DATE_CREATION_BL', 'DATE_BL'])
  const idDateRIC     = findChampId(['DATE_RIC', 'DATE_RECEPTION', 'DATE_REC'])
  const idPlateforme  = findChampId(['PLATEFORME', 'PLATEFORMES', 'PLATFORM'])
  const idClient      = findChampId(['CLIENT', 'CLIENTS'])
  const idAccessoires = findChampId(['ACCESSOIRES', 'ACCESSOIRE', 'ACCESSORIES'])

  const valeurs: { champId: number; valeur: string }[] = []

  // Auto-remplir depuis les champs de l'article (même code)
  if (article) {
    for (const valArt of article.valeurs) {
      const champArt    = champsArticle.find((c: any) => c.id === valArt.champId)
      if (!champArt || !valArt.valeur) continue
      const champInvCorr = champsInv.find((c: any) => c.code.toUpperCase() === champArt.code.toUpperCase())
      if (champInvCorr) valeurs.push({ champId: champInvCorr.id, valeur: valArt.valeur })
    }
  }

  // Champs réception fixes
  if (idSN && ligne.sn)          valeurs.push({ champId: idSN,       valeur: ligne.sn })
  if (idPN && ligne.pn)           valeurs.push({ champId: idPN,       valeur: ligne.pn })
  if (idGarantie && ligne.garantie) valeurs.push({ champId: idGarantie, valeur: ligne.garantie })
  if (idPanneClient && ligne.panneClient) valeurs.push({ champId: idPanneClient, valeur: ligne.panneClient })
  if (idBL && attendu.rma)       valeurs.push({ champId: idBL,       valeur: attendu.rma })
  if (idBT && attendu.bt)        valeurs.push({ champId: idBT,       valeur: attendu.bt })
  if (idDateRIC)                 valeurs.push({ champId: idDateRIC,  valeur: dateAujourdhui })

  // Champs communs saisis à la création (donneesCommunes JSON {code: valeur})
  if (attendu.donneesCommunes) {
    try {
      const donnees: Record<string, string> = JSON.parse(attendu.donneesCommunes)
      for (const [code, valeur] of Object.entries(donnees)) {
        if (!valeur) continue
        const champInv = champsInv.find(c => c.code === code)
        if (champInv) valeurs.push({ champId: champInv.id, valeur })
      }
    } catch {}
  }
  if (idAccessoires && ligne.accessoires) {
    try {
      const accs: string[] = JSON.parse(ligne.accessoires)
      if (accs.length > 0) valeurs.push({ champId: idAccessoires, valeur: accs.join(', ') })
    } catch {}
  }

  // Dédupliquer (les champs explicites écrasent l'auto-remplissage)
  const valeursMap = new Map<number, string>()
  for (const v of valeurs) valeursMap.set(v.champId, v.valeur)
  const valeursDedupliquees = Array.from(valeursMap.entries()).map(([champId, valeur]) => ({ champId, valeur }))

  await prisma.inventaire.create({
    data: {
      siteId,
      articleId: article?.id ?? null,
      statutId: statutStockId,
      valeurs: { create: valeursDedupliquees }
    }
  })
}

// ─── Helper : trouver l'article par PN ───────────────────────────────────────
async function chargerArticles(siteId: number) {
  const champsPNArt = await prisma.champArticle.findMany({ where: { siteId } })
  const champsPNIds = champsPNArt
    .filter((c: any) => ['PN', 'P_N', 'PART_NUMBER', 'PART_NO'].includes(c.code.toUpperCase()))
    .map((c: any) => c.id)
  const articles = await prisma.article.findMany({ where: { siteId }, include: { valeurs: true } })
  const champsArticle = await prisma.champArticle.findMany({ where: { siteId, actif: true } })

  function trouverParPN(pn: string) {
    return articles.find(a => a.valeurs.some((v: any) => champsPNIds.includes(v.champId) && v.valeur === pn)) ?? null
  }

  return { articles, champsArticle, trouverParPN }
}

// ─────────────────────────────────────────────────────────────────────────────
//  ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

export async function getAll(req: Request, res: Response) {
  const { siteId } = req.params
  const attendus = await prisma.attendu.findMany({
    where: { siteId: Number(siteId) },
    include: { _count: { select: { lignes: true } } },
    orderBy: { createdAt: 'desc' }
  })
  res.json(attendus)
}

export async function getDetail(req: Request, res: Response) {
  const { id } = req.params
  const attendu = await prisma.attendu.findUnique({
    where: { id: Number(id) },
    include: { lignes: { orderBy: [{ pn: 'asc' }, { sn: 'asc' }] } }
  })
  if (!attendu) return res.status(404).json({ error: 'Attendu introuvable' })
  res.json(attendu)
}

export async function importExcel(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const file = (req as any).file
    if (!file) return res.status(400).json({ error: 'Fichier manquant' })

    // Charger la config du site
    const config = await prisma.configAttendus.findUnique({ where: { siteId: Number(siteId) } })
    const mappings = await prisma.configImportExcel.findMany({ where: { siteId: Number(siteId), actif: true } })

    const wb = XLSX.readFile(file.path)

    // Onglet : config ou fallback sur "terminal"
    const nomOnglet = config?.nomOnglet || 'Terminal Details'
    const sheetName = wb.SheetNames.find(s => normalize(s) === normalize(nomOnglet))
      || wb.SheetNames.find(s => normalize(s).includes('terminal'))
      || wb.SheetNames[0]
    const ws = wb.Sheets[sheetName]
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

    const headerRowIdx = findHeaderRow(data)
    const headers = (data[headerRowIdx] || []).map((h: any) => String(h ?? ''))

    // Identifier les colonnes SN et PN (depuis config ou fallback)
    const colSNConfig = mappings.find(m => m.roleSpecial === 'SN')
    const colPNConfig = mappings.find(m => m.roleSpecial === 'PN')

    const iSN = colSNConfig
      ? headers.findIndex(h => normalize(h) === normalize(colSNConfig.colonneExcel))
      : findCol(headers, COL_SN)
    const iPN = colPNConfig
      ? headers.findIndex(h => normalize(h) === normalize(colPNConfig.colonneExcel))
      : findCol(headers, COL_PN)

    // Colonnes additionnelles depuis le mapping config
    const colsMappees = mappings.filter(m => !m.roleSpecial).map(m => ({
      idx: headers.findIndex(h => normalize(h) === normalize(m.colonneExcel)),
      code: m.champInventaireCode
    })).filter(m => m.idx !== -1)

    // Fallback colonnes panne et garantie si pas de config
    const iPanne    = mappings.length === 0 ? findCol(headers, COL_PANNE) : -1
    const iGarantie = mappings.length === 0 ? findCol(headers, COL_GARANTIE) : -1

    if (iSN === -1 || iPN === -1) {
      fs.unlinkSync(file.path)
      return res.status(400).json({ error: 'Colonnes Serial Number / Part Number introuvables. Vérifiez la configuration du mapping.' })
    }

    // Extraire les lignes
    const lignesRaw: any[] = []
    for (let i = headerRowIdx + 1; i < data.length; i++) {
      const row = data[i]
      if (!row || !row[iSN] || !row[iPN]) continue
      const sn = String(row[iSN]).trim()
      const pn = String(row[iPN]).trim()
      if (!sn || !pn) continue

      // Champs additionnels depuis le mapping configuré
      const champsSupp: Record<string, string> = {}
      for (const col of colsMappees) {
        if (row[col.idx]) champsSupp[col.code] = String(row[col.idx]).trim()
      }

      lignesRaw.push({
        sn, pn,
        panneClient: champsSupp['PANNE_CLIENT'] || (iPanne !== -1 && row[iPanne] ? String(row[iPanne]).trim() : null),
        garantie:    champsSupp['GARANTIE'] || (iGarantie !== -1 && row[iGarantie] ? String(row[iGarantie]).trim() : null),
        champsSupp
      })
    }

    // Vérifier les PN contre le catalogue (si obligatoire selon config)
    const obligatoirePN = config?.obligatoirePNcatalogue ?? true
    if (obligatoirePN) {
      const pnsUniques = [...new Set(lignesRaw.map(l => l.pn))]
      const champsPNArt = await prisma.champArticle.findMany({ where: { siteId: Number(siteId) } })
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
          error: `Les P/N suivants n'existent pas dans le catalogue : ${pnsInconnus.join(', ')}`,
          pnsInconnus
        })
      }
    }

    const { donneesCommunes } = req.body
    // Extraire rma et bt depuis donneesCommunes si présents
    const donnees: Record<string, string> = donneesCommunes || {}
    const rmaAuto = Object.entries(donnees).find(([k]) => ['BL', 'RMA', 'BON_LIVRAISON'].includes(normalizeCode(k)))?.[1] || null
    const btAuto  = Object.entries(donnees).find(([k]) => ['BT', 'BT_RECEP', 'BON_TRANSPORT'].includes(normalizeCode(k)))?.[1] || null

    const attendu = await prisma.attendu.create({
      data: { siteId: Number(siteId), rma: rmaAuto, bt: btAuto, donneesCommunes: donneesCommunes ? JSON.stringify(donneesCommunes) : null, statut: 'EN_COURS' }
    })
    const lignes = lignesRaw.map(({ champsSupp, ...l }) => ({ ...l, attenduId: attendu.id, statut: 'ATTENDU' }))
    await prisma.ligneAttendue.createMany({ data: lignes })
    fs.unlinkSync(file.path)
    res.json({ ...attendu, lignesCount: lignes.length })
  } catch (e) { next(e) }
}

export async function update(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const { rma, bt, donneesCommunes } = req.body
    const attendu = await prisma.attendu.update({
      where: { id: Number(id) },
      data: { rma, bt, donneesCommunes: donneesCommunes ? JSON.stringify(donneesCommunes) : null }
    })
    res.json(attendu)
  } catch (e) { next(e) }
}

export async function deleteAttendu(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const attendu = await prisma.attendu.findUnique({ where: { id: Number(id) }, include: { lignes: true } })
    if (!attendu) return res.status(404).json({ error: 'Attendu introuvable' })
    const aCommence = attendu.lignes.some(l => l.statut === 'RECU' || l.statut === 'INATTENDU')
    if (aCommence) return res.status(400).json({ error: 'Impossible de supprimer un attendu en cours de traitement.' })
    await prisma.attendu.delete({ where: { id: Number(id) } })
    res.json({ success: true })
  } catch (e) { next(e) }
}

export async function scannerSN(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const { sn, pn, accessoires } = req.body

    const attendu = await prisma.attendu.findUnique({ where: { id: Number(id) }, include: { lignes: true } })
    if (!attendu) return res.status(404).json({ error: 'Attendu introuvable' })
    if (attendu.statut === 'CLOS') return res.status(400).json({ error: 'Attendu clôturé' })

    const snNorm = String(sn).trim()
    const accessoiresJson = accessoires ? JSON.stringify(accessoires) : null

    // Ligne attendue pour ce SN + PN
    const ligne = attendu.lignes.find(l => l.sn === snNorm && l.statut === 'ATTENDU' && (!pn || l.pn === pn))

    // Vérifier présence en inventaire (statut non final = bloquant)
    const champsInv = await prisma.champInventaire.findMany({ where: { siteId: attendu.siteId } })
    const idsSN = getIdsSN(champsInv)
    let dejaEnInventaire = false
    let rmaExistant: string | null = null

    const existingVal = await prisma.valeurChampInventaire.findFirst({
      where: { champId: { in: idsSN }, valeur: snNorm },
      include: { inventaire: { include: { statut: true } } }
    })

    if (existingVal && !(existingVal.inventaire?.statut?.estFinal ?? false)) {
      dejaEnInventaire = true
      const champsRMA = champsInv.filter(c => ['BL', 'RMA', 'BON_LIVRAISON'].includes(normalizeCode(c.code)))
      if (champsRMA.length > 0) {
        const valRMA = await prisma.valeurChampInventaire.findFirst({
          where: { inventaireId: existingVal.inventaireId, champId: { in: champsRMA.map(c => c.id) } }
        })
        rmaExistant = valRMA?.valeur ?? null
      }
    }

    if (ligne) {
      await prisma.ligneAttendue.update({
        where: { id: ligne.id },
        data: { statut: 'RECU', snRecu: snNorm, accessoires: accessoiresJson }
      })
      // Si doublon actif → créer une ligne DOUBLON_INVENTAIRE pour le rapport
      if (dejaEnInventaire) {
        await prisma.ligneAttendue.create({
          data: {
            attenduId: Number(id), sn: snNorm, pn: ligne.pn,
            statut: 'DOUBLON_INVENTAIRE',
            notes: rmaExistant ? `Déjà en inventaire — RMA : ${rmaExistant}` : 'Déjà en inventaire'
          }
        })
      }
      res.json({ resultat: 'RECU', pn: ligne.pn, garantie: ligne.garantie, panneClient: ligne.panneClient, dejaEnInventaire, rmaExistant })
    } else {
      const dejaScanne = attendu.lignes.find(l => l.sn === snNorm && l.statut === 'RECU')
      if (dejaScanne) {
        res.json({ resultat: 'DEJA_SCANNE', pn: dejaScanne.pn, dejaEnInventaire })
      } else {
        await prisma.ligneAttendue.create({
          data: { attenduId: Number(id), sn: snNorm, pn: pn || 'INCONNU', statut: 'INATTENDU', accessoires: accessoiresJson }
        })
        res.json({ resultat: 'INATTENDU', dejaEnInventaire })
      }
    }
  } catch (e) { next(e) }
}

export async function descanner(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const ligne = await prisma.ligneAttendue.findUnique({ where: { id: Number(id) } })
    if (!ligne) return res.status(404).json({ error: 'Ligne introuvable' })
    await prisma.ligneAttendue.delete({ where: { id: Number(id) } })
    await prisma.ligneAttendue.updateMany({
      where: { attenduId: ligne.attenduId, sn: ligne.sn, statut: 'RECU' },
      data: { statut: 'ATTENDU', snRecu: null, accessoires: null }
    })
    res.json({ success: true })
  } catch (e) { next(e) }
}

export async function updateLigne(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const ligne = await prisma.ligneAttendue.update({ where: { id: Number(id) }, data: req.body })
    res.json(ligne)
  } catch (e) { next(e) }
}

export async function cloturer(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const attendu = await prisma.attendu.findUnique({ where: { id: Number(id) }, include: { lignes: true } })
    if (!attendu) return res.status(404).json({ error: 'Attendu introuvable' })

    // Vérifier doublons actifs (statut non final)
    const champsInvCheck = await prisma.champInventaire.findMany({ where: { siteId: attendu.siteId } })
    const idsSNCheck = getIdsSN(champsInvCheck)
    const lignesRecues = attendu.lignes.filter(l => l.statut === 'RECU')
    const existants = lignesRecues.length > 0 ? await prisma.valeurChampInventaire.findMany({
      where: { champId: { in: idsSNCheck }, valeur: { in: lignesRecues.map(l => l.sn) } },
      include: { inventaire: { include: { statut: true } } }
    }) : []
    const doublonsActifs = existants.filter(e => !(e.inventaire?.statut?.estFinal ?? false))
    if (doublonsActifs.length > 0) {
      return res.status(400).json({
        error: `Clôture impossible : ${doublonsActifs.length} S/N déjà présent${doublonsActifs.length > 1 ? 's' : ''} en inventaire avec un statut non final.`,
        snsEnDoublon: doublonsActifs.map(e => e.valeur)
      })
    }

    // Marquer les non scannés comme NON_RECU
    await prisma.ligneAttendue.updateMany({
      where: { attenduId: Number(id), statut: 'ATTENDU' },
      data: { statut: 'NON_RECU' }
    })

    // Charger données pour injection
    const champsInv = await prisma.champInventaire.findMany({ where: { siteId: attendu.siteId, actif: true } })
    const { champsArticle, trouverParPN } = await chargerArticles(attendu.siteId)
    // Statut de clôture : depuis la config ou fallback recherche "STOCK"
    const configSite = await prisma.configAttendus.findUnique({ where: { siteId: attendu.siteId } })
    const statutStock = configSite?.statutCloture
      ? await prisma.statut.findFirst({ where: { siteId: attendu.siteId, code: configSite.statutCloture } })
      : await prisma.statut.findFirst({ where: { siteId: attendu.siteId, OR: [{ code: { contains: 'STOCK' } }, { label: { contains: 'stock' } }] } })

    // S/N à exclure (déjà en inventaire avec statut non final)
    const idsSN = getIdsSN(champsInv)
    const snsExistants = idsSN.length > 0 ? await prisma.valeurChampInventaire.findMany({
      where: { champId: { in: idsSN } },
      include: { inventaire: { include: { statut: true } } }
    }) : []
    const snsDejaPresents = new Set(
      snsExistants.filter(v => !(v.inventaire?.statut?.estFinal ?? false)).map(v => v.valeur)
    )

    const dateAujourdhui = new Date().toISOString().split('T')[0]
    let lignesInjectees = 0
    const snDoublons: string[] = []

    for (const ligne of lignesRecues) {
      if (snsDejaPresents.has(ligne.sn)) { snDoublons.push(ligne.sn); continue }
      const article = trouverParPN(ligne.pn)
      await creerEntreeInventaire({ siteId: attendu.siteId, ligne, attendu, article, champsInv, champsArticle, statutStockId: statutStock?.id ?? null, dateAujourdhui })
      lignesInjectees++
    }

    await prisma.attendu.update({ where: { id: Number(id) }, data: { statut: 'CLOS', closedAt: new Date() } })
    res.json({ success: true, lignesInjectees, snDoublons })
  } catch (e) { next(e) }
}

export async function rapport(req: Request, res: Response) {
  const { id } = req.params
  const attendu = await prisma.attendu.findUnique({
    where: { id: Number(id) },
    include: { lignes: { orderBy: [{ pn: 'asc' }, { sn: 'asc' }] } }
  })
  if (!attendu) return res.status(404).json({ error: 'Attendu introuvable' })

  const lignesNormales = attendu.lignes.filter(l => l.statut !== 'DOUBLON_INVENTAIRE')
  const nonRecus   = lignesNormales.filter(l => l.statut === 'NON_RECU' || l.statut === 'ATTENDU')
  const inattendus = lignesNormales.filter(l => l.statut === 'INATTENDU')
  const recus      = lignesNormales.filter(l => l.statut === 'RECU')

  // Calculer doublons inventaire en temps réel
  const champsInv = await prisma.champInventaire.findMany({ where: { siteId: attendu.siteId } })
  const idsSN = getIdsSN(champsInv)
  const champsRMA = champsInv.filter(c => ['BL', 'RMA', 'BON_LIVRAISON'].includes(normalizeCode(c.code)))

  const valeursExistantes = recus.length > 0 ? await prisma.valeurChampInventaire.findMany({
    where: { champId: { in: idsSN }, valeur: { in: recus.map(l => l.sn) } },
    include: { inventaire: { include: { statut: true } } }
  }) : []

  // Garder uniquement les doublons avec statut NON final
  const doublonsInventaire: any[] = []
  for (const val of valeursExistantes.filter(e => !(e.inventaire?.statut?.estFinal ?? false))) {
    const ligne = recus.find(l => l.sn === val.valeur)
    if (!ligne) continue
    let rmaExistant = null
    if (champsRMA.length > 0) {
      const valRMA = await prisma.valeurChampInventaire.findFirst({
        where: { inventaireId: val.inventaireId, champId: { in: champsRMA.map(c => c.id) } }
      })
      rmaExistant = valRMA?.valeur ?? null
    }
    doublonsInventaire.push({
      ...ligne,
      notes: rmaExistant ? `Déjà en inventaire — RMA : ${rmaExistant}` : 'Déjà en inventaire'
    })
  }

  // Fusionner avec les lignes DOUBLON_INVENTAIRE stockées
  const doublonsStockes = attendu.lignes.filter(l => l.statut === 'DOUBLON_INVENTAIRE')
  const tousDoublons = [
    ...doublonsInventaire,
    ...doublonsStockes.filter(d => !doublonsInventaire.some(di => di.sn === d.sn))
  ]

  res.json({ nonRecus, inattendus, doublonsInventaire: tousDoublons, recus, total: lignesNormales.length })
}
