# Cadrage — ordre d'affichage des couches

## 1. Constat

L'ordre de superposition n'est aujourd'hui **ni réglable ni stable**.

Aucun `map.addLayer()` d'Atlas ne passe de `beforeId` : chaque couche est empilée au
sommet. Et `addLayerToMap()` procède par `removeLayerGfx()` + `addLayer()`, donc
**toute couche remontée repasse devant les autres**.

Or on remonte une couche depuis 8 points d'appel (`app_v7.js` : 1441, 1454, 1491,
3440, 3488, 3928, 4412) — bascule de visibilité, matérialisation différée,
changement de symbolisation, bascule à plat/volume, activation du repli en points,
rafraîchissement d'une table liée. L'ordre observé dépend donc de l'historique des
interactions, pas d'un état : deux utilisateurs sur la même scène peuvent voir deux
superpositions différentes.

**Preuve mesurée** : à l'étape 9 du récit CRESO, les 38 848 bâtiments montés après
le réseau le recouvraient intégralement. Faute de pouvoir corriger la superposition,
il a fallu masquer une couche — ce qui a appauvri l'étape.

Les seuls boutons ▲▼ du produit ordonnent les *étapes du récit* (`storyMove`), pas
les couches.

## 2. Invariants — ce que « correct » veut dire

| # | Invariant |
|---|---|
| I1 | L'ordre d'affichage égale l'ordre de `STATE.layers` **à tout moment**, quel que soit l'historique |
| I2 | Les habillages d'une couche restent solidaires d'elle et dans leur ordre interne |
| I3 | Toutes les couches de données restent au-dessus du fond de carte |
| I4 | Masquer puis réafficher une couche **ne change pas** sa position |
| I5 | L'ordre survit au rechargement du widget (lot 3) |
| I6 | Une étape de récit restitue son ordre, et la sortie de récit rétablit celui de l'utilisateur |

I4 est le cœur : c'est l'invariant aujourd'hui violé.

## 3. Périmètre

