import { Router } from 'express'
import * as ctrl from '../controllers/expeditions'

const router = Router({ mergeParams: true })

// Emballage
router.post('/:siteId/emballage/scan', ctrl.scanEmballage)
router.get('/:siteId/emballage', ctrl.getEmballages)

// Master Box
router.post('/:siteId/masterbox/scan', ctrl.scanMasterBox)
router.post('/:siteId/masterbox/envoyer', ctrl.envoyerMasterBoxes)
router.post('/:siteId/masterbox/:id/enregistrer', ctrl.enregistrerMasterBox)
router.get('/:siteId/masterbox/en-cours', ctrl.getMasterBoxesEnCours)
router.get('/:siteId/masterbox/enregistrees', ctrl.getMasterBoxesEnregistrees)
router.get('/:siteId/masterbox/:id', ctrl.getMasterBoxDetail)

export default router
