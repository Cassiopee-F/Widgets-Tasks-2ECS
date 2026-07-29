# Binding QGIS → Grist → carto Cerema (v2)

> Spécification de correspondance entre formats de sortie QGIS standard,
> modèle de stockage Grist (qgis2grist), et briques cartographiques de
> l'écosystème Cerema (Scene Manifest V0.2, composants qgis-sspcloud,
> Atlas, ZEBRA, geoai-kit).
>
Implémentation cible : `../index_v2.html` (Phase 1–2 autorisées — voir `CADRAGE-v2.md`).
> **Sources de vérité externes** :
> - Scene Manifest : `cerema-offre-de-service/docs/scene-manifest-spec.md`
> - Modèle Pydantic : `cerema-offre-de-service/shared/io/scene_manifest.py`
> - Axes WikiChat : `scene-manifest-axis`, `qgis-sspcloud-composants-axis`,
>   `audit-trail-axis`, `solution-geomind-axis`, `grist-axis`

---

## 1. Objectif

Définir les **bindings** (correspondances, contraintes, écarts) pour que :

1. Un export QGIS **standard** (hors stack Cerema) puisse alimenter Grist de
   façon exploitable (types, relations, labels).
2. Les tables Grist produites soient **consommables** par les composants carto
   déjà établis ailleurs (MapLibre, Atlas, iframe_grist, ZEBRA).
3. La convergence avec l'**offre de service Cerema** soit explicite, sans
   dupliquer les contrats autoritaires.

---

## 2. Architecture en strates

```
┌─────────────────────────────────────────────────────────────────┐
│  AMONT QGIS (standard ou Cerema)                                │
│  .qgz .qgs .gpkg qgis2web .grist Scene Manifest.json            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  PIVOT DONNÉES (Cerema)                                         │
│  Scene Manifest V0.2 · GPKG étendu · .grist · GeoJSON WGS84     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  GRIST (stockage collaboratif)                                  │
│  Tables typées · geometry_json/lat-lng · Ref · Choice · config    │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     qgis2grist v2 MapLibre  Atlas / ZEBRA   qgis-sspcloud
                          MapLibre+3D      interactive_map · iframe_grist
```

**Règle Cerema** : les composants carto de l'offre consomment
**Scene Manifest V0.2 + GeoJSON/WGS84**, pas le QML QGIS brut.

**État qgis2grist v1.1** : binding données ✅ ; binding style via
`fill_color` ad hoc ⚠️ (hors contrat Scene Manifest).

---

## 3. Formats QGIS entrants — contraintes

| Format | Données | Métadonnées QGIS | Contraintes |
|--------|---------|------------------|-------------|
| `.gpkg` | ✅ WKB complet | `gpkg_data_columns`, enum, `layer_styles`, `qgis_projects` | Reprojection → EPSG:4326 ; tables GPKG V0.2 Cerema (`_meta_scene`) non lues |
| `.qgz` / `.qgs` (dans ZIP) | ⚠️ si GPKG/GeoJSON embarqués ou dans ZIP parent | aliases, edit widgets, relations, renderer-v2 | GPKG externes hors archive → schéma seul (import bloqué v1.1+) |
| qgis2web `.html`/`.zip` | ✅ FeatureCollections | styles JS, légendes | EPSG:3857 fréquent → reprojection ; cas BigQgisMCP (slider/meta) |
| GeoJSON (dans ZIP) | ✅ | faible | CRS implicite 4326 |
| `.grist` (BigQgisMCP) | ✅ dans fichier | table `SceneManifest` | **Non lu** par qgis2grist actuel |
| Scene Manifest `.json` | — (orchestration) | StyleDeclarative | **Non importé** directement |
| Shapefile | ❌ | — | Hors scope v1 |
| PostGIS / WFS (dans `.qgs`) | ❌ fetch | schéma seul | Widget JS ne peut pas interroger la source |

---

## 4. Binding schéma : QGIS → colonnes Grist

### 4.1 Géométrie (contrat partagé ZEBRA / Scene Manifest axis)

