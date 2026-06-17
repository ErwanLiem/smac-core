import { logActivite, HistoriqueType } from './historique'

interface EnregistrerOperationParams {
  siteId: number
  inventaireId: number
  userId?: number | null
  type: HistoriqueType
  details?: Record<string, any>
}

export async function enregistrerOperation(params: EnregistrerOperationParams): Promise<void> {
  const { siteId, inventaireId, userId, type, details } = params
  await logActivite({ siteId, userId: userId ?? undefined, type, entite: 'inventaire', entiteId: inventaireId, details })
}
