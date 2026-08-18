# Atlas — atelier Contrôles + dock pastilles

> **⚠️ Document absorbé** par la spec unifiée :  
> **`docs/superpowers/specs/2026-07-30-atlas-controls-system-design.md`** (cadrage complet 2026-07-30).  
> Ce fichier reste en archive détaillée ; en cas de conflit, la spec unifiée prime.

**Date** : 2026-07-30  
**Statut** : **supersédé** → voir spec unifiée ci-dessus  
`docs/superpowers/plans/2026-07-30-atlas-controls-atelier-dock.md` (T0–T9)  
**Projet** : `projects/Atlas/` (v7)  
**Lié** : lecture mobile (`2026-07-30-atlas-view-mobile-design.md`), hors-V0 (`2026-07-30-atlas-view-hors-v0-cadrage.md`), binding (`projects/Atlas/docs/BINDING-ATLAS-v7.md`)

---

## 1. Objectif

Clarifier **comment on traite les contrôles** dans Atlas :

1. **Atelier** (panneau rail Contrôles) — créer / activer / configurer / publier  
2. **Runtime** (dock pastilles carte) — manipuler le **canevas** (édition, et lecture *si exposé*)  
3. **Chaîne récit** — configurer le canevas avec les contrôles → **capturer** l’étape ; en lecture récit, **rejouer** l’état figé (pas nécessairement laisser des pastilles)  
4. **Deux familles** — données (couches) et environnement / widget — **même geste de publication**, schémas séparés

**Succès** :

- L’éditeur comprend : contrôles = **outils de mise en scène** d’abord ; exposition lecteur = **option**  
- Chaque contrôle exposé a une **pastille** (cercle → capsule), style soleil  
- Un récit joué affiche des **scènes complètes** telles que capturées ; les pastilles ne sont pas requises pour comprendre  
- Les futurs contrôles s’ajoutent sans nouveau paradigme UI  

---

## 1bis. Contrôles ↔ récit (clarification produit)

### Trois rôles distincts

| Rôle | Qui | Quoi |
|------|-----|------|
| **A. Manipuler le canevas** | Éditeur (toujours) ; lecteur si `exposed` | Pastilles / atelier → filtre, soleil, 2D/3D… |
| **B. Capturer** | Éditeur | « Photo » de l’état courant → étape `Atlas_Story` (caméra + couches + controls + settings…) |
| **C. Jouer le récit** | Lecteur (et éditeur en preview) | Enchaîner les états **figés** ; UI récit (◀ ▶) — **pas** le studio de contrôles |

```
[ Contrôles sur canevas ] ──configure──► [ Capture étape ] ──► [ Story.steps[] ]
                                              │
                                              ▼
                                    [ Play récit ] = rejeu des scènes
                                    (pastilles optionnelles / souvent masquées)
```

### Ce qu’un rendu récit n’est pas

- Ce **n’est pas** « donner au user les mêmes curseurs que l’éditeur »  
- C’est **afficher** chaque scène telle qu’elle a été **composée et capturée** (complet : cadrage, filtres, lumière, symbo…)  
- Les pastilles en lecture libre (hors play) restent un **mode exploration** distinct du **mode présentation**

### Modes lecture Atlas (à ne pas confondre)

| Mode | Pastilles contrôles | Récit |
|------|---------------------|--------|
| **Exploration** (`?mode=view`, hors play) | Seulement `exposed` | FAB ▶ si étapes |
| **Présentation** (play récit) | **Masquées / gelées** par défaut | Étapes + transitions ; état appliqué depuis `step.state` |
| **Édition** | Atelier + dock | Capture / recapture |

**Décision produit (acte)** : en présentation, priorité au **rejeu d’état** ; l’exposition de pastilles pendant le play est un opt-in rare (ex. « laisse explorer à cette étape »), pas le défaut.

### Contrainte mobile (acte 2026-07-30)

Les contrôles **display** en lecture (pastilles dock `exposed` / `active`, hors play récit) doivent être **utilisables sur mobile** (≤720px), pas seulement bureau :

- Cibles tactiles ≥ pastille 54px ; **une capsule ouverte à la fois** (déjà V1)
- Rangée pastilles : wrap / scroll horizontal si trop nombreuses ; ne pas masquer FAB Récit ni légende
- Slots (select, range, time, soleil, view3d…) : UI digitable (pas de hover-only, pas de panneau atelier)
- Critère d’acceptation : bees en `?mode=view` sur téléphone / DevTools mobile — manipuler ≥1 contrôle données + ≥1 env sans casser la carte

