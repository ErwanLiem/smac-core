# SMAC - Suivi et Management des Ateliers et de la Chaîne logistique

## Projet

Développement d'un outil permettant de remplacer OGI.

---

## État des lieux — OGI

Technologie WinDev, qui offre peu de solutions d'évolution, architecture limitée, ergonomie pas du tout adaptée.

Outils de gestion WMS *(Warehouse Management System)* pour la logistique et MES *(Manufacturing Execution System)* pour la production.

Développement compliqué car géré par une entreprise externe.

---

## Problématiques

- Paramétrage en dur dans le code, non paramétrable
- Temps de latence important, dû au langage WinDev et à la base de données
- Aucun accès externe possible (pas de visibilité client)
- Ne correspond plus à l'activité exercée aujourd'hui — beaucoup de tâches chronophages, effectuées en double voire en triple dans certains cas

---

## Identification des besoins

- Développement d'une base commune facilement réplicable, pour mise en place sur différents sites (MES et WMS)
- Mise en place de différentes spécificités permettant le paramétrage complet de l'application (workflow, traitements laboratoire, etc.)
- Développement de modules fonctionnels itinérants à la plateforme utilisatrice
- Accès externe pour proactivité avec d'autres plateformes et visibilité client
- Vision globale de l'activité de production, prenant en compte plusieurs indicateurs : KPI, SLA, etc.

---

## Solution

Application Web, offrant une liberté d'accès partout pour tout le monde.

### Stack technique

| Technologie | Rôle |
|-------------|------|
| React + TypeScript | Frontend — librairie UI puissante et très utilisée |
| Vite | Outil de développement frontend — démarrage instantané |
| Express (Node.js) | Backend — framework Node.js simplifié |
| TypeScript | Langage commun Frontend + Backend |
| Prisma | ORM — gestion de la relation entre le Backend et la base de données |
| MySQL (XAMPP) | Base de données |

---

## Plan

1. Documentation — mise en place du `README.md` (documentation du projet) et du `CHANGELOG.md` (historique du développement)
2. Développement du « tronc commun » configurable
3. Développement des modules complémentaires en relation avec Liem Vallery
