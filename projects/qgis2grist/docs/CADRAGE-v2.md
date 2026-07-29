# Cadrage qgis2grist v2

> **Gate v2** — D1–D10 actés (2026-07-26). Phases 1–2 autorisées sur `index_v2.html`.
> `index.html` (v1.1 Leaflet) reste stable jusqu'à Phase 8 publication.
>
> Spec technique détaillée : [BINDING-QGIS-GRIST-CEREMA-v2.md](./BINDING-QGIS-GRIST-CEREMA-v2.md)

---

## 1. Verdict cadrage (2026-07-26, enrichi offre Cerema)

Sources consultées : WikiChat axes `scene-manifest`, `qgis-sspcloud-composants`,
`qgis-sspcloud-publication-flow`, `audit-trail`, `maplibre-threejs`, `grist`,
`public-kb-platform` ; décisions D4 (anti-drift Scene Manifest), D-QGIS-006
(Source Strate), D-FORMAT-008 (integrity_hash), Phase B `export_grist` BigQgisMCP.

| Zone | État | Commentaire |
|------|------|-------------|
| Problème / valeur | 🟢 Cadré | Import QGIS natif → Grist + interop carto Cerema |
| Périmètre v1 vs v2 | 🟢 Cadré | v1 stable ; v2 = convergence Scene Manifest |
| Bindings données QGIS→Grist | 🟢 Cadré | Hérités v1.1, documentés |
| D1–D5 (§6) | 🟢 **Actés** | Voir §9 — alignés BigQgisMCP + qgis-sspcloud |
| D6–D9 (§6 bis) | 🟢 **Actés** | Dérivés des contrats Cerema récents |
| Bindings style QML→declarative | 🟡 Partiel | kinds single/cat/graduated MVP ; rule_based → v2.1 |
| GPKG V0.2 `_meta_scene` | 🟠 Ouvert | Attend implémentation cerema-offre-de-service |
| `@cerema/map-editor` | 🟠 Ouvert | Étude convergence 2026-06-30 — v2 n'attend pas |
| rotation_field 2D V0.3 | 🟠 Ouvert | ZEBRA ; fallback `qml_source` si besoin |

**Conclusion : cadrage suffisant pour démarrer Phases 1–2 sur `index_v2.html`.**
Phases 3+ (.grist) et publication peuvent suivre après tests §8 partiels.

---

## 2. Mission v2 (fixée)

Étendre qgis2grist pour que **tout export QGIS standard complet** (hors obligation
stack Cerema en amont) produise un document Grist :

1. **Exploitable** comme v1 (types, labels, Ref, Choice, géométrie 4326).
2. **Interopérable** avec les composants carto de l'écosystème (Scene Manifest
   V0.2, Atlas, ZEBRA, qgis-sspcloud `interactive_map` / `iframe_grist`).
3. **Compatible** avec la sortie BigQgisMCP `export_grist` (boucle fermée).

**Hors mission v2** : remplacer qgis-sspcloud, Strate `describe()`, L5 KB,
moteur spatial GEOS, publication DSFR storymap.

---

## 3. Principes verrouillés 🟢

| # | Principe |
|---|----------|
| P1 | `index.html` = v1.1 ; pas de régression ; seule cible dev v2 = `index_v2.html` |
| P2 | Scene Manifest V0.2 = contrat style autoritaire (repo `cerema-offre-de-service`) — pas de fork du Pydantic dans le widget |
| P3 | Géométrie Grist en **EPSG:4326** ; `geometry_json` + lat/lng — aligné ZEBRA / scene-manifest-axis |
| P4 | `fill_color` peut rester en **cache dérivé** à l'import (hybride C), pas source de vérité style |
| P5 | Provenance minimale `SourceInfo` à l'import ; `audit_chain` complet seulement si export vers assemblage qgis-sspcloud (hors widget) |
| P6 | **MapLibre GL JS** = runtime carto v2 (aligné qgis-sspcloud `interactive_map`, Atlas, geoai-kit). **Leaflet = v1.1 uniquement** (`index.html`) |
| P7 | Pas de mode démo obligatoire v2.0 (héritage v1 : Grist required) |
| P8 | Code mort v1 (`adaptHtmlForGrist`, `renderAsWidget`, `saveToStorage`) : suppression dans **v2 uniquement**, pas v1 |