| Type QGIS | Colonnes Grist | Type Grist | Contrainte |
|-----------|----------------|------------|------------|
| Point | `latitude`, `longitude` | Numeric | WGS84, `[lng, lat]` côté carto |
| Line, Polygon, Multi* | `geometry_json` | Text (GeoJSON) | WGS84 ; arrondi 5 décimales (~1 m) |
| idem | `centroid_lat`, `centroid_lon` | Numeric | Facultatif carto / filtres |
| Raster | — | — | Non importé |

> Pas de type `Ref:Geometry` Grist — géométrie sérialisée en Text.

### 4.2 Attributs

| Source QGIS | Colonne Grist | Binding |
|-------------|---------------|---------|
| `<field name>` / GPKG column | `col.id` (= `sanitizeColName`) | Identifiant technique |
| `<aliases>` / `gpkg_data_columns.title` | `col.label` | Libellé humain |
| Clé GeoJSON brute | `_rawKey` (interne import) | Résolution properties |
| Type field QGIS | `qgsTypeToGrist()` | int→Int, real→Numeric, bool→Bool, date→Date/DateTime, défaut→Text |
| `ValueMap` | `Choice` + `widgetOptions.choices` | Import = **labels** Choice ; `_valueMap` pour conversion |
| `CheckBox` | `Bool` | 0/1 |
| `Range` | `Int` ou `Numeric` | Step entier sans precision → Int |
| `DateTime` widget | `Date` ou `DateTime` | Selon `field_format` sans heure |
| `<relations>` | `Ref:ParentTable` | FK résolue → rowId parent après `BulkAddRecord` |
| `ValueRelation` | `Ref:` / `RefList:` | Index parent sur `target.Key` |
| `gpkg enum` | `Choice` | |
| `ExternalResource` | Text (+ `_externalResource`) | Attachments : non implémenté |

### 4.3 Ordre d'import Refs

1. `topoSortByRefs(layers)` — parents avant enfants.
2. `tableNameRemap` en cas de collision de nom de table.
3. `parentMaps[table][field][value] → rowId` après chaque couche parente.
4. Refs cycliques : ordre découverte ; FK non résolues (cas exotique).

---

## 5. Binding style : QGIS → Scene Manifest → Grist

### 5.1 État actuel (qgis2grist v1.1)

```
QML / qgis2web JS  →  parseQmlStyle()  →  layer.style (interne)
                                      →  fill_color (Text, par feature)
                                      →  QgisWidgets.config_json.style
```

### 5.2 Cible v2 (alignement Cerema)

```
QML / renderer-v2  →  StyleDeclarative  →  table SceneManifest (Text JSON)
                                         →  layer.style.declarative dans config
```

