# Atlas — système Contrôles (spec unifiée)

**Date** : 2026-07-30  
**Statut** : **validé — implémentation C1–C5 en cours** (T1–T5 livrés 2026-07-30)  
**Projet** : `projects/Atlas/` (v7)  
**Remplace / absorbe** : `2026-07-30-atlas-controls-atelier-dock-design.md` (détail atelier/dock conservé ici)  
**Plan d’implémentation** : `docs/superpowers/plans/2026-07-30-atlas-controls-atelier-dock.md` (à aligner après validation)  
**Lié** : `2026-07-30-atlas-view-mobile-design.md`, `projects/qgis2grist/docs/SCENE-MANIFEST-v0.2.2.md`, `projects/Atlas/docs/BINDING-ATLAS-v7.md`

---

## 0. Objectif

Unifier **modèle**, **schéma**, **catalogue**, **composants UI** et **surfaces** (atelier, dock, lecture, récit) pour les contrôles Atlas — sans trois paradigmes parallèles.

**Succès** :
- L’éditeur active un contrôle → pastille carte + visible lecture (données) ou visible lecture (env).
- Même grammaire UI que le dock soleil existant (FAB 54px → capsule).
- Récit = rejeu d’état figé ; pastilles masquées en play.
- Mobile lecture : dock tactile obligatoire (pas HUD rect `#viewer-controls`).

---

## 1. Modèle mental & trois modes

### 1.1 Chaîne auteur

```
Activer contrôle (atelier)
    → manipuler sur canevas (dock)
    → capturer étape récit (valeurs non triviales dans step.state)
    → publier → lecteur explore (pastilles) et/ou joue récit (état figé)
```

### 1.2 Trois modes Atlas

| Mode | Atelier | Dock pastilles | Récit UI |
|------|---------|----------------|----------|
| **Édition** | Oui | Tous contrôles `active` (données) + outils env | Capture / preview |
| **Lecture exploration** | Non | Données `active` + env `visible` | FAB ▶ si étapes |
| **Présentation (play)** | Non | **Masqué** (`body.story-presenting`) | ◀ ▶ overlay |

### 1.3 Deux familles

| Famille | Rôle | Flag publication | Persistance |
|---------|------|------------------|-------------|
| **Données** | Filtrer / animer features d’une couche | `active` (un seul flag) | `Atlas_LayerPrefs` + SM |
| **Environnement** | Mise en scène widget (soleil, 2D/3D, fond) | `visible` (visible en lecture) | `Atlas_ScenePrefs.ViewerJSON` |
| **Navigation** | Pan, zoom, légende, cmdk, géoloc, FAB récit | Hors atelier publication | — |

**Décision actée** : pas de 2ᵉ flag `exposed` sur les données en V1. Créer/activer = outil éditeur + pastille + lecture.

**Décision actée** : env — en **édition**, soleil/view3d/basemap restent manipulables via dock/rail même si `visible: false` ; en **lecture**, dock filtré sur `visible: true` uniquement.

### 1.4 Exit play récit (V1)

**Décision actée** : à la sortie du play, **conserver la dernière scène affichée** (pas de restauration automatique de l’état pré-play). Restauration pré-play = V1.1 si besoin.

> **Écart code actuel** : `storyExit()` appelle encore `restorePreStorySnapshot()` — à modifier en **C3** (ou tâche dédiée récit) pour aligner D10.

---

## 2. Schéma données

### 2.1 Données — `layers[].controls[]` (ControlDeclarative SM V0.2.2)

```typescript
type DataControl = {
  field: string;
  type: 'select' | 'range' | 'time';  // V1
  label?: string;
  active?: boolean;   // défaut false à l'import SM
  variant?: 'checklist' | 'chips' | 'dropdown' | 'cutoff' | 'range' | 'play'; // Atlas prefs uniquement ; absent du SM V0.2.2
  min?: number;
  max?: number;
  dataMin?: number;
  dataMax?: number;
  values?: string[];
  mode?: 'simulation';  // range scénario flood — badge atelier, pas filtre attribut simple
};
```

**Règles** :
- Import SM : `active: false`.
- `Atlas_LayerPrefs` **écrase** le manifest (priorité user).
- Capture récit : `shouldCaptureControl` (existant) — valeurs non triviales dans `step.state.layers[].controls`.
- Lecture : pas d’écriture prefs ; valeurs session locales OK.

### 2.2 Environnement — `scene.viewerControls[]`

