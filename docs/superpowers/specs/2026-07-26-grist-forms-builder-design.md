# Design — Grist Form Builder (essence formulaires)

**Date** : 2026-07-26  
**Repo** : Widgets Grist (`projects/grist_forms/`)  
**Statut** : draft révisé (revue « idéal ») — en attente relecture utilisateur  
**Liens** : Survey Manifest (artefactory-mcp esquisse + cible cerema-offre-de-service), `grist-bridge.js`, pattern publish Artefactory (`CreateViewSection` / custom-widget-builder)

---

## 1. Problème

On dispose d’un Form Builder monolithique (v3) capable de composer des formulaires Grist riches (étapes, Ref, cascades, conditions), mais :

- config non persistée, export HTML manuel uniquement ;
- types incomplets / bugs (Bool, ChoiceList, RefList, dates) ;
- UI DSFR cosmétique, hors briques communes ;
- pas de contrat aligné avec le Survey Manifest / l’écosystème offre-de-service.

**Objectif** : en faire l’**essence formulaires** du socle — compose tout type de formulaire Grist, stocke le **contrat canonique** de composition, publie une vue utilisable, et est **repris / intégré** par offre-de-service et les composants pour ce qu’ils font (collecte, survey_*, BlockNote), sans second moteur.

---

## 2. Périmètre

### In scope (v1)

- Composition de formulaires (builder) hébergé **GitHub Pages** depuis ce repo.
- Persistance **FormDef** (JSON) en table Grist du document courant.
- Publish **intra-doc** : nouvelle vue custom figée (pattern Artefactory) ; le publish **bundle** le moteur dans `_js` (zéro dépendance GH Pages au runtime).
- Runtime d’exécution (collecte `AddRecord` uniquement) via couche I/O alignée **GristBridge**.
- Deux modes de composition : **bind** (colonnes existantes) et **ensureSchema** (créer/aligner colonnes manquantes sur `TableCible`).
- Preview builder branchée sur le **même** `engine.js` que le runtime.
- Alignement types Grist + comportements (cascade, conditions, sections).
- UI DSFR réelle (composants / classes), styles repo cohérents.
- FormDef = contrat canonique formulaires ; projection / alias Survey Manifest pour l’écosystème.
- Point d’extension submit : horodatage + hook `_audit_hash` (si colonnes présentes).

### Out of scope (v1)

- Édition d’enregistrements (`UpdateRecord`) → v1.1.
- Attachments upload, géométrie / carte, blocs BlockNote, Web Components UMD finaux.
- Service backend Config D.
- Création automatique sur un **autre** document (REST + clé API) — manuel / plus tard.
- Dashboard polarité / exports CSV-GeoJSON (rôle composants / offre-de-service).
- Table méta `Questions` normalisée (projection optionnelle → v1.1 si besoin dashboards).

### Relation écosystème

```
Widgets Grist / Form Builder     FormDef (contrat canonique formulaires)
        (compose + publish vue)  ──────────────────►  cerema-offre-de-service
                                                      + composants (survey_*, BlockNote)
                                                      reprennent / intègrent pour leur rôle
```

Analogie : Scene Manifest ↔ carto. FormDef est l’essence ; Survey Manifest en est la **spécialisation / projection** enquête (pas un schéma rival).

---

## 3. Architecture

```
┌──────────────────────────────┐
│ Builder (GH Pages URL)       │
│ Compose → écrit FormDef      │
└──────────────┬───────────────┘
               │ table Formulaires (JSON + méta)
               ▼
┌──────────────────────────────┐
│ Publish (dans le widget)     │
│ CreateViewSection("custom")  │
│ + options _html/_js figés    │
│   (custom-widget-builder)    │
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│ Vue Grist « Remplir »        │
│ Runtime figé in-doc          │
│ 1 moteur conditions          │
│ AddRecord → table cible      │
└──────────────────────────────┘
```

| Pièce | Rôle | Hébergement |
|-------|------|-------------|
| Builder | Composer / éditer FormDef | GitHub Pages (repo) |
| Table `Formulaires` | Source de vérité | Intra-doc Grist |
| Publish | Matérialiser une vue | Actions Grist depuis le builder (accès full) |
| Runtime publié | Remplir le form | **Figé in-doc** (moteur + FormDef snapshot bundlés) |

Export HTML clipboard = **secours** uniquement.

**Invariant publish** : après publish, la vue fonctionne même si GitHub Pages / le builder est down. Toute évolution du FormDef en table exige un **republish** pour mettre à jour le snapshot (pas de lecture live de la table au fill — choisi pour l’autonomie intra-doc).

Règles Artefactory à respecter :

