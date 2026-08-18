# Grist Form Builder v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer un Form Builder GH Pages + FormDef en table + publish intra-doc bundlé, essence formulaires alignée GristBridge / Survey Manifest.

**Architecture:** Modules JS purs (UMD) testables en Node — `types`, `engine`, `survey-project`, `ensure-schema`, `publish` — consommés par `builder.html`. Publish fige runtime (`engine` + snapshot FormDef + bridge) via `CreateViewSection` + custom-widget-builder (`_html`/`_js`).

**Tech Stack:** HTML/JS vanilla, DSFR CDN, `grist-plugin-api.js`, GristBridge (vendor artefactory), Node `assert` / `node --test` pour les modules purs.

**Spec:** `docs/superpowers/specs/2026-07-26-grist-forms-builder-design.md`

## Global Constraints

- Développer uniquement dans `projects/grist_forms/` — **ne pas** toucher `published/` sans demande explicite de publication.
- Accès Grist builder : `requiredAccess: 'full'`.
- Collecte v1 : `AddRecord` seulement (pas `UpdateRecord`).
- Publish : `applyUserActions` uniquement sur `_grist_Views*` — jamais REST PATCH.
- Dates Grist en **secondes** Unix ; ChoiceList/RefList préfixe `['L', …]`.
- Un seul moteur : `runtime/engine.js` (preview = runtime bundlé).
- UI : français ; commentaires FR ; classes DSFR (`fr-*`) préférées au skin custom.
- Commits git : **uniquement si l’utilisateur le demande** (ne pas committer spontanément).

## File map

| Fichier | Responsabilité |
|---------|----------------|
| `projects/grist_forms/CLAUDE.md` | Contexte agent / état / liens spec |
| `projects/grist_forms/runtime/formdef.schema.json` | Contrat JSON FormDef (documentation machine) |
| `projects/grist_forms/shared/grist-bridge.js` | Vendor I/O Grist (copie artefactory) |
| `projects/grist_forms/shared/types.js` | Mapping type↔widget↔valeur écriture |
| `projects/grist_forms/runtime/engine.js` | Conditions, rendu DOM, collect/submit payload |
| `projects/grist_forms/shared/survey-project.js` | `formDefToSurveyManifest` |
| `projects/grist_forms/shared/ensure-schema.js` | Diff colonnes + actions AddColumn |
| `projects/grist_forms/shared/publish.js` | Bundle HTML/JS + CreateViewSection + options |
| `projects/grist_forms/shared/formulaires-table.js` | ensure table Formulaires + CRUD Def |
| `projects/grist_forms/builder.html` | UI composition DSFR |
| `projects/grist_forms/tests/*.test.js` | Tests Node des modules purs |

---

### Task 1: Scaffold + schéma FormDef + CLAUDE.md

**Files:**
- Create: `projects/grist_forms/CLAUDE.md`
- Create: `projects/grist_forms/runtime/formdef.schema.json`
- Create: `projects/grist_forms/tests/fixtures/formdef-minimal.json`

**Interfaces:**
- Produces: fixture JSON valide selon spec §4.2 (champs `manifest_version`, `id`, `title`, `tableId`, `composeMode`, `sections[]`, `choices`)

- [ ] **Step 1: Créer `CLAUDE.md`**

Contenu minimal :

```markdown
# Projet: grist_forms (Form Builder)

## Contexte
Essence formulaires Grist — compose FormDef, persist table Formulaires, publish vue intra-doc.

## Spec
`docs/superpowers/specs/2026-07-26-grist-forms-builder-design.md`

## Architecture
Voir plan `docs/superpowers/plans/2026-07-26-grist-forms-builder.md`

## État
Scaffold en cours (v1).
```

- [ ] **Step 2: Écrire `formdef.schema.json`**

