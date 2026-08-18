# Binding formulaires — FormDef ↔ Grist ↔ BlockNote (Cerema)

**Date** : 2026-07-29  
**Statut** : **cadré — validé pour implémentation offre de service**  
**Repo référence** : Widgets Grist (`projects/grist_forms/`, `projects/qgis2grist/`)  
**Repo cible** : `cerema-offre-de-service` / `qgis-sspcloud` (BlockNote, composants `survey_*`)  
**Modèle parallèle** : `projects/Atlas/docs/BINDING-ATLAS-v7.md`, `projects/qgis2grist/docs/BINDING-QGIS-GRIST-CEREMA-v2.md` (carto)

**Sources de vérité externes** :

- FormDef : `projects/grist_forms/runtime/formdef.schema.json`
- Survey Manifest (JS) : `projects/grist_forms/shared/survey-project.js` + `runtime/survey-manifest.schema.json`
- Survey Manifest (Python, autoritaire offre) : `cerema-offre-de-service` → `shared/io/survey_manifest.py` (à aligner)
- Axes WikiChat : `grist-axis`, `qgis-sspcloud-composants-axis`, `scene-manifest-axis` (parallèle carto)

---

## 1. Objectif

Permettre à l’**offre de service Cerema** (qgis-sspcloud, édition de livrables BlockNote) de composer et publier des **formulaires complets** en s’appuyant sur le travail **grist_forms** — même logique que la carto consomme **Scene Manifest V0.2** via `interactive_map` / blocs BlockNote carto.

**Règle Cerema** : pas de second moteur formulaires. **FormDef** = contrat canonique ; **Survey Manifest** = projection enquête pour BlockNote et `survey_*`.

---

## 2. Architecture en strates

```
┌─────────────────────────────────────────────────────────────────┐
│  AMONT (QGIS / bureau)                                          │
│  QField ZIP · qgis2grist · grist_forms builder                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  CONTRATS CANONIQUES                                            │
│  FormDef 1.0 (autoritaire)  ──►  Survey Manifest (projection)   │
│  Scene Manifest V0.2 (carto — parallèle, indépendant)           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  GRIST (document)                                               │
│  Table Formulaires (Def JSON) · tables réponses · ensureSchema  │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     grist_forms         qgis-sspcloud    qgis2grist
     builder + publish   BlockNote        import terrain
     engine.js bundlé    survey_*         qgis-form-to-formdef
                         iframe_grist_form
```

---

## 3. Parallèle carto ↔ formulaires

| Dimension | Carto (fait) | Formulaires (cible) |
|-----------|--------------|---------------------|
| Contrat pivot | Scene Manifest V0.2 | **FormDef** |
| Projection UI | StyleDeclarative, controls | **Survey Manifest** |
| Table Grist méta | `SceneManifest` | **`Formulaires`** |
| Producteur amont | qgis2grist `buildSceneManifest` | qgis2grist `qgis-form-to-formdef` + grist_forms builder |
| Binding round-trip | `manifest-binding.js` (Atlas prefs ↔ SM) | **À créer** : BlockNote doc ↔ FormDef (offre) |
| Runtime widget repo | MapLibre (qgis2grist v2, Atlas) | `engine.js` + publish bundle |
| Blocs BlockNote offre | `interactive_map`, `scene_3d` | **`survey_*`**, **`iframe_grist_form`** |
| Publish livrable | audit_chain + publication-flow | Idem (classification `cerema_internal`) |

---

## 4. Périmètre in / out

### In scope (binding BlockNote)

- Vendoriser / synchroniser **FormDef schema** + **survey-project.js** côté offre
- Blocs BlockNote consommant **Survey Manifest** (questions simples : text, choice, likert5, bool, date, attachment)
- Bloc **`iframe_grist_form`** : embed URL vue custom publiée (pattern `iframe_grist` carto)
- Adaptateur **FormDef direct** pour cas avancés (Ref, cascade, `dynamicFilter`, audience)
- Flux amont : QGIS → FormDef brouillon (`terrain`) → édition BlockNote ou builder → publish → fill
- Alignement `survey_manifest.py` ↔ projection JS (tests non-régression)

### Out of scope

- UI BlockNote dans **Widgets Grist** (reste dans offre de service)
- Dupliquer `survey_manifest.py` dans ce repo
- Remplacer QField / PostGIS
- Géométrie dans FormDef (carto = Scene Manifest séparé)
- Collab multi-éditeurs BlockNote temps réel

---

## 5. Contrats — champs projetés / non projetés

| Capacité FormDef | Runtime grist_forms | Survey Manifest | Bloc BlockNote |
|------------------|---------------------|-----------------|----------------|
| Text, Choice, Bool, Date, likert5 | ✅ | ✅ | `survey_question_*` |
| Attachments | ✅ (CORS fill publié) | ✅ `attachment` | `survey_file` |
| Ref + visibleCol | ✅ | meta `grist` | FormDef ou SM étendu |
| cascade | ✅ | ❌ FormDef-only | FormDef direct |
| dynamicFilter (A/B/C) | ✅ | ❌ FormDef-only | FormDef direct |
| audience + conditions context | ✅ | ❌ partiel | FormDef direct |
| section.condition / gate | ✅ | partiel | SM + FormDef |

