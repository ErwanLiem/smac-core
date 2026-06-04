import { Router } from 'express'
import multer from 'multer'
import * as ctrl from '../controllers/attendus'

const router = Router()
const upload = multer({ dest: 'uploads/' })

router.get('/:siteId', ctrl.getAll)
router.delete('/:id', ctrl.deleteAttendu)
router.get('/detail/:id', ctrl.getDetail)
router.post('/:siteId/import', upload.single('file'), ctrl.importExcel)
router.put('/:id', ctrl.update)
router.post('/:id/scanner', ctrl.scannerSN)
router.put('/ligne/:id', ctrl.updateLigne)
router.post('/ligne/:id/descanner', ctrl.descanner)
router.post('/:id/cloturer', ctrl.cloturer)
router.get('/:id/rapport', ctrl.rapport)

export default router
