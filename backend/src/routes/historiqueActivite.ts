import { Router } from 'express'
import * as ctrl from '../controllers/historiqueActivite'

const router = Router({ mergeParams: true })

router.get('/:siteId',          ctrl.getHistorique)
router.get('/:siteId/types',    ctrl.getTypesDisponibles)
router.get('/:siteId/users',    ctrl.getUtilisateursActifs)

export default router
