# SMAC — Suivi et Management des Ateliers et de la Chaîne logistique

![Stack](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-blue?logo=react)
![Stack](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green?logo=node.js)
![Stack](https://img.shields.io/badge/ORM-Prisma-2D3748?logo=prisma)
![Stack](https://img.shields.io/badge/BDD-MySQL-orange?logo=mysql)
![Status](https://img.shields.io/badge/Statut-En%20développement-yellow)

---

## Contexte

SMAC est développé pour remplacer **OGI**, l'outil de gestion actuel basé sur WinDev, qui présente plusieurs limites bloquantes :

- Paramétrage en dur dans le code — non configurable sans intervention externe
- Temps de latence importants liés au langage WinDev et à la base de données
- Aucun accès externe possible (pas de visibilité client ni inter-sites)
- Inadapté à l'activité actuelle — tâches chronophages, saisies en double voire triple

SMAC est une **application web** moderne, accessible partout, conçue pour être déployée sur plusieurs sites avec un socle commun configurable.

---

## Identification des besoins

- Développement d'une base commune facilement réplicable, pour mise en place sur différents sites (MES et WMS)
- Mise en place de spécificités permettant le paramétrage complet de l'application (workflow, traitements laboratoire, etc.)
- Développement de modules fonctionnels itinérants à la plateforme utilisatrice
- Accès externe pour proactivité avec d'autres plateformes et visibilité client
- Vision globale de l'activité de production et reporting automatique, prenant en compte plusieurs indicateurs : KPI, SLA, etc.
- Sécurisation des données enregistrées

---

## Workflow — Fonctionnement du site

```mermaid
flowchart TD
    A[📋 Création RMA\nUmberto] --> B[📦 Réception / Contrôle / Stockage]
    B --> C[🔧 Réparation]

    C -->|nok| D[⏳ Attente info\nDevis / pièce / firmware]
    D -->|ok| C

    C --> E[💻 MAJ / Injection]
    E -->|nok| C

    E --> F[✅ Contrôle Qualité]
    F -->|nok - retour réparation| C
    F -->|nok - retour MAJ| E

    F --> G[📦 Emballage individuel]
    G -->|nok| F

    G --> H[🚚 Expédition]
    H --> I[🏁 Livraison client]
```

---

## Architecture technique

```mermaid
graph TD
    A["🖥️ Navigateur / Douchette<br/>(React + TypeScript — port 5173)"] -->|"HTTP /api"| B["⚙️ Backend<br/>(Node.js + Express — port 5000)"]
    B -->|"Prisma ORM"| C[("🗄️ Base de données<br/>MySQL — XAMPP")]

    subgraph Frontend
        A
    end

    subgraph Backend
        B
    end

    subgraph "Base de données"
        C
    end
```

---

## Modules fonctionnels

```mermaid
graph LR
    SMAC["🏭 SMAC"]

    SMAC --> LOG["📦 Logistique"]
    SMAC --> PROD["🔧 Production"]
    SMAC --> ADMIN["⚙️ Administration"]
    SMAC --> COM["💼 Commercial"]

    LOG --> L1["Planning"]
    LOG --> L2["Transferts"]
    LOG --> L3["Inventaire / Stock"]
    LOG --> L4["Entrée stock"]
    LOG --> L5["Gestion PDA"]

    PROD --> P1["Réparation"]
    PROD --> P2["PDA Labo"]
    PROD --> P3["Suivi MAJ"]
    PROD --> P4["Attente info / firmware"]
    PROD --> P5["Injection 🚧"]
    PROD --> P6["Contrôle qualité 🚧"]

    ADMIN --> A1["Utilisateurs & Rôles"]
    ADMIN --> A2["Clients / Plateformes"]
    ADMIN --> A3["Pannes constatées"]
    ADMIN --> A4["Articles"]

    COM --> C1["Expédition 🚧"]
    COM --> C2["Facturation 🔜"]
    COM --> C3["Devis 🔜"]
```

> 🚧 En cours — 🔜 Prévu

---

## Stack technique

| Technologie | Rôle |
|---|---|
| React + TypeScript | Frontend — UI composants, routing |
| Vite | Build tool — démarrage instantané, proxy API |
| Express (Node.js) | Backend — API REST |
| TypeScript | Langage commun Frontend + Backend |
| Prisma | ORM — mapping objet/relationnel |
| MySQL (XAMPP) | Base de données relationnelle |

---

## Structure du projet

```
smac-core/
├── frontend/
│   └── src/
│       ├── pages/          # Pages par module (logistique, production…)
│       └── components/     # Composants réutilisables
├── backend/
│   └── src/
│       ├── controllers/    # Logique métier
│       ├── routes/         # Définition des routes API
│       ├── middleware/      # Auth JWT, gestion erreurs
│       └── prisma/
│           └── schema.prisma  # Schéma base de données
└── README.md
```

---

## Démarrage

### Prérequis

- Node.js ≥ 18
- XAMPP avec MySQL démarré
- Base de données `smac` créée

### Installation

```bash
# Frontend
cd frontend
npm install
npm run dev        # http://localhost:5173

# Backend (dans un terminal séparé)
cd backend
npm install
npx prisma generate
npm run dev        # http://localhost:5000
```

### Accès réseau local (douchette / autre poste)

Vite est configuré avec `host: true`. Les appareils sur le même réseau WiFi peuvent accéder à l'application via :

```
http://<IP-du-poste>:5173
```

---

## Feuille de route

| Priorité | Module | Fonctionnalité |
|---|---|---|
| ✅ Fait | Logistique | Planning, Transferts, Stock, Entrée stock |
| ✅ Fait | Production | Réparation, Fiche réparation, Suivi statuts |
| ✅ Fait | Production | Gestion PDA Labo / Logistique |
| ✅ Fait | Administration | Utilisateurs, Rôles, Clients, Plateformes, Articles |
| 🚧 En cours | Production | Injection, Contrôle qualité |
| 🔜 À venir | Production | Lien pièces utilisées ↔ stock PDA labo |
| 🔜 À venir | Commercial | Expédition, Facturation, Devis |
