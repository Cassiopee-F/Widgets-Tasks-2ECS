# Atlas — la scène qui vient d'ailleurs, et les entités qu'on n'a plus

> **État : cadré, non commencé.** Écrit le 25/08/2026, après la vérification en
> navigateur du chemin distant (banc `tests/manuel/couche-distante.html`).
>
> Prolonge [CADRAGE-SECONDE-ORIGINE.md](CADRAGE-SECONDE-ORIGINE.md), dont il
> reprend les étapes 3 et 5. L'ordre y était proposé à l'inverse ; ce document
> dit pourquoi il change.

---

## Ce qui est acquis, et ce que ça déplace

Le 25/08, sur la scène de Sète publiée par qgis-sspcloud : MapLibre va chercher
la couche à son URL, 325 bâtiments montent, la symbologie graduée s'applique, et
**six sondes de pixel donnent six égalités exactes** — bornes partagées et entité
sans hauteur comprises.

Donc : **le rendu d'une couche qu'Atlas ne détient pas fonctionne.**

C'est ce qui déplace la priorité. Le cadrage précédent disait « le rendu
marchera ; ce sont les fonctions qui comptent, cadrent et dérivent qui
tomberont ». La première moitié est démontrée. La seconde ne l'est pas encore,
et personne d'autre que moi ne peut la vérifier — parce qu'**il n'existe aucun
moyen d'ouvrir une scène externe dans Atlas**. Le banc du 25/08 est une page
écrite pour l'occasion : elle prouve le chemin, elle ne rend pas le produit
essayable.

D'où l'ordre retenu :

| | Chantier | Pourquoi à ce rang |
|---|---|---|
| **A** | le paramètre `scene` | court, et **rend tout le reste vérifiable par d'autres** |
| **B** | le découplage des entités locales | le fond : ce qui sépare un widget d'un runtime |
| **C** | les couches de service externe (`xyz`…) | petit, visible, sans enjeu — Atlas a déjà des fonds |

---

# A. Le paramètre `scene`

## A.1 Ce que c'est

```
…/w/atlas/?scene=<url-du-manifeste>&readonly=1&vitrine=1
```

`readonly` et `vitrine` **existent déjà** (`lib/view-mode.js`,
`lib/data-client.js`). Seul `scene` manque. Côté amont, deux points de bascule
suffisent — `rendering.runtime: "atlas"` et un gabarit — et l'éditeur, la page
publiée et le widget Grist en bénéficient sans changer une ligne.

## A.2 Où ça se branche

Le flux d'initialisation actuel (`app_v7.js:4562`) :

```js
CONFIG.docMode = await detectDocMode(grist.docApi);
if (CONFIG.docMode === 'scene-manifest') { await loadFromSceneManifest(); … }
else { await initGristTables(); await loadLayersFromGrist(); }
```

Tout part de `grist.docApi`. `loadFromSceneManifest` (`app_v7.js:4637`) appelle
`loadLatestSceneManifest(docApi)` — qui lit la table `SceneManifest` du document
— puis `loadSceneManifestLayers(docApi, manifest, config)`.

**La greffe est petite** : quand `?scene=` est présent, le manifeste vient d'un
`fetch` au lieu d'une table. Le reste du chemin — binding, prefs, contrôles,
récit, montage — est déjà écrit et ne change pas.

Ce qui est petit dans le code ne l'est pas dans les conséquences.

## A.3 Le point qui forme le chantier : une scène externe n'est pas de confiance

`loadSceneManifestLayers` reçoit **le `docApi` du document ouvert**. Aujourd'hui
c'est sans conséquence : le manifeste vient d'une table, donc de quelqu'un qui a
déjà les droits d'écriture sur ce document. Le manifeste est du contenu de
confiance, au même titre qu'une formule Grist.

Avec `?scene=<url>`, il vient d'une origine tierce. Trois surfaces s'ouvrent, et
la troisième est la seule qui compte vraiment.

**1. La scène choisit quelles tables lire.** `origineDeCouche` renvoie
`{nature:'table'}` sur `source.table`, et le chargeur fait
`docApi.fetchTable(nom)` (`lib/scene-loader.js:329`). Une scène peut donc
nommer n'importe quelle table du document — dans la limite des ACL de la
personne, qui restent la vraie barrière.

**2. Atlas écrit.** `Atlas_LayerPrefs` à chaque réglage d'apparence,
`Atlas_Story` à chaque capture, `Maquette_Layers` créée à la demande. Une scène
externe provoquerait des écritures dans le document de quelqu'un d'autre.

**3. `popup_template` est du HTML injecté tel quel.** `app_v7.js:3849` :

```js
let html = template;
html = html.replace(/\{([^}]+)\}/g, (_, key) => escapeHtml(…));
return `<div class="atlas-popup">…${html}</div>`;
```