| QGIS renderer | Scene Manifest `kind` | Champs requis |
|---------------|-------------------------|---------------|
| singleSymbol | `single` | `color` (#RRGGBB) |
| categorizedSymbol | `categorized` | `field`, `stops[]` {value, color, opacity} |
| graduatedSymbol | `graduated` | `field`, `breaks[]` ou `stops[]`, `method`, `ramp` |
| RuleBased | `rule_based` | `rules[]` {filter, color, opacity, ordering} |
| 3D / extrusion | `3d_model` / `extrusion` | `gltf_url`, `height_field`, etc. |

**Contraintes StyleDeclarative** (Scene Manifest V0.2) :

- `declarative` **obligatoire** ; `qml_source` optionnel (hors `scene_hash`).
- Couleurs `#RRGGBB` 6 digits ; alpha via `opacity`, pas dans la couleur.
- Style CRS-agnostique ; géométrie Grist en 4326.
- Rotation 2D markers : 🟠 V0.3 proposée (`marker.rotation_field`) ; jusqu'alors `qml_source`.

### 5.3 Migration `fill_color`

| Approche | Avantages | Inconvénients |
|----------|-----------|---------------|
| **A. Conserver `fill_color`** | v1 Leaflet, vues Grist simples | Hors standard Cerema ; figé à l'import |
| **B. SceneManifest + dérivation** | Atlas, interactive_map, geoai-kit | Conversion QML→declarative à maintenir |
| **C. Hybride (recommandé v2)** | `SceneManifest` table + `fill_color` cache | Deux sources ; `fill_color` = matérialisation à l'import |

---

### 5.4 ControlDeclarative (V0.2.2)

Voir `docs/SCENE-MANIFEST-v0.2.2.md` pour le schéma complet.

```
QGIS renderer / widget Range  →  inferLayerControls()  →  layers[].controls[]
BigQgisMCP slider             →  control mode: "simulation"
```

| Source | Control |
|--------|---------|
| graduatedSymbol | `range` |
| categorizedSymbol | `select` |
| Widget Range (Min/Max) | `range` |
| Date/DateTime | `time` |
| BigQgisMCP flood | `range` + `mode: "simulation"` |

Émission : `lib/controls-from-layer.js` · intégration : `lib/scene-manifest.js`.

---

## 6. Binding vers composants carto

### 6.1 Matrice consommateur

| Composant | Entrée Grist | Style attendu | Runtime | Binding v1.1 | Binding v2 cible |
|-----------|--------------|---------------|---------|--------------|------------------|
| qgis2grist v2 | geometry_json, lat/lng, SceneManifest | StyleDeclarative | MapLibre | 🟡 Phase 2 | ✅ interop interactive_map |
| qgis2grist v1 | geometry_json, lat/lng, fill_color | QML interne | Leaflet | ✅ | maintenu jusqu'à Phase 8 |
| ZEBRA review | geometry_json, champs métier | zebra_styles / Scene Manifest | MapLibre | ✅ géo | ✅ si SceneManifest table |
| Atlas widget | geometry_json, attachments | Scene Manifest 3d/extrusion | MapLibre+Three.js | 🟡 géo | manifestToAtlasLayer |
| qgis-sspcloud `interactive_map` | GeoJSON + manifest | StyleDeclarative | MapLibre | ❌ | Rebuild manifest depuis Grist |
| qgis-sspcloud `iframe_grist` | URL doc | — | iframe | ✅ | ✅ |
| geoai-kit | GeoJSON | Scene Manifest | MapLibre | ❌ | applyManifestToMap() |
| Strate | — | cascades describe | statique | ❌ | enrichissement L5 futur |

### 6.2 Reconstruction GeoJSON depuis Grist (contrat commun)

Utilisé par : qgis2grist polling, `adaptHtmlForGrist` (legacy), Atlas, geoai-kit.

```javascript
// Point
{ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties }

// Ligne / polygone
{ type: 'Feature', geometry: JSON.parse(row.geometry_json), properties }
```

Properties : clés = `col.id` Grist ; labels affichés via `col.label` dans popups.

---

## 7. Binding formats Cerema (offre de service)

### 7.1 Trio de pivots (scene-manifest-axis)

| Pivot | Rôle | qgis2grist v1.1 | v2 cible |
|-------|------|-----------------|----------|
| A. Scene Manifest JSON | Orchestration scène | ❌ | Produire à l'import |
| B. GPKG étendu V0.2 | Binaire + `_meta_scene` | Lit GPKG OGC seulement | Lire `_meta_scene` si présent |
| C. ZIP composite | Export web autonome | ❌ | Hors scope |

### 7.2 BigQgisMCP `export_grist`

| Élément | Binding |
|---------|---------|
| Tables features | Équivalent import qgis2grist |
| Table `SceneManifest` | JSON Scene Manifest V0.2 |
| Boucle | v2 : accepter `.grist` en entrée qgis2grist |

### 7.3 Provenance (audit-trail-axis)

**Minimum v2 proposé** (par couche importée) :

```json
{
  "source": {
    "referential": "qgis2grist",
    "millesime": "2026",
    "authority": " fichier source ",
    "license": "unknown",
    "classification": "cerema_internal"
  },
  "provenance": [{
    "platform_id": "widgets-grist-qgis2grist",
    "ingested_at": "ISO8601",
    "via": null
  }]
}
```

Stockage candidat : colonnes dédiées dans `QgisWidgets.config_json.meta.provenance`
ou table `QgisImportLog`.

`audit_chain` complet (qgis-sspcloud) : requis seulement à la **publication**
d'un assemblage DSFR, pas à l'import Grist brut.

### 7.4 Classification (V0.2.3 proposée)

`public | cerema_internal | restricted | confidential`

Défaut import : `cerema_internal`. Filtrage cross-org côté serveur (public-kb-platform).

---

## 8. Persistance Grist (qgis2grist)

### 8.1 Tables créées à l'import

| Table | Rôle |
|-------|------|
| `{layer_name}` | Une table par couche importée |
| `SceneManifest` | Scene Manifest V0.2 (append par import — D1) |
| `QgisWidgets` | Config restauration widget (auto-créée) |

### 8.2 `QgisWidgets.config_json` (v2 proposé)

```json
{
  "version": 3,
  "meta": { "title", "sliderMin", "…", "provenance": {}, "classification": "cerema_internal" },
  "scene_manifest_row_id": 42,
  "scene_manifest": { "…copie dénormalisée optionnelle…" },
  "layers": [{
    "tableName", "displayName", "geomType", "fields", "color",
    "style": { "declarative": {}, "qml_source": null }
  }]
}
```

`version: 2` actuel (v1 code) → rétrocompatible. `version: 3` : pointeur vers table
`SceneManifest` + copie dénormalisée pour restore rapide (D7).

---

## 9. Écarts v1.1 → v2 (backlog binding)

| # | Binding | Priorité | Effort |
|---|---------|----------|--------|
| 1 | QML → StyleDeclarative à l'import | P0 | Moyen |
| 2 | Table `SceneManifest` dans doc Grist | P0 | Faible |
| 3 | Lecture `.grist` BigQgisMCP | P1 | Moyen |
| 4 | SourceInfo / provenance minimal | P1 | Faible |
| 5 | Atlas `manifestToAtlasLayer` | P1 | Faible (~80 LOC) |
| 6 | geoai-kit `applyManifestToMap` | P2 | Moyen (Lead #6) |
| 7 | GPKG `_meta_scene` V0.2 | P2 | Dépend cerema-offre-de-service |
| 8 | ExternalResource → Attachments | P2 | Moyen |
| 9 | Shapefile standalone | P3 | Moyen |
| 10 | Classification par couche | P3 | Faible |

---

## 10. Contraintes transverses (checklist implémentation)

- [ ] Géométrie stockée en **EPSG:4326** avant écriture Grist
- [ ] Labels (`col.label`) posés à `AddTable`, pas post-import
- [ ] Choice : labels = source de vérité ; codes QGIS via `_valueMap`
- [ ] Refs : parents importés avant enfants ; `retValues[0]` capturé
- [ ] Style stable cross-runtime : **StyleDeclarative**, pas QML seul
- [ ] Couleurs `#RRGGBB` 6 digits (pas de alpha dans hex)
- [ ] Ne pas dupliquer `scene_manifest.py` — vendoriser ou appeler spec Cerema
- [ ] v2 : **MapLibre GL JS** + mapper StyleDeclarative → style spec (aligné qgis-sspcloud)
- [ ] v1 : Leaflet conservé dans `index.html` jusqu'à retrait published

---

## 11. Références

| Document | Emplacement |
|----------|-------------|
| Doc agent qgis2grist (v1) | `../CLAUDE.md` |
| Patterns schéma Grist | `../../skills/schema.md` |
| Scene Manifest spec | `cerema-offre-de-service/docs/scene-manifest-spec.md` |
| Composants qgis-sspcloud | WikiChat `qgis-sspcloud-composants-axis.md` |
| Schéma ZEBRA Grist | `../../projects/zebra/shared/grist_schema.js` |

---

*Rédigé v2 — 2026-07-26. Proposition de binding ; les contrats autoritaires
restent dans `cerema-offre-de-service`.*