```typescript
type ViewerControl = {
  id: 'sun' | 'view3d' | 'basemap';
  type: 'sun' | 'view3d' | 'basemap';
  label?: string;
  visible: boolean;   // visible en lecture (UI : « Visible en lecture »)
  config?: {
    shadows?: boolean;           // sun
    allowedBasemaps?: string[];  // basemap — 2–3 ids max recommandé
  };
};
```

**Persistance** : table **`Atlas_ScenePrefs`**, colonne **`ViewerJSON`** (array sérialisé).

**État runtime** (existant) : `settings.timeOfDay`, `date`, `basemap`, pitch, terrain — pilotés par les slots ; capturés dans `step.state.settings` + caméra.

> **Note impl.** : le plan code peut utiliser le nom de champ `exposed` en interne pour env ; la spec produit retient **`visible`**.

### 2.3 Récit — `step.state`

```typescript
type StoryState = {
  camera?: { center: [number, number]; zoom?: number; pitch?: number; bearing?: number };
  // Atlas runtime (captureStoryState) — champs à la racine :
  projection?: string;
  timeOfDay?: number;
  date?: string;
  terrain3D?: boolean;
  // Export SM V0.2.2 peut aussi utiliser settings?: { projection, timeOfDay, date }
  layers: Array<{
    id?: string;
    name?: string;
    visible?: boolean;
    controls?: DataControl[];
    symbolization?: object;
    declarative?: object;
    controlDeclaratives?: object[];  // export interop Cerema (existant)
  }>;
};
```

> **Note** : le runtime Atlas sérialise `projection` / `timeOfDay` / `date` / `terrain3D` **à la racine** de `state` (voir `lib/story.js`). L’export SM peut normaliser vers `settings` — les deux formes doivent être acceptées à la lecture.

Play : applique `state` ; ignore le dock. Pastilles masquées.

### 2.4 Priorité sources

```
Scene Manifest (défauts import)
  ← Atlas_LayerPrefs (données user)
  ← Atlas_ScenePrefs (env user)
Récit step.state (snapshot ponctuel, indépendant du dock)
```

---

## 3. Catalogue contrôles

### 3.1 V1 — 6 kinds (à intégrer)

| Kind | Famille | Slot | Config atelier |
|------|---------|------|----------------|
| `select` | Données | checklist / chips / dropdown | label, active |
| `range` | Données | dual slider min–max | label, active |
| `time` | Données | cutoff ≤ date + ▶ play | label, active |
| `sun` | Env | date + arc + ombres (existant) | visible, ombres |
| `view3d` | Env | seg 2D \| 3D | visible |
| `basemap` | Env | chips fonds autorisés | visible, allowedBasemaps |

### 3.2 V1.1 — +2 types données

| Kind | Slot |
|------|------|
| `boolean` | switch (style `#shadow-toggle`) |
| `search` | mini cmdk 1 champ |

### 3.3 Hors pack publication (modules rail existants)

Symboliser, import, lieu, globe, exagération terrain, lat/lon libres, sky — **pas** pastilles lecture V1.

### 3.4 Hors V1 (cadré, pas implémenté)

Filtre multi-couches, cascading, proximité, swipe, URL state, pastille simulation dédiée, transitions récit (§10).

### 3.5 Auto-variantes (si `variant` absent)

| Type | Règle auto |
|------|------------|
| `select` | n ≤ 6 → chips/checklist dock ; n ≤ 20 → checklist atelier + dropdown dock ; n > 20 → non proposé atelier |
| `range` | `mode: simulation` → slider unique ; sinon dual min–max |
| `time` | défaut `cutoff` (≤ max) ; bouton play optionnel |

### 3.6 Time data ≠ Sun scène

**Décision actée** : deux contrôles distincts — `time` (filtre attribut) et `sun` (éclairage scène). Jamais une seule pastille combinée.

---

## 4. Atelier Contrôles (surface édition)

### 4.1 Structure (P2 scroll — **acté**)

```
🎛️ Contrôles
« Activé = pastille sur la carte et visible en lecture »

── Environnement ──
  Soleil      [Visible en lecture]  → si ON : ☐ Ombres
  Vue 2D/3D   [Visible en lecture]
  Fonds       [Visible en lecture]  → si ON : option-cards (fonds autorisés)

── Données · {couche} ──
  [select couche si >1]

  Actifs
    [label input]  🏷 type · field   [toggle ON]
    └─ preview config (mêmes widgets que dock, plus large)

  Disponibles
    [label]  type · field   [toggle OFF]
```