Les **valeurs** sont échappées ; le **gabarit** ne l'est pas — et c'est
délibéré, c'est un gabarit HTML. Venant d'une table du document, c'est sain.
Venant d'une URL tierce, `<img src=x onerror="…">` s'exécute **dans l'iframe du
widget**, qui tient `grist.docApi` avec les droits de la personne. Lecture de
tout le document, écriture, et exfiltration par `fetch` vers l'origine de
l'attaquant. Ce n'est pas une faille présente : c'est une faille qu'ouvrirait
une implémentation naïve de `?scene=`.

## A.4 La règle retenue

> **Une scène lue dans le document est de confiance. Une scène chargée par
> `scene=` ne l'est pas, et Atlas ne lui donne pas le document.**

Concrètement, `?scene=` **implique** le mode vitrine : `grist.ready()` n'est pas
appelé, `docApi` n'existe pas, aucune préférence ni aucun récit n'est écrit.

Trois conséquences, toutes souhaitables :

- une couche `source.table` d'une scène externe devient **un échec déclaré** —
  « table du document, mais Atlas est en scène externe » — au lieu d'une lecture
  silencieuse. Le message envoie au bon endroit : la couche doit être publiée.
- le gabarit de popup n'a plus de document à voler, mais il reste capable de
  détourner l'affichage. En scène externe, **il est traité comme du texte** :
  interpolation des valeurs, pas de HTML libre. Une scène du document garde le
  gabarit riche.
- l'écriture des préférences n'a plus lieu d'être — une scène externe n'a pas
  d'endroit où les ranger. L'état est dans l'URL ou nulle part.

Ce n'est pas une restriction subie : c'est **exactement le cas d'usage**. Le hub
publie une scène dont les couches sont publiées ; il n'a aucun besoin du
document Grist, et il vaut mieux qu'il ne l'ait pas.

**Cas non couvert, à ne pas confondre** : embarquer le *document* Grist
(`embed=true&style=singlePage`) place Atlas dans le document pour de vrai. C'est
la voie quand on veut à la fois la scène et les données du document — et là,
`scene=` ne doit pas être posé. La règle des trois couches d'URL (cf. le
`CLAUDE.md` du projet) reste la référence.

## A.5 Le travail

1. Lire `scene` dans `lib/view-mode.js`, à côté de `mode` et `readonly`.
   **N'accepter que `https:`** — un `data:` ou un `blob:` contournerait toute
   notion d'origine.
2. Un chargeur `chargerSceneDistante(url)` : `fetch`, JSON, **validation contre
   le schéma publié** (`published/schemas/scene-manifest-0.2.2.schema.json`,
   validateur déjà écrit dans `scripts/valider-schema.js`). Une scène refusée
   doit dire *pourquoi* — c'est le seul diagnostic dont disposera l'auteur de la
   scène, qui n'a pas ma console.
3. Brancher avant `detectDocMode` : si `scene` est présent, on ne parle pas au
   document du tout.
4. Passer `{ docApi: null }` à `loadSceneManifestLayers` et vérifier que les
   couches `table` tombent proprement dans `echecs[]` — c'est déjà la structure,
   il n'y a qu'à s'assurer que le message est le bon.
5. Le drapeau `_scèneExterne` sur la scène, lu par `buildViewPopupHtml` pour
   choisir texte ou HTML.

**Ce qui se teste** : la scène de Sète, ouverte à l'URL, sans aucun document —
et le banc du 25/08 devient superflu.

---

# B. Le découplage des entités locales

## B.1 L'inventaire réel

`layer.geojson` est lu **39 fois** dans `app_v7.js`. Le chiffre effraie moins
une fois trié : les quatre familles n'ont pas le même sort.

### Famille 1 — celles qui tombent, et qui comptent

| Fonction | Ligne | Ce qui casse |
|---|---|---|
| `computeLayersBounds` | 217 | le cadrage de la scène — **déjà traité** par `boundsDuManifest` (`bbox`) |
| `indexFeatures` | 1364 | l'index de recherche |
| `fitToLayer` | 4087 | « zoomer sur la couche » |
| `pointFallbackZoom` | 1400 | le repli en points des surfaces menues |
| `applyTerrainBase` | 1512 | le calage des volumes sur le relief |
| `getUniqueValues` · `detectFieldType` | 394 · 416 | la symbolisation **et les contrôles** : sans valeurs, pas de liste de choix |
| `featuresMatchingCategory` | 3224 | le filtrage par légende |

**C'est ici qu'est le vrai chantier**, et c'est ici que les échecs seront
silencieux : une scène qui s'affiche, ne se cadre pas, et dont les contrôles
sont vides sans que rien ne le dise.

### Famille 2 — les comptes affichés

`updateRailBadge` (5061), `renderSymbologyInspector` (3351), le toast de
chargement (1708). Ils annoncent « n objets ». Sur une couche distante, `n` vaut
zéro — **et zéro est un nombre plausible**, exactement le sixième visage de
`skills/echecs-silencieux.md`. Ils doivent afficher ce que le manifeste déclare
(`n_features`), ou ne rien afficher, jamais zéro.