- `applyUserActions` / `CreateViewSection` / `UpdateRecord` sur `_grist_Views*` ;
- **jamais** REST PATCH sur les tables meta (crash frontend) ;
- `customView` : JSON string imbriquée correctement ;
- publication lourde (`_html`/`_js`) via le contexte widget (privileges owner).

**I/O Grist** : le runtime (et le builder pour CRUD FormDef) s’alignent sur le contrat `GristBridge` (artefactory `shared/grist-bridge.js` — dates en secondes, ChoiceList/RefList `['L',…]`, helpers). On peut vendor / copier la brique dans `projects/grist_forms/shared/` plutôt que réinventer.

---

## 4. Modèle de données — FormDef

### 4.1 Table Grist `Formulaires`

| Colonne | Type | Rôle |
|---------|------|------|
| `Nom` | Text | Identifiant lisible |
| `FormId` | Text | Id stable (slug) |
| `Titre` | Text | Titre affiché |
| `TableCible` | Text | `tableId` Grist de destination des réponses |
| `Version` | Int | Incrémenté à chaque publish |
| `Def` | Text | **JSON FormDef** monolithique |
| `Statut` | Choice | `brouillon` \| `publie` |
| `PublishedSectionRef` | Int | Optionnel — dernière section custom publiée |
| `UpdatedAt` | DateTime | |

Une ligne = un formulaire. Pas de table Champs normalisée en v1.

### 4.2 Structure JSON FormDef

Contrat canonique formulaires. Vocabulaire aligné Survey Manifest : **`sections[].fields`** (alias export `questions` pour la projection SM). Champs métier Grist en plus (Ref, cascade, etc.).

```jsonc
{
  "manifest_version": "1.0.0",
  "id": "demande-exemple",
  "title": "Demande exemple",
  "description": "",
  "classification": "cerema_internal",
  "successMessage": "Merci !",
  "tableId": "Demandes",
  "composeMode": "bind",
  "sections": [
    {
      "id": "s1",
      "label": "Étape 1",
      "gate": null,
      "fields": [
        {
          "colId": "Nom",
          "label": "Nom",
          "type": "Text",
          "widget": "text",
          "required": true,
          "options": {},
          "condition": null,
          "cascade": null,
          "dynamicFilter": null,
          "profile": null,
          "theme": null,
          "polarity": ""
        }
      ]
    }
  ],
  "choices": {}
}
```

- `composeMode` : `"bind"` (colonnes déjà là) | `"ensureSchema"` (créer/aligner types manquants sur `tableId` avant publish / à la sauvegarde).
- `classification` : présent pour projection SM / offre-de-service.
- `theme` / `polarity` : optionnels (méta survey / dashboard) — ignorés par le moteur de fill s’ils sont vides.

### 4.3 Types & widgets (v1)

| Type Grist | Widget(s) | Notes |
|------------|-----------|--------|
| Text | `text`, `textarea` | |
| Int | `number`, `likert` | likert = profil survey |
| Numeric | `number` | step décimal |
| Bool | `checkbox` | |
| Date | `date` | écriture timestamp **secondes** |
| DateTime | `datetime` | idem |
| Choice | `select`, `radio` | choices depuis schéma ou FormDef |
| ChoiceList | `multiselect` | écriture `['L', …]` |
| Ref:T | `select` | + `refTable`, `visibleCol`, cascade |
| RefList:T | `multiselect` | |

**Hors v1** : Attachments, geojson / carte.

**Profils survey** (annotations, pas types de colonne) : `likert5`, `rank_place`, `polarity` (méta). Permettent l’export vers `SurveyManifest` sans forcer tous les forms métier dans le moule enquête.

### 4.4 Comportements

- `section.gate` : raccourci Survey — colId Bool ; équivalent à `condition: { field: gate, operator: "==", value: true }`. Une seule évaluation dans le moteur.
- `field.condition` : `{ field, operator, value }` (opérateurs selon type). Pas de `section.condition` parallèle hors gate (évite double sémantique).
- `field.cascade` : `{ parentField, parentRefCol }` — Ref→Ref (match sur **id**, pas sur index).
- `field.dynamicFilter` : `{ parentField, filterColumn }`.

**Un seul moteur** (`engine.js`) : preview builder + runtime publié (bundlé).

### 4.5 ensureSchema (mode composition) — dual du bind

Si le binding est **complet** (`colId` + `type` ; `refTable` pour Ref/RefList ; `choices` pour Choice/ChoiceList), le FormDef peut **driver le schéma** :

