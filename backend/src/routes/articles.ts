import { Router } from 'express'
import {
  getChamps, createChamp, updateChamp, deleteChamp,
  getArticles, getArticleById, createArticle, updateArticle, deleteArticle, changerStatut
} from '../controllers/articles'
import { requirePermission } from '../middleware/auth'

const router = Router()
const peutEditer = requirePermission('/articles', 'edit')
const peutSupprimer = requirePermission('/articles', 'delete')

// Champs configurables
router.get('/:siteId/champs', getChamps)
router.post('/:siteId/champs', peutEditer, createChamp)
router.put('/champs/:id', peutEditer, updateChamp)
router.delete('/champs/:id', peutSupprimer, deleteChamp)

// Articles
router.get('/:siteId', getArticles)
router.get('/detail/:id', getArticleById)
router.post('/:siteId', peutEditer, createArticle)
router.put('/:id', peutEditer, updateArticle)
router.delete('/:id', peutSupprimer, deleteArticle)
router.post('/:id/transition', peutEditer, changerStatut)

export default router