### Chaîne auteur rappel

1. Activer / régler contrôles (données + env)  
2. Composer la vue sur le canevas  
3. Capturer l’étape  
4. Répéter  
5. Publier → le lecteur **joue** les scènes (et explore à part si pastilles exposées)

---

## 1ter. Transitions entre étapes (piste V+ — pas V1 contrôles)

**Idée** : entre deux étapes, interpoler automatiquement (ease) ce qui **doit bouger**, selon un **profil déclaré**, sans micro-réglage auteur.

Aujourd’hui : `flyTo` caméra ~1500 ms ; le reste (filtres, soleil, couches) est plutôt **appliqué d’un coup** au `moveend` / à l’entrée d’étape.

### Trois profils types (proposition)

| Profil | Comportement | Quand le choisir (auto ou semi-auto) |
|--------|--------------|--------------------------------------|
| **`cut`** | Coupure nette : état B immédiat | Beaucoup de diffs non interpolables (symbo, basemap, jeu de couches très différent) |
| **`ease`** | Ease caméra + fondu / lerp sur grandeurs continues (heure, pitch, filtres range/time si bornes compatibles) | Même « sujet » géo, cadrage et lumière changent |
| **`morph`** | Ease caméra + transition progressive des filtres select (si overlap de valeurs) / visibilité | Continuité narrative forte, peu de ruptures de couches |

**Semi-auto** : à la capture / à l’édition d’étape, Atlas **suggère** un profil en diffant `step[i].state` vs `step[i+1].state` (caméra Δ, controls Δ, layers set Δ, settings Δ) ; l’éditeur peut forcer un autre profil.

**Compatibilité** : n’interpoler que ce qui a un chemin continu ; le reste cut à mi-transition ou en fin. Documenter la matrice (caméra ✅, timeOfDay ✅, range ✅, select ⚠️, declarative style ❌ cut, basemap ❌ cut).

**Hors scope immédiat** : implémentation transitions ; à brancher quand le dock / atelier C2–C3 est stable. Garder le champ optionnel `steps[].transition: { profile, durationMs }` dans le cadrage récit / SM pour ne pas se fermer la porte.

---

## 2. État actuel (constat)

| Surface | Rôle aujourd’hui | Limite |
|---------|------------------|--------|
| Panneau **Contrôles** | Liste champs d’**une** couche + toggle `active` + corps (range / select / time) | Pas de section environnement ; pas de lien visuel dock ; labels techniques (`nbr_of_boxes`) |
| Dock soleil | Pastille 54px → capsule heure / date / ombres | One-shot ; masqué en lecture ; pas dans le panneau |
| HUD `#viewer-controls` | Liste rectangulaire des `layer.controls` `active` en lecture | Intérimaire ; pas le langage pastille |

**Règle données déjà bonne** : `active: false` à l’import SM → l’éditeur active → `Atlas_LayerPrefs`.  
**Manque** : `active` / `exposed` pour l’environnement, et **dock unifié**.

---

## 3. Modèle mental

```
                    ┌─────────────────────────────┐
                    │  Atelier Contrôles (rail)   │
                    │  choisir · configurer       │
                    │  exposer (édition+lecture)  │
                    └─────────────┬───────────────┘
                                  │ exposed / active
                                  ▼
                    ┌─────────────────────────────┐
                    │  Dock pastilles (carte)     │
                    │  [☀] [🏷] [▦] [🗺] …        │
                    │  cercle → capsule (slot)    │
                    └─────────────────────────────┘
```

- **Atelier** = source de vérité éditoriale  
- **Dock** = seule UI d’**interaction** runtime (plus de double panneau pour « utiliser »)  
- En **lecture** : pas d’atelier ; dock filtré sur `exposed`

---

## 4bis. Taxonomie usages × types (recherche web + état Atlas)

Sources : Vizro (McKinsey), Honeycomb Maps, Lizmap, GeoLeaf, ArcGIS StoryMaps / Experience Builder, O2A Viewer — synthèse 2026-07-30.

### A. Par type de données → contrôle UI (premier axe)

Consensus marché = **le type de colonne dicte le sélecteur** (Vizro le formalise explicitement).

