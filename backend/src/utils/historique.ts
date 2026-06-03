import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface LogParams {
  siteId: number
  userId?: number
  type: 'RECEPTION' | 'MODIFICATION' | 'SUPPRESSION' | 'TRANSITION_STATUT' | 'CREATION'
  entite: 'inventaire' | 'article' | 'client' | 'plateforme' | 'statut'
  entiteId?: number
  details?: Record<string, any>
}

export async function logActivite(params: LogParams): Promise<void> {
  try {
    await prisma.historiqueActivite.create({
      data: {
        siteId: params.siteId,
        userId: params.userId ?? null,
        type: params.type,
        entite: params.entite,
        entiteId: params.entiteId ?? null,
        details: params.details ? JSON.stringify(params.details) : null,
      }
    })
  } catch (e) {
    // Le log ne doit jamais faire planter l'action principale
    console.error('[HISTORIQUE] Erreur lors du log:', e)
  }
}
