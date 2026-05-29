import { Router } from 'express'
import { login, changerMotDePasse } from '../controllers/auth'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.post('/login', login)
router.post('/changer-mdp', requireAuth, changerMotDePasse)

export default router
