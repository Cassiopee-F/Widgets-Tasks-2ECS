# Atlas — mode lecture + mobile lecture

**Date** : 2026-07-30  
**Statut** : implémenté V0 (projects/Atlas) — publication `published/atlas/` sur demande  
**Projet** : Widgets Grist / `projects/Atlas/` (v7 → `published/atlas/`)  
**Hors scope** : Terrain PWA/APK qgis2grist, client REST multi-docs, embed Atlas dans terrain (V1), APK Capacitor

**Décisions WikiChat** : `#decisions` 2026-07-30 — rôles stack ; consommation Atlas lecture vs édition ; mobile = lecture d’abord.

---

## 1. Objectif

Permettre de **consulter** une scène Atlas (Scene Manifest qgis2grist) sans droits d’écriture Grist, y compris sur **téléphone / tablette** en composition lecture — sans refondre l’UI auteur bureau.

**Succès V0** :

1. Un utilisateur avec accès **lecture seule** sur le doc Grist ouvre Atlas et voit la carte + couches + récit **sans erreur d’écriture**.
2. `?mode=view` force le même comportement même si le compte a `full`.
3. Sous ~720 px : carte utilisable (zoom, couches, fiche attributs, récit) ; chrome auteur replié / masqué.
4. Aucune régression du mode édition bureau (`full`, UI actuelle).

---

## 2. Activation du mode lecture (D1 — acté)

**Approche 3** : URL **et** droits.

| Source | Effet |
|--------|--------|
| `?mode=view` (ou `?mode=lecture`) | Force `viewMode = true` |
| `?mode=edit` | Force édition si `full` possible ; sinon toast + view |
| Pas de param | **Auto** : démarrer avec le niveau d’accès approprié |

### Algorithme `initGrist`

```
si URL mode=view → viewMode=true, requiredAccess='read table'
sinon si URL mode=edit → tenter full ; si échec → viewMode=true, read table
sinon (auto) :
  tenter grist.ready({ requiredAccess: 'full' })
  si OK → viewMode=false (édition)
  si échec / refus → grist.ready({ requiredAccess: 'read table' }), viewMode=true
```

**Note API** : Grist Custom Widget — `requiredAccess` est déclaré à `ready()`. Si le doc n’accorde que la lecture, demander `full` peut échouer ou n’accorder que read ; le code doit traiter l’échec et **retenter** en `read table`, puis verrouiller `viewMode`.

Badge UI permanent en view : **Lecture** (topbar / rail).

---

## 3. Ce qui est lecture vs écriture

### Lecture (autorisée en view)

- Charger Scene Manifest, `QgisWidgets`, tables géo (`fetchTable`)
- Lire `Atlas_LayerPrefs`, `Atlas_Story` (appliquer, ne pas écrire)
- Afficher carte MapLibre + modèles 3D (si perf OK)
- Toggles **visibilité / filtres locaux** (état session uniquement — **pas** `saveLayerPref`)
- Naviguer le récit (appliquer `state` caméra/couches) — **pas** capture / save story
- Export JSON projet `2.2-atlas-binding` (snapshot local download — OK)
- Export GeoJSON (download local — OK)

### Écriture (interdite en view — no-op + toast si déclenché)

- `ensureAtlasPrefsTable` / `saveLayerPref`
- `ensureStoryTable` / `saveStoryToGrist`
- `AddTable` `Maquette_Layers` / CRUD maquette
- `saveFeaturesToSource`
- Symbolisation permanente (onglets qui écrivent prefs)
- Lier une table Grist / import qui mute le schéma

### Garde centrale

```js
function assertCanWrite(actionLabel) {
  if (CONFIG.viewMode) {
    showToast('Mode lecture — ' + actionLabel + ' indisponible', 'warning');
    return false;
  }
  return true;
}
```

Tous les chemins `applyUserActions` / ensure*Table passent par cette garde (ou un wrapper `docApiWrite`).

---

## 4. Mobile lecture (D2) / Chrome lecture (clarifié 2026-07-30)

**Principe** : l’éditeur a déjà paramétré Atlas pour le public. En lecture on **affiche** la scène telle que publiée — on ne reconfigure pas.

| Surface | Lecture | Édition |
|---------|---------|---------|
| Canvas carte | ✅ navigation | ✅ |
| Recherche (cmdk) | ✅ | ✅ |
| Récit | ✅ lecture / play | capture + play |
| Contrôles canvas | ✅ pastilles dock : données `active` + env `visible` | config + activation |
| Soleil / Vues / Réglages (rail) | ❌ panneaux auteur ; **pastilles env** si `visible` (dock) | ✅ rails + atelier |
| Visibilité couches / import | ❌ figée | ✅ |
| Édition objets 3D | ❌ | ✅ |

