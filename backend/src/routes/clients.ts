import { Router } from 'express'
import { getChamps, createChamp, updateChamp, deleteChamp, getClients, getClientById, createClient, updateClient, deleteClient } from '../controllers/clients'

const router = Router()

router.get('/:siteId/champs', getChamps)
router.post('/:siteId/champs', createChamp)
router.put('/champs/:id', updateChamp)
router.delete('/champs/:id', deleteChamp)

router.get('/:siteId', getClients)
router.get('/detail/:id', getClientById)
router.post('/:siteId', createClient)
router.put('/:id', updateClient)
router.delete('/:id', deleteClient)

export default router