**Inclus** : les couches de données (`STATE.layers`), leurs habillages, la couche de
modèles 3D, la persistance dans `Atlas_LayerPrefs`, le récit, le mode lecture
(respect de l'ordre, sans édition).

**Exclu** : les couches du style de base (fond OpenFreeMap/IGN), le terrain et le
ciel — ils ne sont pas réordonnables et restent sous les données.

## 4. Conventions à figer

**Sens de lecture** — le point le plus piégeux, car l'existant fait l'inverse de
l'intuition. Aujourd'hui les couches sont montées dans l'ordre du tableau
(`STATE.layers.forEach` → `addLayerToMap`), donc **la dernière du tableau finit
au-dessus**. Or le panneau et la légende affichent le tableau dans son ordre :
**le haut de la liste est donc actuellement la couche la plus basse de la carte.**

Deux voies, et une seule est sûre :

| Voie | Effet |
|---|---|
| Redéfinir `layers[0]` comme la couche du dessus | ❌ **inverse la superposition de toutes les scènes existantes**. Sur CRESO, la grille de 42 182 mailles passerait au-dessus des sites |
| Conserver la sémantique du tableau (fin = dessus) et **inverser l'affichage** | ✅ conforme aux habitudes SIG, **aucune régression de rendu** |

On retient la seconde : `STATE.layers` garde son sens actuel, et le panneau, la
légende et la liste du mode lecture affichent `[...STATE.layers].reverse()` — le
dessus en premier. Le réordonnancement manipule le tableau ; seule la présentation
est inversée.

**Ordre interne des habillages**, du bas vers le haut :

| Géométrie | Séquence |
|---|---|
| Surface | `id` (fill) → `-outline` (line) → `-pts` (repli en points) → `-label` |
| Ligne | `id` (line) → `-label` |
| Point | `id` (circle) → `-label` |

Contour et étiquettes doivent rester au-dessus de leur propre remplissage : le
déplacement traite donc le groupe comme un **bloc indivisible**.

**Couche de modèles 3D** (`Models3D.layerId`) : elle **est** dans la pile MapLibre
(`map.addLayer(Models3D.makeLayer())`), et elle y est ajoutée **avant** les couches
de données (ligne 1027, puis `scheduleMapLayersSync` ligne 1030) — elle se trouve
donc aujourd'hui **sous** elles. Comme elle est unique et partagée par toutes les
couches à modèles, elle ne peut suivre aucune couche en particulier : on **conserve
sa position actuelle** (juste au-dessus du fond) et on la documente. La remonter au
sommet serait un changement de comportement que rien ne demande.

**Couches système au sommet** : `sel-hl-ring`, la surbrillance de sélection, est
créée une seule fois — donc au sommet au moment de sa création. Un `applyLayerOrder()`
qui remonte toutes les couches de données la ferait passer **dessous**, rendant la
sélection invisible. Elle doit donc être remontée **en fin de séquence**, après les
données.

Pile résultante, du bas vers le haut : fond de carte → modèles 3D → couches de
données (ordre du tableau) → surbrillance de sélection.

**Défaut à l'insertion d'une nouvelle couche** : par géométrie — surfaces en bas,
puis lignes, puis points. C'est le défaut attendu, et c'est précisément ce qui
manquait à l'étape 9 : aujourd'hui, importer un bâti après un réseau suffit à
masquer le réseau, sans que l'utilisateur puisse ni le voir ni le corriger.
Exception : une couche de fond volumineuse (`isBasemapLayer`) s'insère en bas.

## 5. Lot 1 — rendre l'ordre déterministe

C'est la fondation : sans elle, un réordonnancement dans l'interface serait
cosmétique, cassé au premier changement de visibilité.

**Nouveau module `lib/layer-order.js`** — logique pure, testable hors DOM (rappel :
`app_v7.js` n'exporte rien, donc rien de ce qui y vit n'est couvert par un test) :

- `layerGfxIds(layer)` → ids d'habillage d'une couche, du bas vers le haut
- `orderedGfxIds(layers)` → séquence complète pour la pile entière
- `moveSequence(layers, exists)` → ids à passer à `moveLayer`, dans l'ordre d'appel,
  filtrés par ceux qui existent réellement (`exists` est un prédicat injecté)

**Dans `app_v7.js`** : `applyLayerOrder()` consomme la séquence et appelle
`map.moveLayer(id)` (sans `beforeId`, donc au sommet). En parcourant de la dernière
couche vers la première, l'index 0 finit au sommet — ce qui satisfait la convention
et garantit I3 au passage.

**Points d'appel** — viser un nombre minimal de points sûrs plutôt que de les
saupoudrer :
1. fin de `syncLayerToMapState()` (couvre les remontages individuels)
2. fin de `syncAllLayersToMap()` (montage global)
3. après `style.load` consécutif à un changement de fond (`setStyle`, ligne 4565 :
   le style détruit toutes les couches)
4. fin de `applyStoryState()` (lot 3)

## 6. Lot 2 — réordonnancement dans le panneau Couches

La liste affiche déjà `STATE.layers` dans l'ordre : il n'y a qu'à la rendre
manipulable.

**Contrainte d'encombrement** : `.layer-item` porte déjà 5 éléments interactifs (œil,
pastille, corps cliquable, 🎯, 🗑️, plus 🔄 pour une table liée). Ajouter deux
boutons en permanence surchargerait la ligne.

**Proposition** : ▲▼ affichés **uniquement sur la couche sélectionnée**. Simple,
tactile (donc valable sur le mobile ≤720 px), accessible au clavier, et sans coût de
glisser-déposer. Le glisser-déposer par poignée peut venir ensuite ; il se heurte au
`onclick` de sélection déjà porté par la ligne entière.

**Fonction** `A.moveLayerRank(id, delta)` : réordonne `STATE.layers`, appelle
`applyLayerOrder()`, rafraîchit le panneau et la légende, puis persiste (lot 3).
Attention au sens : « monter » dans la liste affichée signifie **avancer vers la fin**
du tableau.

