# Budget perso — suite de widgets Grist

Suite de widgets custom Grist pour le suivi de finances personnelles. Quatre modules autonomes branchés sur un même registre d'opérations, sur le modèle de TaskFlow (vues indépendantes, un schéma partagé).

| Module | Fichier | Rôle |
|--------|---------|------|
| Import | `import.html` | Ingère les relevés CSV multi-banques → `Transactions` |
| Classement | `classement.html` | Catégorise sur 2 niveaux (famille › sous-catégorie), apprend des règles |
| Suivi | `suivi.html` | Dashboard enveloppes : reste-à-vivre, seuils intelligents, tendance |
| Prévisionnel | `previsionnel.html` | Objectif d'épargne, prévu vs réel, trajectoire glissante |

Chaque widget est un fichier HTML autonome (CSS + JS inline, vanilla, zéro framework). Données privées : tout reste dans le document Grist de l'utilisateur.

## Le contrat partagé

Tous les modules ne se connaissent qu'à travers **deux choses** : la table `Transactions` et le **typage** des catégories. C'est le seul point de couplage.

- `Categories.Type` ∈ `revenu` · `depense` · `epargne` · `exclu` décide si une opération entre dans le reste-à-vivre, l'épargne, ou est neutralisée.
- Ajouter ou retyper une catégorie est le **seul** endroit à toucher pour que tous les modules restent cohérents.
- **Convention `Locatif -`** : les catégories préfixées ainsi appartiennent à la lentille immo/LMNP. Les lentilles perso (Suivi, Prévisionnel) les **ignorent** (RAV, enveloppes) sans toucher à leur `Type` — elles restent revenu/dépense pour les widgets immo. Résout l'arbitrage « loyers en revenu ou en exclu » sans bascule. Voir `docs/DECISIONS.md` (D2).

## Déployer comme template (doc neuf)

Pour monter la suite copiable sur un document Grist vierge : voir **`template/SETUP.md`** (bootstrap `template/schema.bootstrap.json` + pose des 4 widgets). Le doc personnel reste l'instance vivante ; le template en est l'extraction propre, sans données.

## Schéma des tables

### `Transactions` (registre central, obligatoire)

| Colonne | Type Grist | Notes |
|---------|------------|-------|
| `Date` | Date | Timestamp Unix en secondes (÷1000 pour JS) |
| `Libelle` | Text | Libellé de l'opération |
| `Montant` | Numeric | Montant **signé** (négatif = débit) |
| `Categorie` | Text | Doit exister dans `Categories` |
| `Sous_categorie` | Text | Libre, idéalement dans `Sous_categories` |
| `Compte` | Text | Optionnel |
| `Banque` | Text | Renseigné par l'import |
| `Reference` | Text | Sert au dédoublonnage |
| `Exclu` | Bool | Exclusion ponctuelle (hors typage) |
| `Notes` | Text | Optionnel |

### `Categories` (référentiel de typage, obligatoire)

| Colonne | Type | Notes |
|---------|------|-------|
| `Categorie` | Text | Clé |
| `Type` | Text | `revenu` / `depense` / `epargne` / `exclu` — **pilote tous les calculs** |
| `Couleur` | Text | Hex |
| `Budget_mensuel` | Numeric | Seuil fixe (mode `fixe`) ; part fixe forcée (mode `flottant`) |
| `Budget_mode` | Text | `fixe` · `auto` (médiane 6 mois) · `flottant` (part fixe + provision, réserve dérivée) |
| `Provision` | Numeric | Provision mensuelle du mode `flottant` |
| `Lisser` | Bool | (hérité) lissage des dépenses périodiques — le mode `flottant` le généralise |

### `Regles` (catégorisation automatique)

| Colonne | Type | Notes |
|---------|------|-------|
| `Motif` | Text | Sous-chaîne recherchée dans le libellé (insensible casse/accents) |
| `Categorie` | Text | |
| `Sous_categorie` | Text | |
| `Exclu` | Bool | |
| `Priorite` | Int | Tri décroissant |

### `Sous_categories` (référentiel famille → sous-catégorie)

| Colonne | Type | Notes |
|---------|------|-------|
| `Categorie` | Text | Famille |
| `Sous_categorie` | Text | |

### `Parametres` et `Previsionnel` (prévisionnel)

`Parametres` : `Cle` (Text) · `Valeur` (Numeric) — porte `objectif_epargne`.
`Previsionnel` : `Mois` (`YYYY-MM`) · `Categorie` · `Prevu` (Numeric) · `Fige` (Bool) — snapshots des mois clôturés.

Les widgets **créent ces tables automatiquement** si elles manquent (l'import bootstrappe l'ensemble, le prévisionnel complète `Parametres`/`Previsionnel`).

## Installation

1. Dans Grist : ouvrir un document, ajouter une page.
2. « Add widget to page » → « Custom » → coller l'URL publiée du widget, p. ex.
   `https://nic01asfr.github.io/Widgets-Grist/budget/import/`
3. Lier le widget à la table `Transactions` (« Select By » → `Transactions`).
4. Commencer par **Import** : il crée le schéma et sème la taxonomie de départ.

Ordre de mise en place conseillé : Import → Classement → Suivi → Prévisionnel.

## Mode démo

Ouvrir un fichier HTML directement dans un navigateur (hors Grist) affiche un message d'invitation ; les widgets requièrent l'API Grist pour lire/écrire.

## Fichiers

```
budget_app/
├── import.html           Module Import
├── classement.html       Module Classement
├── suivi.html            Module Suivi
├── previsionnel.html     Module Prévisionnel
├── core/
│   └── budget-core.js    Taxonomie FR + helpers partagés (à inliner par build)
├── docs/
│   └── ARCHITECTURE_VISUEL.md   Besoin pour la planche d'architecture
├── README.md             Ce fichier
└── CLAUDE.md             Guide de développement
```

## Licence

EUPL-1.2.
