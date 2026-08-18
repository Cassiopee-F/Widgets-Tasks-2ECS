# Atlas viewMode + mobile lecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mode lecture Atlas (URL + droits) et UI mobile lecture ≤720px, sans régression édition bureau.

**Architecture:** Module pur `lib/view-mode.js` (parse URL, intent d’accès, garde écriture) branché dans `app_v7.js` ; classes CSS `body.view-mode` / `body.mobile-layout` dans `index_v7.html` ; writes Grist gated ; no-op dans `grist-sync` / `story` si view.

**Tech Stack:** HTML/CSS/JS vanilla, Grist Plugin API, MapLibre, Node test runner

**Spec:** `docs/superpowers/specs/2026-07-30-atlas-view-mobile-design.md`

## Global Constraints

- Développer uniquement dans `projects/Atlas/` — ne pas toucher `published/` sans demande
- Un seul widget ; `?mode=view|lecture|edit` + auto droits
- Filtres/visibilité en view = session only (pas `saveLayerPref`)
- Breakpoint mobile : `max-width: 720px`
- Messages UI en français
- Cache-bust query sur imports lib si version bumpée

---

### Task 1: Module `view-mode.js` + tests

**Files:**
- Create: `projects/Atlas/lib/view-mode.js`
- Create: `projects/Atlas/tests/view-mode.test.js`

**Interfaces:**
- Produces: `parseAtlasMode(search)` → `'view'|'edit'|'auto'`
- Produces: `accessIntentFromMode(mode)` → `{ viewModeForced, preferFull, requiredAccess }`
- Produces: `shouldEnableLight3d({ viewMode, no3dParam, isNarrow, hardwareConcurrency })` → boolean
- Produces: `canWrite(viewMode)` → boolean

- [ ] **Step 1:** Écrire tests (parse view/lecture/edit/absent ; light3d ; canWrite)
- [ ] **Step 2:** Implémenter `lib/view-mode.js`
- [ ] **Step 3:** `node --test "projects/Atlas/tests/view-mode.test.js"` vert

---

### Task 2: Brancher viewMode dans `app_v7.js` / initGrist

**Files:**
- Modify: `projects/Atlas/app_v7.js` (CONFIG, initGrist, assertCanWrite)
- Modify: `projects/Atlas/lib/grist-sync.js` (`saveLayerPref`, `ensureAtlasPrefsTable` early return)
- Modify: `projects/Atlas/lib/story.js` (`saveStoryToGrist` early return)

**Interfaces:**
- Consumes: `parseAtlasMode`, `accessIntentFromMode` from view-mode.js
- Produces: `CONFIG.viewMode`, `CONFIG.light3d`, `assertCanWrite(label)`, `applyViewModeChrome()`

- [ ] **Step 1:** `CONFIG.viewMode = false`, `CONFIG.light3d`, parse URL au boot
- [ ] **Step 2:** `initGrist` selon intent (read table si view forcé ; full puis fallback read table)
- [ ] **Step 3:** `assertCanWrite` avant saves ; passer viewMode aux libs sync/story
- [ ] **Step 4:** Sur échec `applyUserActions`, basculer viewMode + toast (fallback runtime)
- [ ] **Step 5:** Tests Atlas existants toujours verts

---

### Task 3: Chrome UI lecture + badge

**Files:**
- Modify: `projects/Atlas/index_v7.html` (badge, classes body)
- Modify: `projects/Atlas/app_v7.js` (`applyViewModeChrome`, masquer actions écriture)

- [ ] **Step 1:** Badge « Lecture » dans topbar
- [ ] **Step 2:** `body.view-mode` : masquer boutons save story / link table / édition destructive
- [ ] **Step 3:** Modules rail édition désactivés ou toast si view

---

### Task 4: Layout mobile ≤720px

**Files:**
- Modify: `projects/Atlas/index_v7.html` (CSS `@media`, bottom nav markup)
- Modify: `projects/Atlas/app_v7.js` (toggle mobile-layout, géoloc, sheet)

- [ ] **Step 1:** CSS : rail → bottom nav ; panneau en sheet ; inspecteur bottom sheet ; dock pastille
- [ ] **Step 2:** Markup `#mobile-nav` Carte / Couches / Récit
- [ ] **Step 3:** `matchMedia('(max-width:720px)')` → `body.mobile-layout` ; GeolocateControl
- [ ] **Step 4:** `?no3d=1` + heuristique light3d

---

### Task 5: Docs

**Files:**
- Modify: `projects/Atlas/docs/MANUAL_TEST.md`
- Modify: `projects/Atlas/CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-07-30-atlas-view-mobile-design.md` (statut validé)

- [ ] **Step 1:** Cases manuels view + mobile
- [ ] **Step 2:** CLAUDE état modes
- [ ] **Step 3:** Spec statut → validé pour implémentation / done

---

### Task 6: Vérification

- [ ] `node --test "projects/Atlas/tests/*.test.js"`
- [ ] Checklist acceptation spec §9 (hors Grist réel si indispo : noter)

**Commit:** uniquement si l’utilisateur le demande.