| Type données | Contrôle standard | Atlas aujourd’hui | Priorité Atlas |
|--------------|-------------------|-------------------|----------------|
| **Catégoriel** (≤ ~20 modalités) | Checklist / chips multi, ou dropdown si >8 | `select` | ✅ garder ; UI chips dans pastille |
| **Booléen** | Switch / 2 cases | souvent `select` true/false | 🔹 V1.1 `boolean` dédié |
| **Numérique** | Range slider (min–max) ou slider simple | `range` | ✅ |
| **Temporel** (date / datetime) | Timeline + play, ou date range | `time` | ✅ ; distinguer *filtre data* vs *soleil scène* |
| **Texte libre** / id | Search / autocomplete | ❌ (cmdk partiel) | 🔹 recherche champ exposable |
| **Ordinal / hiérarchie** | Cascading select | ❌ | plus tard |
| **Relation / Ref** | Select sur labels liés | partiel Grist | plus tard |

**Règle atelier** : proposer le contrôle **par défaut selon le type** ; l’éditeur peut changer le widget *dans la famille autorisée* (ex. catégoriel : checklist ↔ dropdown), pas un range sur du texte.

### B. Par usage produit (deuxième axe)

| Usage | Besoin dominant | Contrôles typiques | Mode Atlas |
|-------|-----------------|--------------------|------------|
| **Carte dynamique / exploration** | Filtrer, comparer, chercher | select + range + time + search ; légende ciblage ; basemap | Lecture + édition |
| **App carto métier** | Multicritère, partage d’état | Filtres combinés (ET), compteur résultats, URL state (GeoLeaf) | V1.1+ |
| **Storymap / récit** | Guider le regard ; **rejouer** des scènes capturées | Peu ou pas de pastilles en play ; contrôles surtout pour **composer avant capture** ; time/soleil figés dans l’étape ; transitions V+ | Présentation ≠ exploration |
| **Simulation** (flood, scénario) | Un curseur « scénario » | `range` + `mode: "simulation"` (déjà en SM) | Pastille dédiée plus tard |
| **Présentation 3D / maquette** | Lumière, 2D/3D, fond | `sun`, `view3d`, `basemap` | Pack Env V1 |

**Storymap (Esri)** : distinguer *time animation* (widget bas) vs *timeline narrative* (bloc texte) vs *swipe* (deux états). Atlas a déjà le récit d’étapes ; le **time data** et le **soleil** ne doivent pas être confondus dans une seule pastille.

### C. Autres axes (souvent oubliés)

| Axe | Exemples | Pour Atlas |
|-----|----------|------------|
| **Spatial** | Bbox, proximité / rayon, « autour de moi » | Géoloc MapLibre = nav ; filtre proximité = V2 |
| **Comparaison** | Swipe A/B, split map (Experience Builder) | Hors V1 ; utile flood / avant-après |
| **Portée multi-couches** | Un filtre « année » sur 3 couches (Honeycomb *Apply to layers*) | V1.1 : contrôle *scène* lié à plusieurs `layerId` |
| **Cascading** | Commune → quartier (filtres liés) | Plus tard |
| **Coordination** | Filtre → carte + KPI + table | Hors scope Atlas seul (dashboard) |
| **Audience / droits** | Éditeur expose ; lecteur session-only | Déjà V0 lecture |
| **Mobile** | Une interaction à la fois ; pastille > panneau dense | Dock 1 capsule ouverte |
| **État partageable** | Filtres dans l’URL | Option V2 |
| **Null / vide** | « Inclure les sans valeur » | À prévoir dans select |
| **Performance** | Gros jeu → dropdown + search, pas 200 checkboxes | Règle UI atelier |

### D. Matrice « ce qu’on veut voir » (cible produit)

```
DONNÉES (pastilles métier)
  catégoriel ──► select / chips
  booléen    ──► switch (V1.1)
  numérique  ──► range
  temporel   ──► time (+ play)
  texte      ──► search field (V1.1)

ENVIRONNEMENT (pastilles widget)
  soleil+date, view3d, basemap

NARRATION (pas toujours pastille)
  récit étapes, (plus tard) swipe

NAVIGATION (toujours, hors atelier pub)
  pan/zoom, boussole, légende, cmdk, géoloc
```

### E. Implications sur l’atelier Contrôles

