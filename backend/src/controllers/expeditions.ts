import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { hasRole } from '../utils/roles'
import { enregistrerOperation } from '../utils/operations'
import { logActivite, computeResultat } from '../utils/historique'
import { normCode } from '../utils/pda'

const prisma = new PrismaClient()

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getStatuts(siteId: number) {
  return prisma.statut.findMany({ where: { siteId } })
}

function getDesignationByChampId(inv: { article?: { valeurs: { valeur: string | null; champId: number }[] } | null }, champId: number | undefined): string {
  if (!champId) return ''
  return inv.article?.valeurs.find(v => v.champId === champId)?.valeur ?? ''
}

async function getStatutEmballage(siteId: number) {
  const statuts = await getStatuts(siteId)
  const statutControle = statuts.find(s => hasRole(s.roles, 'estControleQualite')) ?? null
  const statutEmballage = statuts.find(s => hasRole(s.roles, 'estEmballage')) ?? null
  return { statutControle, statutEmballage }
}

async function getStatutFinal(siteId: number) {
  const statuts = await getStatuts(siteId)
  return statuts.find(s => hasRole(s.roles, 'estFinal')) ?? null
}

async function genererNumeroMasterBox(siteId: number, clientValeur: string | null): Promise<string> {
  const boxes = await prisma.masterBox.findMany({ where: { siteId, clientValeur, statut: { not: 'EXPEDIEE' } }, select: { numero: true } })
  let max = 0
  for (const b of boxes) {
    const m = b.numero.match(/^MB-(\d+)$/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `MB-${String(max + 1).padStart(4, '0')}`
}

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

async function trouverOuCreerMasterBoxActive(
  siteId: number,
  clientValeur: string | null,
  pnValeur: string | null,
  rmaValeur: string | null,
  zone: string | null,
  userId?: number | null
) {
  const candidates = await prisma.masterBox.findMany({
    where: { siteId, clientValeur, statut: 'OUVERTE' },
    include: { lignes: { include: { inventaire: true }, take: 1 } },
    orderBy: { createdAt: 'desc' }
  })

  for (const box of candidates) {
    if (zone === 'Adyen' && box.lignes.length > 0) {
      const premiere = box.lignes[0].inventaire
      if (premiere.partNumber !== (pnValeur || '') || premiere.rma !== (rmaValeur || '')) continue
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

    const inv = await prisma.inventaire.findFirst({
      where: { siteId, serialNumber: sn },
      include: { statut: true, article: { include: { valeurs: { include: { champ: true } } } } }
    })

    if (!inv) return res.status(404).json({ error: `S/N ${sn} introuvable en inventaire` })

    const estControle = hasRole(inv.statut?.roles, 'estControleQualite') || hasRole(inv.statut?.roles, 'CONTROL')
    if (!estControle) {
      return res.status(400).json({
        error: `Ce S/N n'est pas en statut "Contrôle qualité" (statut actuel : ${inv.statut?.label ?? '—'})`,
        statutActuel: inv.statut?.label ?? '—'
      })
    }

    const { statutEmballage } = await getStatutEmballage(siteId)
    if (!statutEmballage) {
      return res.status(400).json({ error: 'Aucun statut "Emballage" (rôle estEmballage) configuré dans le workflow.' })
    }

    const today = new Date()
    await prisma.inventaire.update({
      where: { id: inv.id },
      data: { statutId: statutEmballage.id, datePack: today, dateCls: today }
    })

    const labelAvantEmb = inv.statut?.label ?? '?'
    const resultatEmb = await computeResultat(inv.id, inv.statut?.ordre ?? 0, statutEmballage.ordre, statutEmballage.label)
    await logActivite({
      siteId, userId: (req as any).user?.id ?? undefined,
      type: 'TRANSITION_STATUT', entite: 'inventaire', entiteId: inv.id,
      details: { label: `${labelAvantEmb} → ${statutEmballage.label}`, couleur: statutEmballage.couleur, statutAvant: labelAvantEmb, statutApres: statutEmballage.label },
      resultat: resultatEmb
    })

    res.json({
      ok: true,
      inventaireId: inv.id,
      sn,
      pnValeur: inv.partNumber ?? '',
      rmaValeur: inv.rma ?? '',
      designationValeur: inv.article?.valeurs.find((v: any) => normCode(v.champ?.code ?? '') === 'DESIGNATION')?.valeur ?? '',
      clientValeur: inv.customer ?? '',
      statut: statutEmballage.label
    })
  } catch (e) { next(e) }
}

// ─── Liste des articles emballés (groupés par RMA × P/N) ────────────────────

export async function getEmballages(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)

    const { statutEmballage } = await getStatutEmballage(siteId)
    if (!statutEmballage) return res.json([])

    const [inventaires, champsArticleEmb] = await Promise.all([
      prisma.inventaire.findMany({
        where: { siteId, statutId: statutEmballage.id, ligneMasterBox: { is: null } },
        include: { article: { include: { valeurs: true } } },
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.champArticle.findMany({ where: { siteId } })
    ])
    const champDesigEmb = champsArticleEmb.find(c => normCode(c.code) === 'DESIGNATION')

    const groupes = new Map<string, {
      pnValeur: string; rmaValeur: string; designationValeur: string; clientValeur: string
      ids: number[]; sns: string[]
    }>()

    for (const inv of inventaires) {
      const pnVal     = inv.partNumber    ?? ''
      const rmaVal    = inv.rma           ?? ''
      const desigVal  = getDesignationByChampId(inv, champDesigEmb?.id)
      const clientVal = inv.customer      ?? ''
      const snVal     = inv.serialNumber  ?? ''
      const key = `${pnVal}__${rmaVal}`
      if (!groupes.has(key)) {
        groupes.set(key, { pnValeur: pnVal, rmaValeur: rmaVal, designationValeur: desigVal, clientValeur: clientVal, ids: [], sns: [] })
      }
      const g = groupes.get(key)!
      g.ids.push(inv.id)
      if (snVal) g.sns.push(snVal)
    }

    res.json(Array.from(groupes.values()).map(g => ({
      pnValeur: g.pnValeur,
      rmaValeur: g.rmaValeur,
      designationValeur: g.designationValeur,
      clientValeur: g.clientValeur,
      quantite: g.ids.length,
      sns: g.sns
    })))
  } catch (e) { next(e) }
}

// ─── Master Box ──────────────────────────────────────────────────────────────

export async function scanMasterBox(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const sn = String(req.body?.sn ?? '').trim()
    if (!sn) return res.status(400).json({ error: 'S/N requis' })

    const { statutEmballage } = await getStatutEmballage(siteId)
    if (!statutEmballage) {
      return res.status(400).json({ error: 'Aucun statut "Emballage" (rôle estEmballage) configuré dans le workflow.' })
    }

    const inv = await prisma.inventaire.findFirst({
      where: { siteId, serialNumber: sn },
      include: { statut: true, ligneMasterBox: true, article: { include: { valeurs: { include: { champ: true } } } } }
    })

    if (!inv) return res.status(404).json({ error: `S/N ${sn} introuvable en inventaire` })

    if (inv.statutId !== statutEmballage.id) {
      return res.status(400).json({
        error: `Ce S/N n'est pas au statut "Emballé" (statut actuel : ${inv.statut?.label ?? '—'})`,
        statutActuel: inv.statut?.label ?? '—'
      })
    }

    if (inv.ligneMasterBox) {
      return res.status(400).json({ error: `Ce S/N est déjà affecté à une Master Box` })
    }

    const clientValeur = inv.customer || null
    const pnValeur     = inv.partNumber || null
    const rmaValeur    = inv.rma || null
    const zone = await getZoneClient(siteId, clientValeur)

    const masterBox = await trouverOuCreerMasterBoxActive(siteId, clientValeur, pnValeur, rmaValeur, zone, req.user?.id)

    await prisma.ligneMasterBox.create({ data: { masterBoxId: masterBox.id, inventaireId: inv.id } })

    await logActivite({ siteId, userId: req.user?.id, type: 'MASTERBOX', entite: 'inventaire', entiteId: inv.id, details: { numero: masterBox.numero } })

    res.json({
      ok: true,
      sn,
      pnValeur,
      rmaValeur,
      designationValeur: inv.article?.valeurs.find((v: any) => normCode(v.champ?.code ?? '') === 'DESIGNATION')?.valeur ?? '',
      clientValeur,
      masterBox: { id: masterBox.id, numero: masterBox.numero }
    })
  } catch (e) { next(e) }
}

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

export async function getMasterBoxesEnregistrees(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)

    const [boxes, champsArticleEnr] = await Promise.all([
      prisma.masterBox.findMany({
        where: { siteId, statut: 'EN_ATTENTE' },
        include: { lignes: { include: { inventaire: { include: { article: { include: { valeurs: true } } } } } } },
        orderBy: [{ clientValeur: 'asc' }, { createdAt: 'asc' }]
      }),
      prisma.champArticle.findMany({ where: { siteId } })
    ])
    const champDesigEnr = champsArticleEnr.find(c => normCode(c.code) === 'DESIGNATION')

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
        const pnVal    = l.inventaire.partNumber    ?? ''
        const rmaVal   = l.inventaire.rma           ?? ''
        const desigVal = getDesignationByChampId(l.inventaire, champDesigEnr?.id)
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
      return res.status(404).json({ error: "Cet article n'est affecté à aucune Master Box" })
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

export async function envoyerMasterBoxes(req: Request, res: Response, next: any) {
  try {
    const siteId       = Number(req.params.siteId)
    const raw          = req.body?.clientValeur
    const clientValeur = (raw === null || raw === undefined || raw === '') ? null : String(raw)
    const btEnvoi      = req.body?.btEnvoi      ? String(req.body.btEnvoi)      : null
    const plateformeId = req.body?.plateformeId ? Number(req.body.plateformeId) : null

    // Résoudre le nom SOCIETE de la plateforme
    let plateformeNom: string | null = null
    if (plateformeId) {
      const champSociete = await prisma.champPlateforme.findFirst({ where: { siteId, code: 'SOCIETE' } })
      if (champSociete) {
        const valeur = await prisma.valeurChampPlateforme.findFirst({ where: { plateformeId, champId: champSociete.id } })
        plateformeNom = valeur?.valeur ?? null
      }
    }

    const statutFinal = await getStatutFinal(siteId)
    if (!statutFinal) {
      return res.status(400).json({ error: 'Aucun statut Final (rôle estFinal) configuré dans le workflow.' })
    }

    const boxes = await prisma.masterBox.findMany({
      where: { siteId, statut: 'EN_ATTENTE', clientValeur },
      include: { lignes: true }
    })

    if (boxes.length === 0) {
      return res.status(400).json({ error: 'Aucune Master Box en attente pour ce client' })
    }

    const today = new Date()
    let nbArticles = 0
    for (const box of boxes) {
      const invIds = box.lignes.map(l => l.inventaireId)
      const invsAvant = await prisma.inventaire.findMany({ where: { id: { in: invIds } }, include: { statut: true } })
      const invMap = Object.fromEntries(invsAvant.map(i => [i.id, i]))

      for (const ligne of box.lignes) {
        const invAvant = invMap[ligne.inventaireId]
        await prisma.inventaire.update({
          where: { id: ligne.inventaireId },
          data: {
            statutId:       statutFinal.id,
            dateSHP:        today,
            ...(btEnvoi      ? { btEnvoi }                    : {}),
            ...(plateformeNom ? { plateformeEnvoi: plateformeNom } : {}),
          }
        })
        const labelAvantExp = invAvant?.statut?.label ?? '?'
        const resultatExp = await computeResultat(ligne.inventaireId, invAvant?.statut?.ordre ?? 0, statutFinal.ordre, statutFinal.label)
        await logActivite({
          siteId, userId: (req as any).user?.id ?? undefined,
          type: 'TRANSITION_STATUT', entite: 'inventaire', entiteId: ligne.inventaireId,
          details: { label: `${labelAvantExp} → ${statutFinal.label}`, couleur: statutFinal.couleur, statutAvant: labelAvantExp, statutApres: statutFinal.label },
          resultat: resultatExp
        })
        nbArticles++
      }
      await prisma.masterBox.update({ where: { id: box.id }, data: { statut: 'EXPEDIEE' } })
    }

    await deleteBrouillonBL(siteId, clientValeur)
    res.json({ ok: true, nbBoxes: boxes.length, nbArticles })
  } catch (e) { next(e) }
}

export async function getBrouillonBL(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const clientValeur = req.query.clientValeur ? String(req.query.clientValeur) : null
    const brouillon = await prisma.brouillonBL.findUnique({ where: { siteId_clientValeur: { siteId, clientValeur: clientValeur ?? '' } } })
    res.json(brouillon ?? null)
  } catch (e) { next(e) }
}

export async function saveBrouillonBL(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const clientValeur = req.query.clientValeur ? String(req.query.clientValeur) : null
    const { numeroBL, bonTransport, eta, colisJson, plateformeId } = req.body
    const brouillon = await prisma.brouillonBL.upsert({
      where: { siteId_clientValeur: { siteId, clientValeur: clientValeur ?? '' } },
      create: { siteId, clientValeur: clientValeur ?? '', numeroBL, bonTransport: bonTransport || null, eta: eta || null, colisJson: colisJson || null, plateformeId: plateformeId || null },
      update: { numeroBL, bonTransport: bonTransport || null, eta: eta || null, colisJson: colisJson || null, plateformeId: plateformeId || null }
    })
    res.json(brouillon)
  } catch (e) { next(e) }
}

