import { Router } from 'express'
import {
  getStatuts, createStatut, updateStatut, deleteStatut,
  getTransitions, createTransition, updateTransition, deleteTransition
} from '../controllers/workflow'

const router = Router()

// Statuts
router.get('/:siteId/statuts', getStatuts)
router.post('/:siteId/statuts', createStatut)
router.put('/statuts/:id', updateStatut)
router.delete('/statuts/:id', deleteStatut)

// Transitions
router.get('/:siteId/transitions', getTransitions)
router.post('/:siteId/transitions', createTransition)
router.put('/transitions/:id', updateTransition)
router.delete('/transitions/:id', deleteTransition)

export default router
