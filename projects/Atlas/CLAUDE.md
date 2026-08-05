# Projet : Atlas — Maquette 3D Territoriale

## Contexte

Widget Grist de maquette territoriale 3D (MapLibre + three.js), direction UX **Atlas**.
Cible : construire et présenter une scène (import, symbolisation, contrôles, récit, modèles 3D).

Interop Cerema : lecture **Scene Manifest V0.2.2** produit par qgis2grist, prefs utilisateur
`Atlas_LayerPrefs`, récit `Atlas_Story`.

## Architecture des fichiers

```
Atlas/
├── index_v7.html          # Entrée courante (v7) — source de publication
├── app_v7.js              # Logique v7 (ES module)
├── lib/                   # Binding Scene Manifest / Grist / contrôles / récit
│   ├── scene-loader.js
│   ├── declarative-style.js
│   ├── controls.js
│   ├── manifest-binding.js
│   ├── story.js
│   ├── grist-sync.js
│   ├── grist-rows.js
│   ├── grist-bool.js
│   ├── geo-tables.js
│   └── viewport.js
├── docs/
│   ├── BINDING-ATLAS-v7.md
│   ├── CADRAGE-BINDING-COMPLET.md
│   └── MANUAL_TEST.md
├── tests/                 # node --test
└── CLAUDE.md
```

> **`projects/Atlas/app.js` sur `origin/main` — ne pas écraser.**
> Cette entrée pré-v7 (3 110 lignes) porte deux fonctionnalités **absentes de la
> v7 et de la version en ligne** : l'export QGIS (`layerToQML`, `qgisSymbol`,
> `hexToQgisColor`, `downloadFile`) et le modèle 3D par objet en pièce jointe
> Grist (`model_glb`, colonne `Attachments`). Elles ont quitté le widget lors du
> passage à la v7, le 30 juillet 2026 — sans décision explicite : la v7 a été
> développée sur une branche qui ignorait cette lignée.
>
> Tant qu'elles ne sont pas portées dans la v7, ce fichier est leur **dernière
> copie**. Les versions de travail pré-v7 ont été retirées du poste
> (sauvegarde : `backups/atlas-prev7/`) parce qu'un `git add projects/Atlas/`
> aurait remplacé la version complète par une copie tronquée de 2 371 lignes.
>
> Portage : l'export QGIS ≈ 108 lignes, quatre fonctions isolables en
> `lib/qgis-export.js` — mais le QML doit alors être **généré depuis le
> StyleDeclarative**, pas depuis l'état interne, pour respecter
> `BINDING-QGIS-GRIST-CEREMA-v2.md` §5.2. Pour `model_glb`, arbitrer d'abord la
> coexistence avec le catalogue partagé (`catalog.json`) : pièce jointe par objet
> > `gltf_url` de couche > catalogue > cercle 2D.

**Publication** : `published/atlas/` = copie de `index_v7.html` → `index.html`, `app_v7.js` → `app.js`, + `lib/`.

## Décisions techniques

1. **MapLibre GL JS v5** (globe) — plus de Mapbox.
2. **Modèles 3D** : custom layer three.js / InstancedMesh (`Models3D`).
3. **Fonds** : OpenFreeMap + IGN Géoplateforme.
4. **Binding** : Scene Manifest → style + controls ; prefs Atlas prioritaires (voir `docs/BINDING-ATLAS-v7.md`).
5. **Inspecteur droit** : ouvert au clic couche ; fermeture via ✕ (pas de pastille flottante).
6. **Dock soleil** : barre compacte ancrée à gauche de la boussole, repliable en pastille soleil.

## Modules UI

Lieu · Couches · Soleil · Vues · Contrôles · Récit · Réglages (+ symboliser via inspecteur).

## État actuel — fonctionne

- Chargement Scene Manifest / tables qgis2grist (cas Bee Farming validé).
- Symbolisation (fixe / catégorisé / gradué), contrôles, récit, export JSON `2.2-atlas-binding`.
- Dock soleil haut-droite (repli style boussole) ; inspecteur fermable.
- Couches fond (buildings/landscape/lines) masquées par défaut à l’import.
- **Mode lecture** : `?mode=view` ou accès Grist `read table` ; badge Lecture ; pas d’écriture prefs/story/features.
- **Mobile ≤720px** : bottom nav Carte / Couches / Récit ; panneaux en sheet ; géolocalisation ; `?no3d=1` / light3d.

## Points d’attention

- **Colonnes géométriques** : `source.geometry_fields` du manifest prime sur la
  convention `latitude`/`longitude`/`geometry_json`. Sans lui (imports anciens),
  repli sur les variantes suffixées (`latitude2`) quand lat/lon valent 0 —
  collision qgis2grist. `(0, 0)` est traité comme « pas de coordonnée ».
- **Visibilité par défaut** : sans `visibility.defaultVisible` explicite,
  `isBasemapLayer` masque toute couche de plus de 2 500 entités. Une couche
  d’analyse volumineuse doit donc porter `defaultVisible: true` dans le manifest.
