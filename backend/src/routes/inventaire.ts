import { Router } from 'express'
import * as inventaireCtrl from '../controllers/inventaire'
import { requirePermission } from '../middleware/auth'

const router = Router({ mergeParams: true })
const peutEditer = requirePermission('/inventaire', 'edit')
const peutSupprimer = requirePermission('/inventaire', 'delete')

// Champs inventaire
router.get('/:siteId/champs', inventaireCtrl.getChamps)
router.post('/:siteId/champs', peutEditer, inventaireCtrl.createChamp)
router.put('/champs/:id', peutEditer, inventaireCtrl.updateChamp)
router.delete('/champs/:id', peutSupprimer, inventaireCtrl.deleteChamp)

// Vérification S/N
router.get('/:siteId/check-sn/:sn', inventaireCtrl.checkSN)

// Historique d'une ligne
router.get('/:id/historique', inventaireCtrl.getHistorique)

// Inventaire
router.get('/:siteId', inventaireCtrl.getAll)
router.post('/:siteId', inventaireCtrl.create)
router.put('/:id', peutEditer, inventaireCtrl.update)
router.put('/:id/reception-qte', inventaireCtrl.receptionQte)
router.put('/:id/champ/:champId', inventaireCtrl.updateValeurChamp)
router.delete('/:id', peutSupprimer, inventaireCtrl.remove)

export default router
