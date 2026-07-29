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
├── index_v6.html / app_v6.js   # Historique (ne plus étendre)
├── index.html / app.js         # Ancienne entrée (pré-v7)
└── CLAUDE.md
```

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

## Points d’attention

- Ombres = éclairage modèles three.js (pas shadow map MapLibre au sol).
- Modèles GLB via `published/models/` (GitHub Pages).
- Tests : `node --test projects/Atlas/tests/*.test.js` (chemins quotés sous PowerShell).

## Publication

```bash
# Déjà fait via promote manuel → published/atlas/
npm run manifest
# Commit published/atlas + manifest, puis push pour gh-pages
```

URL widget : `https://nic01asfr.github.io/Widgets-Grist/atlas/`  
`requiredAccess: 'full'` (tables prefs / sync).
