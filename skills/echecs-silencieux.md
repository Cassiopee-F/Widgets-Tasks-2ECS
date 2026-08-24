# Les échecs silencieux

> Six formes rencontrées et corrigées entre le 21 et le 25 août 2026, dans
> Widgets-Grist et qgis-sspcloud. Elles n'ont rien en commun techniquement, et
> produisent pourtant **le même résultat** : un fonctionnement qui ressemble à un
> fonctionnement normal.
>
> Capitalisé avec `Interop-Carto` (qgis-sspcloud, BigQgisMCP).

---

## Le motif

**L'échec prend la forme d'une intention.** C'est ce qui les unit, et c'est ce
qui les rend indétectables : ce qu'on observe est indiscernable d'une décision
que quelqu'un aurait prise.

| Forme | Ce qu'on croit lire | Ce que c'est |
|---|---|---|
| **Un `catch` qui poursuit** | une couche qu'on n'a pas voulue | une couche qui a échoué |
| **Une adresse morte** | un schéma qu'on n'a pas publié | un schéma publié à une adresse fausse |
| **Un nom qui ment** | pas de données ici | un module masqué par une variable |
| **Un refus qui imite une règle** | « c'est privé » | on n'a pas su lire la clé |
| **Une autorisation qui manque** | une réponse correcte | un CORS jamais posé |
| **Un vide qui se convertit** | une mesure | l'absence de mesure |

Les deux dernières ont ceci de commun qu'elles **traversent une frontière** — le
CORS entre deux origines, JSON entre deux ouvertures. Ce qui se perd se perd au
passage, jamais à l'écriture, donc jamais là où on regarde.

Aucune ne lève d'erreur. Aucune n'apparaît dans un test. Et **toutes se
diagnostiquent en heures ou en mois**, jamais en minutes — parce que la première
question qu'on se pose n'est pas « qu'est-ce qui a échoué ? » mais « pourquoi
cette donnée manque-t-elle ? ».

---

## 1. Un `catch` qui poursuit

```js
try { colData = await docApi.fetchTable(tableName); }
catch (e) { console.warn('table absente:', tableName); continue; }
```

La couche disparaît **exactement comme une couche qu'on aurait choisi de ne pas
mettre**. Rien ne distingue l'échec du choix.

Et `console.warn` ne prévient que celui qui a la console ouverte, c'est-à-dire
personne — ni sur le terrain, ni chez un utilisateur, ni en production.

**La correction n'est pas de lever.** Une exception ferait tomber toute la scène
pour une couche manquante, ce qui est pire. C'est de **rendre compte** : collecter
les échecs et les remonter à l'appelant, qui décide de les afficher.

```js
const echecs = [];
…
catch (e) { echecs.push({ nom, origine, raison: e.message }); continue; }
…
return { layers, echecs };
```

> **Le message doit permettre le bon geste.** « Table absente » envoie chercher
> une table ; « origine non déclarée, nom déduit de l'identifiant » envoie
> implémenter une origine. Même échec, deux journées différentes.

---

## 2. Une adresse morte

Un contrat qui déclare `$id: "https://exemple.local/schema.json"` — un domaine
qui n'existe pas. Le fichier est parfaitement valide, il est même respecté par
tous ceux qui le lisent, et **personne ne peut le résoudre**.

Variante rencontrée : un schéma servi à une adresse réelle, mais **dont le
contenu diffère du fichier annoncé** — une réserialisation compacte quand
l'empreinte portait sur le fichier indenté. Toute vérification de copie échoue,
en permanence.

**Ce qui protège** : publier le contrat à une adresse **réelle et versionnée**,
et le vérifier depuis l'extérieur — suivre le `$id` jusqu'au bout, pas seulement
le déclarer. Voir `scripts/schemas.test.js`.

> **Un garde-fou qu'on apprend à ignorer est pire qu'aucun** : il occupe la
> place. Une empreinte périmée, une alerte qui se déclenche toujours, un
> avertissement qu'on ne lit plus — tous rassurent sans rien garantir.

---

## 3. Un nom qui ment

Un module nommé `scene_layers`, une variable locale nommée `scene_layers` qui
contient les couches d'une scène. La variable masque le module ; l'appel tombe
sur `'list' object has no attribute …` ; la carte est **vide**, l'erreur
journalisée, et rien ne s'affiche.

**La règle qui rend la classe impossible :**

> **Nommer un module par son rôle, jamais par la donnée qu'il traite.**