- **Chargement différé** : une couche masquée de plus de `DEFER_FEATURE_THRESHOLD`
  entités n’est convertie en GeoJSON qu’à son activation (`materializeDeferredLayer`).
  Le critère est le volume seul — pas le nom de la couche. La matérialisation est
  portée par `setLayerVisibility`, donc valable quelle que soit l’origine de
  l’activation (pastille, récit, prefs).
- **Zoom manifest non appliqué** : Atlas ignore `visibility.minZoom`/`maxZoom` —
  seul `defaultVisible` agit. Le LOD zoom du manifest ne vaut que pour les
  lecteurs qui l’implémentent (carte qgis2grist).

## Apparence des couches

Réglages portés par `style.symbolization` (persistés dans `Atlas_LayerPrefs`) :

| Réglage | Clé | Défaut |
|---|---|---|
| Opacité de couche | `opacity` | `null` = suit l’entité puis la géométrie (point 0.92 · ligne 0.9 · surface plate 0.55 · volume 0.85) |
| Contour | `stroke: {enabled, mode, color, width}` | actif, `mode:'follow'` (suit le remplissage), 1.5 px |
| Base d’extrusion | `extrusion.base` | 0 |
| Étiquette | `label: {size, color}` | 12 px, `#2D2820` |
| Rendu surfacique | `style.polygonMode` | `'flat'` pour les imports qgis2grist |

- **Ordre de priorité de l’opacité** : valeur fixée par l’utilisateur → `_fill_opacity`
  de l’entité (issue des `stops[].opacity` du style déclaratif, lue par
  `opacityFnFromDeclarative`) → défaut de la géométrie.
- `_fill_opacity` n’est posé sur une entité **que** si une opacité est déclarée ;
  sinon il reste absent pour que le `coalesce` retombe sur l’opacité de couche.
- Le contour en mode `follow` réutilise `layerPaintColor`, donc il suit la
  symbolisation (catégorisée ou graduée) au lieu d’une couleur unique.
- Sur une surface **à plat**, l’onglet Taille masque « Hauteur extrusion » —
  le réglage serait sans effet. La bascule « À plat / En volume » le réactive.
- **`polygonMode` par défaut** : `’flat’` n’est posé d’office que pour les imports
  `qgis2grist`. Toute autre couche surfacique part donc **en volume** (`extrude =
  polygonMode !== ‘flat’`), ce qui la rend invisible en vue régionale (sous-pixel,
  et le repli en points ne vise que les surfaces à plat) et coûte très cher au
  rendu. Une grille d’analyse doit déclarer `polygonMode: ‘flat’`.
- **`_fill_color` fait foi dès qu’un style déclaratif existe** (`layerPaintColor`),
  plus seulement pour `qgis2grist` : une table Grist stylée par un récit se peint
  comme un import.
- **Les couleurs du déclaratif priment sur la rampe nommée**
  (`sequentialPaletteForSym`). Sans cela `applyLayerStyle` recoloriait les couches
  `qgis2grist` depuis `colorRamp` et effaçait la symbologie du récit.
- **Classes graduées bornées** : si les `stops` portent `lower`/`upper`, ils sont
  appliqués tels quels ; l’étalement linéaire min→max n’est qu’un repli. Sur une
  distribution asymétrique (mailles à 1–2 bâtiments, maximum à 134) l’étalement
  verse la quasi-totalité dans la première classe.
- `applyLayerPrefsBinding` restaure l’apparence **en plus** du style déclaratif
  (`mergeAppearancePrefs`) : un `declarative` dans les prefs ne doit pas effacer
  opacité, contour ni base d’extrusion.

## Placement 3D réservé aux couches à modèles (`lib/model-layer.js`)

`isModelLayer(layer)` = mode `library`/`custom` **et** géométrie ponctuelle. Les
réglages de placement (échelle, rotations, altitude, décalages) pilotent une
instance three.js posée sur un point — `Models3D.placement()` lit
`feature.geometry.coordinates` comme `[lng, lat]` — donc ils n'ont ni effet ni sens
sur une surface, une ligne ou un point rendu en cercle 2D.

- L'inspecteur d'objet compose ses onglets via `objectInspectorTabs()` :
  « Attributs » pour tout objet unique (édition si `qgis2grist`, lecture sinon),
  « Placement 3D » seulement si `isModelLayer`. Une sélection multiple non 3D
  n'a aucun onglet et affiche un état vide.
- **Le corps de l'inspecteur suit l'onglet actif.** Il avait auparavant sa propre
  cascade de conditions : retirer l'onglet sans toucher au corps aurait laissé les
  curseurs 3D visibles pour les objets non `qgis2grist`, en sélection multiple et
  en mode lecture.
- **`atlas_3d_json` n'est sérialisé que pour une couche à modèles**
  (`featureToRowUpdate`). C'est la seule garde qui protège la donnée : sans elle,
  des surcharges héritées — ou une couche ayant changé de mode — écriraient des
  transformations 3D sur des objets qui ne seront jamais rendus ainsi.