**Trois surfaces à inverser**, pas une seule — sans quoi la lecture serait
incohérente d'un endroit à l'autre :
- `renderLayersPanel` (liste d'édition)
- `renderLayersPanelLecture` (mode lecture — ordre respecté, aucun contrôle)
- `updateLegend` (la légende énumère `STATE.layers` dans l'ordre du tableau)

## 7. Lot 3 — persistance, récit, manifest

**Préférences** : ajouter `rank` (entier) à `layerPrefsPayload`. `Atlas_LayerPrefs`
porte une ligne par couche, donc le champ y est naturel. Au chargement,
`applyLayerPrefsBinding` trie `STATE.layers` par `rank` — en conservant la règle
existante : *les prefs Atlas priment sur le manifest*.

**Récit** : `captureStoryState` enregistre déjà les couches dans l'ordre de
`STATE.layers` — **l'ordre est donc déjà présent dans les récits existants**, il
suffit qu'`applyStoryState` réordonne `STATE.layers` selon le tableau de l'étape.
`capturePreStorySnapshot` / `restorePreStorySnapshot` doivent mémoriser et rétablir
l'ordre d'avant présentation, comme ils le font pour visibilité, filtres,
symbolisation et rendu surfacique (I6).

**Scene Manifest** : le contrat V0.2.2 n'a **aucune notion d'ordre** (vérifié : rien
dans `scene-loader.js` ni `manifest-binding.js`). Recommandation : **ne pas étendre
le contrat**. L'ordre du tableau `layers[]` fait foi à l'import, les prefs Atlas
prennent le relais ensuite. Cela évite une extension propriétaire de plus après
`source.geometry_fields`.

## 8. Cas limites à traiter

1. **Couche différée non matérialisée** : aucune couche MapLibre → `moveLayer`
   lèverait une exception. D'où le prédicat `exists` du lot 1.
2. **`-pts` absent** au-dessus du seuil de repli ; **`-outline`** absent si épaisseur
   nulle ; **`-label`** absent si étiquettes désactivées. Même filtrage.
3. **Changement de fond de carte** : `setStyle` détruit tout — réappliquer après
   `style.load`.
4. **Suppression / ajout** de couche pendant la session : les rangs se recalculent
   depuis l'ordre du tableau, jamais stockés en double.
5. **Couche masquée** : elle garde son rang (I4) ; seule sa visibilité change.
6. **Code mort à confirmer** : le suffixe `-hit` est nettoyé et masqué en trois
   endroits mais **jamais créé**. À supprimer ou à documenter — ne pas l'embarquer
   dans la nouvelle logique sans avoir tranché.
7. **Surbrillance de sélection** : `sel-hl-ring` doit remonter après les données
   (cf. § 4), sinon sélectionner un objet ne se voit plus.
8. **Nouvelle couche importée** : les 4 points d'insertion (`app_v7.js` 3439, 3761,
   3847, 3927) font tous un `push` — donc en fin de tableau, donc **au-dessus**.
   C'est le comportement voulu pour une nouveauté, sauf conflit de géométrie : un
   bâti importé après un réseau le masquerait. D'où le défaut par géométrie du § 4,
   qui l'insère sous les lignes.
9. **Export `2.2-atlas-binding`** : il sérialise `STATE.layers` dans l'ordre
   (ligne 3896), l'ordre y est donc **déjà** porté implicitement. Rien à ajouter —
   cohérent avec le choix de ne pas étendre le contrat manifest.

## 9. Tests

Dans `tests/layer-order.test.js`, sur le module pur (avec un faux `map` exposant
`getLayer` / `moveLayer` et enregistrant les appels) :

- ordre interne des habillages par géométrie
- **non-régression du sens** : la dernière couche du tableau reste peinte en dernier
  (le test qui interdit d'inverser les scènes existantes)
- la surbrillance `sel-hl-ring` reste au-dessus des données après réordonnancement
- ids absents filtrés — aucun appel sur une couche inexistante
- **stabilité après bascule de visibilité** (le test qui garde I4)
- séquence inchangée quand une couche est remontée
- insertion par géométrie : un bâti importé après un réseau passe **sous** lui
- capture puis restitution de l'ordre par le récit
- tri par `rank` au chargement des prefs

À ajouter au harnais existant (129 tests verts aujourd'hui).

## 10. Risques

| Risque | Traitement |
|---|---|
| `moveLayer` sur une couche absente lève une exception | prédicat `exists`, testé |
| **Inversion involontaire des scènes existantes** | sémantique du tableau conservée, seul l'affichage s'inverse ; test de non-régression du sens |
| La surbrillance de sélection passe sous les données | remontée en fin de séquence, testée |
| La couche 3D change de place | position actuelle conservée, non touchée par le lot 1 |
| Le récit modifie l'ordre de l'utilisateur | snapshot pré-récit (I6) |
| Coût de rendu | ~7 couches × ≤4 habillages = moins de 30 appels par synchro, négligeable |
| Surcharge visuelle du panneau | ▲▼ sur la seule couche sélectionnée |

## 11. Séquencement proposé

**Lot 1** — module + `applyLayerOrder()` + 3 points d'appel + tests. Corrige à lui
seul le défaut révélé par le récit ; aucun changement visible d'interface.

**Lot 2** — ▲▼ sur la couche sélectionnée + défaut par géométrie à l'insertion.

**Lot 3** — `rank` dans les prefs, ordre appliqué et restauré par le récit.

Les lots 1 et 2 suffisent à un fonctionnement correct **dans la session**. Le lot 3
apporte la persistance et rend l'étape 9 du récit CRESO capable de montrer bâti et
réseau superposés.
