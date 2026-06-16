import { Router } from 'express'
import * as ctrl from '../controllers/emplacements'

const router = Router({ mergeParams: true })

router.get('/:siteId', ctrl.getAll)
router.post('/:siteId', ctrl.create)
router.put('/:siteId/:id', ctrl.update)
router.delete('/:siteId/:id', ctrl.remove)

export default router
