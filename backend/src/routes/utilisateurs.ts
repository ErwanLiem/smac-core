import { Router } from 'express'
import {
  getRoles, createRole, updateRole, deleteRole, getPagesDisponibles,
  getUtilisateurs, createUtilisateur, updateUtilisateur, deleteUtilisateur, reinitialiserMdp
} from '../controllers/utilisateurs'

const router = Router()

// Pages disponibles (pour le formulaire de rôle)
router.get('/pages', getPagesDisponibles)

// Rôles
router.get('/:siteId/roles', getRoles)
router.post('/:siteId/roles', createRole)
router.put('/roles/:id', updateRole)
router.delete('/roles/:id', deleteRole)

// Utilisateurs
router.get('/:siteId/utilisateurs', getUtilisateurs)
router.post('/:siteId/utilisateurs', createUtilisateur)
router.put('/utilisateurs/:id', updateUtilisateur)
router.delete('/utilisateurs/:id', deleteUtilisateur)
router.post('/utilisateurs/:id/reinitialiser-mdp', reinitialiserMdp)

export default router
