# CLAUDE.md — Budget perso

Guide de développement pour la suite de widgets **Budget perso** (Grist).

---

## Vue d'ensemble

Suite de 4 widgets custom Grist pour les finances personnelles. Tous partagent les mêmes tables et fonctionnent en concert dans un même document. Chaque widget est un **fichier HTML autonome** (CSS + JS inline, vanilla, pas de framework).

| Widget | Fichier | Rôle | Écrit |
|--------|---------|------|-------|
| Import | `import.html` | Relevés CSV multi-banques → registre | `Transactions` (+ bootstrap schéma) |
| Classement | `classement.html` | Catégorisation 2 niveaux + apprentissage | `Transactions`, `Regles`, `Sous_categories`, `Categories` |
| Suivi | `suivi.html` | Enveloppes, reste-à-vivre, seuils auto | `Categories` (Budget_mensuel/mode) |
| Prévisionnel | `previsionnel.html` | Objectif, prévu vs réel, trajectoire | `Parametres`, `Previsionnel`, `Categories.Lisser` |

Identité visuelle : papier `#f6f7f9`, encre `#171a21`, accent indigo `#3d5afe`, chiffres en mono à chasse fixe.

---

## Le contrat partagé (point de couplage unique)

Les modules **ne se connaissent pas entre eux**. Ils dépendent seulement de :

1. la table `Transactions` (registre des opérations) ;
2. le **typage** des catégories : `Categories.Type` ∈ `revenu` / `depense` / `epargne` / `exclu`.

Toute la mécanique d'agrégation repose sur `typeOf(cat)` :

```javascript
// revenu  → compte dans les revenus
// depense → compte dans les dépenses (et par catégorie)
// epargne → flux vers l'épargne (sorti du reste-à-vivre)
// exclu   → neutralisé (virements internes, opérations spéciales)
const typeOf = cat => (CATS[cat] && CATS[cat].type) || 'depense';
```

> **Règle d'or** : ne jamais déduire un comportement (revenu/épargne/exclu) d'un nom de catégorie en dur dans un widget. Toujours passer par `Type`. Un nouveau jeu de catégories ne doit demander **aucune** modification de code — seulement des lignes dans `Categories`.

Le préfixe `Locatif -` sur certaines catégories est une convention de tag (sous-ensemble LMNP), exploitée par d'autres suites du document mais transparente pour le budget perso.

---

## Conversions Grist (pièges)

```javascript
// Dates : Grist stocke en SECONDES Unix, JS en millisecondes
const gristToDate = ts => ts ? new Date(ts * 1000) : null;
const dateToGrist = d  => d  ? Math.floor(d.getTime() / 1000) : null;

// Données colonnaires → objets
// { Date:[...], Montant:[...] } → [{Date, Montant}, ...]
// via fetchTable(); itérer sur t.id.length

// Montant : toujours SIGNÉ (négatif = débit). L'import normalise débit/crédit en signé.
```

---

## Détail par module

### Import (`import.html`)