**Décision D2 (actée)** : SM pour blocs simples ; **FormDef direct** pour Ref / cascade / filtres / audience — comme Atlas utilise SM + prefs utilisateur.

---

## 6. Décisions produit (actées)

| ID | Décision | Choix |
|----|----------|-------|
| **D1** | Source de vérité édition | **Table `Formulaires.Def`** (FormDef JSON) ; BlockNote exporte/importe via SM ou FormDef |
| **D2** | Extension SM | **Reporter** — gaps documentés ; blocs avancés lisent FormDef |
| **D3** | Runtime fill livrable | **Court terme** : `iframe_grist_form` (vue publiée grist_forms) ; **moyen terme** : `engine.js` embarqué si autonomie requise |
| **D4** | Où vit l’éditeur BlockNote | **Uniquement offre de service** ; grist_forms = builder technique |
| **D5** | Granularité QField | **N FormDef / couche métier** (`buildTerrainPack`) ; relations = Ref entre forms |

---

## 7. Flux utilisateur cible

```
1. Import QField (qgis2grist) → tables + FormDef draft (statut terrain) + Scene Manifest
2. Édition bureau : grist_forms builder OU BlockNote offre (SM/FormDef)
3. ensureSchema → colonnes Grist alignées
4. Publish → vue custom « Remplir » (bundle engine.js)
5. Assemblage livrable BlockNote : récit + blocs carto (SM) + blocs survey (SM/FormDef)
6. Publication offre (publication-flow + audit_chain)
7. Fill terrain : iframe formulaire publié ou composants survey_*
```

---

## 8. Briques réutilisables depuis Widgets Grist

| Module | Chemin | Rôle offre |
|--------|--------|------------|
| FormDef schema | `runtime/formdef.schema.json` | Validation, contrat |
| Projection SM | `shared/survey-project.js` | Export/import BlockNote |
| Runtime fill | `runtime/engine.js` | Référence ou bundle |
| Types Grist | `shared/types.js` | coerceForWrite |
| Schéma auto | `shared/ensure-schema.js` | Tables réponses |
| Publish | `shared/publish.js` | Pattern vue custom |
| Pont QGIS | `qgis2grist/lib/qgis-form-to-formdef.js` | Amont terrain |
| Provision | `qgis2grist/lib/terrain-provision.js` | Table Formulaires |

**Tests de non-régression repo** : `node --test projects/grist_forms/tests/*.test.js` (89+ tests).

---

## 9. Livrables côté offre de service (qgis-sspcloud)

| Livrable | Description |
|----------|-------------|
| `survey_manifest.py` aligné | Schéma Python = projection FormDef |
| Blocs BlockNote `survey_section`, `survey_question_*` | Rendu éditeur + preview |
| Bloc `iframe_grist_form` | URL doc Grist + section publiée |
| Adaptateur `formDefToBlockNote` / inverse | Round-trip édition |
| Intégration `publication-flow` | Livrable DSFR mixte carto + forms |
| Tests fixture `bees.zip` | N forms + fill + export SM |

---

## 10. Critères d’acceptation

- [ ] BlockNote produit un SM valide vs schéma Cerema / in-repo
- [ ] Round-trip SM → FormDef → SM sans perte sur types enquête standard
- [ ] FormDef depuis BlockNote → `ensureSchema` crée colonnes Grist
- [ ] Fill via iframe vue publiée → types Grist corrects (Ref, ChoiceList, dates s)
- [ ] Cas bees.zip : ≥3 FormDef éditables, publiés, fill OK
- [ ] Pas de drift non testé entre `survey-project.js` et `survey_manifest.py`
- [ ] Livrable mixte : blocs carto SM + blocs survey dans une page BlockNote

---

## 11. Plan d’implémentation par phase

| Phase | Où | Contenu |
|-------|-----|---------|
| **0** | Offre | Auditer `survey_manifest.py` vs `survey-project.js` ; aligner schémas |
| **1** | Offre | Blocs MVP SM + `iframe_grist_form` |
| **2** | Offre | Adaptateur FormDef direct (Ref, cascade, filtres) |
| **3** | Repo + offre | Pipeline qgis2grist → BlockNote (lien post-import) |
| **4** | Offre | Assemblage livrable DSFR + audit_chain |
| **5** | Offre | Round-trip BlockNote ↔ FormDef (équivalent manifest-binding Atlas) |

---

## 12. Questions ouvertes (non bloquantes phase 0–1)

1. Versioning conjoint `manifest_version` FormDef vs `Formulaires.Version` vs republish
2. Extension future SM pour cascade/filtres si BlockNote ne peut pas lire FormDef sidecar
3. Harmonisation nommage blocs (`survey_*` vs préfixe Cerema)

---

## 13. Références

- `docs/superpowers/specs/2026-07-26-grist-forms-builder-design.md`
- `docs/superpowers/specs/2026-07-26-grist-forms-phase2-design.md`
- `projects/qgis2grist/docs/QFIELD-COMPLET-GRIST-IDEAL.md`
- `projects/grist_forms/docs/MANUAL_TEST.md` §9
- Validations live filtres A/B/C + UI + publish (2026-07-28)
