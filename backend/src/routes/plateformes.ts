import { Router } from 'express'
import { getChamps, createChamp, updateChamp, deleteChamp, getPlateformes, getPlateformeById, createPlateforme, updatePlateforme, deletePlateforme } from '../controllers/plateformes'

const router = Router()

router.get('/:siteId/champs', getChamps)
router.post('/:siteId/champs', createChamp)
router.put('/champs/:id', updateChamp)
router.delete('/champs/:id', deleteChamp)

router.get('/:siteId', getPlateformes)
router.get('/detail/:id', getPlateformeById)
router.post('/:siteId', createPlateforme)
router.put('/:id', updatePlateforme)
router.delete('/:id', deletePlateforme)

export default router
