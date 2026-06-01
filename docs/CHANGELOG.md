# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

---

## [0.5.0] - 2026-06-01

### Ajouté
- **Permissions granulaires** par rôle : actions Voir / Modifier / Supprimer configurables page par page
- **Bouton Modifier** sur les pages Catalogue (Articles, Clients, Plateformes) — modal pré-remplie
- **Redirection automatique** vers `/login` en cas de token expiré (401)
- **Middleware global d'erreurs** backend — gestion propre des doublons (P2002) et enregistrements introuvables (P2025)
- **Message d'erreur inline** dans les formulaires (ex : code de champ déjà existant)
- **GitHub Pages avec Docsify** — documentation en ligne accessible publiquement
- **Manuel utilisateur en Markdown** disponible sur le site de documentation
- Utilitaire partagé `utils/permissions.ts` pour la gestion des droits dans le frontend

### Design
- Refonte complète de la sidebar : espacement réduit, fond bleuté, lien actif plein bleu, accordéon (une section à la fois)
- Harmonisation du design sur toutes les pages : padding, cards, tableaux, formulaires, modals
- Titre de page avec barre bleue à gauche
- En-tête tableau bleuté
- Renommage **BASE DE DONNÉES → CATALOGUE**, sous-sections Configuration préfixées **"Structure"**

### Sécurité
- Champ `action` ajouté sur `permissionRole` — permissions en format `page:action`
- Boutons d'action masqués côté frontend selon les permissions du rôle connecté
- Pages Configuration réservées à l'ADMIN pour toute modification

### Documentation
- README enrichi : schéma workflow Mermaid, architecture technique, identification des besoins
- CHANGELOG déplacé dans `docs/`
- Site de documentation GitHub Pages mis en place (Docsify + Mermaid)

---

## [0.4.0] - 2026-05-29

### Ajouté
- Bases configurables **Clients** et **Plateformes** — même architecture que les articles (champs dynamiques par site)
- Pages de visualisation : Articles, Clients, Plateformes (section BASE DE DONNÉES)
- **Gestion des rôles** : création de rôles avec permissions par page individuelle
- **Gestion des utilisateurs** : CRUD complet, mot de passe sécurisé généré automatiquement à la création
- **Réinitialisation de mot de passe** par l'administrateur
- **Changement de mot de passe obligatoire** au premier login — modal avec règles de sécurité en temps réel
- **Sidebar filtrée dynamiquement** selon les permissions du rôle connecté
- L'utilisateur ADMIN a accès à toutes les pages par défaut

### Sécurité
- Mot de passe généré avec `crypto.randomInt` (12 caractères, majuscule + minuscule + chiffre + spécial)
- bcrypt avec 12 rounds
- Nouveau mot de passe soumis à validation : 10 caractères min, majuscule, minuscule, chiffre, caractère spécial
- Mot de passe affiché une seule fois à la création, jamais stocké en clair

### Technique
- Composants génériques `BaseAdmin` et `BaseList` pour éviter la duplication de code
- Flag `doitChangerMdp` sur chaque utilisateur
- Table `permissionRole` : roleId + page

---

## [0.3.0] - 2026-05-29

### Sécurité
- Middleware JWT : toutes les routes API sont protégées, seul `/api/auth/login` est public
- CORS restreint au frontend local (`localhost:5173`) et réseau WiFi local
- JWT_SECRET fort dans `.env`, suppression du fallback faible en dur

### Ajouté
- Champs articles configurables par site (`champArticle`, `valeurChamp`) — même philosophie que le workflow
- Page **Admin Articles** : création, modification, suppression des champs dynamiques
- Types de champs disponibles : Texte, Nombre, Date, Liste déroulante

### Design
- Badges statuts : fond coloré léger + point coloré (fini l'arc-en-ciel plein)
- Boutons d'action : icônes crayon/poubelle à la place des textes
- Bouton Supprimer : discret par défaut, rouge plein uniquement dans le modal de confirmation
- Codes techniques : style `monospace` sur fond gris clair
- Sidebar : section "ADMINISTRATION" renommée "CONFIGURATION"

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
