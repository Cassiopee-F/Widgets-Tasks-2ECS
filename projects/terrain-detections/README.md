# Terrain Détections

Widget Grist de gestion du flux de détections d'objets capturé depuis mobile.

## Compagnon mobile

Ce widget est le pendant bureau de l'app mobile [Terrain Vision](https://nic01asfr.github.io/Grist-AppStore/app-video/) (dépôt [Grist-AppStore](https://github.com/nic01asFr/Grist-AppStore)).

L'app mobile :
- Capture le flux caméra en temps réel
- Détecte 80 classes d'objets via TensorFlow.js COCO-SSD **embarqué** (WebGL/WASM, 15-25 FPS)
- Géolocalise chaque détection (GPS continu, vitesse, cap)
- Déduplifie par IoU + cooldown temporel
- Streame par batch vers Grist toutes les 3 secondes

Le widget affiche, filtre par catégorie, permet de plonger sur chaque détection.

## Table cible

Le widget attend une table `Detections_video` (auto-créée par l'app mobile).

| Colonne | Type | Rôle |
|---|---|---|
| `session_id` | Text | ID unique de la session de capture |
| `horodatage` | Text | ISO 8601 |
| `classe_fr` | Choice | Classe en français |
| `classe_en` | Text | Classe COCO-SSD originale |
| `categorie` | Choice | Véhicule / Personne / Animal / Infrastructure / Objet |
| `confiance` | Numeric | Score du modèle (0-100) |
| `latitude` | Numeric | 7 décimales |
| `longitude` | Numeric | 7 décimales |
| `precision_gps` | Numeric | Mètres |
| `vitesse_kmh` | Numeric | Vitesse du capteur |
| `cap_degres` | Numeric | Cap en degrés |
| `nb_objets_frame` | Numeric | Objets dans le frame |
| `bbox` | Text | JSON [x, y, w, h] |
| `snapshot` | Text | Data URL JPEG (optionnel) |

## Fonctionnement

- Filtres par catégorie (Véhicule, Personne, Animal, Infrastructure, Objet)
- Recherche full-text (classe, session)
- Tri par colonne
- Panneau détail avec miniature snapshot, coordonnées GPS et lien carte
- Statistiques : total, sessions, classes, confiance moyenne

## Structure

```
index.html          Squelette + imports
app.js              Bootstrap et orchestration
lib/
  grist-adapter.js  Wrapper grist.ready / onRecords (read-only)
  data-model.js     Normalisation records + couleurs de catégorie
  ui-filters.js     Chips catégorie + recherche
  ui-list.js        Tableau + tri + barre de confiance
  ui-detail.js      Panneau détail avec snapshot + carte
  ui-stats.js       Compteurs de tête
styles.css          Feuille de style
```

## Installation dans Grist

1. Dans un document Grist, "Add New" → "Add Widget to Page"
2. Type : Custom, table : `Detections_video`
3. URL : `https://nic01asfr.github.io/Widgets-Grist/terrain-detections/`
4. Accès requis : "Read selected table" (lecture seule suffit)

## Version

v1.0.0 — première publication dans `Widgets-Grist`. Refactorisé depuis le monolithe du repo `Grist-AppStore/grist-widget-video/`.

## Licence

MIT
