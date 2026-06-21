import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import { verifierReglesAlerte } from '../utils/reglesAlerte'
import { hasRole } from '../utils/roles'
import { enregistrerOperation } from '../utils/operations'

const prisma = new PrismaClient()

// ─── Constantes colonnes Excel ───────────────────────────────────────────────
const COL_SN       = ['serial number', 's/n', 'sn', 'serial']
const COL_PN       = ['part number', 'p/n', 'pn', 'partnumber']
const COL_PANNE    = ['reported problem', 'panne', 'problem', 'description']
const COL_GARANTIE = ['status', 'statut', 'warranty']

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

/** Colonnes fixes autorisées sur inventaire */
const COLONNES_FIXES = [
  'serialNumber', 'partNumber', 'rma', 'customer', 'productFamily', 'mercurySn',
  'warranty', 'rmaCreationDate', 'dateRic', 'defectFromCustomer', 'descrCode',
  'repaireNotes', 'genericNotes',
]

const COLONNES_FIXES_DATE = ['rmaCreationDate', 'dateRic']

// ─── Helper : injection d'une ligne dans l'inventaire ────────────────────────
async function creerEntreeInventaire(params: {
  siteId: number
  ligne: any
  attendu: any
  article: any | null
  mappings: any[]
  statutStockId: number | null
  userId?: number
}) {
  const { siteId, ligne, attendu, article, mappings, statutStockId, userId } = params

  // Données fixes depuis la ligne scannée
  const data: Record<string, any> = {
    siteId,
    articleId: article?.id ?? null,
    statutId: statutStockId,
    serialNumber: ligne.sn ?? null,
    partNumber:   ligne.pn ?? null,
    dateRic:      new Date(),
  }

  // Champs depuis donnéesCommunes de l'attendu (BL=rma, CLIENT=customer, etc.)
  if (attendu.donneesCommunes) {
    try {
      const donnees: Record<string, string> = JSON.parse(attendu.donneesCommunes)
      for (const [code, valeur] of Object.entries(donnees)) {
        if (!valeur) continue
        const codeNorm = normalizeCode(code).replace(/\s+/g, '_')
        // Mapper codes communs vers colonnes fixes
        if (codeNorm === 'BL' || codeNorm === 'RMA') data.rma = valeur
        else if (codeNorm === 'CLIENT') data.customer = valeur
        else if (codeNorm === 'GARANTIE' || codeNorm === 'WARRANTY') data.warranty = valeur
        else if (codeNorm === 'PANNE_CLIENT') data.defectFromCustomer = valeur
        // Mapping direct si la clé est une colonne inventaire connue (donneesCommunes stocke les clés camelCase)
        if (COLONNES_FIXES.includes(code) && !(code in data)) {
          if (COLONNES_FIXES_DATE.includes(code)) {
            const d = new Date(valeur)
            data[code] = isNaN(d.getTime()) ? null : d
          } else {
            data[code] = valeur
          }
        }
        // Mapping via configImportExcel (colonneExcel → colonneInventaire)
        const mapping = mappings.find(m => normalizeCode(m.colonneExcel) === codeNorm && COLONNES_FIXES.includes(m.colonneInventaire))
        if (mapping && !(mapping.colonneInventaire in data)) {
          if (COLONNES_FIXES_DATE.includes(mapping.colonneInventaire)) {
            const d = new Date(valeur)
            data[mapping.colonneInventaire] = isNaN(d.getTime()) ? null : d
          } else {
            data[mapping.colonneInventaire] = valeur
          }
        }
      }
    } catch {}
  }

  // Champs explicites de la ligne
  if (ligne.garantie) data.warranty = ligne.garantie
  if (ligne.panneClient) data.defectFromCustomer = ligne.panneClient
  if (attendu.rma) data.rma = attendu.rma
  if (ligne.caisse) data.caisse = ligne.caisse
  if (ligne.emplacementId) data.emplacementId = ligne.emplacementId

  // Règles d'alerte
  const alerte = await verifierReglesAlerte(prisma, siteId, ligne.sn ?? null)
  if (alerte) {
    data.couleurAlerte = alerte.couleurAlerte
    data.regleAlerteId = alerte.regleAlerteId
    for (const af of alerte.champsAutoFill) {
      if (COLONNES_FIXES.includes(af.colonne) && !(af.colonne in data)) {
        data[af.colonne] = af.valeur
      }
    }
  }

  const inventaireCree = await prisma.inventaire.create({ data: data as any })

  await enregistrerOperation({
    siteId,
    inventaireId: inventaireCree.id,
    userId,
    type: 'RECEPTION',
    details: { attenduId: attendu.id, sn: ligne.sn, label: 'Réception', couleur: '#10b981' }
  })
}