- Détecte 8 formats FR (LCL/CIC/CM, Boursorama, Crédit Agricole, Société Générale, BNP, Caisse d'Épargne, Revolut, N26) + mapping deviné pour tout CSV.
- Mapping de colonnes corrigeable à la main ; normalise dates et montants.
- Catégorise via `Regles` (utilisateur) puis taxonomie FR de départ (`core`).
- Dédoublonne contre `Transactions` (clé `Reference`, sinon date+montant+libellé).
- **Bootstrappe le schéma** : crée `Transactions`/`Regles`/`Categories`/`Sous_categories` si absentes et sème la taxonomie de départ. C'est le widget « maître » d'un document neuf.

### Classement (`classement.html`) — câblé à Grist

- Regroupe les opérations non catégorisées par **marchand** (`merchantKey` : retire dates, masques de carte, villes, mentions SEPA).
- Suggère sur **deux niveaux** (famille + sous-catégorie), source : Appris (historique) > Règle > Connu (taxonomie) > À confirmer.
- Divulgation progressive : tri en masse par marchand → « distinguer ligne par ligne » → sélection d'un sous-ensemble pour classer différemment.
- Combobox recherche-par-frappe unique « Famille › Sous-catégorie » (filtre tokenisé insensible aux accents) ; création à la volée (`+ Créer X`, `+ Nouvelle famille X`) persistée immédiatement.
- Apprend une `Regle` **seulement** si tout le marchand tombe dans une seule famille.

### Suivi (`suivi.html`) — câblé à Grist (premier widget réel de la suite)

- Méthode enveloppe. Hero **reste-à-vivre** = revenus − dépenses, hors `epargne`, `exclu` (via `Type`) **et hors `Locatif -`** (via `BP.isLocatif`).
- Bascule Mois calendaire ↔ Cycle de paie. Le jour de paie est **détecté** (plus gros revenu récurrent non locatif, jour-du-mois modal) ; si introuvable, le mode cycle est masqué.
- **Trois modes de seuil** par enveloppe, stockés dans `Categories.Budget_mode` :
  - `fixe` — plafond = `Budget_mensuel`.
  - `auto` — plafond = médiane des 6 mois précédents (arrondie à 10). Bouton « figer » → passe en `fixe`.
  - `flottant` — part fixe (récurrents auto-détectés, ou `Budget_mensuel` si forcée) + `Provision` ; **réserve dérivée** (12 mois glissants, jamais stockée) qui absorbe les gros mois. Cf. `BP.detectRecurrents` / `BP.deriveReserve` et `docs/DECISIONS.md` (D1).
- Écritures via `applyUserActions(['UpdateRecord','Categories',rowId,{...}])` sur `Budget_mode` / `Budget_mensuel` / `Provision`.
- Enveloppes affichées = catégories `depense` non locatives ayant une dépense sur 6 périodes (pas de liste « active » stockée : aucun état caché). Tendance 6 périodes en barres.

### Prévisionnel (`previsionnel.html`) — câblé à Grist

- Objectif d'épargne mensuel (`Parametres.objectif_epargne`).
- Grille mois × catégories (PAST=7 … FUTURE=4). **Prévu** = seuil de la catégorie (fixe ou médiane auto) ; se **fige** par mois clôturé → snapshot dans `Previsionnel`. **Réel** depuis `Transactions`.
- KPIs : épargne réelle moyenne, écart cumulé / objectif, épargne prévue / mois, projection.
- Trajectoire d'épargne (SVG) : cumul réel vs objectif vs projection.
- `Lisser` (flag par catégorie) prévu pour lisser les dépenses périodiques (affichage réserve différé).

---

## Cœur partagé (`core/budget-core.js`)

Aujourd'hui chaque widget inline sa propre copie de la taxonomie FR (`TAXO`, `SOUS_SEED`, `CAT_SEED`) et des helpers (`norm`, `eur`, `parseDate`, `parseAmount`, `merchantKey`, `typeOf`). `core/budget-core.js` est la **source unique** de ces constantes/fonctions (objet global `BP`).

**Roadmap (calquée sur TaskFlow)** : un `scripts/build-budget.js` inline `core/budget-core.js` dans chaque widget entre les marqueurs `// <budget-core>` / `// </budget-core>`, avec un mode `--check` pour la CI. Tant que le build n'est pas en place, garder `core/budget-core.js` comme **référence canonique** et reporter à la main toute évolution de la taxonomie dans les widgets.

---

## Déploiement

```
budget_app/import.html        → published/budget/import/index.html
budget_app/classement.html    → published/budget/classement/index.html
budget_app/suivi.html         → published/budget/suivi/index.html
budget_app/previsionnel.html  → published/budget/previsionnel/index.html
```

URLs publiées : `https://nic01asfr.github.io/Widgets-Grist/budget/{module}/`

---

## Points d'attention

1. **Dates** : secondes Unix côté Grist, ×1000 / ÷1000 côté JS.
2. **Montant signé** : ne jamais supposer un signe ; l'import normalise débit/crédit.
3. **Typage avant tout** : aucun comportement déduit d'un nom de catégorie en dur — passer par `Categories.Type`.
4. **Écritures Grist flaky** : un `applyUserActions` peut renvoyer une erreur vide tout en réussissant — vérifier par relecture si critique.
5. **Import = widget maître** : sur un document neuf, l'ouvrir en premier (il crée le schéma et la taxonomie).
6. **Dédoublonnage** : `Reference` d'abord, sinon clé date+montant+libellé tronqué.
