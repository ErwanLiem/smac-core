import { Router } from 'express'
import * as ctrl from '../controllers/expeditions'

const router = Router({ mergeParams: true })

// Emballage
router.post('/:siteId/emballage/scan', ctrl.scanEmballage)
router.get('/:siteId/emballage', ctrl.getEmballages)

// Master Box
router.get('/:siteId/masterbox/disponibles', ctrl.getDisponiblesMasterBox)
router.post('/:siteId/masterbox', ctrl.createMasterBox)
router.get('/:siteId/masterbox/:id', ctrl.getMasterBoxDetail)
router.get('/:siteId/masterbox', ctrl.getMasterBoxes)

export default router
