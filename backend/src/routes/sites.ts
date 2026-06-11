import { Router } from 'express'
import { getSites, getSiteBySlug, createSite, updateSite } from '../controllers/sites'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.get('/', asyncHandler(getSites))
router.get('/:slug', asyncHandler(getSiteBySlug))
router.post('/', asyncHandler(createSite))
router.put('/:id', asyncHandler(updateSite))

export default router
