# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

---

## [0.2.0] - 2026-05-22

### Ajouté
- Design de l'ancien SMAC intégré (CSS complet : sidebar, cards, table, badges, modals, formulaires)
- Layout principal (`Layout.tsx`) avec sidebar et zone de contenu
- Sidebar (`Sidebar.tsx`) avec navigation par sections accordéon et bouton de déconnexion
- Site renommé "Vallery" (slug : `smac-vallery`)

---

## [0.1.0] - 2026-05-21

### Ajouté
- Initialisation du projet `smac-core` avec architecture workflow configurable
- Stack : React + TypeScript + Vite (frontend), Express + TypeScript + Prisma (backend), MySQL XAMPP
- Schéma Prisma : `Site`, `Statut`, `Transition`, `Role`, `Utilisateur`, `Article`, `HistoriqueStatut`
- Migration initiale de la base de données
- Pages : `/login`, `/` (Dashboard), `/suivi`, `/admin/workflow`
- Seed de test : site Vallery, 7 statuts, 8 transitions, utilisateur admin/admin123, 3 articles de test
- Accès multi-poste via GitHub (code) + export/import MySQL (données)
