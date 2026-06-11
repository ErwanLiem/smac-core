import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { logActivite } from '../utils/historique'
import { verifierReglesAlerte } from '../utils/reglesAlerte'
import { enregistrerOperation } from '../utils/operations'

const prisma = new PrismaClient()

// CHAMPS INVENTAIRE
export async function getChamps(req: Request, res: Response) {
  const { siteId } = req.params
  const champs = await prisma.champInventaire.findMany({
    where: { siteId: Number(siteId) },
    orderBy: { ordre: 'asc' }
  })
  res.json(champs)
}

export async function createChamp(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const { code, label, type, options, obligatoire, ordre, visibleReceptionSN, visibleReceptionQTE } = req.body
    const champ = await prisma.champInventaire.create({
      data: {
        siteId: Number(siteId),
        code,
        label,
        type: type || 'TEXT',
        options: options || null,
        obligatoire: obligatoire ?? false,
        ordre: ordre ?? 0,
        actif: true,
        visibleReceptionSN: visibleReceptionSN ?? false,
        visibleReceptionQTE: visibleReceptionQTE ?? false,
      }
    })
    res.json(champ)
  } catch (e) {
    next(e)
  }
}

export async function updateChamp(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const { label, type, options, obligatoire, ordre, actif, visibleReceptionSN, visibleReceptionQTE } = req.body
    const champ = await prisma.champInventaire.update({
      where: { id: Number(id) },
      data: {
        label,
        type,
        options: options || null,
        obligatoire,
        ordre,
        actif,
        visibleReceptionSN,
        visibleReceptionQTE,
      }
    })
    res.json(champ)
  } catch (e) {
    next(e)
  }
}

export async function deleteChamp(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    await prisma.champInventaire.delete({
      where: { id: Number(id) }
    })
    res.json({ success: true })
  } catch (e) {
    next(e)
  }
}

// Vérification S/N en inventaire
export async function checkSN(req: Request, res: Response) {
  const { siteId, sn } = req.params

  // Trouver le champ S/N
  const champsInv = await prisma.champInventaire.findMany({ where: { siteId: Number(siteId) } })
  const CODES_SN = ['SN', 'S_N', 'NUMERO_SERIE', 'NUMERO DE SERIE', 'SERIAL']

  function normCode(s: string) {
    return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
  }

  const champsSN = champsInv.filter(c => {
    const n = normCode(c.code).replace(/\s+/g, '_')
    const ns = normCode(c.code).replace(/\s+/g, ' ')
    return CODES_SN.includes(n) || CODES_SN.includes(ns) || CODES_SN.includes(normCode(c.code))
  })
  const idsSN = champsSN.length > 0 ? champsSN.map(c => c.id) : champsInv.map(c => c.id)

  const existing = await prisma.valeurChampInventaire.findFirst({
    where: { champId: { in: idsSN }, valeur: sn },
    include: { inventaire: { include: { statut: true } } }
  })

  if (!existing) return res.json({ existe: false })

  const estFinal = (() => {
    const r = existing.inventaire?.statut?.roles
    try { return r ? JSON.parse(r).includes('estFinal') : false } catch { return false }
  })()

  // Chercher le RMA
  const champsRMA = champsInv.filter(c => ['BL', 'RMA', 'BON_LIVRAISON'].includes(normCode(c.code)))
  let rma = null
  if (champsRMA.length > 0) {
    const valRMA = await prisma.valeurChampInventaire.findFirst({
      where: { inventaireId: existing.inventaireId, champId: { in: champsRMA.map(c => c.id) } }
    })
    rma = valRMA?.valeur ?? null
  }

  res.json({ existe: true, estFinal, statut: existing.inventaire?.statut?.label ?? null, rma })
}

