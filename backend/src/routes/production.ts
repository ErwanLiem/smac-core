import { Router } from 'express'
import * as ctrl from '../controllers/production'
import * as mouvQteCtrl from '../controllers/mouvementQTE'
import * as suiviPdaCtrl from '../controllers/suiviPda'
import * as suiviPdaLaboCtrl from '../controllers/suiviPdaLabo'
import * as repCtrl from '../controllers/reparation'
import * as majCtrl from '../controllers/majInjection'
import * as cqCtrl  from '../controllers/controleQualite'

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
router.post('/capacite/:siteId/toggle-jour', ctrl.toggleJourCapacite)

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

// Mouvements QTE (PDA / Accessoires)
router.get('/mouvement-qte/:siteId',  mouvQteCtrl.getAll)
router.post('/mouvement-qte/:siteId', mouvQteCtrl.create)
router.delete('/mouvement-qte/:id',   mouvQteCtrl.remove)

// Suivi PDA
router.get('/suivi-pda/:siteId', suiviPdaCtrl.getSuiviPDA)

// Suivi PDA Labo
router.get('/suivi-pda-labo/:siteId', suiviPdaLaboCtrl.getSuiviPDALabo)

// ─── Réparation ───────────────────────────────────────────────────────────────
router.get('/reparation/:siteId/rma',                     repCtrl.getRmaList)
router.get('/reparation/:siteId/rma/:rma/inventaires',    repCtrl.getInventairesRma)
router.get('/reparation/:siteId/scan',                    repCtrl.scanInventaire)
router.get('/reparation/:siteId/inventaire/:id',          repCtrl.getDetailInventaire)
router.put('/reparation/:siteId/inventaire/:id/panne',    repCtrl.saisirPanneConstatee)
router.post('/reparation/:siteId/inventaire/:id/pda',     repCtrl.utiliserPDA)
router.put('/reparation/:siteId/inventaire/:id/statut',   repCtrl.changerStatutReparation)

// ─── MAJ / Injection ──────────────────────────────────────────────────────────
router.get('/maj-injection/:siteId/rma',                    majCtrl.getRmaList)
router.get('/maj-injection/:siteId/rma/:rma/inventaires',   majCtrl.getInventairesRma)
router.get('/maj-injection/:siteId/scan',                   majCtrl.scanInventaire)
router.get('/maj-injection/:siteId/inventaire/:id',         majCtrl.getDetailInventaire)
router.put('/maj-injection/:siteId/inventaire/:id/valider', majCtrl.validerMajInjection)
router.put('/maj-injection/:siteId/inventaire/:id/statut',  majCtrl.changerStatut)

// ─── Contrôle qualité ─────────────────────────────────────────────────────────
router.get('/controle-qualite/:siteId/rma',                    cqCtrl.getRmaList)
router.get('/controle-qualite/:siteId/rma/:rma/inventaires',   cqCtrl.getInventairesRma)
router.get('/controle-qualite/:siteId/scan',                   cqCtrl.scanInventaire)
router.get('/controle-qualite/:siteId/inventaire/:id',         cqCtrl.getDetailInventaire)
router.put('/controle-qualite/:siteId/inventaire/:id/valider', cqCtrl.validerControle)
router.put('/controle-qualite/:siteId/inventaire/:id/statut',  cqCtrl.changerStatut)

export default router
