# Terrain Observations

Widget Grist de gestion des observations terrain saisies depuis mobile.

## Compagnon mobile

Ce widget est le pendant bureau de l'app mobile [Terrain Voix](https://nic01asfr.github.io/Grist-AppStore/app/) (dépôt [Grist-AppStore](https://github.com/nic01asFr/Grist-AppStore)).

L'app mobile :
- Capture la voix (STT streaming par chunks 10 s, SSPCloud / Albert)
- Capture une photo (analyse VLM gemma4-31b)
- Structure les champs via un LLM
- Attache audio + photo comme PJ Grist
- Géolocalise chaque observation

Le widget affiche, filtre, valide.

## Table cible

Le widget attend une table `Visites_terrain` (auto-créée par l'app mobile) avec les colonnes suivantes. Toute colonne manquante est simplement ignorée.

| Colonne | Type | Rôle |
|---|---|---|
| `transcription_brute` | Text | Texte dicté par l'agent |
| `commentaire_structure` | Text | Reformulation LLM |
| `type_observation` | Choice | Voirie, Ouvrage d'art, Signalisation… |
| `localisation_precise` | Text | Descriptif terrain |
| `niveau_urgence` | Choice | faible / moyen / élevé / critique |
| `actions_requises` | Text | Actions identifiées par l'IA |
| `materiaux_concernes` | Text | — |
| `surface_estimee` | Numeric | m² |
| `date_visite` | Date | Timestamp Unix |
| `statut` | Choice | à traiter / en cours / validé / rejeté |
| `audio` | Attachments | PJ audio |
| `coordonnees_gps` | Text | "lat, lon (±m)" |

## Fonctionnement

- Filtres statut + urgence + recherche full-text
- Tri par colonne
- Panneau détail éditable (commentaire, actions, statut)
- Dropdown de changement rapide de statut par ligne
- Lien OpenStreetMap sur les coordonnées GPS
- Compteurs : total, critiques, à traiter

## Structure

```
index.html          Squelette + imports
app.js              Bootstrap et orchestration
lib/
  grist-adapter.js  Wrapper grist.ready / onRecords / update
  data-model.js     Normalisation records + badges
  ui-filters.js     Barre de filtres
  ui-list.js        Tableau + tri
  ui-detail.js      Panneau détail éditable
  ui-stats.js       Chips de compteurs
styles.css          Feuille de style
```

## Installation dans Grist

1. Dans un document Grist, "Add New" → "Add Widget to Page"
2. Type : Custom, table : `Visites_terrain`
3. URL : `https://nic01asfr.github.io/Widgets-Grist/terrain-observations/`
4. Accès requis : Full document access

## Version

v1.0.0 — première publication dans `Widgets-Grist`. Refactorisé depuis le monolithe du repo `Grist-AppStore/grist-widget/`.

## Licence

MIT
