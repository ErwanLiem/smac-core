import { Router } from 'express'
import { getChamps, createChamp, updateChamp, deleteChamp, getClients, getClientById, createClient, updateClient, deleteClient } from '../controllers/clients'
import { requirePermission } from '../middleware/auth'

const router = Router()
const peutEditer = requirePermission('/clients', 'edit')
const peutSupprimer = requirePermission('/clients', 'delete')

router.get('/:siteId/champs', getChamps)
router.post('/:siteId/champs', peutEditer, createChamp)
router.put('/champs/:id', peutEditer, updateChamp)
router.delete('/champs/:id', peutSupprimer, deleteChamp)

router.get('/:siteId', getClients)
router.get('/detail/:id', getClientById)
router.post('/:siteId', peutEditer, createClient)
router.put('/:id', peutEditer, updateClient)
router.delete('/:id', peutSupprimer, deleteClient)

export default router
