import { Router } from 'express'
import * as ctrl from '../controllers/production'

const router = Router({ mergeParams: true })

// Config
router.get('/config/:siteId',         ctrl.getConfig)
router.put('/config/:siteId',         ctrl.updateConfig)

// Techniciens
router.get('/techniciens/:siteId',    ctrl.getTechniciens)
router.post('/techniciens/:siteId',   ctrl.createTechnicien)
router.put('/techniciens/:id',        ctrl.updateTechnicien)
router.delete('/techniciens/:id',     ctrl.deleteTechnicien)

// Absences
router.get('/absences/:siteId',       ctrl.getAbsences)
router.post('/absences',              ctrl.upsertAbsence)
router.delete('/absences/:id',        ctrl.deleteAbsence)

// Capacité journalière
router.get('/capacite/:siteId',       ctrl.getCapacite)

// Cartes (groupes P/N × RMA en stock)
router.get('/cartes/:siteId',         ctrl.getCartes)

// Articles filtrés pour transfert QTE
router.get('/articles-qte/:siteId',   ctrl.getArticlesQTE)

// Demandes de transfert
router.get('/demandes/:siteId',       ctrl.getDemandes)
router.post('/demandes/:siteId/sn',   ctrl.createDemandeSN)
router.post('/demandes/:siteId/qte',  ctrl.createDemandeQTE)
router.put('/demandes/:id/valider',   ctrl.validerDemande)
router.put('/demandes/:id/annuler',   ctrl.annulerDemande)

// Inventaire labo
router.get('/inventaire-labo/:siteId', ctrl.getInventaireLabo)

export default router
