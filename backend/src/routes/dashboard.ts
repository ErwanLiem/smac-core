import { Router } from 'express'
import * as ctrl from '../controllers/dashboard'

const router = Router({ mergeParams: true })

router.get('/:siteId/stats', ctrl.getStats)

export default router
