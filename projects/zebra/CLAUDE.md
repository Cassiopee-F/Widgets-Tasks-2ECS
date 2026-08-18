# CLAUDE.md — Widget ZEBRA (4 widgets coordonnés)

## Contexte

ZEBRA = diagnostic sécurité passages piétons par IA (CEREMA Méditerranée × INSERM DSR × ADERA).
4 widgets Grist coordonnés sur le **même schéma de données**, même table `Pp`.

## Architecture

```
Doc Grist
  ├── Pp            (passages piétons — schéma v1.0, ~50 colonnes)
  ├── Etudes        (runs d'inférence)
  ├── Campagnes     (zones pour Atlas)
  ├── Corrections   (audit trail append-only)
  └── Pp_vision     (objets géoréférencés par zebra-vision)

4 widgets sur la même page :
  inference/  → lance SAMGeo3 + classifiers → remplit Pp
  validation/ → révision carte + LOM → statut_terrain
  terrain/    → photo + GPS → DepthPro + GroundingDINO → cl_* + Pp_vision
  atlas/      → 3D + OSM + campagnes
```

## Coordination inter-widgets (pattern Taskflow)

- `shared/grist_bridge.js` : `ZebraGristBridge` gère `grist.setSelectedRows` et `grist.onRecord`
- Sélectionner un PP dans n'importe quel widget → tous les autres se centrent dessus
- `shared/grist_schema.js` : schéma canonique, `ensureTables()`, `PP_COLUMNS` etc.
- `shared/zebra_osm.js` : requêtes Overpass pour les 14 critères, `fetchOsmPreset()`

## IDs Grist (IMPORTANT)

Grist normalise les IDs de tables (première lettre en majuscule) :
- `'pp'` → `'Pp'` dans `applyUserActions`
- `'etudes'` → `'Etudes'`
- `'corrections'` → `'Corrections'`
- `'campagnes'` → `'Campagnes'`
- `'pp_vision'` → `'Pp_vision'`

## Connexion au service ZEBRA

URL de base : `https://user-nic01asfr-zebra-bridge.user.lab.sspcloud.fr`

Endpoints disponibles :
- `GET /api/manifest` — Instance Manifest
- `GET /api/styles` — zebra_styles.json (styles partagés)
- `GET /api/schema` — schéma tables Grist
- `GET /api/available` — communes disponibles
- `POST /api/process` — lancer inférence SAMGeo3
- `GET /api/status/{job_id}` — statut job (SSE via EventSource)
- `GET /api/export/gpkg` — export GPKG L93
- `POST /api/convert/gpkg` — GeoJSON → GPKG
- `POST /api/vision` — photo+GPS → objets géoréférencés (à implémenter)
- `POST /api/phase2` — pipeline LOM stationnement (à implémenter)

## pipeline zebra-vision

Photo terrain + GPS + cap boussole :
1. `POST /api/vision` → DepthPro (profondeur) + GroundingDINO (détection)
2. Géoréférencement : `bearing = heading + angle_h`, `lat2,lng2 = vincenty(gps, bearing, depth_m)`
3. Résultat → Pp_vision table + UpdateRecord Pp.cl_* si pp_id fourni

## Développement

```bash
# Pas de build — vanilla JS + importmap
# Servir localement pour test
python -m http.server 3000
# Ouvrir http://localhost:3000/validation/ dans Grist Custom Widget

# Après modif → promote vers published/
npm run promote
```

## Conventions

- Vanilla JS, zéro framework, zéro build
- `type="module"` sur les scripts (pour les imports shared/)
- `window.ZEBRA_API = 'https://user-nic01asfr-zebra-bridge...'` dans chaque widget
- Offline-first terrain : localStorage queue + sync au retour réseau
- Photos = Grist Attachments (blob, pas URL) pour autonomie réseau terrain

## Repos frères (lecture seule)

- `../../Passerelle/examples/zebra/service/` — code Python du service ZEBRA
- `../../depthpro/` — service DepthPro (Docker, port 9010)
- `../../cerema-offre-de-service/L6-scout-terrain/` — pattern app terrain SCOUT IA
- `../Atlas/` — code source atlas (fork → app_zebra.js)