export async function deleteBrouillonBL(siteId: number, clientValeur: string | null) {
  await prisma.brouillonBL.deleteMany({ where: { siteId, clientValeur } })
}

export async function getArticlesMasterBoxEnregistrees(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const raw = req.query.clientValeur
    const clientValeur = (raw === undefined || raw === null || raw === '' || raw === 'Sans client') ? null : String(raw)

    const [lignes, champsArticle] = await Promise.all([
      prisma.ligneMasterBox.findMany({
        where: { masterBox: { siteId, statut: 'EN_ATTENTE', clientValeur } },
        include: { inventaire: { include: { statut: true, article: { include: { valeurs: true } } } } }
      }),
      prisma.champArticle.findMany({ where: { siteId } })
    ])
    const champDesig  = champsArticle.find(c => normCode(c.code) === 'DESIGNATION')
    const champFamille = champsArticle.find(c => normCode(c.code) === 'FAMILLE')

    const fmtDate = (d: Date | null | undefined) => d ? d.toISOString().slice(0, 10) : ''

    const articles = lignes.map(l => {
      const inv = l.inventaire
      return {
        id:                 inv.id,
        serialNumber:       inv.serialNumber        ?? '',
        partNumber:         inv.partNumber          ?? '',
        rma:                inv.rma                 ?? '',
        customer:           inv.customer            ?? '',
        designation:        getDesignationByChampId(inv, champDesig?.id),
        famille:            getDesignationByChampId(inv, champFamille?.id),
        defectFromCustomer: inv.defectFromCustomer  ?? '',
        descrCode:          inv.descrCode           ?? '',
        repaireNotes:       inv.repaireNotes        ?? '',
        livelloRiparazione: inv.livelloRiparazione  ?? '',
        warranty:           inv.warranty            ?? '',
        mercurySn:          inv.mercurySn           ?? '',
        techLabo:           inv.techLabo            ?? '',
        dateRic:            fmtDate(inv.dateRic),
        dateLav:            fmtDate(inv.dateLav),
        dateMaj:            fmtDate(inv.dateMaj),
        dateInjection:      fmtDate(inv.dateInjection),
        dateTest:           fmtDate(inv.dateTest),
        datePack:           fmtDate(inv.datePack),
        dateAsp:            fmtDate(inv.dateAsp),
        dateAsw:            fmtDate(inv.dateAsw),
        dateEng:            fmtDate(inv.dateEng),
        datePrv:            fmtDate(inv.datePrv),
        dateNlv:            fmtDate(inv.dateNlv),
        statut: inv.statut ? { label: inv.statut.label } : null,
      }
    })

    res.json({ articles })
  } catch (e) { next(e) }
}

