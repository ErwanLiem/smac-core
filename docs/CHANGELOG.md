# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

---

## [0.9.0] - 2026-06-11

### Ajouté
- **Planning de production — quota du samedi configurable** :
  - Réglage par défaut "Activer le quota de production le samedi par défaut" (Configuration > Production > Techniciens & quotas), désactivé par défaut. Lorsqu'il est désactivé, la capacité de chaque samedi est de 0 dans le planning quels que soient les quotas individuels des techniciens.
  - Bouton "Actif / Inactif" sur la colonne du samedi dans le Planning : permet d'activer (ou de désactiver) ponctuellement la capacité d'un samedi en particulier, sans changer le réglage par défaut des autres samedis.
- **Suivi PDA / Suivi PDA Labo — édition de l'emplacement** : la colonne "Code Stock Location" est désormais éditable directement dans le tableau ; la valeur saisie est enregistrée dans le champ inventaire `EMPLACEMENT` (Suivi PDA) ou `EMPLACEMENT LABO` (Suivi PDA Labo) de la ligne d'inventaire correspondante. La saisie doit être validée explicitement (touche Entrée ou bouton ✓ qui apparaît dès que la valeur est modifiée) ; un clic en dehors du champ (ou Échap) annule la modification sans l'enregistrer, pour éviter toute erreur de saisie accidentelle.

### Corrigé (audit léger du code)
- **Spinners infinis** : sur Tableau de bord, Suivi PDA et Suivi PDA Labo, une erreur réseau/API pendant le chargement laissait la page bloquée sur le spinner ; le chargement se termine désormais toujours (succès ou erreur).
- **Suivi articles** : le message "Aucun article" tenait compte de tous les articles au lieu des seuls articles ayant un statut suivi.
- **Inventaire** : suppression d'un bouton/modal "Ajouter" non fonctionnel (code mort), et d'une fonction de scan inutilisée sur la page de détail des Attendus.
- **Listes génériques (Catalogue)** : le pré-remplissage des champs "Date du jour" dans le formulaire d'ajout ne se fait plus pendant le rendu (source d'avertissements React) mais via un effet dédié.
- **Déconnexion automatique (session expirée)** : les informations de l'utilisateur stocké localement sont désormais effacées en plus du token, pour éviter un état incohérent après redirection vers la connexion.
- **Réception de quantité** : une quantité non numérique envoyée à l'API est désormais rejetée (erreur 400) au lieu de corrompre le stock.
- **Mise à jour d'une ligne d'inventaire** : si la requête ne transmet pas la liste des valeurs de champs, les valeurs existantes ne sont plus effacées par erreur.
- **Demande de transfert (quantité)** : la ligne de stock source utilisée pour décrémenter le stock magasin est désormais choisie de manière déterministe (la plus ancienne), au lieu d'un choix arbitraire de la base de données.
- **Suppression d'un statut (Configuration > Workflow)** : la suppression était auparavant possible même si des inventaires utilisaient encore ce statut, ce qui supprimait silencieusement ces inventaires (suppression en cascade côté base de données). La suppression est désormais bloquée (erreur 400) tant que des inventaires référencent ce statut.

### Sécurité
- **`/api/gestion` (utilisateurs, rôles) et `/api/sites`** : ces routes nécessitent désormais le rôle ADMIN (middleware `requireAdmin`), et plus seulement d'être connecté.
- **Permissions par rôle vérifiées côté API** (middleware `requirePermission`) sur les actions de modification/suppression des pages Articles, Clients, Plateformes et Inventaire (création/édition/suppression d'articles, clients, plateformes, lignes d'inventaire et de leurs champs configurables) : un rôle sans la permission `:edit`/`:delete` correspondante reçoit désormais une erreur 403, même via un appel API direct.