// ─── Helper : trouver l'article par PN ───────────────────────────────────────
async function chargerArticles(siteId: number) {
  const champsArticle = await prisma.champArticle.findMany({ where: { siteId } })
  const champsPNIds = champsArticle
    .filter((c: any) => ['PN', 'P_N', 'PART_NUMBER', 'PART_NO'].includes(c.code.toUpperCase()))
    .map((c: any) => c.id)
  const articles = await prisma.article.findMany({ where: { siteId }, include: { valeurs: true } })

  function trouverParPN(pn: string) {
    return articles.find(a => a.valeurs.some((v: any) => champsPNIds.includes(v.champId) && v.valeur === pn)) ?? null
  }

  return { articles, trouverParPN }
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

    const config = await prisma.configAttendus.findUnique({ where: { siteId: Number(siteId) } })
    const mappings = await prisma.configImportExcel.findMany({ where: { siteId: Number(siteId), actif: true } })

    const wb = XLSX.readFile(file.path)
    const nomOnglet = config?.nomOnglet || 'Terminal Details'
    const sheetName = wb.SheetNames.find(s => normalize(s) === normalize(nomOnglet))
      || wb.SheetNames.find(s => normalize(s).includes('terminal'))
      || wb.SheetNames[0]
    const ws = wb.Sheets[sheetName]
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

    const headerRowIdx = findHeaderRow(data)
    const headers = (data[headerRowIdx] || []).map((h: any) => String(h ?? ''))

    const colSNConfig = mappings.find(m => m.roleSpecial === 'SN')
    const colPNConfig = mappings.find(m => m.roleSpecial === 'PN')

    const iSN = colSNConfig
      ? headers.findIndex(h => normalize(h) === normalize(colSNConfig.colonneExcel))
      : findCol(headers, COL_SN)
    const iPN = colPNConfig
      ? headers.findIndex(h => normalize(h) === normalize(colPNConfig.colonneExcel))
      : findCol(headers, COL_PN)

    const colsMappees = mappings.filter(m => !m.roleSpecial).map(m => ({
      idx: headers.findIndex(h => normalize(h) === normalize(m.colonneExcel)),
      colonneInventaire: m.colonneInventaire
    })).filter(m => m.idx !== -1)

    const iPanne    = mappings.length === 0 ? findCol(headers, COL_PANNE) : -1
    const iGarantie = mappings.length === 0 ? findCol(headers, COL_GARANTIE) : -1

    if (iSN === -1 || iPN === -1) {
      fs.unlinkSync(file.path)
      return res.status(400).json({ error: 'Colonnes Serial Number / Part Number introuvables. Vérifiez la configuration du mapping.' })
    }

    const lignesRaw: any[] = []
    for (let i = headerRowIdx + 1; i < data.length; i++) {
      const row = data[i]
      if (!row || !row[iSN] || !row[iPN]) continue
      const sn = String(row[iSN]).trim()
      const pn = String(row[iPN]).trim()
      if (!sn || !pn) continue

      const colonnesMappees: Record<string, string> = {}
      for (const col of colsMappees) {
        if (row[col.idx]) colonnesMappees[col.colonneInventaire] = String(row[col.idx]).trim()
      }

      lignesRaw.push({
        sn, pn,
        panneClient: colonnesMappees['defectFromCustomer'] || (iPanne !== -1 && row[iPanne] ? String(row[iPanne]).trim() : null),
        garantie:    colonnesMappees['warranty']           || (iGarantie !== -1 && row[iGarantie] ? String(row[iGarantie]).trim() : null),
        colonnesMappees
      })
    }

    const obligatoirePN = config?.obligatoirePNcatalogue ?? true
    if (obligatoirePN) {
      const pnsUniques = [...new Set(lignesRaw.map(l => l.pn))]
      const champsArticle = await prisma.champArticle.findMany({ where: { siteId: Number(siteId) } })
      const champsPNIds = champsArticle
        .filter(c => ['PN', 'P_N', 'PART_NUMBER', 'PART_NO'].includes(c.code.toUpperCase()))
        .map(c => c.id)
      const articlesExistants = await prisma.article.findMany({
        where: { siteId: Number(siteId) },
        include: { valeurs: { where: { champId: { in: champsPNIds } } } }
      })
      const pnsCatalogue = new Set(articlesExistants.flatMap(a => a.valeurs.map(v => v.valeur)).filter(Boolean))
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
    let donnees: Record<string, string> = {}
    if (donneesCommunes) {
      try { donnees = typeof donneesCommunes === 'string' ? JSON.parse(donneesCommunes) : donneesCommunes } catch {}
    }
    const rmaAuto = Object.entries(donnees).find(([k]) => ['BL', 'RMA', 'BON_LIVRAISON'].includes(normalizeCode(k)))?.[1] || null
    const btAuto  = Object.entries(donnees).find(([k]) => ['BT', 'BT_RECEP', 'BON_TRANSPORT'].includes(normalizeCode(k)))?.[1] || null

    if (config?.champsAttendu) {
      try {
        const champsConfig: any[] = typeof config.champsAttendu === 'string' ? JSON.parse(config.champsAttendu) : (config.champsAttendu as any)
        const champsUniques = champsConfig.filter((c: any) => c.uniqueValeur && c.visible)
        if (champsUniques.length > 0) {
          const attendusExistants = await prisma.attendu.findMany({ where: { siteId: Number(siteId), statut: { not: 'CLOS' } } })
          for (const champCfg of champsUniques) {
            const valeur = donnees[champCfg.code]
            if (!valeur) continue
            for (const att of attendusExistants) {
              if (!att.donneesCommunes) continue
              try {
                const dc: Record<string, string> = JSON.parse(att.donneesCommunes)
                if (dc[champCfg.code] === valeur) {
                  fs.unlinkSync(file.path)
                  return res.status(400).json({ error: `Un attendu non clôturé possède déjà la valeur "${valeur}" pour le champ "${champCfg.code}" (Attendu #${att.id}). Ce champ est configuré comme unique.` })
                }
              } catch {}
            }
          }
        }
      } catch {}
    }

    const attendu = await prisma.attendu.create({
      data: { siteId: Number(siteId), rma: rmaAuto, bt: btAuto, donneesCommunes: Object.keys(donnees).length > 0 ? JSON.stringify(donnees) : null, statut: 'EN_COURS' }
    })
    const lignes = lignesRaw.map(({ colonnesMappees, ...l }) => ({ ...l, attenduId: attendu.id, statut: 'ATTENDU' }))
    await prisma.ligneAttendue.createMany({ data: lignes })
    fs.unlinkSync(file.path)
    res.json({ ...attendu, lignesCount: lignes.length })
  } catch (e) { next(e) }
}

