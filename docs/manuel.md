# Manuel Utilisateur — SMAC

**Version 0.5.0 — Juin 2026**

> 📥 [Télécharger le manuel au format Word](SMAC_Manuel_Utilisateur.docx)

---

## 1. Introduction

SMAC est une application web de gestion industrielle conçue pour remplacer l'outil OGI. Elle couvre deux domaines :

- **WMS** *(Warehouse Management System)* — gestion de la chaîne logistique
- **MES** *(Manufacturing Execution System)* — suivi de la production en atelier

L'application est accessible depuis n'importe quel navigateur web, sur ordinateur ou terminal mobile (Honeywell CT40, etc.), via le réseau local.

> 🔒 L'accès à l'application est sécurisé. Un identifiant et un mot de passe sont obligatoires. Toutes les données sont protégées et inaccessibles sans authentification.

---

## 2. Connexion

### 2.1 Accéder à l'application

Ouvrez votre navigateur et saisissez l'adresse fournie par votre administrateur (ex : `http://192.168.x.x:5173`).

### 2.2 Se connecter

L'écran de connexion vous demande deux informations :

| Champ | Description |
|---|---|
| Identifiant | Votre login (ex : admin) |
| Mot de passe | Votre mot de passe personnel |

Cliquez sur **« Se connecter »**. En cas d'erreur, le message « Identifiants incorrects » s'affiche.

> ⚠️ Les identifiants par défaut (premier démarrage) sont : `admin` / `admin123`. À modifier impérativement en production.

---

## 3. Tableau de bord

Après connexion, vous arrivez sur le tableau de bord. Il donne accès aux différentes sections de l'application.

| Raccourci | Description |
|---|---|
| Suivi articles | Consulter et faire avancer les articles dans le workflow |
| Base articles | Configurer les champs de vos articles |
| Admin workflow | Configurer les statuts et transitions (accès administrateur) |

---

## 4. Suivi des articles

La page **« Suivi articles »** affiche la liste de tous les articles et leur statut courant dans le workflow.

### 4.1 Tableau de suivi

| Colonne | Description |
|---|---|
| Référence | Référence interne de l'article |
| Désignation | Nom du produit (ex : Honeywell CT40) |
| N° Série | Numéro de série unique de l'appareil |
| Statut | Statut actuel, affiché sous forme de badge coloré |
| Actions | Boutons de transition disponibles selon le statut courant |

### 4.2 Faire avancer un article

Cliquez sur le bouton de transition souhaité pour changer le statut de l'article. Le tableau se met à jour immédiatement.

Si aucun bouton n'est affiché, l'article est dans un statut final ou sans transition configurée.

> ℹ️ Les transitions disponibles sont configurées par l'administrateur dans **Configuration > Workflow**.

---

## 5. Configuration — Articles

Accessible via **CONFIGURATION > Structure articles**. Permet de définir les champs qui composent vos articles.

### 5.1 Créer un champ

| Champ | Description |
|---|---|
| Code | Identifiant technique unique (ex : NUMERO_RMA, PN, SN) |
| Label | Nom affiché à l'utilisateur (ex : N° RMA, P/N, S/N) |
| Type | Nature de la valeur : Texte, Nombre, Date ou Liste déroulante |
| Ordre | Position du champ dans les formulaires |
| Obligatoire | Si coché, le champ devra obligatoirement être renseigné |

### 5.2 Modifier un champ

Cliquez sur l'icône **crayon** en fin de ligne pour modifier le label, le type, l'ordre ou le statut actif/inactif.

### 5.3 Supprimer un champ

Cliquez sur l'icône **poubelle**. Une confirmation est demandée.

> ⚠️ Toutes les valeurs associées à ce champ sur les articles existants seront supprimées.

---

## 6. Configuration — Workflow

Accessible via **CONFIGURATION > Workflow**. Permet de configurer les statuts et transitions du cycle de vie des articles.

### 6.1 Statuts

| Champ | Description |
|---|---|
| Code | Identifiant technique unique (ex : EN_REPARATION) |
| Label | Nom affiché (ex : En réparation) |
| Couleur | Couleur du badge dans le suivi |
| Ordre | Position dans la liste |
| Final | Cochez si c'est une étape terminale (ex : Terminé, Irréparable) |