// INVENTAIRE
export async function getAll(req: Request, res: Response) {
  const { siteId } = req.params
  const inventaires = await prisma.inventaire.findMany({
    where: { siteId: Number(siteId) },
    include: {
      article: true,
      statut: true,
      valeurs: {
        include: {
          champ: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
  res.json(inventaires)
}

export async function create(req: Request, res: Response, next: any) {
  try {
    const { siteId } = req.params
    const { articleId, statutId, valeurs } = req.body
    // valeurs = [{ champId, valeur }]

    // Vérifier les règles d'alerte sur l'entrée existante (statut final) pour ce S/N
    const champs = await prisma.champInventaire.findMany({ where: { siteId: Number(siteId) } })
    const CODES_SN_INV = ['SN', 'S_N', 'SERIAL', 'SERIAL_NUMBER', 'NUMERO_SERIE', 'NUMERO_DE_SERIE']
    function normSN(s: string) { return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_').trim() }
    const champsSN = champs.filter(c => CODES_SN_INV.includes(normSN(c.code)))
    const snValue: string | null = champsSN.length > 0
      ? (valeurs.find((v: any) => champsSN.some((cs: any) => cs.id === v.champId))?.valeur ?? null)
      : null
    const alerte = await verifierReglesAlerte(prisma, Number(siteId), snValue, champs)

    // Fusionner les champs auto-fill de la règle
    let valeursFinales = [...valeurs]
    if (alerte?.champsAutoFill?.length) {
      for (const af of alerte.champsAutoFill) {
        const champ = champs.find(c => c.code.toUpperCase() === af.codeChamp.toUpperCase())
        if (champ && !valeursFinales.some(v => v.champId === champ.id)) {
          valeursFinales.push({ champId: champ.id, valeur: af.valeur })
        }
      }
    }

    const inventaire = await prisma.inventaire.create({
      data: {
        siteId: Number(siteId),
        articleId: Number(articleId),
        statutId: statutId ? Number(statutId) : null,
        couleurAlerte: alerte?.couleurAlerte ?? null,
        regleAlerteId: alerte?.regleAlerteId ?? null,
        valeurs: { create: valeursFinales }
      },
      include: {
        article: true,
        statut: true,
        valeurs: { include: { champ: true } }
      }
    })

    await enregistrerOperation({
      siteId: Number(siteId),
      inventaireId: inventaire.id,
      champCode: 'OPE.RECEPTION',
      userId: (req as any).user?.id,
      type: 'RECEPTION',
      details: {
        articleId: Number(articleId),
        statutId: statutId ? Number(statutId) : null,
        valeurs: valeursFinales.map((v: any) => ({ champId: v.champId, valeur: v.valeur }))
      }
    })

    res.json(inventaire)
  } catch (e) {
    next(e)
  }
}

export async function update(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const { statutId, valeurs } = req.body

    if (Array.isArray(valeurs)) {
      // Supprimer les anciennes valeurs et recréer avec les nouvelles
      await prisma.valeurChampInventaire.deleteMany({
        where: { inventaireId: Number(id) }
      })
    }

    // Créer les nouvelles valeurs
    const inventaire = await prisma.inventaire.update({
      where: { id: Number(id) },
      data: {
        statutId: statutId ? Number(statutId) : null,
        ...(Array.isArray(valeurs) ? { valeurs: { create: valeurs } } : {})
      },
      include: {
        article: true,
        statut: true,
        valeurs: {
          include: {
            champ: true
          }
        }
      }
    })
    await logActivite({
      siteId: inventaire.siteId,
      userId: (req as any).user?.id,
      type: 'MODIFICATION',
      entite: 'inventaire',
      entiteId: inventaire.id,
      details: { statutId: statutId ? Number(statutId) : null }
    })

    res.json(inventaire)
  } catch (e) {
    next(e)
  }
}

// Réception d'une quantité supplémentaire sur une ligne existante (suivi QTE)
// Incrémente le champ et trace l'opération (type RECEPTION) pour le suivi des entrées mensuelles
export async function receptionQte(req: Request, res: Response, next: any) {
  try {
    const { id } = req.params
    const { champId, quantite } = req.body
    const inventaireId = Number(id)
    const qte = Number(quantite)

    if (isNaN(qte)) {
      return res.status(400).json({ error: 'Quantité invalide' })
    }

    const valeurActuelle = await prisma.valeurChampInventaire.findUnique({
      where: { inventaireId_champId: { inventaireId, champId: Number(champId) } }
    })
    const nouvelleValeur = (parseInt(valeurActuelle?.valeur ?? '0') || 0) + qte

    await prisma.valeurChampInventaire.upsert({
      where: { inventaireId_champId: { inventaireId, champId: Number(champId) } },
      create: { inventaireId, champId: Number(champId), valeur: String(nouvelleValeur) },
      update: { valeur: String(nouvelleValeur) }
    })

    const inventaire = await prisma.inventaire.findUnique({
      where: { id: inventaireId },
      include: { article: true, statut: true, valeurs: { include: { champ: true } } }
    })
    if (!inventaire) return res.status(404).json({ error: 'Inventaire introuvable' })

    await enregistrerOperation({
      siteId: inventaire.siteId,
      inventaireId,
      champCode: 'OPE.RECEPTION',
      userId: (req as any).user?.id,
      type: 'RECEPTION',
      details: { champId: Number(champId), quantiteRecue: qte }
    })

    res.json(inventaire)
  } catch (e) {
    next(e)
  }
}

// Mise à jour d'un champ unique d'une ligne d'inventaire (ex : colonne Transfert du Suivi PDA)
export async function updateValeurChamp(req: Request, res: Response, next: any) {
  try {
    const { id, champId } = req.params
    const { valeur } = req.body
    const inventaireId = Number(id)

    const valeurChamp = await prisma.valeurChampInventaire.upsert({
      where: { inventaireId_champId: { inventaireId, champId: Number(champId) } },
      create: { inventaireId, champId: Number(champId), valeur: valeur != null ? String(valeur) : null },
      update: { valeur: valeur != null ? String(valeur) : null }
    })

    res.json(valeurChamp)
  } catch (e) {
    next(e)
  }
}

// Historique d'une ligne d'inventaire (horodatage + opérateur)
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
        details: { articleId: inv.articleId }
      })
    }
    res.json({ success: true })
  } catch (e) {
    next(e)
  }
}
