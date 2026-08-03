# Atlas v7 — Validation binding (offre Cerema)

Interop **qgis2grist → Scene Manifest → Atlas** (style + contrôles + récit).

| Environnement | URL |
|---------------|-----|
| **Publié** | `https://nic01asfr.github.io/Widgets-Grist/atlas/` |
| Dev local | `http://localhost:8766/Atlas/index_v7.html?v=20260730o` |
| Lecture forcée | même URL + `&mode=view` |

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

## 7. Mode lecture (`?mode=view` ou droits read-only)

- [ ] Badge **Lecture** visible dans le header
- [ ] Doc **public viewer** (non authentifié) : même chrome lecture **sans** `?mode=view` (sonde écriture au boot)
- [ ] Scene Manifest charge ; console sans erreur AddTable / prefs
- [ ] Toggle couche / filtre local OK ; **pas** d’écriture `Atlas_LayerPrefs` après reload (prefs inchangées)
- [ ] Capture récit / Enregistrer objets → toast « Mode lecture — … indisponible »
- [ ] Clic légende (couche ou catégorie) → zoom / ciblage ; pas d’onglet Couches
- [ ] Onglet / rail Récit visible seulement si `Atlas_Story` non vide
- [ ] Clic objet → **popup MapLibre** (attributs ou `popup_template` si présent) — **pas** d’inspecteur Géométrie / barre sélection
- [ ] Clic fond carte ferme la popup
- [ ] Export JSON / GeoJSON toujours possible (download local)
- [ ] Sans `?mode=view`, auteur `full` : édition prefs inchangée

## 8. Mobile lecture (DevTools 390px ou téléphone)

- [ ] Pas de bottom nav ; FAB **▶ Récit** si étapes ; légende cliquable
- [ ] Loupe header (cmdk) ouvre la recherche
- [ ] Pas de HUD coords/zoom/pitch ; pas Exporter / dirty dans le header
- [ ] Contrôles publiés : panneau repliable (replié par défaut sur mobile)
- [ ] Clic objet → popup (pas bottom-sheet inspecteur)
- [ ] Contrôle géolocalisation MapLibre utilisable
- [ ] `?no3d=1` : pas de rebuild Models3D lourd

---

## Critères d’acceptation

1. Scene Manifest → style + controls appliqués
2. Édition Atlas → `Atlas_LayerPrefs`
3. Récit capture / rejoue symbo + contrôles + caméra
4. Clic couche = inspecteur ouvert ; ✕ = fermeture (pas de FAB carte)
5. Mode lecture : clic → popup (pas inspecteur) ; pas d’écriture Grist ; badge visible
6. Mobile ≤720px : bottom nav + carte consultable