### 6.2 Transitions

| Champ | Description |
|---|---|
| De | Statut de départ |
| Vers | Statut d'arrivée |
| Label bouton | Texte du bouton (ex : Envoyer en réparation) |
| Couleur | Couleur du bouton dans le suivi |

> ℹ️ Exemple : transition « Réception → Diagnostic » avec le label « Démarrer diagnostic » affichera ce bouton pour tous les articles en statut Réception.

---

## 7. Catalogue

La section **CATALOGUE** regroupe les pages de consultation et de saisie des articles, clients et plateformes.

### 7.1 Articles / Clients / Plateformes

- Le bouton **« + Ajouter »** ouvre un formulaire de saisie avec les champs actifs du site.
- Le bouton **crayon** permet de modifier un enregistrement existant — une modal pré-remplie s'ouvre.
- Le bouton **poubelle** supprime un enregistrement après confirmation.

> ℹ️ Si aucun champ n'est configuré, la page affiche un message vous invitant à passer par la section Configuration avant de saisir des données.

> 🔒 Les boutons Ajouter, Modifier et Supprimer sont visibles uniquement si votre rôle dispose des permissions correspondantes.

---

## 8. Configuration — Rôles

Accessible via **CONFIGURATION > Rôles**. Permet de définir les rôles utilisateurs et leurs droits d'accès.

### 8.1 Créer un rôle

| Champ | Description |
|---|---|
| Code | Identifiant technique unique (ex : TECHNICIEN) |
| Label | Nom affiché (ex : Technicien) |
| Permissions | Pour chaque page : cochez les actions autorisées (Voir / Modifier / Supprimer) |

Les permissions sont **granulaires** : un technicien peut par exemple avoir accès à la consultation du catalogue sans pouvoir modifier ou supprimer.

### 8.2 Modifier un rôle

Cliquez sur l'icône **crayon** pour modifier le label ou les permissions. Les accès sont mis à jour à la prochaine connexion de l'utilisateur.

> ℹ️ Le rôle **ADMIN** a accès à toutes les pages et toutes les actions par défaut, quelle que soit la configuration.

---

## 9. Configuration — Utilisateurs

Accessible via **CONFIGURATION > Utilisateurs**.

### 9.1 Créer un utilisateur

| Champ | Description |
|---|---|
| Nom | Nom de famille |
| Prénom | Prénom |
| Login | Identifiant de connexion unique |
| Rôle | Rôle attribué (détermine les accès) |

> ⚠️ Le mot de passe généré est affiché **une seule fois**. Notez-le avant de fermer la fenêtre.

### 9.2 Premier login — Changement de mot de passe

À sa première connexion, l'utilisateur doit définir son propre mot de passe. Le nouveau mot de passe doit respecter :

- 10 caractères minimum
- Au moins une majuscule
- Au moins une minuscule
- Au moins un chiffre
- Au moins un caractère spécial parmi : `@ # $ % & !`

### 9.3 Réinitialiser un mot de passe

En cas d'oubli, l'administrateur peut réinitialiser le mot de passe via le bouton **réinitialisation** (icône flèche) sur la ligne de l'utilisateur.

---

## 10. Glossaire

| Terme | Définition |
|---|---|
| Article | Machine ou terminal suivi dans l'application |
| Champ | Information configurable attachée à un article (ex : N° RMA, S/N) |
| Statut | Étape courante d'un article dans le workflow |
| Transition | Action permettant de passer d'un statut à un autre |
| Workflow | Ensemble des statuts et transitions configurés pour un site |
| WMS | Warehouse Management System — gestion logistique |
| MES | Manufacturing Execution System — suivi de production |
| Site | Déploiement client de l'application (ex : Vallery) |
| JWT | Token de sécurité généré à la connexion, valide 8 heures |
| Rôle | Profil utilisateur définissant les pages accessibles |
| Permission | Droit d'accès à une page spécifique, accordé via un rôle |

---

*Document à jour au 01 juin 2026 — Version 0.5.0*
