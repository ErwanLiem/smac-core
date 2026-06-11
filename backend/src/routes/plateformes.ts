import { Router } from 'express'
import { getChamps, createChamp, updateChamp, deleteChamp, getPlateformes, getPlateformeById, createPlateforme, updatePlateforme, deletePlateforme } from '../controllers/plateformes'
import { requirePermission } from '../middleware/auth'

const router = Router()
const peutEditer = requirePermission('/plateformes', 'edit')
const peutSupprimer = requirePermission('/plateformes', 'delete')

router.get('/:siteId/champs', getChamps)
router.post('/:siteId/champs', peutEditer, createChamp)
router.put('/champs/:id', peutEditer, updateChamp)
router.delete('/champs/:id', peutSupprimer, deleteChamp)

router.get('/:siteId', getPlateformes)
router.get('/detail/:id', getPlateformeById)
router.post('/:siteId', peutEditer, createPlateforme)
router.put('/:id', peutEditer, updatePlateforme)
router.delete('/:id', peutSupprimer, deletePlateforme)

export default router
