# Dynamic Filter Ref (cas C) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Étendre `dynamicFilter` pour résoudre une colonne sur la ligne Ref parent (`parentResolve: "refRow"` + `parentValueColumn`) tout en gardant cascade et filtre Choice inchangés.

**Architecture:** `resolveParentFilterValue` dans `engine.js` ; schéma FormDef + UI builder quand parent = Ref ; tests unit + mount.

**Tech Stack:** JS vanilla UMD, `node --test`, FormDef JSON schema.

**Spec:** `docs/superpowers/specs/2026-07-27-grist-forms-dynamic-filter-ref-design.md`

## Global Constraints

- Rétrocompat : absence de `parentResolve` = comportement cas A (`"value"`)
- Cascade inchangé ; exclusif avec dynamicFilter
- Lookup / préremplir hors scope
- SM : ne pas projeter les nouveaux champs

---

## Task 1: Engine — resolveParentFilterValue + mount cas C

**Files:**
- Modify: `projects/grist_forms/runtime/engine.js`
- Modify: `projects/grist_forms/tests/engine.test.js`
- Modify: `projects/grist_forms/tests/engine-mount.test.js`
- Modify: `projects/grist_forms/runtime/formdef.schema.json`

- [ ] **Step 1:** Tests unitaires `resolveParentFilterValue` (value vs refRow ; id manquant → null) + mount cas C (Contacts Groupe)
- [ ] **Step 2:** Run tests → FAIL
- [ ] **Step 3:** Implémenter `resolveParentFilterValue` + brancher dans `resolveOptionsForField`
- [ ] **Step 4:** Étendre schéma `dynamicFilter` (`parentResolve`, `parentValueColumn`)
- [ ] **Step 5:** Run tests → PASS

## Task 2: Builder UI

**Files:**
- Modify: `projects/grist_forms/builder.html`

- [ ] **Step 1:** Si parent Ref → afficher select `parentValueColumn` ; poser `parentResolve: "refRow"`
- [ ] **Step 2:** Si parent non-Ref → `parentResolve: "value"`, retirer `parentValueColumn`
- [ ] **Step 3:** Hints / infobulles cas C ; validation toggle si parent Ref sans colonne

## Task 3: Docs + vérification

**Files:**
- Modify: `projects/grist_forms/docs/MANUAL_TEST.md`
- Modify: `projects/grist_forms/CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-07-27-grist-forms-dynamic-filter-ref-design.md` (statut)

- [ ] **Step 1:** Checklist MANUAL_TEST cas C
- [ ] **Step 2:** Mention CLAUDE.md
- [ ] **Step 3:** Suite tests complète `node --test projects/grist_forms/tests/*.test.js`
- [ ] **Step 4:** Spec statut → validé
