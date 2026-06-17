import { PrismaClient } from '@prisma/client'

export interface ResultatAlerte {
  couleurAlerte: string
  regleAlerteId: number
  champsAutoFill: Array<{ colonne: string; valeur: string }>
}

export async function verifierReglesAlerte(
  prisma: PrismaClient,
  siteId: number,
  snValue: string | null,
): Promise<ResultatAlerte | null> {
  if (!snValue?.trim()) return null

  const regles = await prisma.regleAlerte.findMany({ where: { siteId, actif: true } })
  if (regles.length === 0) return null

  // Chercher une entrée existante avec ce SN et un statut final
  const entreeFinale = await prisma.inventaire.findFirst({
    where: {
      siteId,
      serialNumber: snValue,
      statut: { roles: { contains: 'estFinal' } }
    }
  })
  if (!entreeFinale) return null

  const today = new Date()

  for (const regle of regles) {
    const valeurDate = (entreeFinale as any)[regle.codeChampDate] as Date | null | undefined
    if (!valeurDate) continue

    const date = new Date(valeurDate)
    if (isNaN(date.getTime())) continue

    const limite = new Date(date)
    limite.setMonth(limite.getMonth() + regle.seuilMois)

    if (today >= date && today <= limite) {
      let champsAutoFill: Array<{ colonne: string; valeur: string }> = []
      if (regle.champsAutoFill) {
        try { champsAutoFill = JSON.parse(regle.champsAutoFill) } catch {}
      }
      return { couleurAlerte: regle.couleurAlerte, regleAlerteId: regle.id, champsAutoFill }
    }
  }

  return null
}
