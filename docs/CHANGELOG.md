# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

---

## [0.6.0] - 2026-06-10

### Ajouté
- **Traçabilité des opérations** : les champs `OPE.RECEPTION` et `OPE.TRANSFERT` de l'inventaire sont automatiquement renseignés avec le login de l'opérateur lors de la réception (création directe ou via clôture d'un Attendu) et de la validation d'un transfert SN
- **Bouton "Détail"** sur l'inventaire (visible quand une seule ligne est sélectionnée) : ouvre l'historique horodaté des opérations de la ligne (date/heure, type d'opération, opérateur)
- Helper backend générique `enregistrerOperation()` réutilisable pour les futurs modules (suivi/réparation) afin de tracer opérateur + date sur chaque étape `OPE.xxx`
- **Affichage/masquage des colonnes** sur les tableaux (Inventaire et tableaux génériques type Catalogue) via un bouton "Colonnes" — la configuration est sauvegardée par utilisateur dans le localStorage
- **Visibilité du mot de passe** dans le formulaire de connexion (icône œil)
- Tooltips explicatifs sur les colonnes "Obligatoire" et "Actif" de la configuration des champs inventaire
- **Transition "Attente transfert" → "Attente réparation"** : horodate automatiquement le champ `DATE LAV` de l'inventaire avec la date du jour
- **Page "Suivi PDA"** (Logistique) : tableau récapitulatif mensuel des mouvements par article (Référence, Emplacement, Référence additionnelle, Désignation, Range, Stock, consommation hebdomadaire par semaine ISO, Transfert, consommation mensuelle, Supply)
- **Traçabilité des réceptions QTE** : les réceptions sur une ligne d'inventaire existante (suivi quantité) sont désormais historisées avec la quantité reçue, pour alimenter le suivi mensuel des approvisionnements
- **Page "Suivi PDA Labo"** (Production), en remplacement de "Inventaire labo" : même visuel que "Suivi PDA" (Référence, Code Stock Location, Référence additionnelle, Désignation, Range, Stock, consommation hebdomadaire par semaine ISO, consommation mensuelle, Supply). Stock = quantité en stock labo, Code Stock Location = champ inventaire "EMPLACEMENT LABO" (différent de l'emplacement magasin utilisé par "Suivi PDA"), Supply = transferts validés vers le labo dans le mois. La consommation hebdomadaire/mensuelle sera alimentée plus tard par la consommation des techniciens en production (colonnes prêtes, valeurs à 0 pour l'instant)
- **Export Excel** sur les pages Inventaire, Suivi PDA et Suivi PDA Labo : bouton "Exporter" avec sélection des colonnes à inclure (toutes par défaut, ou seulement certaines), génération d'un fichier `.xlsx` côté navigateur à partir des données affichées (avec filtres/période en cours)
- **Page "Expéditions"** (Logistique), avec onglets Emballage / Master Box / Envoi :
  - Onglet **Emballage** : zone de scan de S/N en sortie de contrôle qualité — chaque scan vérifie que l'article est bien au statut "Contrôle qualité" (rôle `CONTROL`), applique la transition de workflow vers "Emballé" déjà configurée, et trace l'opérateur dans le champ `OPE.EMBALLAGE`. Les articles emballés sont affichés en cartes regroupées par RMA × P/N, avec le client associé et la liste des S/N
  - Onglet **Master Box** : regroupement des articles "Emballé" en cartons collectifs (Master Box), par client. Sélection des articles disponibles (cartes par RMA × P/N, cases à cocher individuelles ou par groupe) puis génération d'une Master Box numérotée automatiquement (MB-0001, MB-0002...) — les terminaux restent au statut "Emballé". Pour la zone client **Adyen**, une Master Box ne peut contenir que des articles d'une même RMA (vérifié à la création). Génère une vue imprimable avec une **étiquette au format Castles Technology**, dont la mise en page dépend de la zone du client (champ `ZONE` configuré sur les clients) :
    - **Zone A3F** : "Box / Customer", quantité totale, tableau Serial Number (N° / Model / P/N / S/N / Barcode) — les P/N peuvent être mélangés dans un même carton
    - **Zone Adyen** : "Box", section "Part Number" (Model / P/N / Barcode), bandeau "RMA_xxx", quantité totale, tableau Serial Number (N° / Model / S/N / Barcode, sans colonne P/N)
    - Les codes-barres sont rendus en police "Libre Barcode 39" (`*valeur*`)

    suivie d'une **liste des terminaux** prêts à expédier ; historique des Master Box générées avec réimpression
  - Onglet **Envoi** : à venir

### Modifié
- Renommage des colonnes "Visible S/N" / "Visible QTE" en "Réception S/N" / "Réception QTE" dans la configuration de l'inventaire (nom plus explicite sur leur usage)
- Page "Inventaire labo" renommée "Suivi PDA Labo" (`/suivi-pda-labo`), avec un nouveau visuel calqué sur "Suivi PDA"

### Supprimé
- Configuration "Colonnes Inventaire Labo" (`configProduction.colonnesLabo`) et son écran d'administration dédié, devenus obsolètes suite au remplacement de la page "Inventaire labo" par "Suivi PDA Labo"

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