**Décision actée** : listing **par couche → par champ**, pas par type global. Regroupement **Actifs / Disponibles** **dans chaque couche**.

### 4.2 Interaction atelier

| Action | Effet |
|--------|-------|
| Toggle ON (données) | `active: true`, déplie config, crée pastille dock, save prefs |
| Toggle OFF | `active: false`, retire pastille, conserve config en prefs |
| Label éditable | Met à jour FAB title + dock |
| Toggle visible (env) | `visible: true/false`, save ScenePrefs, refresh dock |

### 4.3 Rail Soleil (**acté D4**)

Le rail **Soleil** reste un **raccourci édition** (panneau détaillé). Source de vérité publication = **atelier Env** + **dock**. Les deux restent synchronisés sur `settings`.

---

## 5. Dock pastilles (surface carte)

### 5.1 Coque (généralisation soleil existant)

```
Repos                         Ouvert (une capsule à la fois — acté D2)
[☀][🏷][▦]… scroll/wrap  →   ┌─────────────────────────────┐ [▼]
 54px FABs                     │ slot (h=54px, radius 27px) │
                               └─────────────────────────────┘
```

**Interaction** :
- Clic FAB → ouvre sa capsule, ferme les autres.
- Clic ▼ / repli → `collapsed` (localStorage `atlas_map_controls_collapsed`, existant).
- Mobile ≤720px : FABs scroll horizontal ; capsule `max-width: calc(100% - marges)` ; cibles ≥ 54px.

**Ordre pastilles (V1 fixe)** : env (`sun`, `view3d`, `basemap`) puis données par couche (`layerId:field`). Drag ordre = V1.1.

### 5.2 Affichage par mode

| Mode | Dock |
|------|------|
| Édition | Données `active` + env (soleil toujours utilisable) |
| Lecture | Données `active` + env `visible` seulement |
| Play | `display: none` (`story-presenting`) |

**Décision actée** : retirer `#viewer-controls` (HUD rect) ; dock seul en lecture.

---

## 6. Grammaire UI & fiches interaction

Primitives réutilisées (déjà dans `index_v7.html` / `app_v7.js`) :

| Primitive | CSS / id | Usage |
|-----------|----------|-------|
| Toggle | `.toggle` | active / visible |
| Toggle bouton | `#shadow-toggle` | bool inline |
| Chips / seg | `.chip`, `.seg` | view3d, basemap |
| Option cards | `.option-card` | basemap atelier |
| Checklist | `.cats`, `.cat-row` | select |
| Range | `input.rng` | range, time |
| Arc drag | `#sun-arc` | sun uniquement |
| Seg-inline | `.seg-inline` | valeurs live date/heure |
| Btn soft | `.btn-soft` | ▶ animer time |

### 6.1 `select`

| Surface | Affichage | Interaction |
|---------|-----------|-------------|
| Atelier | `.cats` + compteurs | cocher → filtre immédiat → save prefs |
| Dock ≤6 | chips ou mini-checklist scroll 120px | idem, session en lecture |
| Dock 7–20 | dropdown ou popover checklist | 1 tap ouvre |

### 6.2 `range`

| Surface | Affichage | Interaction |
|---------|-----------|-------------|
| Atelier | 2× `.rng` + lo→hi | oninput → filtre + labels mono |
| Dock | dual thumb compact ou 2 sliders empilés mobile | idem |
| simulation | 1 slider + badge | scénario unique |

### 6.3 `time` (données)

| Surface | Affichage | Interaction |
|---------|-----------|-------------|
| Atelier | ≤ date + 1 `.rng` + ▶ Animer | scrub ; play animation |
| Dock | seg-inline date + slider court | idem |

### 6.4 `sun`

| Surface | Affichage | Interaction |
|---------|-----------|-------------|
| Atelier | visible + ombres | preview via dock |
| Dock | **existant** : date, arc drag, altitude, ombres | drag arc, toggle ombres |

### 6.5 `view3d`

| Surface | Affichage | Interaction |
|---------|-----------|-------------|
| Atelier | visible | — |
| Dock | chips **2D \| 3D** | pitch 0 / 55 |

### 6.6 `basemap`

| Surface | Affichage | Interaction |
|---------|-----------|-------------|
| Atelier | visible + option-cards fonds autorisés | multi-select 2–3 |
| Dock | chips horizontaux | `setBasemap` si autorisé |

---

## 7. Composants code (cible implémentation)

