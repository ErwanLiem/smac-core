import { PrismaClient } from '@prisma/client'

export interface ResultatAlerte {
  couleurAlerte: string
  regleAlerteId: number
  champsAutoFill: Array<{ codeChamp: string; valeur: string }>
}

const CODES_SN = ['SN', 'S_N', 'SERIAL', 'SERIAL_NUMBER', 'NUMERO_SERIE', 'NUMERO_DE_SERIE']

function normCode(s: string): string {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_').trim()
}

function getIdsSN(champs: any[]): number[] {
  const found = champs.filter(c => CODES_SN.includes(normCode(c.code)))
  return found.length > 0 ? found.map(c => c.id) : []
}

/**
 * Vérifie si une règle d'alerte se déclenche pour un S/N donné.
 *
 * Logique : si ce S/N existe déjà en inventaire avec un statut final,
 * on regarde les dates de CETTE entrée existante. Si l'une d'elles
 * est dans la fenêtre configurée (dateChamp <= today <= dateChamp + seuilMois),
 * l'alerte se déclenche sur la NOUVELLE entrée en cours de création.
 */
export async function verifierReglesAlerte(
  prisma: PrismaClient,
  siteId: number,
  snValue: string | null,
  champsInvPreloaded?: any[]
): Promise<ResultatAlerte | null> {
  if (!snValue?.trim()) return null

  const regles = await prisma.regleAlerte.findMany({ where: { siteId, actif: true } })
  if (regles.length === 0) return null

  const champsInv = champsInvPreloaded ?? await prisma.champInventaire.findMany({ where: { siteId } })
  const idsSN = getIdsSN(champsInv)
  if (idsSN.length === 0) return null

  // Trouver une entrée en inventaire avec ce S/N et un statut final
  const existants = await prisma.valeurChampInventaire.findMany({
    where: { champId: { in: idsSN }, valeur: snValue },
    include: {
      inventaire: {
        include: { statut: true, valeurs: true }
      }
    }
  })

  const entreeFinale = existants.find(e => {
    const r = e.inventaire?.statut?.roles
    try { return r ? JSON.parse(r).includes('estFinal') : false } catch { return false }
  })
  if (!entreeFinale) return null

  // Construire le map des données de cette entrée existante (statut final)
  const donneesExistantes: Record<string, string> = {}
  for (const val of entreeFinale.inventaire.valeurs) {
    const champ = champsInv.find(c => c.id === val.champId)
    if (champ && val.valeur) donneesExistantes[champ.code.toUpperCase()] = val.valeur
  }

  const today = new Date()

  for (const regle of regles) {
    const valeurDate = donneesExistantes[regle.codeChampDate.toUpperCase()]
    if (!valeurDate) continue

    const date = new Date(valeurDate)
    if (isNaN(date.getTime())) continue

    const limite = new Date(date)
    limite.setMonth(limite.getMonth() + regle.seuilMois)

    if (today >= date && today <= limite) {
      let champsAutoFill: Array<{ codeChamp: string; valeur: string }> = []
      if (regle.champsAutoFill) {
        try { champsAutoFill = JSON.parse(regle.champsAutoFill) } catch {}
      }
      return { couleurAlerte: regle.couleurAlerte, regleAlerteId: regle.id, champsAutoFill }
    }
  }

  return null
}
