import { Router } from 'express'
import { getChamps, createChamp, updateChamp, deleteChamp, getClients, getClientById, createClient, updateClient, deleteClient } from '../controllers/clients'
import { requirePermission } from '../middleware/auth'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()
const peutEditer = requirePermission('/clients', 'edit')
const peutSupprimer = requirePermission('/clients', 'delete')

router.get('/:siteId/champs', asyncHandler(getChamps))
router.post('/:siteId/champs', peutEditer, asyncHandler(createChamp))
router.put('/champs/:id', peutEditer, asyncHandler(updateChamp))
router.delete('/champs/:id', peutSupprimer, asyncHandler(deleteChamp))

router.get('/:siteId', asyncHandler(getClients))
router.get('/detail/:id', asyncHandler(getClientById))
router.post('/:siteId', peutEditer, asyncHandler(createClient))
router.put('/:id', peutEditer, asyncHandler(updateClient))
router.delete('/:id', peutSupprimer, asyncHandler(deleteClient))

export default router