export async function update(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const { donneesCommunes } = req.body
    const donnees: Record<string, string> = donneesCommunes ?? {}
    const rmaAuto = Object.entries(donnees).find(([k]) => ['BL', 'RMA', 'BON_LIVRAISON'].includes(normalizeCode(k)))?.[1] ?? null
    const btAuto  = Object.entries(donnees).find(([k]) => ['BT', 'BT_RECEP', 'BON_TRANSPORT'].includes(normalizeCode(k)))?.[1] ?? null
    const attendu = await prisma.attendu.update({
      where: { id: Number(id) },
      data: { rma: rmaAuto, bt: btAuto, donneesCommunes: Object.keys(donnees).length > 0 ? JSON.stringify(donnees) : null }
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
    const { sn, pn, accessoires, caisse, emplacementId } = req.body

    const attendu = await prisma.attendu.findUnique({ where: { id: Number(id) }, include: { lignes: true } })
    if (!attendu) return res.status(404).json({ error: 'Attendu introuvable' })
    if (attendu.statut === 'CLOS') return res.status(400).json({ error: 'Attendu clôturé' })

    const snNorm = String(sn).trim()
    const accessoiresJson = accessoires ? JSON.stringify(accessoires) : null
    const ligne = attendu.lignes.find(l => l.sn === snNorm && l.statut === 'ATTENDU' && (!pn || l.pn === pn))

    // Vérifier présence en inventaire via colonne fixe serialNumber
    const existingActif = await prisma.inventaire.findFirst({
      where: { siteId: attendu.siteId, serialNumber: snNorm, statut: { is: { roles: { not: { contains: 'estFinal' } } } } },
      include: { statut: true }
    })
    const dejaEnInventaire = !!existingActif
    const rmaExistant = existingActif?.rma ?? null

    if (ligne) {
      await prisma.ligneAttendue.update({
        where: { id: ligne.id },
        data: { statut: 'RECU', snRecu: snNorm, accessoires: accessoiresJson, caisse: caisse || null, emplacementId: emplacementId ? Number(emplacementId) : null }
      })
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

    // Vérifier champs obligatoires
    const configChampsCheck = await prisma.configAttendus.findUnique({ where: { siteId: attendu.siteId } })
    if (configChampsCheck?.champsAttendu) {
      const champsConfig: any[] = typeof configChampsCheck.champsAttendu === 'string' ? JSON.parse(configChampsCheck.champsAttendu) : (configChampsCheck.champsAttendu as any)
      let donnees: Record<string, string> = {}
      if (attendu.donneesCommunes) { try { donnees = JSON.parse(attendu.donneesCommunes) } catch {} }
      const champsObligatoires = champsConfig.filter((c: any) => c.visible && (c.obligatoire || c.obligatoireCloture))
      const manquants = champsObligatoires.filter((c: any) => !String(donnees[c.code] ?? '').trim())
      if (manquants.length > 0) {
        return res.status(400).json({
          error: `Clôture impossible : complétez d'abord les champs obligatoires suivants via "Modifier infos" : ${manquants.map((c: any) => c.code).join(', ')}`,
          champsManquants: manquants.map((c: any) => c.code)
        })
      }
    }

    // Vérifier doublons actifs via colonne fixe
    const lignesRecues = attendu.lignes.filter(l => l.statut === 'RECU')
    const snsRecus = lignesRecues.map(l => l.sn).filter(Boolean)
    const doublonsActifs = snsRecus.length > 0
      ? await prisma.inventaire.findMany({
          where: { siteId: attendu.siteId, serialNumber: { in: snsRecus }, statut: { roles: { not: { contains: 'estFinal' } } } },
          select: { serialNumber: true }
        })
      : []
    if (doublonsActifs.length > 0) {
      return res.status(400).json({
        error: `Clôture impossible : ${doublonsActifs.length} S/N déjà présent${doublonsActifs.length > 1 ? 's' : ''} en inventaire avec un statut non final.`,
        snsEnDoublon: doublonsActifs.map(e => e.serialNumber)
      })
    }

    // Marquer les non scannés comme NON_RECU
    await prisma.ligneAttendue.updateMany({
      where: { attenduId: Number(id), statut: 'ATTENDU' },
      data: { statut: 'NON_RECU' }
    })

    // Charger données pour injection
    const mappings = await prisma.configImportExcel.findMany({ where: { siteId: attendu.siteId, actif: true } })
    const { trouverParPN } = await chargerArticles(attendu.siteId)
    const configSite = await prisma.configAttendus.findUnique({ where: { siteId: attendu.siteId } })

    const statutStock = await (async () => {
      const sIds = (await prisma.statut.findMany({ where: { siteId: attendu.siteId }, select: { id: true, roles: true } }))
        .filter(s => hasRole(s.roles, 'estStock')).map(s => s.id)
      return sIds.length > 0 ? prisma.statut.findFirst({ where: { id: { in: sIds } } }) : null
    })()
    ?? (configSite?.statutCloture
      ? await prisma.statut.findFirst({ where: { siteId: attendu.siteId, code: configSite.statutCloture } })
      : await prisma.statut.findFirst({ where: { siteId: attendu.siteId, OR: [{ code: { contains: 'STOCK' } }, { label: { contains: 'stock' } }] } })
    )

    // S/N déjà présents (statut non final)
    const snsDejaPresents = new Set(
      doublonsActifs.map(e => e.serialNumber).filter(Boolean)
    )

    let lignesInjectees = 0
    const snDoublons: string[] = []

    for (const ligne of lignesRecues) {
      if (snsDejaPresents.has(ligne.sn)) {
        snDoublons.push(ligne.sn)
        await prisma.ligneAttendue.update({ where: { id: ligne.id }, data: { statut: 'DOUBLON_INVENTAIRE', notes: 'Déjà présent en inventaire au moment de la clôture' } })
        continue
      }
      const article = trouverParPN(ligne.pn)
      await creerEntreeInventaire({ siteId: attendu.siteId, ligne, attendu, article, mappings, statutStockId: statutStock?.id ?? null, userId: req.user?.id })
      await prisma.ligneAttendue.update({ where: { id: ligne.id }, data: { statut: 'INJECTE' } })
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
  const recus      = lignesNormales.filter(l => l.statut === 'RECU' || l.statut === 'INJECTE')
  const recusNonInjectes = lignesNormales.filter(l => l.statut === 'RECU')

  // Doublons inventaire en temps réel via colonne fixe
  const snsNonInjectes = recusNonInjectes.map(l => l.sn).filter(Boolean)
  const doublonsActifs = snsNonInjectes.length > 0
    ? await prisma.inventaire.findMany({
        where: { siteId: attendu.siteId, serialNumber: { in: snsNonInjectes }, statut: { roles: { not: { contains: 'estFinal' } } } },
        select: { serialNumber: true, rma: true }
      })
    : []

  const doublonsInventaire = doublonsActifs.map(inv => {
    const ligne = recusNonInjectes.find(l => l.sn === inv.serialNumber)
    if (!ligne) return null
    return { ...ligne, notes: inv.rma ? `Déjà en inventaire — RMA : ${inv.rma}` : 'Déjà en inventaire' }
  }).filter((d): d is NonNullable<typeof d> => d !== null)

  const doublonsStockes = attendu.lignes.filter(l => l.statut === 'DOUBLON_INVENTAIRE')
  const tousDoublons = [
    ...doublonsInventaire,
    ...doublonsStockes.filter(d => !doublonsInventaire.some(di => di.sn === d.sn))
  ]

  res.json({ nonRecus, inattendus, doublonsInventaire: tousDoublons, recus, total: lignesNormales.length })
}
