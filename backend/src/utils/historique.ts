import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export type HistoriqueType = 'RECEPTION' | 'MODIFICATION' | 'SUPPRESSION' | 'TRANSITION_STATUT' | 'CREATION' | 'TRANSFERT' | 'EMBALLAGE' | 'MASTERBOX' | 'EXPEDITION'

interface LogParams {
  siteId: number
  userId?: number
  type: HistoriqueType
  entite: 'inventaire' | 'article' | 'client' | 'plateforme' | 'statut'
  entiteId?: number
  details?: Record<string, any>
  resultat?: 'OK' | 'NOK'
}

export async function logActivite(params: LogParams): Promise<void> {
  try {
    await prisma.historiqueActivite.create({
      data: {
        siteId:   params.siteId,
        userId:   params.userId ?? null,
        type:     params.type,
        entite:   params.entite,
        entiteId: params.entiteId ?? null,
        details:  params.details ? JSON.stringify(params.details) : null,
        resultat: params.resultat ?? null,
      }
    })
  } catch (e) {
    console.error('[HISTORIQUE] Erreur lors du log:', e)
  }
}

/**
 * Détermine si une transition de statut est OK ou NOK.
 * OK  = premier passage en avant dans le workflow
 * NOK = recul (ordreApres < ordreAvant) OU re-passage d'une étape déjà franchie
 */
export async function computeResultat(
  inventaireId: number,
  ordreAvant: number,
  ordreApres: number,
  statutApresLabel: string
): Promise<'OK' | 'NOK'> {
  if (ordreApres <= ordreAvant) return 'NOK'

  // Vérifier si la machine a déjà atteint ce statut cible
  const dejaVu = await prisma.historiqueActivite.findFirst({
    where: {
      entite:   'inventaire',
      entiteId: inventaireId,
      type:     'TRANSITION_STATUT',
      details:  { contains: `"statutApres":"${statutApresLabel}"` }
    },
    select: { id: true }
  })

  return dejaVu ? 'NOK' : 'OK'
}
