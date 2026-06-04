import { Router } from 'express'
import * as ctrl from '../controllers/configAttendus'

const router = Router()

router.get('/:siteId', ctrl.getConfig)
router.put('/:siteId', ctrl.saveConfig)
router.post('/:siteId/mappings', ctrl.addMapping)
router.put('/mappings/:id', ctrl.updateMapping)
router.delete('/mappings/:id', ctrl.deleteMapping)

export default router