JSON Schema draft-07 décrivant : `manifest_version` (string), `id`, `title`, `description`, `classification`, `successMessage`, `tableId`, `composeMode` enum `["bind","ensureSchema"]`, `sections` array d’objets `{id,label,gate,fields}`, `fields` items avec `colId`, `label`, `type`, `widget`, `required`, `options`, `condition`, `cascade`, `dynamicFilter`, `profile`, `theme`, `polarity`, `choices` object.

- [ ] **Step 3: Fixture minimale**

```json
{
  "manifest_version": "1.0.0",
  "id": "demo-contact",
  "title": "Contact",
  "description": "",
  "classification": "cerema_internal",
  "successMessage": "Merci !",
  "tableId": "Contacts",
  "composeMode": "bind",
  "sections": [
    {
      "id": "s1",
      "label": "Identité",
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

- [ ] **Step 4: Vérifier**

Run: `Test-Path projects/grist_forms/runtime/formdef.schema.json`
Expected: `True`

---

### Task 2: Vendor GristBridge + `types.js` (écriture valeurs)

**Files:**
- Create: `projects/grist_forms/shared/grist-bridge.js` (copie de `artefactory-mcp/shared/grist-bridge.js`)
- Create: `projects/grist_forms/shared/types.js`
- Create: `projects/grist_forms/tests/types.test.js`

**Interfaces:**
- Consumes: rien
- Produces:
  - `Types.coerceForWrite(field, rawValue) → any` (valeur prête AddRecord)
  - `Types.defaultWidget(gristType) → string`
  - `Types.normalizeGristType(typeStr) → string` (`Ref:X` → `Ref`, etc.)
  - UMD : `module.exports` / `window.FormTypes`

- [ ] **Step 1: Copier grist-bridge**

```powershell
Copy-Item "C:\Users\Omen\Desktop\LAVAL\Github Repositories\artefactory-mcp\shared\grist-bridge.js" `
  "C:\Users\Omen\Desktop\LAVAL\Github Repositories\Widgets Grist\projects\grist_forms\shared\grist-bridge.js"
```

- [ ] **Step 2: Test failing `coerceForWrite`**

```js
// projects/grist_forms/tests/types.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Types = require('../shared/types.js');

describe('Types.coerceForWrite', () => {
  it('Bool from checkbox', () => {
    assert.equal(Types.coerceForWrite({ type: 'Bool', widget: 'checkbox' }, true), true);
  });
  it('Date ISO to unix seconds', () => {
    const v = Types.coerceForWrite({ type: 'Date', widget: 'date' }, '2024-06-15');
    assert.equal(v, Math.floor(Date.UTC(2024, 5, 15) / 1000));
  });
  it('ChoiceList to L-prefix', () => {
    assert.deepEqual(
      Types.coerceForWrite({ type: 'ChoiceList', widget: 'multiselect' }, ['a', 'b']),
      ['L', 'a', 'b']
    );
  });
  it('Ref to number', () => {
    assert.equal(Types.coerceForWrite({ type: 'Ref', widget: 'select', refTable: 'T' }, '42'), 42);
  });
  it('RefList to L-prefix ids', () => {
    assert.deepEqual(
      Types.coerceForWrite({ type: 'RefList', widget: 'multiselect' }, ['1', '2']),
      ['L', 1, 2]
    );
  });
});
```

- [ ] **Step 3: Run — expect FAIL**

Run: `node --test projects/grist_forms/tests/types.test.js`
Expected: FAIL (module missing)

- [ ] **Step 4: Implement `types.js`**

UMD factory exportant au minimum :

