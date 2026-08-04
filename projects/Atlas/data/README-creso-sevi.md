# CRESO / SEVI — Cagliari (GPKG qgis2grist)

Fichier : `creso_sevi_cagliari.gpkg` (~18 Mo)

Produit QGIS pour remplacer / compléter les données incohérentes du doc Grist `gc-22fb54`
(grille Sardaigne vs « bâti » Ligurie mal nommé).

## Couches

| Couche | Type | Features | Style Atlas recommandé |
|--------|------|----------|------------------------|
| **Grille_analyse_200m** | Polygon | 3 843 | Graduated `score_enjeu` (YlOrRd) |
| **Batiments** | Polygon | 38 848 | Categorized `usage_sevi` |
| **Routes** | Line | 6 934 | Categorized `highway` |
| **Sites_etude_INTERREG** | Point | 10 | Categorized `Case_study` |

CRS : EPSG:32632 (UTM 32N) pour géométries grille / bâti / routes.  
Sites : EPSG:4326 + colonnes `latitude` / `longitude`.

## Attributs grille (alignés SEVI)

- `nb_bat`, `nb_residence`, `nb_bat_hebergement`
- `lg_route_m`, `surf_bat_m2`
- `score_enjeu` (0–1, proxy synthétique densité bâti + routes + hébergement)
- `fill_color`

## Import qgis2grist

1. Ouvrir le widget **qgis2grist v2** sur le document cible (ou un doc neuf de test).
2. Déposer `creso_sevi_cagliari.gpkg`.
3. Vérifier styles déclaratifs + contrôles range/select.
4. Ouvrir **Atlas v7** → SceneManifest généré automatiquement.

## Limites assumées V1

- Zone = métropole **Cagliari** (pas toute la Sardaigne 42k cellules).
- Données OSM (pas BD TOPO / DBSN officielles).
- Routes : primary/secondary/residential/trunk (tertiary partiel — rate-limit Overpass).
- Pas encore de scores CHI / PSI physiques (manque aléa / morphologie côtière).
- `score_enjeu` = proxy d’enjeu, pas le SEVI composite méthodologique complet.
