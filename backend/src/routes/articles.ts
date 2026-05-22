import { Router } from 'express'
import { getArticles, getArticleById, createArticle, changerStatut } from '../controllers/articles'

const router = Router()

router.get('/:siteId', getArticles)
router.get('/detail/:id', getArticleById)
router.post('/:siteId', createArticle)
router.post('/:id/transition', changerStatut)

export default router