### Technique
- Factorisation de `getSiteId()` (lecture du site de l'utilisateur connecté) dans `utils/permissions.ts`, remplaçant 24 copies locales identiques.
- Factorisation des sons d'alerte/succès (`jouerSonAlerte`, `jouerSonSucces`) dans `utils/sons.ts`, remplaçant les copies de Réception, Expéditions et Attendus.
- Ajout d'un wrapper `asyncHandler` (`backend/src/utils/asyncHandler.ts`) appliqué aux routes Articles, Clients, Plateformes et Sites : les erreurs levées par les contrôleurs async sont désormais transmises au middleware d'erreurs global (jusqu'ici, ces routes n'avaient pas de gestion d'erreur).
- Remplacement de boucles `for...of` séquentielles par `Promise.all` lorsque les opérations sont indépendantes (mise à jour des valeurs de champs personnalisés d'un article/client/plateforme, recherche du RMA existant pour les doublons d'inventaire dans Attendus).
- Factorisation Suivi PDA / Suivi PDA Labo : les fonctions communes (`normCode`, `getISOWeek`, `getSemainesDuMois`, `valeurPour`, résolution du mois ciblé, sélection des articles suivis en quantité) sont regroupées dans `backend/src/utils/pda.ts` ; côté frontend, la navigation mois précédent/suivant (`usePeriodeMensuelle`) et la cellule d'édition "Code Stock Location" (`EmplacementCell`) sont mutualisées entre `SuiviPDA.tsx` et `SuiviPDALabo.tsx`. Aucun changement de comportement.

---

## [0.8.0] - 2026-06-11

### Ajouté
- **Expéditions — onglet Envoi** :
  - possibilité de **retirer un article d'une Master Box** déjà enregistrée (statut "en attente d'envoi") mais pas encore expédiée, pour corriger une erreur détectée lors du contrôle ; la Master Box est supprimée automatiquement si elle devient vide, et l'article redevient disponible pour un nouvel emballage
  - **bouton "Exporter"** (avec sélection des colonnes, comme sur l'Inventaire) dans la fenêtre de détail d'un client : exporte les données d'inventaire des articles des Master Box en attente d'envoi
  - **champ "Bon d'envoi" (n° de transport)** dans la fenêtre de confirmation d'expédition : si renseigné, la valeur est écrite dans le champ inventaire "Bon D'envoi" de chaque article expédié

### Modifié
- Pages de configuration (Articles, Inventaire, Attendus, Rôles, Utilisateurs, Workflow, Clients, Plateformes) : remplacement du fond blanc des badges/codes et bordures de séparation, peu lisibles sur le thème sombre, par un style cohérent avec le reste de l'interface

---

## [0.7.0] - 2026-06-10

### Ajouté
- **Attendus** : blocage du scan tant que le "numéro de caisse" n'est pas renseigné, validation de la caisse à la touche Entrée, modal bloquant si le S/N scanné est déjà présent, et impossibilité de clôturer un attendu si les champs obligatoires de "Modifier les informations" sont vides
- **Planning de production** :
  - les cartes en attente de dispatch affichent désormais le client associé
  - le dispatch (drag & drop) ne découpe plus jamais une caisse physique : seules les caisses entièrement transférables (+ articles hors caisse) sont proposées, avec indication de la quantité maximale et message si aucune caisse complète ne tient dans la capacité restante
  - les cartes de demande de transfert validée s'affichent dans une couleur distincte (vert)
- **Expéditions** :
  - onglet **Emballage** : sous-onglets regroupant les cartes d'articles emballés par client
  - onglet **Master Box** : la numérotation `MB-XXXX` (et le numéro de "Box" sur les étiquettes) est désormais une séquence propre à chaque client ; dans la fenêtre de détail d'un client, cliquer sur une Master Box affiche en dessous le détail de son contenu (liste des S/N)
  - onglet **Envoi** entièrement refondu : cartes par client (récapitulatif P/N × RMA) ouvrant une fenêtre de détail listant les Master Box prêtes à expédier (avec détail au clic, comme dans l'onglet Master Box) et le bouton d'envoi ; la confirmation d'envoi utilise désormais une fenêtre modale de l'application (au lieu de la boîte de dialogue du navigateur)
  - le passage au statut "Emballé" renseigne automatiquement les champs inventaire `DATE_PACK` et `DATE_CLS` avec la date du jour (s'ils sont configurés) ; le passage au statut "Expédié" renseigne `DATE_SHP`

### Modifié
- **Master Box** : le champ "Model" affiché sur les étiquettes et dans le détail provient désormais du champ `MODEL` du catalogue Article (et non plus du champ `TYPE` de l'inventaire)
- **Master Box** : les Master Box enregistrées ("en attente d'envoi") n'apparaissent plus dans l'onglet Master Box — leur récapitulatif est désormais dans l'onglet Envoi
- Rapport d'erreur des Attendus : correction de l'affichage "N/A" pour le nom du client

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
  - Onglet **Master Box** : zone de scan de S/N "Emballé" — chaque scan ajoute le terminal à la **Master Box "en cours" de remplissage** (créée à la volée si besoin, numérotée automatiquement MB-0001, MB-0002...) ; le statut de l'article reste "Emballé", seule l'affectation au carton change. Pour la zone client **A3F**, les S/N et les RMA peuvent être mélangés librement dans un même carton. Pour la zone **Adyen**, un carton ne peut contenir qu'un seul couple P/N × RMA : dès qu'un S/N d'un autre P/N ou d'une autre RMA est scanné, un nouveau carton est créé automatiquement. Chaque "Master Box en cours" est affichée en carte (contenu détaillé par P/N × RMA, liste des S/N) avec deux actions :
    - **Imprimer** : génère l'étiquette du carton (voir gabarit ci-dessous) sans clôturer le scan
    - **Enregistrer** : clôture le carton (il devient "enregistré", prêt à expédier) et regroupe l'ensemble des cartons enregistrés dans une carte par client (nombre de cartons + quantité totale). Un clic sur cette carte ouvre une fenêtre de détail listant les Master Box déjà enregistrées du client (numéro / quantité / date, avec réimpression) et un récapitulatif par P/N × RMA pour contrôler la correspondance avec le contenu physique

    Étiquette au format Castles Technology, dont la mise en page dépend de la zone du client (champ `ZONE` configuré sur les clients) :
    - **Zone A3F** : "Box / Customer", quantité totale, tableau Serial Number (N° / Model / P/N / S/N / Barcode) — les P/N peuvent être mélangés dans un même carton
    - **Zone Adyen** : "Box", section "Part Number" (Model / P/N / Barcode), bandeau "RMA_xxx", quantité totale, tableau Serial Number (N° / Model / S/N / Barcode, sans colonne P/N)
    - Les codes-barres sont rendus en police "Libre Barcode 39" (`*valeur*`)

    suivie d'une **liste des terminaux** prêts à expédier
  - Onglet **Envoi** : pour chaque client ayant des Master Box enregistrées, récapitulatif (liste des cartons + répartition par P/N × RMA) permettant de vérifier la correspondance avec le contenu physique avant envoi. Bouton "Envoyer les articles" : applique la transition de workflow "Emballé → Expédié" (déjà configurée) à tous les terminaux des Master Box du client, trace l'opérateur dans `OPE.EXPEDITION`, et passe les Master Box au statut "Expédiée"

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
