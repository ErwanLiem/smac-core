import { Router } from 'express'
import {
  getChamps, createChamp, updateChamp, deleteChamp,
  getArticles, getArticleById, createArticle, updateArticle, deleteArticle, changerStatut
} from '../controllers/articles'
import { requirePermission } from '../middleware/auth'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()
const peutEditer = requirePermission('/articles', 'edit')
const peutSupprimer = requirePermission('/articles', 'delete')

// Champs configurables
router.get('/:siteId/champs', asyncHandler(getChamps))
router.post('/:siteId/champs', peutEditer, asyncHandler(createChamp))
router.put('/champs/:id', peutEditer, asyncHandler(updateChamp))
router.delete('/champs/:id', peutSupprimer, asyncHandler(deleteChamp))

// Articles
router.get('/:siteId', asyncHandler(getArticles))
router.get('/detail/:id', asyncHandler(getArticleById))
router.post('/:siteId', peutEditer, asyncHandler(createArticle))
router.put('/:id', peutEditer, asyncHandler(updateArticle))
router.delete('/:id', peutSupprimer, asyncHandler(deleteArticle))
router.post('/:id/transition', peutEditer, asyncHandler(changerStatut))

export default router