```js
function normalizeGristType(t) {
  if (!t) return 'Text';
  if (t.startsWith('RefList:')) return 'RefList';
  if (t.startsWith('Ref:')) return 'Ref';
  return t;
}
function defaultWidget(t) {
  const map = {
    Text: 'text', Int: 'number', Numeric: 'number', Bool: 'checkbox',
    Date: 'date', DateTime: 'datetime', Choice: 'select', ChoiceList: 'multiselect',
    Ref: 'select', RefList: 'multiselect'
  };
  return map[normalizeGristType(t)] || 'text';
}
function coerceForWrite(field, raw) {
  const t = normalizeGristType(field.type);
  if (raw === '' || raw == null) return null;
  if (t === 'Bool') return !!raw;
  if (t === 'Int' || t === 'Numeric' || t === 'Ref') {
    const n = Number(raw); return Number.isFinite(n) ? n : null;
  }
  if (t === 'Date' || t === 'DateTime') {
    const d = typeof raw === 'string' ? new Date(raw) : raw;
    return Number.isFinite(d.getTime()) ? Math.floor(d.getTime() / 1000) : null;
  }
  if (t === 'ChoiceList') {
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr.length ? ['L'].concat(arr) : null;
  }
  if (t === 'RefList') {
    const arr = (Array.isArray(raw) ? raw : [raw]).map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n));
    return arr.length ? ['L'].concat(arr) : null;
  }
  return raw;
}
```

- [ ] **Step 5: Run — expect PASS**

Run: `node --test projects/grist_forms/tests/types.test.js`
Expected: PASS

---

### Task 3: Moteur — conditions + collect payload

**Files:**
- Create: `projects/grist_forms/runtime/engine.js`
- Create: `projects/grist_forms/tests/engine.test.js`

**Interfaces:**
- Consumes: `Types.coerceForWrite`
- Produces:
  - `Engine.evaluateCondition(condition, values) → boolean`
  - `Engine.isSectionVisible(section, values) → boolean` (`gate` Bool shorthand)
  - `Engine.isFieldVisible(field, values) → boolean`
  - `Engine.collectSubmitData(formDef, values) → object` (clés colId, visibles only)
  - `Engine.filterCascadeOptions(choices, refRecords, parentRefCol, parentValue) → choices` (match by **id**, not index)

- [ ] **Step 1: Tests conditions + cascade id-match**

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../runtime/engine.js');

describe('Engine conditions', () => {
  it('gate Bool hides section when false', () => {
    const sec = { id: 's2', gate: 'Concerne', fields: [] };
    assert.equal(Engine.isSectionVisible(sec, { Concerne: false }), false);
    assert.equal(Engine.isSectionVisible(sec, { Concerne: true }), true);
  });
  it('field condition ==', () => {
    const f = { colId: 'X', condition: { field: 'Type', operator: '==', value: 'A' } };
    assert.equal(Engine.isFieldVisible(f, { Type: 'A' }), true);
    assert.equal(Engine.isFieldVisible(f, { Type: 'B' }), false);
  });
});

describe('Engine.collectSubmitData', () => {
  it('omits hidden fields', () => {
    const def = {
      sections: [{
        id: 's1', gate: null, fields: [
          { colId: 'A', type: 'Text', widget: 'text', required: false },
          { colId: 'B', type: 'Text', widget: 'text', condition: { field: 'A', operator: '==', value: 'oui' } }
        ]
      }]
    };
    const data = Engine.collectSubmitData(def, { A: 'non', B: 'secret' });
    assert.deepEqual(data, { A: 'non' });
  });
});