**Breakpoint mobile** : `max-width: 720px` — pas de bottom nav en lecture (carte plein écran) ; loupe header ; FAB Récit si étapes ; légende cliquable ; pas de HUD coords.

**Contrôles display en lecture** : obligatoirement **compatibles mobile** (pastilles dock tactiles, une capsule à la fois, wrap/scroll). Détail dans `2026-07-30-atlas-controls-system-design.md` §5–8.

---

## 5. Partage — scénarios V0

| Scénario | Comment |
|----------|---------|
| Collègue lecture seule sur le doc | Auto → viewMode |
| Lien « présentation » | URL widget + `?mode=view` dans la config Custom Widget ou page Grist |
| Embed sspcloud / iframe | Même widget + `?mode=view` ; doc doit être accessible au viewer |
| Snapshot hors Grist | Export JSON déjà existant (pas un viewer offline V0) |

**Pas de 2ᵉ package `atlas-view/` obligatoire en V0** : un seul widget ; le mode suffit. Optionnel plus tard : entrée manifest « Atlas Lecture » avec URL préfixée `?mode=view` pour le sélecteur Grist.

---

## 6. Fichiers touchés (implémentation)

| Fichier | Rôle |
|---------|------|
| `projects/Atlas/app_v7.js` | `CONFIG.viewMode`, parse URL, `initGrist` dual ready, `assertCanWrite`, UI badge, gating actions |
| `projects/Atlas/index_v7.html` | CSS mobile (`@media`), bottom nav, sheet, badge Lecture, classes `body.view-mode` / `body.mobile-layout` |
| `projects/Atlas/lib/grist-sync.js` | Early-return si viewMode passé / helper |
| `projects/Atlas/lib/story.js` | No-op save si view |
| `projects/Atlas/docs/MANUAL_TEST.md` | Cases lecture + mobile |
| `projects/Atlas/CLAUDE.md` | État + modes |
| Tests | Unitaires parse mode + assertCanWrite ; manuel bees |

Pas de nouveau package npm. Promote `published/atlas/` **sur demande explicite** de publication.

---

## 7. Approches écartées

| Approche | Pourquoi non |
|----------|----------------|
| Uniquement `?mode=view` | Rate le cas droits lecture seule sans param |
| Uniquement auto droits | Pas de lien « forcer présentation » pour un éditeur |
| Widget séparé `atlas-view` dès V0 | Duplication promote/manifest ; le query param suffit |
| Client REST Atlas V0 | Reporté (Terrain Scout PWA) |

---

## 8. Risques

| Risque | Mitigation |
|--------|------------|
| `grist.ready('full')` ne « échoue » pas clairement | Documenter comportement réel ; fallback si première écriture échoue → bascule viewMode |
| Utilisateur pense pouvoir sauver filtres | Toast + badge Lecture explicites |
| Mobile 3D crash / chaleur | `?no3d=1` + heuristique light3d |
| Confusion Atlas ≠ Strate | Doc + CLAUDE ; pas de rename produit |

---

## 9. Critères d’acceptation

- [ ] Doc bees, accès viewer : Atlas charge SM, pas d’erreur console liée à AddTable/prefs
- [ ] Même doc, auteur `full` sans param : édition inchangée
- [ ] Auteur + `?mode=view` : pas d’écriture prefs/story
- [ ] iPhone / Chrome DevTools 390px : bottom nav, carte pleine, sheet couches, géoloc
- [ ] `node --test projects/Atlas/tests/*.test.js` vert
- [ ] MANUAL_TEST.md mis à jour

---

## 10. Enchaînement

1. Validation de **cette spec** par l’utilisateur  
2. Plan d’implémentation `docs/superpowers/plans/2026-07-30-atlas-view-mobile.md`  
3. Implémentation dans `projects/Atlas/`  
4. Puis cadrage Terrain PWA qgis2grist (spec séparée)  
5. Hors V0 cadrés : `docs/superpowers/specs/2026-07-30-atlas-view-hors-v0-cadrage.md` (popup_template, catalogue Lecture, promote)

---

## 11. Self-review

- Pas de placeholder TBD sur l’algo d’activation  
- Scope mobile borné (lecture) ; PWA/REST exclus  
- Cohérent avec décisions WikiChat 2026-07-30  
- Un seul widget, pas de fork published sans demande  
