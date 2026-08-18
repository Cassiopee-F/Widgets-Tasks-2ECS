# Atlas — Contrôles atelier + dock pastilles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unifier la publication des contrôles (données + environnement) via un atelier lisible et un dock pastilles (cercle → capsule), en respectant exploration vs présentation récit.

**Architecture:** Modèle pur `lib/viewer-controls.js` (`scene.viewerControls` + helpers) ; persistance `Atlas_ScenePrefs` ; atelier `renderControles()` sectionné (Env + Données) ; dock multi-pastilles généralisant `#map-controls-dock` ; lecture = pastilles données `active` + env `visible` hors play ; play récit = pastilles masquées ; transitions `cut|ease|morph` en dernière vague.

**Tech Stack:** HTML/CSS/JS vanilla, Grist Plugin API, MapLibre, Node `node --test`

**Specs:**
- `docs/superpowers/specs/2026-07-30-atlas-controls-system-design.md` (**référence unique**)
- `docs/superpowers/specs/2026-07-30-atlas-view-mobile-design.md` (lecture V0 déjà en place)

## Global Constraints

- Développer uniquement dans `projects/Atlas/` — **pas** de `published/` sans demande explicite
- Messages UI / commentaires en **français**
- **Commit uniquement si l’utilisateur le demande** (ignorer les steps « Commit » sinon)
- TDD : test rouge → code → vert pour chaque module pur
- Cache-bust `?v=` sur `index_v7.html` + imports à chaque livraison testable
- En **présentation** récit : pastilles masquées par défaut
- Données : `layer.controls[].active` = pastille + lecture
- Env : `viewerControls[].visible` (UI « Visible en lecture » ; code peut alias `exposed`)
- Prefs scène : table **`Atlas_ScenePrefs`** (colonne `ViewerJSON`) — ne pas polluer `layers[].controls`
- Dock : **une capsule ouverte à la fois**
- Atelier : page unique scroll **P2** (Env puis Données)
- **Lecture + mobile** : contrôles display (pastilles `exposed`/`active`) utilisables ≤720px — pas de solution bureau-only
- Ne pas casser bees : `node --test projects/Atlas/tests/*.test.js` vert après chaque task code

### Décisions verrouillées (2026-07-30)

| # | Décision |
|---|----------|
| D1 | P2 atelier scroll Env + Données |
| D2 | Une capsule ouverte à la fois |
| D3 | `Atlas_ScenePrefs` + `ViewerJSON` |
| D4 | Rail Soleil **conservé** en édition comme raccourci ; source de vérité = atelier Env + dock |
| D5 | Play récit → pastilles off |
| D6 | Transitions : vocabulaire `cut` / `ease` / `morph` (Task 8) |
| D7 | Contrôles display lecture **compatibles mobile** (dock pastilles, pas HUD rect) |
| D8 | Données : **un seul flag** `active` |
| D9 | Atelier : par couche, actifs/dispos |
| D10 | Exit play : garder dernière scène (V1) |
| D11 | `time` data ≠ `sun` scène |
| D12 | Supprimer HUD `#viewer-controls` |

**Figement** : après validation utilisateur de `2026-07-30-atlas-controls-system-design.md` §13.

### Fichiers (carte)

| Fichier | Rôle |
|---------|------|
| `lib/viewer-controls.js` | Catalogue Env, defaults, serialize/parse, suggestTransition |
| `lib/scene-prefs.js` | ensure/load/save `Atlas_ScenePrefs` |
| `lib/controls.js` | contrat données (évent. helper label) |
| `app_v7.js` | atelier, dock, wiring viewMode / story play |
| `index_v7.html` | CSS dock multi-FAB, atelier |
| `tests/viewer-controls.test.js` | unit |
| `tests/scene-prefs.test.js` | unit payload |
| `docs/MANUAL_TEST.md` | cases C1–C5 |

---

### Task 0: Baseline lecture (smoke, pas de code)

**Files:** aucune

