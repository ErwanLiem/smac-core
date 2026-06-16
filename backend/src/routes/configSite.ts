import { Router } from 'express'
import * as ctrl from '../controllers/configSite'

const router = Router()

router.get('/:siteId', ctrl.getConfig)
router.put('/:siteId', ctrl.saveConfig)
router.post('/:siteId/next-bl', ctrl.getNextBl)

export default router
