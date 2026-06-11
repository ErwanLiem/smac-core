import { Router } from 'express'
import { getChamps, createChamp, updateChamp, deleteChamp, getPlateformes, getPlateformeById, createPlateforme, updatePlateforme, deletePlateforme } from '../controllers/plateformes'
import { requirePermission } from '../middleware/auth'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()
const peutEditer = requirePermission('/plateformes', 'edit')
const peutSupprimer = requirePermission('/plateformes', 'delete')

router.get('/:siteId/champs', asyncHandler(getChamps))
router.post('/:siteId/champs', peutEditer, asyncHandler(createChamp))
router.put('/champs/:id', peutEditer, asyncHandler(updateChamp))
router.delete('/champs/:id', peutSupprimer, asyncHandler(deleteChamp))

router.get('/:siteId', asyncHandler(getPlateformes))
router.get('/detail/:id', asyncHandler(getPlateformeById))
router.post('/:siteId', peutEditer, asyncHandler(createPlateforme))
router.put('/:id', peutEditer, asyncHandler(updatePlateforme))
router.delete('/:id', peutSupprimer, asyncHandler(deletePlateforme))

export default router
