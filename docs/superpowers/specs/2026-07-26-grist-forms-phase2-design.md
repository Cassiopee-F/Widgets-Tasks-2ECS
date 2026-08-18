# Design — Grist Forms Phase 2 (contrat SM + Attachments)

**Date** : 2026-07-26  
**Repo** : Widgets Grist (`projects/grist_forms/`)  
**Statut** : implémenté (approche 2 + Attachments) — 2026-07-26 — **clos** ; upload PJ custom CORS différé (voir `projects/grist_forms/CLAUDE.md`).
**Prérequis** : v1 Form Builder (spec `2026-07-26-grist-forms-builder-design.md`)

---

## 1. Objectif

1. **D — Contrat** : FormDef reste canonique ; Survey Manifest = projection versionnée (schéma + export + inverse partielle) pour BlockNote / offre-de-service.
2. **A — Attachments** : type Grist `Attachments` bout-en-bout (builder → ensureSchema → runtime upload → colonne) + projection SM `attachment`.

**Hors cette itération** : géo/carte, collab multi-éditeurs, UI BlockNote (consomment le SM exporté).

---

## 2. Approche retenue

**Approche 2** : schéma SM in-repo + projection enrichie + roundtrip partiel. Pas de fusion FormDef = SM.

```
FormDef (canon) ──formDefToSurveyManifest──► Survey Manifest
       ▲                                         │
       └──── surveyManifestToFormDef (partiel) ──┘
```

---

## 3. Survey Manifest (projection)

Fichier : `projects/grist_forms/runtime/survey-manifest.schema.json`

Champs projetés par question : `colId`, `label`, `type`, `required`, `condition` (si présent), `profile` / `theme` / `polarity` (si présents).  
Sections : `id`, `label`, `gate`, `questions` (alias de `fields`).

Types SM : `text`, `choice`, `choice_list`, `bool`, `datetime`, `number`, `date`, `likert5`, `attachment`.  
Ref / RefList → `text` + objet optionnel `grist: { type, refTable, visibleCol }` (hors SM strict).

`manifest_version` : aligné sur FormDef (`1.0.0` ; bump si breaking).

---

## 4. Attachments

| Couche | Comportement |
|--------|----------------|
| FormDef | `type: "Attachments"`, `widget: "file"` ; options `accept`, `maxFiles` (défaut 5) |
| ensureSchema | `AddColumn` type `Attachments` |
| Runtime | `<input type="file" multiple>` ; upload via `getAccessToken({readOnly:false})` + `POST …/attachments?auth=` |
| Écriture | valeur cellule `['L', id1, id2, …]` |
| SM | `type: "attachment"` |

Démo / sans token : upload impossible → erreur claire à la soumission (pas de fausse réussite).

**Différé (ops / produit)** — upload custom cross-origin bloqué CORS sur `grist.numerique` (token OK, POST KO). Formulaire **natif** OK sans tiers. VPS ≠ fix si autre origine ; options : même origine / CORS instance / relai API / PJ native. Détail : `projects/grist_forms/CLAUDE.md` § Note différée Attachments.

---

## 5. Fichiers touchés

- `shared/survey-project.js`, `runtime/survey-manifest.schema.json`
- `shared/attachments.js` (nouveau), `shared/types.js`, `runtime/engine.js`
- `shared/ensure-schema.js`, `shared/ux.js`, `shared/publish.js`, `builder.html`
- tests + `CLAUDE.md`

---

## 6. Critères de succès

- Tests roundtrip SM (Satisfaction / Contact) verts
- ensureSchema crée une colonne Attachments
- Engine rend `file` ; coerce produit `['L', …]`
- Export SM contient `attachment` pour ces champs
- `node --test projects/grist_forms/tests/*.test.js` vert