---

## 4. Périmètre fonctionnel v2

### 4.1 In scope v2.0 (MVP)

| Id | Fonctionnalité | Critère d'acceptation |
|----|----------------|----------------------|
| F1 | QML/renderer → `StyleDeclarative` | kinds `single`, `categorized`, `graduated` ; couleurs `#RRGGBB` |
| F2 | Table Grist `SceneManifest` | 1 row JSON manifest par import ; restauration au reload |
| F3 | `QgisWidgets.config_json` v3 | `version: 3`, `scene_manifest_row_id`, layers avec `style.declarative` ; copie dénormalisée optionnelle (D7) |
| F4 | Import fichier `.grist` BigQgisMCP | Détection table `SceneManifest` + tables features existantes → skip AddTable ou merge |
| F5 | Import Scene Manifest `.json` seul | Optionnel : enrichir config sans ré-importer features |
| F6 | Provenance par import | `source_file`, `imported_at`, `classification: cerema_internal` dans config |
| F7 | Héritage parsers v1 | `.gpkg`, `.qgz`/ZIP, qgis2web, blocage schéma-vide |
| F8 | Nettoyage code mort | Suppression fonctions non appelées (v2 file only) |

### 4.2 In scope v2.1+ (post-MVP)

| Id | Fonctionnalité |
|----|----------------|
| F9 | `rule_based` StyleDeclarative |
| F10 | ExternalResource → Attachments |
| F11 | Shapefile standalone |
| F12 | GPKG `_meta_scene` V0.2 (si implémenté cerema-offre-de-service) |
| F13 | API headless import (ZEBRA push REST) |
| F14 | Export Scene Manifest JSON téléchargeable depuis widget |

### 4.3 Out of scope (toutes versions v2)

- PostGIS / WFS fetch depuis `.qgs`
- Duplication logique Atlas / geoai-kit / qgis-sspcloud storymap dans le widget
- Publication automatique vers `published/` sans demande explicite
- Vendor `scene_manifest.py` Python dans le widget HTML
- Remplacer qgis-sspcloud ou Strate (voir §2 hors mission)

---

## 5. Bindings verrouillés (résumé)

Voir [BINDING-QGIS-GRIST-CEREMA-v2.md](./BINDING-QGIS-GRIST-CEREMA-v2.md) §4–6.

**Entrées v2.0** :

```
.gpkg | .qgz | ZIP(QField/qgis2web/GPKG) | qgis2web .html | .grist | .json (Scene Manifest)
```

**Sorties Grist v2.0** :

```
Tables features (comme v1)
+ SceneManifest (Text JSON, 1+ rows)
+ QgisWidgets (config v3)
+ fill_color (cache, conservé)
```

**Consommateurs aval** (non implémentés dans le widget, must remain valid) :

```
Atlas (manifestToAtlasLayer) | ZEBRA | iframe_grist | interactive_map (rebuild manifest)
```

---

## 6. Décisions actées (appuyées offre Cerema)

### D1 — Table `SceneManifest` → **A** 🟢

**Choix** : table `SceneManifest`, **une ligne par import** (append).

**Preuves** :
- BigQgisMCP `export_grist` embarque déjà le manifest en table `SceneManifest`
  (scene-manifest-axis, qgis-sspcloud-composants §2, commit `ce5c265`).
- qgis2grist utilise le même pattern pour `QgisWidgets` : `BulkAddRecord` +
  `loadLatestWidget()` = dernière ligne (historique implicite).

**Schéma v2 proposé** (aligné interop) :

| Colonne | Type | Contenu |
|---------|------|---------|
| `manifest_json` | Text | Scene Manifest V0.2 complet |
| `scene_hash` | Text | SHA256 canonique (si calculé) |
| `source_file` | Text | Nom fichier source |
| `created_at` | DateTime | Timestamp import |

### D2 — Import `.grist` BigQgisMCP → **A** 🟢

**Choix** : copier tables features + `SceneManifest` dans le **doc Grist courant**
(AddTable + BulkAddRecord), avec gestion collisions (`tableNameRemap` existant).

**Preuves** :
- Rôle qgis2grist = peuplement doc live (zebra-axis, grist-axis Config B).
- `.grist` = pivot DONNÉES strate qgis-sspcloud (même rang que GPKG).
- Lecture faisable en navigateur via **sql.js** (déjà utilisé pour GPKG).