- [x] **Step 1:** Servir `projects/` si besoin
- [x] **Step 2:** Smoke Chrome standalone `?v=20260730j&mode=view` — OK (badge Lecture, HUD/export/dock masqués, légende ciblage)
- [x] **Step 3:** Grist Atlas (copy) bees chargé en **édition** (rail auteur + Contrôles Apiary) ; lecture Grist nécessite URL widget `mode=view` (à vérifier manuellement / config Custom Widget)

---

### Task 1: Modèle `viewer-controls.js` + tests

**Files:**
- Create: `projects/Atlas/lib/viewer-controls.js`
- Create: `projects/Atlas/tests/viewer-controls.test.js`

**Interfaces:**
- Produces: `createDefaultViewerControls()` → `[{ id, type, label, exposed, config }]`
- Produces: `getViewerControl(list, id)`
- Produces: `setViewerExposed(list, id, exposed)`
- Produces: `listExposedViewerControls(list)`
- Produces: `serializeViewerControls(list)` / `parseViewerControls(raw)`
- Produces: `suggestTransitionProfile(stateA, stateB)` → `'cut'|'ease'|'morph'`

- [ ] **Step 1: Écrire les tests**

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultViewerControls,
  setViewerExposed,
  listExposedViewerControls,
  parseViewerControls,
  serializeViewerControls,
  suggestTransitionProfile,
} from '../lib/viewer-controls.js';