- « Reset » ne rétablit que les surcharges de placement : il n'apparaît qu'avec
  l'onglet 3D. « Enregistrer » reste, car `applySelected` persiste aussi les
  attributs.
- Reste à faire : la règle est encore réécrite à la main en 7 points d'`app_v7.js`
  (943, 1906, 1944, 2770, 2865, 2903, 2944), dont **1906, 1944 et 2944 sans la
  condition ponctuelle**. À remplacer par `isModelLayer`.

## Repli en points (`lib/point-fallback.js`)

Une maille d’analyse de 200 m mesure moins d’un pixel en vue régionale : le
polygone est chargé, mais rien ne s’affiche. `pointFallbackZoom()` calcule le
zoom sous lequel les surfaces d’une couche passent sous `MIN_FEATURE_PX` (3 px)
à partir de leur taille réelle ; en deçà, Atlas peint une couche `circle` sur
leurs centres (rayon fixe à l’écran), au-delà les surfaces reprennent la main.

- Actif seulement sur les couches **surfaciques à plat** d’au moins
  `POINT_FALLBACK_MIN_FEATURES` (300) entités.
- Source parallèle `<layer.id>-pts`, alimentée par `centroidCollection()` et
  **filtrée comme la couche principale** (cf. `syncLayerSourceData`).
- Les propriétés sont conservées, donc les points gardent la symbolisation.
- Une couche différée est vide au montage : son seuil est réévalué et la couche
  remontée dès qu’elle se peuple (`_pointFallbackAt`).
- Un anneau GeoJSON étant fermé, `featureCentroid()` ignore le sommet répété —
  sans quoi chaque centre serait décalé vers ce sommet.

- Le rayon des points ne descend pas sous `MIN_FEATURE_PX` : un repli plus fin
  que le seuil reproduirait l'invisibilité qu'il corrige.
- Le masquage d'une couche couvre tous ses habillages (`-outline`, `-label`,
  `-hit`, `-pts`) : sans `-pts`, le repli restait à l'écran après extinction ;
  sans `-hit`, la zone de clic restait active sur une couche invisible.

Repère mesuré : mailles de 200 m → bascule vers **z10,8**.

## Récit (`Atlas_Story`)

- Une étape décrit l’**état complet** de la scène : `applyStoryState` masque les
  couches qu’elle ne cite pas. `captureStoryState` enregistre toujours toutes les
  couches ; seuls les récits écrits à la main sont partiels.
- `findStoryLayer` résout par **`sourceTable` d’abord**, puis id, puis nom. Le nom
  n’est qu’un repli : deux couches homonymes issues d’imports différents feraient
  sinon appliquer styles et filtres aux mauvaises données.
- `storyExit` rétablit l’état d’avant présentation (visibilité, filtres,
  symbolisation, **rendu surfacique**) via `restorePreStorySnapshot` +
  `remountAllLayers`.
- Une étape peut porter **`polygonMode`** : posé *avant* l’affichage de la couche,
  car le repli en points ne vise que les surfaces à plat et doit connaître le mode
  au montage. C’est ce qui permet de montrer un bâti en volume (morphologie =
  critère SEVI_B) puis de le remettre à plat.
- La caméra se cale sur la **zone utile**, pas sur la carte entière : la bulle de
  texte masque le tiers inférieur, et le panneau latéral (s’il reste ouvert) la
  moitié gauche. En projection **globe**, sous z≈8, le calcul Mercator surestime
  le zoom d’environ un cran — caler à l’œil plutôt que par la formule.
- Un filtre `range` sur un champ absent est ignoré ; un filtre `select` sur un
  champ absent exclut toutes les entités (cf. `buildControlPredicate`).
- **`requireValue`** sur un contrôle `range` inverse cette tolérance : une entité
  dépourvue de l’attribut (ou de valeur non numérique) est **écartée**. À poser
  sur les vues thématiques dont l’attribut n’est renseigné que partiellement —
  sans lui, les entités muettes reçoivent la couleur de repli du style gradué et
  recouvrent la thématique (cas de `nb_bat`, absent de 67 % des mailles de la
  grille sarde). Transmis par `applyStoryControlsToLayer` et conservé par
  `captureStoryState`.

- Ombres = éclairage modèles three.js (pas shadow map MapLibre au sol).
- Modèles GLB via `published/models/` (GitHub Pages).
- Tests : `node --test projects/Atlas/tests/*.test.js` (chemins quotés sous PowerShell).
- Spec lecture/mobile : `docs/superpowers/specs/2026-07-30-atlas-view-mobile-design.md`

## Publication

```bash
# Déjà fait via promote manuel → published/atlas/
npm run manifest
# Commit published/atlas + manifest, puis push pour gh-pages
```

URL widget : `https://nic01asfr.github.io/Widgets-Grist/atlas/`  
Édition : `requiredAccess: 'full'` (défaut). Lecture : `?mode=view` → `read table`.
