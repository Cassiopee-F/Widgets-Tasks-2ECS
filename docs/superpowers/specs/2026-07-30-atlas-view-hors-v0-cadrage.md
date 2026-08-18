# Atlas lecture — cadrage hors V0 (#5)

**Date** : 2026-07-30  
**Statut** : cadrage (pas d’implémentation)  
**Prérequis** : V0 lecture + mobile actée dans `projects/Atlas/` (`?mode=view`, légende cliquable, popup clic, chrome allégé)

---

## Contexte

La V0 lecture est un **runtime de consultation** dans le même widget Atlas. Trois sujets restent hors V0 ; ils ne bloquent pas bees / tests manuels, mais cadrent la suite produit.

| # | Sujet | Pourquoi pas V0 |
|---|--------|------------------|
| A | `popup_template` Scene Manifest | Pas de champ SM aujourd’hui ; popup attributs générique suffit |
| B | Entrée catalogue « Atlas Lecture » | Un seul widget + `?mode=view` suffit ; duplication promote |
| C | Promote `published/atlas/` | Demande explicite utilisateur (règle repo) |
| D | Atelier Contrôles + dock pastilles | Cadrage dédié : `2026-07-30-atlas-controls-atelier-dock-design.md` |

---

## A. `popup_template` (Scene Manifest → Atlas)

### Problème

En lecture, le clic ouvre une popup **attributs auto** (champs `_fields` / properties). L’éditeur ne peut pas choisir titre, champs, HTML, ni masquer des colonnes techniques.

### Proposition V1

1. **Schéma SM** (couche) — optionnel :
   ```json
   "popup": {
     "enabled": true,
     "title": "{name}",
     "template": "<b>{bee_species}</b><br>{notes}",
     "fields": ["bee_species", "notes"]
   }
   ```
   - `enabled: false` → pas de popup (clic no-op ou ciblage légende seulement)
   - `template` : substitutions `{field}` (déjà amorcé côté Atlas)
   - `fields` : liste ordonnée si pas de template (fallback structured)

2. **Producteur** : qgis2grist exporte depuis QGIS form / HTML map tip si présent, sinon omit → Atlas fallback.

3. **Atlas** : `buildViewPopupHtml` lit `layer._manifestLayer.popup` (déjà branché pour `popup_template` / `popup.template`).

### Hors scope V1

- Éditeur WYSIWYG de template dans Atlas
- Popups multimédia / pièces jointes Grist
- Différenciation popup édition vs lecture

### Critères

- [ ] SM bees sans `popup` → comportement V0 inchangé
- [ ] SM avec `popup.template` → HTML rendu échappé + `{field}`
- [ ] `popup.enabled: false` → pas de popup MapLibre

---

## B. Entrée catalogue « Atlas Lecture »

### Problème

Aujourd’hui l’auteur doit coller `?mode=view` dans l’URL du Custom Widget. Facile à oublier ; le sélecteur Grist ne distingue pas lecture / édition.

### Options

| Opt | Description | Pour | Contre |
|-----|-------------|------|--------|
| **B1** | 2ᵉ entrée `grist` dans le même `package.json` (`atlas` + `atlas-view`), même `index.html`, URL avec `?mode=view` | Zéro fork code ; clair dans le sélecteur | Deux lignes catalogue |
| **B2** | Widget pack séparé `published/atlas-view/` | Isolation totale | Duplication promote / drift |
| **B3** | Rien — doc + tip URL | Simple | UX partage faible |

**Recommandation** : **B1** au moment du promote — une seule build, deux métadonnées.

Exemple `package.json` (indicatif) :

```json
"grist": [
  {
    "widgetId": "atlas",
    "name": "Atlas",
    "url": "index.html",
    "accessLevel": "full",
    "description": "Scène carto 3D — édition"
  },
  {
    "widgetId": "atlas-lecture",
    "name": "Atlas Lecture",
    "url": "index.html?mode=view",
    "accessLevel": "read table",
    "description": "Consultation scène Atlas (sans écriture)"
  }
]
```

### Critères

- [ ] Manifest GitHub Pages liste les 2 widgets
- [ ] « Atlas Lecture » démarre en `viewMode` sans param manuel supplémentaire
- [ ] « Atlas » garde le comportement auto full / fallback lecture

---

## C. Promote `published/atlas/`

### Règle repo

Ne pas toucher `published/` sans demande explicite.

### Checklist promote (quand demandé)

1. Copier `index_v7.html` → `published/atlas/index.html` (+ `app_v7.js`, `lib/*` nécessaires)
2. `package.json` grist avec **B1** (édition + lecture)
3. Cache-bust / versions assets cohérents
4. `npm run manifest`
5. Commit dédié `feat(atlas): publish lecture v…`
6. MANUAL_TEST smoke sur URL gh-pages

### Hors promote

- Terrain PWA / REST multi-docs
- Rename produit Atlas ≠ Strate

---

## Ordre suggéré

```
V0 lecture (fait) → validation bees manuelle
  → A popup_template (si besoin métier QGIS map tips)
  → C promote + B1 catalogue (même PR publication)
  → Terrain PWA (spec séparée)
```

---

## Décisions à trancher (utilisateur)

1. **Export local en lecture** : retiré du header V0 — le remettre via cmdk seulement, ou bouton discret ?
2. **B1 vs B3** pour le catalogue au prochain promote ?
3. **Priorité A** : bees a-t-il des map tips QGIS à porter, ou fallback attributs OK longtemps ?
