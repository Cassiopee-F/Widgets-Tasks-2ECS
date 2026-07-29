# Atlas v7 — Validation binding (offre Cerema)

Interop **qgis2grist → Scene Manifest → Atlas** (style + contrôles + récit).

| Environnement | URL |
|---------------|-----|
| **Publié** | `https://nic01asfr.github.io/Widgets-Grist/atlas/` |
| Dev local | `http://localhost:8766/Atlas/index_v7.html?v=20260730c` |

**Jeu de données :** doc Grist importé depuis `qfield_bees.zip` (Bee Farming)

---

## 1. Chargement Scene Manifest

- [ ] Ouvrir Atlas sur le doc Grist qgis2grist
- [ ] Toast : `qgis2grist · N couche(s) · M visible(s)`
- [ ] Couches métier visibles (Apiary, Fields…), fond (buildings) masqué par défaut
- [ ] Console sans erreur module ES

## 2. StyleDeclarative (symbolisation)

| Couche | Test | Attendu |
|--------|------|---------|
| **Apiary** | Clic couche → inspecteur **ouvert** | Panneau Symboliser visible (pas de pastille carte) |
| **Apiary** | Mode Catégorisé, champ espèce | Couleurs + légende OK |
| **Toute couche** | Modifier couleur → Enregistrer | Prefs Atlas ; reload → style conservé |
| **Inspecteur** | Bouton ✕ | Panneau fermé ; reclic couche → rouvert |

## 3. ControlDeclarative (module Contrôles)

- [ ] Ouvrir **Contrôles**, sélectionner une couche
- [ ] Filtres pré-configurés (import qgis2grist, inactive par défaut)
- [ ] Activer filtre → objets filtrés sur carte
- [ ] **Enregistrer** → prefs `Atlas_LayerPrefs` (`controls` + `declarative`)

## 4. Soleil / overlays carte

- [ ] Dock soleil à gauche de la boussole (gap 12px), hauteur 54px, sans scroll
- [ ] Repli → pastille soleil ; réouverture OK
- [ ] Arc / heure / ombres fonctionnels

## 5. Récit (storymap)

- [ ] Capturer ≥2 étapes (caméra + filtres + symbo)
- [ ] Lecture ▶ : état rejoué
- [ ] Reload → `Atlas_Story` persisté

## 6. Export / interop

- [ ] Projet JSON version `2.2-atlas-binding` avec `storyManifest`, `declarative`, `controls`
- [ ] Recharger le JSON → état identique

---

## Critères d’acceptation

1. Scene Manifest → style + controls appliqués
2. Édition Atlas → `Atlas_LayerPrefs`
3. Récit capture / rejoue symbo + contrôles + caméra
4. Clic couche = inspecteur ouvert ; ✕ = fermeture (pas de FAB carte)
