# Projet: grist_forms (Form Builder)

## Contexte
Essence formulaires Grist — compose FormDef, persist table Formulaires, publish vue intra-doc.
Façade **questionnaire** pour user non formé ; moteur technique (`bind` / `ensureSchema`) en coulisse.

## Spec
- v1 : `docs/superpowers/specs/2026-07-26-grist-forms-builder-design.md`
- Phase 2 (SM + Attachments) : `docs/superpowers/specs/2026-07-26-grist-forms-phase2-design.md`
- Contexte & audience : `docs/superpowers/specs/2026-07-26-grist-forms-context-audience-design.md`

## Architecture

```
projects/grist_forms/
├── builder.html          # UI 4 étapes + wizard + templates
├── runtime/
│   ├── engine.js         # Preview + runtime (conditions, cascade, editRowId)
│   ├── formdef.schema.json
│   └── survey-manifest.schema.json
├── shared/
│   ├── dsfr-like.css
│   ├── ux.js
│   ├── grist-bridge.js
│   ├── types.js
│   ├── attachments.js
│   ├── session-context.js   # Probe widget / session / groupes audience
│   ├── audience-setup.js    # Auto formule user.Email (trigger nouvelles lignes)
│   ├── survey-project.js
│   ├── ensure-schema.js
│   ├── audience-setup.js    # Auto formule user.Email (trigger nouvelles lignes)
│   ├── formulaires-table.js
│   └── publish.js
├── tests/
├── docs/MANUAL_TEST.md
└── docs/PUBLICATION.md
```

## État — **v1 + phase 2 + audience** (2026-07-27)

`node --test projects/grist_forms/tests/*.test.js` → **82 tests verts**

### Livré
- Wizard Créer / Brancher ; templates (Satisfaction = chemin recontact)
- Binding complet + `visibleCol` méta
- Chemins d’étapes + conditions champ (ET/OU, opérateurs FR, infobulles `?`)
- **Contexte & audience** :
  - `session-context.js` : `inGristWidget`, `isLoggedIn`, `userEmail`, `groups`
  - Conditions `source: context | audience | field`
  - Accueil : case « Réserver des questions… » + table email/groupe (détection auto, selects par type)
  - **Reconnaître la personne connectée** : coche → `audience-setup.js` applique `ModifyColumn` (formule `user.Email`, trigger nouvelles lignes)
- Cascade Ref→Ref ; filtre dynamique Choice/Text→Ref ; filtre Ref→même table (`parentResolve: refRow` + `parentValueColumn`)
- Publish intra-doc ; Survey Manifest ; Attachments (upload CORS différé)
- UX : slides Accueil/Fin, branding, placeholders, libellés inline

### Validation live
Checklist : `docs/MANUAL_TEST.md` §4–5. Guide publication : `docs/PUBLICATION.md`.

### Publication GitHub Pages

```bash
npm run promote:grist-forms   # projects/ → published/grist_forms/
npm run manifest
```

Widget catalogue : `grist_forms/builder.html` (accès **full**).

### Hors scope / différé
- Géo, **BlockNote**, collab ; goto explicite entre étapes
- Upload PJ custom cross-origin (CORS)
- Promote `published/` : sur demande

### Piste future (étude séparée)
Binding BlockNote formulaires (offre de service) : **cadré** — voir `docs/superpowers/specs/2026-07-29-form-binding-blocknote-cerema-design.md` et `.wikichat/knowledge/grist-forms-blocknote-binding-axis.md`. Ce projet = référence technique (`FormDef`, `ensureSchema`, publish, survey-project.js) ; blocs BlockNote dans cerema-offre-de-service / qgis-sspcloud.

### Note différée — Attachments / CORS
`getAccessToken` OK ; `POST …/attachments` depuis vue custom hors origine → CORS. Alternative : formulaire natif Grist sur colonne `Attachments`.

## Audience — rappel UX

| UI (Accueil) | Rôle |
|--------------|------|
| Réserver des questions… | Active `audience.mode=bind` |
| Table / colonnes email & groupe | Liste personnes pour conditions |
| Reconnaître la personne connectée | `audience.probe=true` + formule auto sur colonne email |

Conditions ≠ ACL : masquage UX seulement ; droits réels = règles Grist.

## Ouverture

```bash
npm run serve:dev
# → http://localhost:3001/grist_forms/builder.html
```

Widget Grist → cette URL, accès **full**. E2E auto : `?e2e=1` uniquement.
