# Publier un widget : manifeste, vitrine, forum

> Ce que chaque commande produit, quels champs sont **réellement lus**, et ce qui
> se versionne. Écrit après qu'un widget préparé dans un autre dépôt soit arrivé
> avec un `package.json` complet et une section inventée que rien ne lisait.

---

## Règle première : rien de généré ne s'édite à la main

| Commande | Produit | Versionné |
|---|---|---|
| `npm run manifest` | `published/manifest.json` | oui |
| `node scripts/generate-vitrine.js` | `published/index.html`, `published/w/<widget>/`, `sitemap.xml` | oui |
| `node scripts/generate-post.js <widget>` | `.forum/<widget>.md` | **non**, ignoré par git |
| `node scripts/publish-post.js <widget>` | réécrit un message existant sur le forum | — |

Les sources sont **`published/<widget>/package.json`**, **`published/<widget>/vitrine.json`**
et **`published/accueil.json`**. Une retouche directe dans un fichier généré est
écrasée à la régénération suivante.

---

## `package.json` — ce qui met le widget au catalogue

La **section `grist` est obligatoire**. Sans elle, `generate-manifest.js` ignore
le dossier : le widget n'apparaît jamais dans le sélecteur de Grist. Depuis
2026-08, l'omission est signalée en fin d'exécution, sur `stderr`.

```json
{
  "name": "mon-widget",
  "version": "1.0.0",
  "description": "Une phrase, pour les humains qui lisent le dépôt",
  "authors": [{ "name": "…", "url": "https://github.com/…" }],
  "grist": {
    "widgetId": "mon-widget",
    "name": "Mon Widget",
    "accessLevel": "full",
    "description": "Ce que Grist affiche dans le sélecteur, ~125 caractères"
  }
}
```

Points qui font trébucher :

- **`url` est facultatif** et se déduit du nom du dossier. Ne l'écrivez pas à la
  main : la CI déploie le **contenu** de `published/` à la racine de `gh-pages`,
  donc l'adresse est `…/Widgets-Grist/mon-widget/` et **jamais**
  `…/Widgets-Grist/published/mon-widget/`.
- **`accessLevel`** vaut `full`, `read table` ou `none`. Le déclarer au plus juste :
  un widget qui n'écrit pas demande `read table`.
- **`grist` accepte un tableau** pour déclarer plusieurs widgets d'une même suite
  (TaskFlow en déclare huit).
- **`prive: true`** retire le paquet du catalogue **sans le retirer du site** :
  les fichiers restent servis, donc testables par leur URL dans un vrai document,
  mais le widget n'est ni au manifeste ni sur la vitrine. C'est le sas avant
  publication, et le seul moyen de valider pour de vrai — une instance Grist
  distante ne peut pas atteindre un `localhost`.
- Un `package.json` **illisible arrête tout** : mieux vaut pas de manifeste qu'un
  manifeste amputé sans que personne le voie.

---

## `vitrine.json` — la fiche du projet

Une seule fiche alimente **la page publique et le message de forum**. Les écrire
séparément les ferait diverger, et c'est la page qui perdrait — on annonce plus
souvent qu'on ne met à jour.

### Champs lus par la page (`generate-vitrine.js`)

| Champ | Rôle |
|---|---|
| `nom` | le titre affiché |
| `pitch` | une ou deux phrases, orientées valeur, pas fonctionnalités |
| `couleur` | l'accent de la page (`#RRGGBB`) |
| `peau` | variante de thème, facultative |
| `tags` | mots-clés courts |
| `depot` | l'URL du code |
| `points` | `[{titre, texte}]` — ce que le widget fait |
| `encart` | `{titre, texte, lien:{libelle, url}}` — un appel à part (une application, un téléchargement) |
| `journal` | `[{version, texte}]` — du plus récent au plus ancien |
| `produit` | le bloc de présentation détaillée, voir ci-dessous |
| `forum` | `{url, titre, postId, titreSujet}` — `postId` **arme le workflow d'édition** |
| `principal` | le `widgetId` mis en avant quand le projet en publie plusieurs |
| `archives` | les `widgetId` de versions précédentes, marqués comme tels |

### Le bloc `produit`

| Champ | Rôle |
|---|---|
| `accroche` | la phrase d'ouverture |
| `chiffres` | `[{valeur, libelle}]` |
| `titreContextes`, `contextes` | `[{titre, texte, pourquoi, format, images}]` — les moments d'usage |
| `titreSequence`, `sequence` | les étapes d'un parcours |
| `apercu` | la démonstration intégrée |

Dans `contextes[].images`, **`prive: true` garde une capture pour la page et
l'écarte du message de forum** — utile pour une capture prise dans un document de
travail, qu'on ne retire plus d'un message public.

### Champs lus par le message de forum uniquement

`statut` (`{niveau, texte}`), `constat` (le problème avant l'outil), `usages`
(`[{titre, texte}]`, par métier). Ils n'apparaissent pas sur la page : le lecteur
de la page cherche déjà un widget, celui du forum a un problème.

### Ce qui n'est lu par rien

Tout le reste. Un champ inventé — `aperçu` avec un accent, `captures`,
`companion_mobile` — est silencieusement ignoré. **La référence vivante est
`published/atlas/vitrine.json`.**

---

## `accueil.json` — la page d'accueil

Contenu éditorial de `published/index.html` : `titre`, `chapeau`, `principes`,
`declinaisons`, `fabrique`, `chaine`, `conventions`, `grist`, `ecosysteme`,
`statut`. Chaque bloc a son `…Titre` et son `…Texte` facultatifs.

`ecosysteme` cite ce sur quoi le dépôt s'appuie ; chaque entrée accepte un champ
`forum` qui renvoie l'équipe vers sa propre présentation, plutôt que de la
résumer à sa place.

---

## Le message de forum

`generate-post.js` rend le brouillon dans **`.forum/<widget>.md`**, hors de la
zone publiée et **hors de git** : le rendu se refait en une commande, et le
publier ferait un troisième exemplaire indexable du même texte, au détriment du
fil qu'on veut voir remonter.

`publish-post.js` ne sait que **réécrire un message existant**, jamais en créer.
Il simule par défaut ; il faut `--publier`. Sans `forum.postId` dans la fiche, il
s'arrête — deviner quel message mettre à jour reviendrait à écrire dans celui de
quelqu'un d'autre.

**Rien ne part sur le forum sans accord explicite de l'utilisateur.**

Attention au piège : un `postId` qui pointe vers un ancien fil sera **écrasé** au
premier déclenchement, et le titre du sujet, lui, ne change pas par cette voie.
Tant que le sujet dédié n'existe pas, ne pas renseigner `postId`.

---

## L'ordre à suivre pour publier

```
1. published/<widget>/          les fichiers + package.json (+ vitrine.json)
2. npm run manifest             → vérifier qu'aucun avertissement ne sort
3. node scripts/generate-vitrine.js
4. node --test scripts/generate-vitrine.test.js
5. commit + push                → la CI déploie published/ sur gh-pages
6. vérifier l'URL en ligne      avant d'annoncer quoi que ce soit
```

Un widget qui n'a jamais tourné dans un document Grist réel passe par
`prive: true` d'abord. Le retrait de ce marqueur **est** le geste qui publie.
