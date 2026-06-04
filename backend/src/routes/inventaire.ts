import { Router } from 'express'
import * as inventaireCtrl from '../controllers/inventaire'

const router = Router({ mergeParams: true })

// Champs inventaire
router.get('/:siteId/champs', inventaireCtrl.getChamps)
router.post('/:siteId/champs', inventaireCtrl.createChamp)
router.put('/champs/:id', inventaireCtrl.updateChamp)
router.delete('/champs/:id', inventaireCtrl.deleteChamp)

// Vérification S/N
router.get('/:siteId/check-sn/:sn', inventaireCtrl.checkSN)

// Inventaire
router.get('/:siteId', inventaireCtrl.getAll)
router.post('/:siteId', inventaireCtrl.create)
router.put('/:id', inventaireCtrl.update)
router.delete('/:id', inventaireCtrl.remove)

export default router