**Nuances v2.0** :
- Si doc contient déjà des tables homonymes → suffixe `_n` (pattern v1).
- Si `.grist` contient `SceneManifest` → restaurer manifest sans re-parser QGIS.
- Pas d'écriture inverse vers fichier `.grist` (hors scope).

### D3 — Carte widget v2 → **MapLibre** 🟢

**Choix** : **MapLibre GL JS** dans `index_v2.html`, styles via `StyleDeclarative`
(même filière que qgis-sspcloud `interactive_map`, Atlas, geoai-kit).

**Preuves / arbitrage** :
- qgis-sspcloud verrouille MapLibre pour `interactive_map` et `scene_3d`
  (qgis-sspcloud-composants §3.2, maplibre-threejs-pattern §5.1).
- Scene Manifest → MapLibre : Lead #1 `mapping-maplibre.md` (cerema-offre-de-service).
- Décision produit **2026-07-26** : pas Leaflet en v2 — runtime unifié écosystème.

**Implémentation v2.0** :
- Remplacer deps Leaflet par MapLibre GL JS (+ CSS) dans `index_v2.html`.
- Mapper `StyleDeclarative` → style MapLibre (kinds single/categorized/graduated MVP).
- Reconstruire GeoJSON depuis tables Grist (`geometry_json`, lat/lng) — inchangé.
- Fallback si pas de manifest : style simple unique par couche.
- Réutiliser patterns existants : templates MapLibre qgis-sspcloud, cible future
  `geoai-kit` `applyManifestToMap()` (Lead #6) — ne pas réinventer.

**Hors scope v2.0** : Three.js / `scene_3d` (Atlas) ; `@cerema/map-editor` (D10).

**v1** : `index.html` reste Leaflet jusqu'à retrait published (Phase 8).

### D4 — Publication → **B → C** 🟢

**Choix** :
- **Beta** : `published/qgis2grist/v2/index.html` (parallèle v1).
- **Stable** : remplacement `published/qgis2grist/index.html` après §8 complet.

**Preuves** :
- Règle repo : `projects/` dev, `published/` sur demande explicite.
- grist-axis : Config B GitHub Pages ; pas de bump v1 sans validation.

### D5 — Mapper QML→declarative → **B** 🟢

**Choix** : module `lib/qml-to-declarative.js` (+ tests), importé par `index_v2.html`.

**Preuves** :
- D4 anti-drift : ne pas vendor `scene_manifest.py` ; mapper JS local OK.
- Pattern repo `grist_forms/tests/` : modules testables hors monolithe.
- `parseQmlStyle()` v1 reste source ; v2 **ajoute** couche declarative, ne supprime pas le parseur.

---

## 6 bis. Décisions dérivées (offre Cerema)

### D6 — Classification par défaut → `cerema_internal` 🟢

Aligné qgis-sspcloud Component/Assembly schema + publication-flow §1.6
(DEFAULT sain ; `public` jamais par défaut — anti-fuite RGPD).

Stockage : champ `classification` dans meta import (`QgisWidgets.config_json` v3).

### D7 — Double persistance 🟢

| Table | Rôle |
|-------|------|
| `SceneManifest` | Contrat Cerema — interop BigQgisMCP, Atlas, interactive_map |
| `QgisWidgets` | État widget — restore carte, meta BigQgisMCP, layer toggles |

`config_json` v3 contient `scene_manifest_row_id` (pointeur) + copie dénormalisée
optionnelle pour restore offline rapide (comme aujourd'hui).

❌ Ne pas choisir D1-C (manifest only in config) — casse interop `.grist`.

### D8 — Provenance import → Source Strate simplifiée 🟢

Pas de `audit_chain` complet à l'import (réservé publication qgis-sspcloud
D-FORMAT-008). Minimum D-QGIS-006 aligned :

```json
{
  "corpus": "qgis-import",
  "ref_id": null,
  "millesime": "2026",
  "authority": "<nom fichier ou projet QGIS>",
  "licence": "unknown",
  "statut": "a_verifier"
}
```

Dans `config_json.meta.sources[]` (une entrée par couche ou par import).

### D9 — Nommage tables contractuel 🟢

| Nom | Usage |
|-----|-------|
| `SceneManifest` | Exact (BigQgisMCP, Atlas Lead #10) |
| `QgisWidgets` | Inchangé (spécifique widget qgis2grist) |

### D10 — `@cerema/map-editor` 🟠 NON BLOQUANT

Étude `#composant-carte-convergence` (2026-06-30) : convergence future Atlas +
qgis-sspcloud + qgis2grist. **v2.0 n'attend pas** cette lib. MapLibre +
`StyleDeclarative` suffit pour MVP (aligné interactive_map).

---

## 7. Plan d'implémentation

```
Phase 0 — Cadrage           ✅ acté (§6–6 bis)
Phase 1 — F8 nettoyage code mort (index_v2.html)     ✅
Phase 2 — lib/qml-to-declarative.js + F1/F2/F3 + **MapLibre**     ✅
Phase 3 — D8 provenance Source + restauration manifest (D7)     ✅
Phase 4 — F4 import .grist via sql.js (D2)
Phase 5 — F5 import Scene Manifest JSON seul (optionnel)
Phase 6 — Tests manuels §8
Phase 7 — Publication published/qgis2grist/v2/ (D4-B)
Phase 8 — Remplacement v1 published (D4-C)
```

---

## 8. Tests manuels v2 (acceptation)

Rep reprendre v1 + :

1. `.gpkg` avec `layer_styles` QML catégorisé → table `SceneManifest` avec `kind: categorized`.
2. `.qgz` + GPKG ZIP → import OK ; manifest cohérent avec couleurs preview.
3. Reload widget → restauration carte + manifest depuis `SceneManifest` / `QgisWidgets`.
4. Fichier `.grist` BigQgisMCP (si dispo) → tables + manifest importés.
5. Tables lisibles par convention ZEBRA (`geometry_json` 4326, labels).
6. v1 `index.html` inchangé et toujours fonctionnel.

---

## 9. Registre des décisions

| Id | Sujet | Choix | Base | Date |
|----|-------|-------|------|------|
| D1 | Table SceneManifest | **A** append | BigQgisMCP export_grist | 2026-07-26 |
| D2 | Import .grist | **A** copie doc courant | Pivot DONNÉES qgis-sspcloud | 2026-07-26 |
| D3 | Carte widget v2 | **MapLibre** + StyleDeclarative | qgis-sspcloud + décision produit 2026-07-26 | 2026-07-26 |
| D4 | Publication | **B→C** | Règle repo projects/published | 2026-07-26 |
| D5 | Mapper QML | **B** lib/ testable | D4 anti-drift + grist_forms pattern | 2026-07-26 |
| D6 | Classification | **cerema_internal** | publication-flow §1.6 | 2026-07-26 |
| D7 | Persistance | **SceneManifest + QgisWidgets** | Interop vs restore widget | 2026-07-26 |
| D8 | Provenance | **Source Strate lite** | D-QGIS-006 | 2026-07-26 |
| D9 | Noms tables | **SceneManifest**, QgisWidgets | BigQgisMCP / v1 | 2026-07-26 |
| D10 | map-editor | **Reporter** v2.2+ | composant-carte-convergence 🟠 | 2026-07-26 |

---

## 10. État des fichiers

| Fichier | Statut |
|---------|--------|
| `index.html` | v1.1 stable (+ UX schéma-vide pending commit) |
| `index_v2.html` | **Phase 2 ✅** — MapLibre + SceneManifest + config v3 |
| `lib/qml-to-declarative.js` | F1 — mapper QML → StyleDeclarative |
| `lib/scene-manifest.js` | F2 — build Scene Manifest V0.2 |
| `lib/maplibre-bridge.js` | D3 — runtime carto MapLibre |
| `lib/provenance.js` | D8 — Source Strate lite + chaîne provenance |
| `tests/provenance.test.js` | Tests unitaires D8 |
| `docs/BINDING-…-v2.md` | Spec technique (référence) |
| `docs/CADRAGE-v2.md` | Ce document (gate) |
| `published/qgis2grist/` | v1.1 — ne pas toucher |

---

## 11. Prochaine action

1. ~~Trancher D1–D5~~ ✅ (§9).
2. Committer : v1 UX `index.html` + docs + `index_v2.html`.
3. ~~Phases 1–3~~ ✅ — Phase 4 (import `.grist`) ou tests §8.

*Dernière mise à jour : 2026-07-26*
