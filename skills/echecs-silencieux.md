# Les échecs silencieux

> Trois formes rencontrées et corrigées entre le 21 et le 24 août 2026, dans
> Widgets-Grist et qgis-sspcloud. Elles n'ont rien en commun techniquement, et
> produisent pourtant **le même résultat** : un fonctionnement qui ressemble à un
> fonctionnement normal.
>
> Capitalisé avec `Interop-Carto` (qgis-sspcloud, BigQgisMCP).

---

## Les trois formes

| Forme | Ce qu'on voit | Le mécanisme |
|---|---|---|
| **Un `catch` qui poursuit** | une couche absente | `catch → console.warn → continue` |
| **Une adresse morte** | rien du tout | un `$schema` pointant vers un domaine inexistant |
| **Un nom qui ment** | une carte vide | une variable masque un module homonyme |

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
