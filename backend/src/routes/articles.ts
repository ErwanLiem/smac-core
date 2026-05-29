import { Router } from 'express'
import {
  getChamps, createChamp, updateChamp, deleteChamp,
  getArticles, getArticleById, createArticle, updateArticle, deleteArticle, changerStatut
} from '../controllers/articles'

const router = Router()

// Champs configurables
router.get('/:siteId/champs', getChamps)
router.post('/:siteId/champs', createChamp)
router.put('/champs/:id', updateChamp)
router.delete('/champs/:id', deleteChamp)

// Articles
router.get('/:siteId', getArticles)
router.get('/detail/:id', getArticleById)
router.post('/:siteId', createArticle)
router.put('/:id', updateArticle)
router.delete('/:id', deleteArticle)
router.post('/:id/transition', changerStatut)

export default router
