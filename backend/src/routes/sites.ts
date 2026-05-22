import { Router } from 'express'
import { getSites, getSiteBySlug, createSite, updateSite } from '../controllers/sites'

const router = Router()

router.get('/', getSites)
router.get('/:slug', getSiteBySlug)
router.post('/', createSite)
router.put('/:id', updateSite)

export default router
