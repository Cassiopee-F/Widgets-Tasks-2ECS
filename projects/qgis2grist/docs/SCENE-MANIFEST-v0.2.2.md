# Scene Manifest V0.2.2 — Extension binding Cerema

> Extension rétrocompatible de V0.2.1 pour le binding **qgis2grist → Atlas → interactive_map**.  
> Les champs V0.2.1 existants restent inchangés ; V0.2.2 ajoute `layers[].controls`, `story`, `panels`.

**Implémentation de référence** :
- Émission : `projects/qgis2grist/lib/controls-from-layer.js`, `lib/scene-manifest.js`
- Consommation : `projects/Atlas/lib/manifest-binding.js`, `lib/controls.js`, `lib/story.js`

---

## 1. Version

| Champ | Valeur |
|-------|--------|
| `version` | `"0.2.2"` (proposée) ou `"0.2.1"` (actuelle qgis2grist — champs optionnels) |
| Rétrocompat | Consommateurs V0.2.1 ignorent `controls`, `story` |

Incrémenter à `0.2.2` lorsque l'émetteur garantit `controls[]` systématique (qgis2grist v2 post Phase A).

---

## 2. ControlDeclarative

Tableau optionnel `layers[].controls[]`.

### Schéma

```typescript
type ControlDeclarative = {
  field: string;           // nom colonne Grist (col.id)
  type: 'range' | 'select' | 'time';
  label?: string;          // libellé UI (défaut = field)
  active?: boolean;        // défaut false à l'import
  min?: number;            // range / time (epoch ms si time)
  max?: number;
  dataMin?: number;        // bornes données observées (hint UI)
  dataMax?: number;
  values?: string[];       // select — valeurs autorisées
  mode?: 'simulation';     // extension flood BigQgisMCP (≠ filtre attribut)
};
```

### Règles d'émission (qgis2grist)

| Source QGIS | Control émis |
|-------------|--------------|
| `graduatedSymbol` | `range` (min/max depuis stops) |
| `categorizedSymbol` | `select` (values = labels Grist si ≠ value QGIS) |
| Widget `Range` (Min/Max) | `range` si pas déjà émis pour le champ |
| Champ `Date` / `DateTime` | `time` |
| BigQgisMCP slider flood | `range` + `mode: "simulation"`, `active: false` |
| BigQgisMCP temporal | `time` |

### Règles de consommation (Atlas)

1. `applyManifestControlsToLayer(layer, manifestLayer)` — `active: false` par défaut
2. `Atlas_LayerPrefs` **écrase** le manifest (priorité user)
3. `buildControlPredicate` : filtre GeoJSON par contrôles `active: true`
4. `mode: "simulation"` : conservé dans prefs ; sémantique simulation flood = extension future (ne pas confondre avec filtre range simple)

---

## 3. StyleDeclarative (inchangé V0.2.1)

```typescript
type StyleDeclarative =
  | { kind: 'single'; color: string; opacity?: number }
  | { kind: 'categorized'; field: string; stops: Stop[] }
  | { kind: 'graduated'; field: string; method?: string; stops: GradStop[] };
```

Stocké dans `layers[].style.declarative`.

---

## 4. Story (récit) — V0.2.2

### StoryManifest (fragment export)

```typescript
type StoryManifest = {
  version: '0.2.1' | '0.2.2';
  steps: StoryStep[];
};

type StoryStep = {
  title?: string;
  text?: string;              // corps markdown/texte simple
  panels?: PanelDeclarative[]; // V0.2.2 — encarts (Phase C Atlas)
  state: StoryState;
};

type StoryState = {
  camera?: { center: [number, number]; zoom?: number; pitch?: number; bearing?: number };
  settings?: { projection?: string; timeOfDay?: number; date?: string };
  layers: StoryLayerState[];
};

type StoryLayerState = {
  name: string;               // ou id table
  visible?: boolean;
  controls?: ControlDeclarative[];  // état actif capturé
  symbolization?: object;     // symbo Atlas runtime
  declarative?: StyleDeclarative;
};
```

### Persistance Grist

Table `Atlas_Story` : colonnes `Title`, `Text`, `StateJSON`, (future `PanelsJSON`).

---

## 5. PanelDeclarative (V0.2.2 — Phase C)

```typescript
type PanelDeclarative = {
  type: 'title' | 'body' | 'legend' | 'layout';
  content?: string;
  layout?: 'bottom-bar' | 'side-left' | 'side-right';
  layerId?: string;           // legend — couche cible
};
```

Hors scope V0.2.1 ; réservé récit enrichi Atlas + import QGIS Print Layout (Phase D).

---

## 6. Priorité lecture (consommateur)

```
1. Atlas_LayerPrefs     (override utilisateur widget)
2. SceneManifest        (import qgis2grist)
3. Détection auto       (controlFieldType sur geojson)
```

---

## 7. Exemple complet (Bee Farming)

Voir `tests/fixtures/golden/scene-manifest-marseille-controls.json`.

Couches clés après import `qfield_bees.zip` :

| Couche | Style | Controls |
|--------|-------|----------|
| `Pollen_Consumption` | single (pas de renderer QGS) | `range` percentage 0–100 (widget Range) |
| `Apiary` | categorized `bee_species` | `select` |
| `Fields` | categorized `plant_species` | `select` |

---

## 8. Tests de conformité

```bash
cd projects/qgis2grist
node --test tests/bees-binding.test.js tests/binding-manifest-integration.test.js

cd projects/Atlas
node --test tests/manifest-binding.test.js
```

Checklist manuelle Grist : `projects/Atlas/docs/MANUAL_TEST.md`

---

*Rédigé 2026-07-29 — extension binding Widgets Grist / offre Cerema.*