### Famille 3 — l'inspection et l'édition

Une vingtaine d'usages : sélection, navigation d'objet en objet, écriture
d'attributs, placement 3D. L'édition est déjà interdite en lecture ; **la
consultation ne l'est pas**. Un clic sur un bâtiment distant doit ouvrir sa
fiche — et MapLibre a la réponse (`queryRenderedFeatures`), même quand Atlas n'a
pas la donnée. C'est un changement de source, pas une suppression.

### Famille 4 — l'export

`exportGeoJSON` (4874), l'enregistrement de couche (4807, 4829). Une couche
distante n'a rien à exporter. Le bouton doit le dire, pas produire un fichier
vide — un fichier vide est un export réussi jusqu'à ce qu'on l'ouvre.

## B.2 Le principe

> **Ce qu'Atlas dérivait des entités, le manifeste le déclare ; ce qui reste,
> MapLibre le sait.**

Trois sources se substituent aux entités locales, dans cet ordre :

1. **le manifeste** — `bbox`, `n_features`, `min_zoom`/`max_zoom`, et les
   `stops` du style déclaratif, qui portent déjà les valeurs de catégories ;
2. **MapLibre** — `queryRenderedFeatures` et `querySourceFeatures` pour ce qui
   est à l'écran (inspection, légende contextuelle) ;
3. **la déclaration d'échec** — quand ni l'un ni l'autre ne peut répondre, on le
   dit, on ne rend pas zéro.

**Piège mesuré le 25/08** : `querySourceFeatures` compte **par tuile**. Sur la
scène de Sète, 1210 remontées pour 400 entités. Toute fonction qui compte doit
dédupliquer, ou elle mentira dans l'autre sens.

## B.3 L'ordre

1. **Les comptes** (famille 2) — le plus petit, et il supprime tout de suite le
   « 0 objet » mensonger.
2. **Les contrôles** (`getUniqueValues`, `detectFieldType`) — sans eux une scène
   externe est décorative. Les valeurs sont dans `style.declarative.stops`.
3. **L'inspection au clic** (famille 3, lecture seule) — bascule sur
   `queryRenderedFeatures`.
4. **`fitToLayer` et l'index** — par `bbox`, puis dégradé déclaré.
5. **Le repli en points et le calage relief** — les deux plus coûteux, et les
   moins urgents : ils ne concernent que les surfaces, et une couche distante
   volumineuse sera de toute façon tuilée.

Chaque étape est livrable seule et se vérifie sur la scène de Sète.

---

# C. Les couches de service externe

Petit, et sans enjeu d'architecture : `xyz` est une source `raster`, le patron
existe déjà (`app_v7.js:1259`, source `raster-dem` avec `tiles`).

**Le renseignement du 25/08, qui vaut plus que le chantier lui-même** :
`tile.openstreetmap.org` **ne sert pas au-delà de z19**. Sans `maxzoom` sur la
source, MapLibre réclame des tuiles inexistantes en boucle et **n'atteint jamais
l'état `idle`**. Ce n'est pas une erreur de tuile : c'est un état stable qui
n'arrive plus, et tout ce qui l'attend reste suspendu.

> **`min_zoom` / `max_zoom` d'une couche de service ne sont pas des indications,
> ce sont des bornes.** Une couche `xyz` qui n'en déclare pas oblige le
> consommateur à en inventer une, qui sera fausse dans un sens ou dans l'autre.

Demande formulée à l'amont le 25/08 : les rendre obligatoires sur `xyz` et
`wmts`, avec le même argument que `bbox` sur les couches non-inline — sans elles,
le consommateur ne peut pas être correct **et ne peut pas le savoir**.

`wfs` n'est pas des tuiles mais du GeoJSON par requête : il relève du chemin URL
déjà écrit, pas d'un nouveau. À traiter avec les paramètres de requête, plus
tard.

---

## Ce qui reste indéterminé

- **L'état d'une scène externe.** Sans document, où va ce que la personne
  règle ? Dans l'URL (partageable, limité), en `localStorage` (persistant, non
  partageable), ou nulle part. Non tranché — et ça ne bloque pas A.
- **Le récit d'une scène externe.** `Atlas_Story` est une table. Un récit
  pourrait venir du manifeste lui-même (`story` y est déjà prévu), ce qui serait
  cohérent — mais alors il est en lecture seule, et le bouton « capturer » doit
  disparaître.
- **La révocation.** Une scène chargée par URL peut changer sous les pieds du
  lecteur, ou disparaître. Faut-il figer, mettre en cache, prévenir ? Lié à
  l'expiration des jetons du hub, qui est une échéance qu'aucun des deux côtés
  ne maîtrise.
- **Le partage d'origine.** Si plusieurs scènes externes deviennent courantes,
  faut-il une liste d'origines admises plutôt que « toute URL https » ? Question
  d'exploitant, pas de développeur — à poser le jour d'une mise en ligne.