describe('viewer-controls', () => {
  it('defaults: sun/view3d/basemap non exposés', () => {
    const list = createDefaultViewerControls();
    assert.deepEqual(list.map((c) => c.id), ['sun', 'view3d', 'basemap']);
    assert.equal(listExposedViewerControls(list).length, 0);
  });

  it('setViewerExposed sun', () => {
    const list = createDefaultViewerControls();
    setViewerExposed(list, 'sun', true);
    assert.equal(list.find((c) => c.id === 'sun').exposed, true);
  });

  it('parse merge catalogue + ignore ids inconnus', () => {
    const list = parseViewerControls([{ id: 'sun', exposed: true }, { id: 'hack', exposed: true }]);
    assert.equal(list.find((c) => c.id === 'sun').exposed, true);
    assert.ok(!list.find((c) => c.id === 'hack'));
    assert.equal(list.length, 3);
  });

  it('serialize round-trip', () => {
    const list = createDefaultViewerControls();
    setViewerExposed(list, 'basemap', true);
    list.find((c) => c.id === 'basemap').config = { allowed: ['osm', 'sat'] };
    const again = parseViewerControls(serializeViewerControls(list));
    assert.equal(again.find((c) => c.id === 'basemap').exposed, true);
    assert.deepEqual(again.find((c) => c.id === 'basemap').config.allowed, ['osm', 'sat']);
  });

  it('suggestTransitionProfile: gros set couches → cut', () => {
    const a = { layers: [{ id: 'A', visible: true }], camera: { zoom: 10 }, settings: {} };
    const b = { layers: [{ id: 'B', visible: true }], camera: { zoom: 10 }, settings: {} };
    assert.equal(suggestTransitionProfile(a, b), 'cut');
  });

  it('suggestTransitionProfile: même couches, caméra change → ease', () => {
    const layers = [{ id: 'A', visible: true, controls: [] }];
    const a = { layers, camera: { zoom: 10, center: [0, 0], pitch: 0, bearing: 0 }, settings: { timeOfDay: 720 } };
    const b = { layers, camera: { zoom: 14, center: [1, 1], pitch: 55, bearing: 20 }, settings: { timeOfDay: 900 } };
    assert.equal(suggestTransitionProfile(a, b), 'ease');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
node --test "projects/Atlas/tests/viewer-controls.test.js"
```

- [ ] **Step 3: Implémenter `lib/viewer-controls.js`**

```js
/** Contrôles environnement / widget — scene.viewerControls */
export function createDefaultViewerControls() {
  return [
    { id: 'sun', type: 'sun', label: 'Soleil & date', exposed: false, config: { shadows: true } },
    { id: 'view3d', type: 'view3d', label: 'Vue 2D / 3D', exposed: false, config: {} },
    { id: 'basemap', type: 'basemap', label: 'Fonds de plan', exposed: false, config: { allowed: [] } },
  ];
}

export function getViewerControl(list, id) {
  return (list || []).find((c) => c.id === id);
}

export function setViewerExposed(list, id, exposed) {
  const c = getViewerControl(list, id);
  if (c) c.exposed = !!exposed;
  return list;
}

export function listExposedViewerControls(list) {
  return (list || []).filter((c) => c.exposed);
}

export function serializeViewerControls(list) {
  return (list || []).map((c) => ({
    id: c.id,
    type: c.type,
    label: c.label,
    exposed: !!c.exposed,
    config: c.config ? { ...c.config } : {},
  }));
}

export function parseViewerControls(raw) {
  const base = createDefaultViewerControls();
  if (!Array.isArray(raw)) return base;
  for (const decl of raw) {
    const c = base.find((x) => x.id === decl.id);
    if (!c) continue;
    if (decl.exposed != null) c.exposed = !!decl.exposed;
    if (decl.label) c.label = String(decl.label);
    if (decl.config && typeof decl.config === 'object') c.config = { ...c.config, ...decl.config };
  }
  return base;
}

/** Heuristique V+ — profil transition entre deux états récit. */
export function suggestTransitionProfile(stateA, stateB) {
  const idsA = new Set((stateA?.layers || []).map((l) => l.id));
  const idsB = new Set((stateB?.layers || []).map((l) => l.id));
  let same = idsA.size === idsB.size;
  if (same) for (const id of idsA) if (!idsB.has(id)) same = false;
  if (!same) return 'cut';
  const ca = stateA?.camera || {};
  const cb = stateB?.camera || {};
  const camDelta = Math.abs((ca.zoom || 0) - (cb.zoom || 0)) > 0.3
    || Math.abs((ca.pitch || 0) - (cb.pitch || 0)) > 5
    || Math.abs((ca.bearing || 0) - (cb.bearing || 0)) > 5;
  const ctrlTouch = (stateA?.layers || []).some((l) => {
    const o = (stateB?.layers || []).find((x) => x.id === l.id);
    return JSON.stringify(l.controls || []) !== JSON.stringify(o?.controls || []);
  });
  if (ctrlTouch && camDelta) return 'morph';
  if (camDelta || (stateA?.settings?.timeOfDay !== stateB?.settings?.timeOfDay)) return 'ease';
  return 'cut';
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
node --test "projects/Atlas/tests/viewer-controls.test.js"
```

---

### Task 2: `scene-prefs.js` (persist ViewerJSON)

**Files:**
- Create: `projects/Atlas/lib/scene-prefs.js`
- Create: `projects/Atlas/tests/scene-prefs.test.js`
- Modify: `projects/Atlas/app_v7.js` — `STATE.viewerControls`, sync après story

**Interfaces:**
- Consumes: `serializeViewerControls` / `parseViewerControls`
- Produces: `ATLAS_SCENE_PREFS_TABLE = 'Atlas_ScenePrefs'`
- Produces: `prefsPayloadFromViewerControls(list)` → `{ ViewerJSON }`
- Produces: `viewerControlsFromPrefsRow(col, i)` → list
- Produces: `async ensureScenePrefsTable(docApi, { viewMode })`
- Produces: `async loadScenePrefs(docApi)` → `{ viewerControls }`
- Produces: `async saveScenePrefs(docApi, { viewerControls }, { viewMode })`

- [ ] **Step 1: Tests payload**

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { viewerControlsFromPrefsRow, prefsPayloadFromViewerControls } from '../lib/scene-prefs.js';
import { createDefaultViewerControls, setViewerExposed } from '../lib/viewer-controls.js';

describe('scene-prefs payload', () => {
  it('round-trip ViewerJSON', () => {
    const list = createDefaultViewerControls();
    setViewerExposed(list, 'sun', true);
    const payload = prefsPayloadFromViewerControls(list);
    assert.equal(typeof payload.ViewerJSON, 'string');
    const back = viewerControlsFromPrefsRow({ ViewerJSON: [payload.ViewerJSON] }, 0);
    assert.equal(back.find((c) => c.id === 'sun').exposed, true);
  });
});
```

- [ ] **Step 2: Implémenter `scene-prefs.js`**

Pattern calqué sur `lib/story.js` : `viewMode` → no-op save ; ensure `AddTable` ; load première ligne `fetchTable` ; save Replace/Add. Colonne unique `ViewerJSON` (Text) contenant `JSON.stringify(serializeViewerControls(...))`.

- [ ] **Step 3: Brancher `app_v7.js`**

```js
viewerControls: createDefaultViewerControls(),

async function syncScenePrefsFromGrist() {
  if (!CONFIG.grist.ready) return;
  const prefs = await loadScenePrefs(grist.docApi);
  STATE.viewerControls = prefs.viewerControls || createDefaultViewerControls();
}

async function persistScenePrefs() {
  if (!CONFIG.grist.ready || CONFIG.viewMode) return;
  await saveScenePrefs(grist.docApi, { viewerControls: STATE.viewerControls }, { viewMode: false });
}
```

Appeler `syncScenePrefsFromGrist` après `syncStoryFromGrist` dans `initGrist`.

- [ ] **Step 4: Suite tests**

```bash
node --test "projects/Atlas/tests/scene-prefs.test.js" "projects/Atlas/tests/viewer-controls.test.js"
node --test "projects/Atlas/tests/*.test.js"
```

---

### Task 3: Atelier Contrôles C1 (UI Env + Données)

**Files:**
- Modify: `projects/Atlas/app_v7.js` — `renderControles()`, API `A.setViewerExposed`, `A.setControlLabel`
- Modify: `projects/Atlas/index_v7.html` — CSS atelier si besoin
- Cache-bust → `20260730k` (incrémenter à chaque livraison)

**Interfaces:**
- Consumes: `STATE.viewerControls`, `setViewerExposed`, `persistScenePrefs`
- Produces: UI P2 ; Env toggles ; Données actifs en tête + label éditable

- [ ] **Step 1: Remplacer `renderControles()`**

Structure :

1. Hint : « Outils de mise en scène… puis capturez une étape de récit. »
2. Section **Environnement** — lignes sun / view3d / basemap (toggle `exposed` + sous-config)
3. Section **Données** — select couche ; champs actifs puis disponibles ; badge type ; `mode: simulation` badge

Env `sun` ON → checkbox ombres → `config.shadows`.  
Env `basemap` ON → multi-check clés `BASEMAPS` → `config.allowed` (toast si >3).

- [ ] **Step 2: API**

```js
setViewerExposed(id, on) {
  if (!assertCanWrite('modifier les contrôles scène')) return;
  setViewerExposedFn(STATE.viewerControls, id, on);
  persistScenePrefs();
  refreshControlsDock();
  if (STATE.currentModule === 'controles') renderControles();
},
setControlLabel(layerId, field, label) { /* markDirty + saveLayerPref */ },
```

- [ ] **Step 3: Manuel bees** — panneau lisible ; toggle sun ; reload conserve.

---

### Task 4: Dock soleil + `exposed` en lecture

**Files:**
- Modify: `app_v7.js` — `refreshControlsDock()` (sun only)
- Modify: `index_v7.html` — CSS view-mode dock

- [ ] **Step 1: CSS**

```css
body.view-mode #map-controls-dock:not(.has-pills) { display: none !important; }
body.view-mode #map-controls-dock.has-pills { display: flex !important; }
body.story-presenting #map-controls-dock { display: none !important; }
```

Retirer le `body.view-mode #map-controls-dock { display: none !important; }` absolu actuel.

- [ ] **Step 2: Logique**

```js
// Édition : dock sun toujours dispo (outil auteur)
// Lecture : dock sun seulement si exposed
const showSunPill = !CONFIG.viewMode || !!getViewerControl(STATE.viewerControls, 'sun')?.exposed;
```

`has-pills` si showSunPill (Task 4) ; données = Task 6.

- [ ] **Step 3: Manuel** — view sans exposed → pas dock ; avec sun exposed → dock.

---

### Task 5: Masquer pastilles pendant play récit

**Files:**
- Modify: `app_v7.js` — `enterStoryPresentation` / `storyExit` (ou équivalent)

- [ ] **Step 1:** `document.body.classList.add('story-presenting')` à l’entrée ; `remove` à la sortie ; `refreshControlsDock()`.
- [ ] **Step 2:** Manuel — play → dock off ; exit → dock selon règles.

---

### Task 6: Dock multi-pastilles données + kill HUD rect

**Files:**
- Modify: `app_v7.js` — dock complet ; `refreshViewerControlsHud` → no-op
- Modify: `index_v7.html` — `#dock-fabs` + panel slot

**Interfaces:**
- Pastille data si `c.active` ; slot = `renderControlBody`
- Une capsule ouverte (`openDockPill(id)`)
- Ordre : viewer ids puis `layerId:field`

- [ ] **Step 1: Refactor markup dock** — FABs dynamiques ; sun strip = `renderSunSlot()` JS.
- [ ] **Step 2: Wiring open/close** ; **mobile ≤720px obligatoire** (dock wrap/scroll, une capsule, pas de HUD rect).
- [ ] **Step 3: Ne plus remplir `#viewer-controls`** (ou `display:none`).
- [ ] **Step 4: Manuel bees** — 2 pastilles (sun + select) ; lecture bureau **et** mobile OK.

---

### Task 7: Pastilles `view3d` + `basemap`

**Files:**
- Modify: `app_v7.js` — `renderView3dSlot`, `renderBasemapSlot`

- [ ] **Step 1: view3d** — seg 2D (pitch 0) / 3D (pitch 55) ; session en lecture.
- [ ] **Step 2: basemap** — chips `config.allowed` ; si vide → toast éditeur.
- [ ] **Step 3: Tests manuels + unit suite.**

---

### Task 8: Transitions récit

**Files:**
- Modify: `lib/story.js` — champ `transition` à la capture
- Modify: `app_v7.js` — `applyStoryState` / capture
- Test: déjà `suggestTransitionProfile` (Task 1)

- [ ] **Step 1: Capture**

```js
transition: {
  profile: prev ? suggestTransitionProfile(prev.state, newState) : 'cut',
  durationMs: 1500,
}
```

- [ ] **Step 2: Apply** — `cut` → `jumpTo` ; `ease`/`morph` → `flyTo` + apply state (morph = même chemin V1).
- [ ] **Step 3: Optionnel** — select profil dans panneau Récit par étape.
- [ ] **Step 4: Manuel** — 2 étapes, play.

---

### Task 9: Docs

**Files:**
- Modify: `projects/Atlas/docs/MANUAL_TEST.md`
- Modify: `projects/Atlas/CLAUDE.md`
- Modify: spec controls — statut partiel

- [ ] **Step 1:** Cases manuelles atelier / dock / play / transitions.
- [ ] **Step 2:** `node --test projects/Atlas/tests/*.test.js`
- [ ] **Step 3:** Documenter cache-bust final.

---

## Self-review (plan vs spec)

| Spec | Task |
|------|------|
| Atelier P2 Env + Données | T3 |
| Labels / actifs en tête | T3 |
| `scene.viewerControls` + prefs | T1–T2 |
| Dock pastilles | T4 / T6 |
| Une capsule | T6 |
| Lecture exposed | T4 / T6 |
| Play pastilles off | T5 |
| sun / view3d / basemap | T4 / T7 |
| Données → pastille | T6 |
| Kill HUD rect | T6 |
| Transitions | T8 |
| booléen / search / swipe | hors plan (V1.1) |
| Promote / popup | hors-V0 |

## Ordre optimal

```
T0 → T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9
```
