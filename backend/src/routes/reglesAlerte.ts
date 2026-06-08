import { Router } from 'express'
import * as ctrl from '../controllers/reglesAlerte'

const router = Router({ mergeParams: true })

router.get('/:siteId', ctrl.getAll)
router.post('/:siteId', ctrl.create)
router.put('/:id', ctrl.update)
router.delete('/:id', ctrl.remove)

export default router