1. Section **Données** groupée par **type** (ou badge type sur chaque ligne), pas seulement par nom de champ.  
2. Section **Environnement** = catalogue fixe (déjà cadré §4.2).  
3. Hint contexte : « Exploration » vs « Récit » — en récit, rappeler que les pastilles trop nombreuses diluent le fil (Esri : minimize distractions).  
4. `mode: simulation` visible dans l’atelier comme badge, pastille distincte quand exposé.

---

## 4. Familles de contrôles

### 4.1 Données — `layer.controls[]` (ControlDeclarative)

| Type | UI slot | Effet |
|------|---------|--------|
| `select` | Cases / chips | Filtre catégories |
| `range` | Slider(s) | Filtre numérique |
| `time` | Timeline / play | Filtre temporel |

Champs : `field`, `type`, `label`, bornes, `active` (= exposé dock + filtre appliqué).  
Persistance : Scene Manifest + **Atlas_LayerPrefs** (prioritaire).

### 4.2 Environnement / widget — `scene.viewerControls[]` (nouveau)

| Id | Contenu slot | Défaut exposed |
|----|--------------|----------------|
| `sun` | Date + heure + ombres | `false` |
| `view3d` | Bascule 2D / 3D (pitch, bâtiments, modèles légers) | `false` |
| `basemap` | Enum **restreinte** (ids choisis par l’éditeur) | `false` |

**Hors pack V1** (atelier édition seulement, jamais pastille lecture) : lat/lon libres, globe, exagération terrain, sky, import, symboliser.

Persistance : table ou clé prefs scène (ex. `Atlas_ScenePrefs` / fragment SM `viewer.controls`) — **à trancher en plan** ; ne pas polluer `layers[].controls`.

### 4.3 Navigation (pas des « contrôles publiés »)

Toujours disponibles selon mode, **sans** pastille atelier : pan/zoom, boussole, légende cliquable (lecture), recherche, géoloc MapLibre, FAB récit.

---

## 5. Atelier Contrôles — structure cible

Remplacer la liste plate « une couche → tous les champs » par un atelier **sectionné**.

### 5.1 En-tête

- Titre : **Contrôles**  
- Sous-titre : « Ce qui est activé apparaît en pastille sur la carte (édition et lecture). »  
- Lien discret : « Voir le dock » (pulse / scroll attention sur le dock)

### 5.2 Section A — Environnement

Liste fixe des contrôles widget V1 :

| Ligne | Toggle exposed | Sous-config si ON |
|-------|----------------|-------------------|
| Soleil & date | ○ | Option « ombres » ; éventuellement plage horaire autorisée |
| Vue 2D / 3D | ○ | — |
| Fonds de plan | ○ | Multi-select des basemaps autorisés (2–3 max recommandé) |

### 5.3 Section B — Données par couche

- Sélecteur de couche (comme aujourd’hui)  
- Pour chaque champ **éligible** (type détecté) :

```
[ icône type ]  Libellé clair          [ toggle ]
                bee_species · select     ← meta secondaire
                └─ corps config si ON (mêmes widgets qu’aujourd’hui)
```

Améliorations lisibilité :

- **Label** éditable (défaut = label champ Grist / QGIS, fallback id)  
- Regrouper : **Actifs** en haut, **Disponibles** en bas (ou filtre « actifs seulement »)  
- Compteur pastilles : « 3 contrôles sur la carte »  
- Masquer les champs non typables (déjà le cas)

### 5.4 Section C — Ordre dock (V1.1 optionnel)

Drag des contrôles exposés pour ordonner les pastilles. V1 : ordre fixe (environnement d’abord, puis données par couche).

---

## 6. Dock pastilles — contrat UI

### Forme (obligatoire pour tout nouveau contrôle)

1. **Repos** : cercle 54px, icône / pastille couleur, bordure hairline, ombre légère (comme soleil)  
2. **Déploiement** : capsule hauteur 54px, `border-radius: 27px`, slot contenu  
3. **Rangée** : pastilles côte à côte, ancrage haut-droite près boussole  
4. **Collapse** : une pastille à la fois ouverte **ou** une seule capsule multi-slots si largeur OK — **recommandation V1** : **une capsule ouverte à la fois** (clic pastille A ferme B) pour mobile  
5. **Lecture** : mêmes pastilles ; pas de mode config dans le slot  
6. **Mobile lecture** : même contrat pastille/capsule qu’en bureau ; layout dock adapté (wrap/scroll) — **pas** de HUD rectangulaire `#viewer-controls` comme solution mobile