describe('Engine.filterCascadeOptions', () => {
  it('filters by record id not array index', () => {
    const choices = [
      { value: 10, label: 'Nord' },
      { value: 20, label: 'Sud' }
    ];
    const refRecords = {
      id: [10, 20],
      name: ['Nord', 'Sud'],
      pays: [1, 2]
    };
    const out = Engine.filterCascadeOptions(choices, refRecords, 'pays', 2);
    assert.deepEqual(out, [{ value: 20, label: 'Sud' }]);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `node --test projects/grist_forms/tests/engine.test.js`

- [ ] **Step 3: Implement `engine.js`**

Implémenter les fonctions ci-dessus ; `collectSubmitData` appelle `Types.coerceForWrite`. Operators : `==`, `!=`, `>`, `>=`, `<`, `<=`, `contains`. Section sans gate → visible. Field sans condition → visible. Si section masquée → aucun de ses fields dans le payload.

- [ ] **Step 4: Run — expect PASS**

Run: `node --test projects/grist_forms/tests/engine.test.js`

---

### Task 4: Projection Survey Manifest

**Files:**
- Create: `projects/grist_forms/shared/survey-project.js`
- Create: `projects/grist_forms/tests/survey-project.test.js`

**Interfaces:**
- Produces: `formDefToSurveyManifest(def) → object` avec `manifest_version`, `id`, `title`, `classification`, `sections` (fields→`questions` avec `colId`,`label`,`type` profil ou type mappé), `choices`

Mapping profil/type → type SM :
- `profile === 'likert5'` → `likert5`
- `type ChoiceList` → `choice_list`
- `type Choice` → `choice`
- `type Bool` → `bool`
- `type DateTime` → `datetime`
- sinon → `text` (Ref etc. restent hors SM strict — omis ou `text` documenté)

- [ ] **Step 1: Test**

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { formDefToSurveyManifest } = require('../shared/survey-project.js');
const fixture = require('./fixtures/formdef-minimal.json');

it('projects title and questions', () => {
  const sm = formDefToSurveyManifest(fixture);
  assert.equal(sm.id, 'demo-contact');
  assert.equal(sm.sections[0].questions[0].colId, 'Nom');
  assert.equal(sm.sections[0].questions[0].type, 'text');
});
```

- [ ] **Step 2: Implement + PASS**

Run: `node --test projects/grist_forms/tests/survey-project.test.js`

---

### Task 5: ensureSchema — plan d’actions colonnes

**Files:**
- Create: `projects/grist_forms/shared/ensure-schema.js`
- Create: `projects/grist_forms/tests/ensure-schema.test.js`

**Interfaces:**
- Produces: `planEnsureSchema(formDef, existingColumns) → { ok, errors[], actions[] }`
  - `existingColumns`: `[{ id, type }]`
  - `actions`: UserActions `AddColumn` à appliquer plus tard
  - erreur si colonne existe avec type incompatible

- [ ] **Step 1: Tests**

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { planEnsureSchema } = require('../shared/ensure-schema.js');

it('plans AddColumn for missing', () => {
  const def = {
    tableId: 'Contacts',
    sections: [{ fields: [{ colId: 'Nom', type: 'Text' }, { colId: 'Age', type: 'Int' }] }]
  };
  const plan = planEnsureSchema(def, [{ id: 'Nom', type: 'Text' }]);
  assert.equal(plan.ok, true);
  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0][0], 'AddColumn');
  assert.equal(plan.actions[0][1], 'Contacts');
  assert.equal(plan.actions[0][2], 'Age');
});

it('errors on incompatible type', () => {
  const def = {
    tableId: 'Contacts',
    sections: [{ fields: [{ colId: 'Nom', type: 'Int' }] }]
  };
  const plan = planEnsureSchema(def, [{ id: 'Nom', type: 'Text' }]);
  assert.equal(plan.ok, false);
  assert.ok(plan.errors[0].includes('Nom'));
});
```

- [ ] **Step 2: Implement + PASS**

Pour Ref/RefList, `AddColumn` type = `Ref:Table` / `RefList:Table` depuis `field.refTable`.

---

### Task 6: Table Formulaires + persist Def

**Files:**
- Create: `projects/grist_forms/shared/formulaires-table.js`
- Create: `projects/grist_forms/tests/formulaires-table.test.js` (pure: shape des actions)

**Interfaces:**
- Produces:
  - `FORMULAIRES_SCHEMA` colonnes (Nom, FormId, Titre, TableCible, Version, Def, Statut, PublishedSectionRef, UpdatedAt)
  - `planCreateFormulairesTable() → actions[]` (`AddTable` si besoin — caller check existence)
  - `rowFromFormDef(def, meta) → fields object` pour Add/UpdateRecord

- [ ] **Step 1: Test rowFromFormDef**

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../shared/formulaires-table.js');
const fixture = require('./fixtures/formdef-minimal.json');

it('serializes Def JSON', () => {
  const fields = F.rowFromFormDef(fixture, { version: 1, statut: 'brouillon' });
  assert.equal(fields.FormId, 'demo-contact');
  assert.equal(fields.TableCible, 'Contacts');
  assert.equal(JSON.parse(fields.Def).id, 'demo-contact');
  assert.equal(fields.Version, 1);
});
```

- [ ] **Step 2: Implement + PASS**

---

### Task 7: Publish — bundle + options customView

**Files:**
- Create: `projects/grist_forms/shared/publish.js`
- Create: `projects/grist_forms/tests/publish.test.js`

**Interfaces:**
- Consumes: sources texte engine + types + bridge (passées en string par le caller navigateur, ou lues via fs en test Node)
- Produces:
  - `splitHtmlJs(fullHtml) → { html, js }` (même idée artefactory : scripts inline → `_js`)
  - `buildRuntimeDocument(formDef, bundles) → fullHtml string` (HTML DSFR + script avec `FORM_DEF` + engine)
  - `buildCustomViewOptions({ html, js, builderDef }) → options JSON string` pour `_grist_Views_section`
  - `planCreateCustomPage(tableRef, pageName) → actions[]` puis caller complète section options

**Builder widget id:** `@berhalak/custom-widget-builder`  
**Fallback URL:** `https://gristgouv.github.io/gristlabs-widgets/custom-widget-builder/index.html`

- [ ] **Step 1: Test split + embed**

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../shared/publish.js');

it('moves inline script to js', () => {
  const { html, js } = P.splitHtmlJs('<div>x</div><script>grist.ready({requiredAccess:"full"});</script>');
  assert.ok(!/<script>/i.test(html) || /src=/i.test(html));
  assert.ok(js.includes('grist.ready'));
});

it('runtime html embeds form id', () => {
  const doc = P.buildRuntimeDocument({ id: 'demo', title: 'T', tableId: 'T', sections: [], choices: {} }, {
    engineJs: '/*engine*/',
    typesJs: '/*types*/',
    bridgeJs: '/*bridge*/'
  });
  assert.ok(doc.includes('demo'));
  assert.ok(doc.includes('/*engine*/'));
});
```

- [ ] **Step 2: Implement publish.js**

`buildRuntimeDocument` :
- charge DSFR CDN + structure `.fr-container`
- injecte `window.__FORM_DEF__ = …`
- concatène bridge + types + engine + bootstrap `Engine.mount(document.getElementById('app'), __FORM_DEF__)`
- submit : `GristBridge.addRow(tableId, data)` ou `applyUserActions([['AddRecord',…]])`

`buildCustomViewOptions` : structure exacte Artefactory :

```js
{
  verticalGridlines: true,
  horizontalGridlines: true,
  zebraStripes: false,
  numFrozen: 0,
  customView: JSON.stringify({
    mode: 'url',
    url: null,
    access: 'full',
    widgetDef: builderDef,
    widgetId: builderDef.widgetId,
    renderAfterReady: true,
    widgetOptions: { _html: html, _js: js },
    columnsMapping: null
  })
}
```

Puis `JSON.stringify` de l’objet outer pour le champ `options`.

- [ ] **Step 3: PASS tests**

---

### Task 8: `Engine.mount` rendu DOM DSFR (runtime UI)

**Files:**
- Modify: `projects/grist_forms/runtime/engine.js`
- Create: `projects/grist_forms/tests/engine-mount.test.js` (jsdom optional — si trop lourd, test manuel checklist + test unitaire `renderFieldHtml(field, values) → string`)

**Interfaces:**
- Produces: `Engine.renderFieldHtml(field, values, optionsList) → string` (échappé)
- Produces: `Engine.mount(rootEl, formDef, bridge)` (navigateur)

- [ ] **Step 1: Test renderFieldHtml échappe XSS**

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../runtime/engine.js');

it('escapes label html', () => {
  const html = Engine.renderFieldHtml({
    colId: 'N', label: '<img src=x onerror=alert(1)>', type: 'Text', widget: 'text', required: false
  }, {});
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img') || html.includes('&lt;'));
});
```

- [ ] **Step 2: Implement renderers** pour widgets v1 : text, textarea, number, checkbox, date, datetime, select, radio, multiselect, likert (1–5). Classes `fr-input`, `fr-select`, `fr-fieldset`, etc.

- [ ] **Step 3: mount** — navigation étapes (sections visibles), validation required, submit via bridge, message succès.

---

### Task 9: Builder UI (`builder.html`)

**Files:**
- Create: `projects/grist_forms/builder.html`

**Interfaces:**
- Consumes: tous les modules shared + engine (script tags relatifs ou inline pour servir-dev)
- Comportement :
  1. `grist.ready({ requiredAccess: 'full' })` + init GristBridge
  2. ensure table `Formulaires` (via plan + apply)
  3. Wizard : liste forms / nouveau ; édition sections/fields ; load colonnes table cible
  4. Preview pane = `Engine.mount`
  5. Save → upsert ligne Formulaires
  6. ensureSchema si mode
  7. Publish → publish.js + applyUserActions ; MAJ Version + PublishedSectionRef + Statut `publie`

- [ ] **Step 1: HTML coquille DSFR** — header, steps (Forms / Construction / Preview / Publish), zones `#forms-list`, `#builder`, `#preview`, `#publish-log`

- [ ] **Step 2: Wire loadTables / loadColumns** via `grist.docApi.fetchTable('_grist_Tables')` + `_grist_Tables_column` (même logique DataManager v3, sans XSS : `GristBridge.util.esc`)

- [ ] **Step 3: Wire save / publish** boutons ; toasts d’erreur FR

- [ ] **Step 4: Test manuel local**

Run: `npm run serve:dev` (ou ouvrir builder en mode démo mock si hors Grist)

Checklist :
- [ ] Mock tables affichées hors Grist
- [ ] En Grist (doc test) : save FormDef visible dans table Formulaires
- [ ] Publish crée une page ; fill AddRecord OK

---

### Task 10: Intégration E2E Grist + doc CLAUDE état

**Files:**
- Modify: `projects/grist_forms/CLAUDE.md` (état = v1 utilisable)
- Create: `projects/grist_forms/docs/MANUAL_TEST.md`

- [ ] **Step 1: MANUAL_TEST.md** — scénario Régions/Villes cascade + ChoiceList + Bool + Date

- [ ] **Step 2: Exécuter checklist sur grist.numerique.gouv.fr** (doc dédié ou Forms v2)

- [ ] **Step 3: Noter bugs restants dans CLAUDE.md**

- [ ] **Step 4: Demander à l’utilisateur s’il faut commit / promote published**

---

## Spec coverage (self-review)

| Exigence spec | Task |
|---------------|------|
| FormDef JSON + table Formulaires | 1, 6 |
| Types Grist + coerce | 2 |
| 1 moteur conditions/cascade id | 3, 8 |
| Survey projection | 4 |
| ensureSchema | 5 |
| Publish intra-doc bundle | 7, 9 |
| Builder GH Pages / DSFR | 9 |
| GristBridge | 2, 9 |
| Preview = engine | 8, 9 |
| AddRecord only | 8 |
| Pas published/ auto | Global Constraints |

## Placeholder scan

Aucun TBD volontaire ; tests manuels Grist listés explicitement Task 10.