1. `bindingIsComplete(formDef)` valide le contrat.
2. Si la table `tableId` **n'existe pas** → `AddTable` avec toutes les colonnes projetées (`columnsFromFormDef`).
3. Si la table existe → pour chaque field, `AddColumn` manquant (+ `widgetOptions.choices` / intention Ref).
4. Types incompatibles → **erreur** (pas d'overwrite).

`bind` et `ensureSchema` sont la **même projection** dans les deux sens : données→formulaire vs formulaire→données.

### 4.6 Lien Survey Manifest / offre-de-service

- FormDef = **contrat canonique** formulaires produit ici.
- Survey Manifest = **projection / spécialisation** (enquête) : `formDefToSurveyManifest(def)` + inverse partielle quand les profils le permettent.
- Offre-de-service et composants **reprennent** ce contrat pour leurs briques — pas de second moteur de gates.
- Naming : côté code on peut documenter « FormDef (= forms contract) » ; la cible long terme dans cerema-offre-de-service peut adopter le même schéma ou un alias officiel — à coordonner sur `#survey-manifest` sans bloquer v1.

---

## 5. Flux utilisateur

1. Ouvrir le Builder (URL GH Pages) sur un doc Grist (accès full).
2. Choisir / créer une ligne `Formulaires` ; mode `bind` ou `ensureSchema`.
3. Composer sections & champs ; **preview live** = `engine.js`.
4. Enregistrer → `Def` JSON + méta (et ensureSchema si mode actif).
5. **Publier** → `CreateViewSection` + bundle `engine` + snapshot FormDef dans `_html`/`_js`.
6. Remplir la vue → `AddRecord` (+ horodatage / audit si colonnes présentes).
7. Republier pour propager toute évolution du FormDef (snapshot).

---

## 6. Structure projet (repo)

```
projects/grist_forms/
  CLAUDE.md
  builder.html
  runtime/
    engine.js             # 1 moteur (preview + bundle publish)
    formdef.schema.json
  shared/
    types.js
    publish.js            # CreateViewSection + freeze + bundle
    grist-bridge.js       # vendored / aligné artefactory
    survey-project.js     # formDefToSurveyManifest
  docs/
```

Publication GH Pages via le flux `published/` **uniquement sur demande explicite** (règle repo).

---

## 7. Critères de succès v1

- [x] Composer un form multi-étapes avec Ref + cascade + conditions, le sauver en table.
- [x] Preview builder = même moteur que le runtime.
- [x] ensureSchema crée les colonnes manquantes en mode dédié.
- [x] Publier une vue dans le même doc sans coller de HTML à la main.
- [x] Remplir → types Bool, Date/DateTime (ts s), ChoiceList, Ref, RefList corrects.
- [x] Runtime OK avec Pages / builder down (bundle).
- [x] Projection FormDef → SurveyManifest minimal (sections/gates/choices/profils).
- [x] UI DSFR (Marianne / fr-*).
- [x] I/O via contrat GristBridge (pas d’accès Grist ad hoc divergent).

*(Compléments livrés après v1 : UpdateRecord si ligne sélectionnée ; Attachments code + note CORS ; `visibleCol` méta.)*

---

## 8. Risques & mitigations

| Risque | Mitigation |
|--------|------------|
| WAF / taille options HTML | Pattern Artefactory apply depuis widget |
| Double logique builder/runtime | Un seul `engine.js` bundlé au publish |
| Drift FormDef vs survey_manifest.py | Projection testée + coord `#survey-manifest` |
| Accès non-full | `requiredAccess: 'full'` + message clair |
| Snapshot obsolète vs table | Republish obligatoire ; UI affiche Version |
| ensureSchema destructif | Refuse overwrite type incompatible |

---

## 9. Décisions actées

| # | Décision |
|---|----------|
| D1 | Périmètre = formulaires / collecte uniquement |
| D2 | Builder hébergé GH Pages (ce repo) |
| D3 | FormDef JSON monolithique en table `Formulaires` |
| D4 | Publish intra-doc figé + **bundle** moteur (pas de live-read table au fill) |
| D5 | Édition UpdateRecord : livré si ligne sélectionnée (hors v1 initiale, fait) |
| D6 | FormDef = essence ; SM / offre-de-service / composants reprennent |
| D7 | Attachments code livré (phase 2) ; upload custom CORS différé ; geo + BlockNote hors scope |
| D8 | Publish programmatique depuis le widget (oui) |
| D9 | GristBridge comme couche I/O |
| D10 | Modes `bind` + `ensureSchema` |
| D11 | `gate` = raccourci Bool ; pas de double condition de section |

---

## 10. Suite

Produit **terminé** en `projects/grist_forms/` (2026-07-26). Suite optionnelle :

1. Promote `published/grist_forms/` + `npm run manifest` **sur demande**.
2. Décision ops PJ (CORS / même origine / natif / relai).
3. Géo / BlockNote / collab = autres briques.
