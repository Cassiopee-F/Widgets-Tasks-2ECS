# Grist Forms Phase 2 — Plan d’implémentation

> **For Claude:** exécuter les tâches dans l’ordre ; TDD sur les modules purs.

**Goal :** Contrat Survey Manifest versionné + Attachments bout-en-bout.

**Architecture :** FormDef canonique → projection SM ; upload PJ via access token Grist ; bundle publish = bridge + types + attachments + engine.

## Task 1 : Projection SM enrichie

- Étendre `survey-project.js` : types date/number/attachment, required, gate, condition, grist meta Ref
- Ajouter `surveyManifestToFormDef` partiel
- Schéma `runtime/survey-manifest.schema.json`
- Tests dans `tests/survey-project.test.js`

## Task 2 : Types + Attachments helper

- `types.js` : widget `file`, coerce Attachments → `['L', …ids]`
- `shared/attachments.js` : `normalizeUploadResponse`, `uploadFiles`, `resolveAttachmentFields`
- Tests `types` + `attachments`

## Task 3 : Engine + ensureSchema + UX + builder + publish

- Widget file, lecture File[], resolve avant submit
- ensureSchema / ux / GRIST_TYPES / bundle attachmentsJs
- Tests engine render file + ensureSchema Attachments
- MAJ CLAUDE.md