### Mapping

| Contrôle | Icône pastille (indicatif) | Slot |
|----------|----------------------------|------|
| sun | disque soleil | strip actuel |
| view3d | cube / 2D | seg 2D \| 3D |
| basemap | calque | chips fonds |
| select données | tag / initiale couche | checklist |
| range | slider icon | double / simple range |
| time | horloge | scrub + play |

### Édition vs lecture

| | Édition | Lecture |
|--|---------|---------|
| Pastilles | toutes `exposed` | idem |
| Atelier rail | oui | non |
| Changer `exposed` | oui | non |
| Manipuler valeurs filtre / heure | oui | oui (session, pas save prefs) |

---

## 7. Cycle de vie d’un contrôle

```
1. Déclaration
   - Données : SM / détection champs
   - Environnement : catalogue fixe Atlas
2. Atelier : label, bornes, options, exposed ON
3. Persist prefs (couche ou scène)
4. Dock : pastille créée
5. Runtime : utilisateur bouge le slot → applique (filtre / lighting / style)
6. Récit : capture l’état des contrôles actifs / exposés selon règles story existantes
7. Lecture : charge prefs + SM ; dock filtré exposed ; pas d’écriture
```

---

## 8. Approches panneau (choix)

| Approche | Description | Pour | Contre |
|----------|-------------|------|--------|
| **P1** | Deux onglets Atelier : Environnement \| Données | Simple | Moins de vue d’ensemble |
| **P2** | Page unique scroll : Env puis Données (recommandé) | Un seul endroit ; compteur global | Long si beaucoup de champs |
| **P3** | Atelier = uniquement liste des pastilles + « + Ajouter » | Très aligné dock | Plus de refactor ; découverte champs moins évidente |

**Recommandation** : **P2** en V1 (approfondir le panneau actuel), **P3** plus tard si le dock devient le centre de gravité.

---

## 9. Hors scope (cette spec)

- Implémentation immédiate du dock multi-pastilles  
- WYSIWYG popup / map tips (hors-V0 A)  
- Promote / catalogue Atlas Lecture (hors-V0 B/C)  
- Contrôles lat-lon, globe, terrain exagéré  
- Refonte complète du module Soleil rail (peut fusionner dans Env plus tard)

---

## 10. Phasage suggéré

| Phase | Contenu |
|-------|---------|
| **C0** | Cadrage (ce doc) + accord |
| **C1** | Atelier P2 : sections Env (toggles stub) + Données lisibles (labels, actifs en tête) — soleil encore = dock actuel |
| **C2** | `scene.viewerControls` + prefs ; soleil `exposed` → pastille lecture |
| **C3** | Dock multi-pastilles : données `active` → pastille ; retirer HUD rect lecture |
| **C4** | `view3d` + `basemap` pastilles |
| **C5** | Transitions récit `cut` / `ease` / `morph` (suggestion semi-auto) |

---

## 11. Critères d’acceptation (quand implémenté)

- [ ] Atelier : section Environnement + Données, libellés clairs  
- [ ] Toggle données `active` ↔ pastille dock (C3)  
- [ ] Soleil exposable en lecture (C2)  
- [ ] Lecture : pas d’atelier ; dock = contrôles exposés seulement  
- [ ] Lecture **mobile** : pastilles / capsules utilisables au doigt (≤720px)  
- [ ] Nouveau contrôle = nouveau slot réutilisant FAB + capsule  
- [ ] Tests prefs / SM non régressifs (bees)

---

## 12. Décisions à confirmer

1. **P2** (scroll Env + Données) vs P1 onglets ?  
2. **Une capsule ouverte à la fois** sur le dock ?  
3. Persistance scène : nouvelle table `Atlas_ScenePrefs` vs champ JSON dans prefs existantes ?  
5. Le rail **Soleil** fusionne-t-il dans Contrôles (Env) en C2, ou reste un raccourci ?  
6. En **présentation** récit : pastilles masquées par défaut — OK ?  
7. Transitions : valider les 3 profils `cut` / `ease` / `morph` comme vocabulaire V+ ?

---

## 13. Self-review

- Pas de TBD sur le modèle atelier / dock / familles  
- Phasage C0–C4 borné ; implémentation hors ce document  
- Cohérent avec lecture V0 (dock = cible, HUD = intérimaire)  
- Namespaces `layer.controls` vs `scene.viewerControls` explicites  