| Module | Rôle |
|--------|------|
| `lib/controls.js` | Données : types, filtres, prefs, capture (existant, étendu) |
| `lib/viewer-controls.js` | Env : catalogue, serialize/parse, defaults |
| `lib/scene-prefs.js` | `Atlas_ScenePrefs` ensure/load/save |
| `lib/control-slots.js` | **Nouveau** : `renderControlSlot(type, variant, ctx, surface: 'atelier'|'dock')` |
| `lib/control-dock.js` | **Nouveau** : FABs, open/close, ordre, `refreshControlsDock()` |
| `app_v7.js` | `renderControles()`, wiring modes, story play |

**Décision actée** : même handler filtre/settings pour atelier et dock ; seul le template change (`surface`).

---

## 8. Mobile (lecture — acté D7)

- Dock : scroll horizontal FABs ; une capsule ; pas de hover-only.
- Légende + FAB récit non masqués.
- Critère bees : `?mode=view` mobile — ≥1 contrôle données + ≥1 env manipulables.

---

## 9. Phasage

| Phase | Contenu |
|-------|---------|
| **C0** | Cadrage (ce doc) — validation utilisateur |
| **C1** | Atelier P2 + libellé « Visible en lecture » + sections Env stub |
| **C2** | `viewer-controls.js` + `Atlas_ScenePrefs` + sun `visible` en lecture |
| **C3** | Dock multi-pastilles données + kill `#viewer-controls` |
| **C4** | Pastilles view3d + basemap |
| **C5** | Transitions récit `cut` / `ease` / `morph` (schéma + suggestion) |
| **C6** | V1.1 : boolean + search |

---

## 10. Transitions récit (V+ — hors V1 impl.)

Vocabulaire acté : `cut` | `ease` | `morph`. Champ optionnel :

```typescript
steps[].transition?: { profile: 'cut' | 'ease' | 'morph'; durationMs?: number };
```

Suggestion semi-auto via `suggestTransitionProfile(stateA, stateB)` à la capture.

---

## 11. Décisions actées (ex « à confirmer »)

| # | Sujet | Décision |
|---|-------|----------|
| D1 | Atelier layout | P2 scroll Env + Données |
| D2 | Dock | Une capsule ouverte à la fois |
| D3 | Prefs env | `Atlas_ScenePrefs` + `ViewerJSON` |
| D4 | Rail Soleil | Raccourci conservé ; vérité = atelier Env + dock |
| D5 | Play récit | Pastilles masquées |
| D6 | Transitions | Vocabulaire cut/ease/morph (C5) |
| D7 | Mobile lecture | Dock pastilles tactile |
| D8 | Flag données | Un seul : `active` |
| D9 | Listing atelier | Par couche, actifs/dispos, badge type |
| D10 | Exit play | Garder dernière scène (V1) |
| D11 | Time vs sun | Deux contrôles distincts |
| D12 | HUD lecture | Supprimé au profit du dock |

---

## 12. Critères d’acceptation (implémentation)

- [ ] Atelier : Env + Données, actifs/dispos par couche, labels éditables
- [ ] Toggle `active` ↔ pastille dock (données)
- [ ] Toggle `visible` ↔ pastille dock (env) en lecture seulement si visible
- [ ] Dock : 6 kinds V1, une capsule, mobile OK
- [ ] Play : dock masqué ; exit garde dernière scène
- [ ] `#viewer-controls` retiré ou inactif
- [ ] `node --test projects/Atlas/tests/*.test.js` vert (bees non régressé)
- [ ] Manuel bees : select Apiary + sun en édition et lecture mobile

---

## 13. Self-review

| Check | Statut |
|-------|--------|
| Modèle 3 modes cohérent avec lecture V0 | OK |
| Schéma données vs env séparé | OK |
| 1 flag données | OK |
| 6 fiches interaction + variantes | OK |
| Tous points « à confirmer » fermés | OK (§11) |
| Hors scope explicite | OK (§3.3–3.4, §10) |
| Pas de TBD bloquant implémentation C1–C4 | OK |

**Reste avant figement** : validation explicite utilisateur de ce document.

---

## 14. Références

- SM : `projects/qgis2grist/docs/SCENE-MANIFEST-v0.2.2.md`
- Binding : `projects/Atlas/docs/BINDING-ATLAS-v7.md`
- Lecture : `docs/superpowers/specs/2026-07-30-atlas-view-mobile-design.md`
- Code existant : `renderControlBody`, `#map-controls-dock`, `#sun-arc`