export async function getArticlesBL(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const raw = req.query.clientValeur
    const clientValeur = (raw === undefined || raw === null || raw === '' || raw === 'Sans client') ? null : String(raw)

    const champsArticle = await prisma.champArticle.findMany({ where: { siteId } })
    const champModelArticle       = champsArticle.find(c => normCode(c.code) === 'FAMILLE')
    const champDesignationArticle = champsArticle.find(c => normCode(c.code) === 'DESIGNATION')

    const lignes = await prisma.ligneMasterBox.findMany({
      where: { masterBox: { siteId, statut: 'EN_ATTENTE', clientValeur } },
      include: { inventaire: { include: { article: { include: { valeurs: true } } } } }
    })

    const articles = lignes.map(l => ({
      sn:          l.inventaire.serialNumber  ?? '',
      pn:          l.inventaire.partNumber    ?? '',
      designation: getDesignationByChampId(l.inventaire, champDesignationArticle?.id),
      model:       champModelArticle ? (l.inventaire.article?.valeurs.find(v => v.champId === champModelArticle.id)?.valeur ?? '') : '',
    }))

    res.json({ articles })
  } catch (e) { next(e) }
}

async function getMasterBoxDetailData(siteId: number, id: number) {
  const masterBox = await prisma.masterBox.findFirst({
    where: { id, siteId },
    include: { lignes: { include: { inventaire: { include: { article: { include: { valeurs: true } } } } } } }
  })
  if (!masterBox) return null

  const champsArticle = await prisma.champArticle.findMany({ where: { siteId } })
  const champModelArticle       = champsArticle.find(c => normCode(c.code) === 'FAMILLE')
  const champDesignationArticle = champsArticle.find(c => normCode(c.code) === 'DESIGNATION')

  const articles = masterBox.lignes.map(l => ({
    inventaireId:      l.inventaireId,
    sn:                l.inventaire.serialNumber  ?? '',
    pnValeur:          l.inventaire.partNumber    ?? '',
    rmaValeur:         l.inventaire.rma           ?? '',
    designationValeur: getDesignationByChampId(l.inventaire, champDesignationArticle?.id),
    modelValeur:       champModelArticle ? (l.inventaire.article?.valeurs.find(v => v.champId === champModelArticle.id)?.valeur ?? '') : '',
    clientValeur:      l.inventaire.customer      ?? '',
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

export async function getMasterBoxDetail(req: Request, res: Response, next: any) {
  try {
    const siteId = Number(req.params.siteId)
    const id = Number(req.params.id)
    const detail = await getMasterBoxDetailData(siteId, id)
    if (!detail) return res.status(404).json({ error: 'Master Box introuvable' })
    res.json(detail)
  } catch (e) { next(e) }
}