`scene_layers` décrit une donnée — donc il *invite* la collision, puisque toute
variable qui porte cette donnée voudra ce nom. `lecteur_couches` décrit un
travail : aucune donnée ne s'appellera jamais ainsi.

Le renommage ne corrige pas le bug — il empêche qu'il se reproduise.

---

## 4. Un refus qui imite une règle

```python
if meta.get("audience") != "public":
    return 403  # « privé »
```

Une clé de métadonnée absente **n'est pas** une audience privée : c'est un objet
dont on n'a pas su lire l'audience. Une seule des deux est une décision ; l'autre
est un bug qui se déguise en décision — et qui se déguise si bien qu'il est
défendu par la bonne conscience de celui qui l'a écrit.

> **Un contrôle d'accès doit distinguer « refusé » de « pas su lire ».**

---

## 5. Une autorisation qui manque

Le pendant exact, par l'autre bout : le serveur n'a rien refusé, il a **oublié
d'autoriser**. Une URL S3 répond HTTP 200 en `curl`, contenu complet, aucun
avertissement — et **sans `Access-Control-Allow-Origin`**. MapLibre rend
`AJAXError: Failed to fetch (0)`, indiscernable d'une panne réseau.

Trois endroits, pas un :

| | Sans quoi |
|---|---|
| la réponse complète | rien ne se lit |
| la réponse partielle **206** | les tuiles PMTiles, lues exclusivement par plages, échouent seules |
| le **contrôle préalable OPTIONS** | un navigateur qui demande une plage n'envoie jamais son GET |

Le troisième ne se voit que si l'on teste autre chose qu'un GeoJSON : corriger le
GET simple donne une correction qui **paraît complète** et ne l'est pas.

---

## 6. Un vide qui se convertit en zéro

Un attribut absent, à `null`, ou portant la chaîne `'NULL'` — fréquent en sortie
de base. Il traverse une conversion numérique et en ressort **`0`**, une mesure
parfaitement plausible. Un bâtiment sans hauteur se lit alors comme un bâtiment
bas ; il est peint, compté, classé, et rien ne le distingue d'une mesure.

Variante plus vicieuse, parce qu'elle est **différée** : le repère qu'on s'était
donné pour dire « hors classification » était `-Infinity`. `JSON.stringify`
l'écrit `null` ; `to-number(null)` vaut `0`. Le code était juste à la première
ouverture et faux à la seconde, sans qu'une ligne ait changé entre les deux.

> **Un « pas de valeur » doit rester distinguable d'une valeur jusqu'au bout de
> la chaîne — sérialisation comprise.**

Corollaire pratique : un repère hors-domaine doit être **représentable dans tous
les formats qu'il va traverser**. `-Infinity`, `NaN` et `undefined` ne survivent
pas à JSON ; une valeur finie assez extrême, oui.

---

## Ce qui les relie

Dans les trois cas, **le code fait exactement ce qu'on lui a demandé**. Il n'y a
ni bug de logique, ni erreur de calcul. Le défaut est que **l'absence de résultat
ressemble à un résultat**.

D'où trois questions à se poser en écrivant, plutôt qu'en déboguant :

1. **Si cela échoue, qu'est-ce que l'utilisateur voit ?** Si la réponse est
   « rien, comme si de rien n'était », c'est un échec silencieux.
2. **Le message permet-il le bon geste ?** Un diagnostic juste envoie au bon
   endroit ; un diagnostic vague envoie chercher au mauvais.
3. **Ce garde-fou peut-il se tromper en permanence ?** Si oui, il sera ignoré, et
   il vaudra moins que rien.
4. **Ce que j'écris traverse-t-il une frontière ?** Origine, sérialisation,
   processus, langage. Ce qui se perd se perd au passage — et le passage est le
   seul endroit qu'aucun des deux côtés ne teste.

## Le corollaire, quand deux systèmes se parlent

Quand un échec peut venir de deux côtés, **le message doit dire de quel côté**.

```
couche d'atelier non matérialisée : inaccessible depuis un navigateur
    → défaut du producteur, il n'a pas publié la donnée

service externe joignable, pas encore pris en charge
    → limite du consommateur, il ne sait pas encore lire cette origine
```

Sans cette distinction, chacun cherche chez soi un défaut qui est chez l'autre —
et le cas le plus coûteux est celui où **les deux supposent que l'autre a
testé**. C'est ainsi qu'un pont entre deux outils est resté rompu des mois : le
producteur écrivait `content` / `created_at_iso`, le consommateur lisait
`manifest_json` / `created_at`, et les deux fonctionnaient parfaitement, chacun
de son côté.
