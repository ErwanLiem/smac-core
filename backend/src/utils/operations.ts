import { PrismaClient } from '@prisma/client'
import { logActivite, HistoriqueType } from './historique'

const prisma = new PrismaClient()

interface EnregistrerOperationParams {
  siteId: number
  inventaireId: number
  champCode: string
  userId?: number | null
  type: HistoriqueType
  details?: Record<string, any>
}

/**
 * Trace une opération sur une ligne d'inventaire :
 * - écrit le login de l'opérateur dans le champ OPE.xxx correspondant
 * - enregistre l'événement dans l'historique (horodatage + opérateur)
 */
export async function enregistrerOperation(params: EnregistrerOperationParams): Promise<void> {
  const { siteId, inventaireId, champCode, userId, type, details } = params

  if (userId) {
    const utilisateur = await prisma.utilisateur.findUnique({ where: { id: userId }, select: { login: true } })
    if (utilisateur) {
      const champ = await prisma.champInventaire.findFirst({ where: { siteId, code: champCode } })
      if (champ) {
        await prisma.valeurChampInventaire.upsert({
          where: { inventaireId_champId: { inventaireId, champId: champ.id } },
          create: { inventaireId, champId: champ.id, valeur: utilisateur.login },
          update: { valeur: utilisateur.login }
        })
      }
    }
  }

  await logActivite({ siteId, userId: userId ?? undefined, type, entite: 'inventaire', entiteId: inventaireId, details })
}
