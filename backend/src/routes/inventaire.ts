import { Router } from 'express'
import * as inventaireCtrl from '../controllers/inventaire'
import { requirePermission } from '../middleware/auth'

const router = Router({ mergeParams: true })
const peutEditer = requirePermission('/inventaire', 'edit')
const peutSupprimer = requirePermission('/inventaire', 'delete')

router.get('/:siteId/check-sn/:sn', inventaireCtrl.checkSN)
router.get('/:id/historique', inventaireCtrl.getHistorique)
router.get('/:siteId', inventaireCtrl.getAll)
router.post('/:siteId', inventaireCtrl.create)
router.put('/:id', peutEditer, inventaireCtrl.update)
router.delete('/:id', peutSupprimer, inventaireCtrl.remove)

export default router
