# Terrain

> **Le socle générique de saisie de terrain.** Un professionnel relève quelque
> chose sur place et le dépose dans un document Grist, quel que soit le métier.
>
> **État : cadrage. Aucun code.** Ce dossier ne contient que des documents.

---

## Si vous arrivez ici sans contexte

Lisez dans cet ordre, ça prend vingt minutes et ça évite de refaire le chemin :

1. **[ARCHITECTURE.md](ARCHITECTURE.md)** — ce qu'est Terrain, les contrats à
   respecter, ce qui existe déjà dans trois dépôts, ce qui est mesuré et ce qui
   ne l'est pas. **C'est le document de référence.**
2. **[../../CLAUDE.md](../../CLAUDE.md)** — les règles du dépôt. En particulier :
   on développe dans `projects/`, on ne touche à `published/` que sur demande
   explicite de publication.
3. **[../../skills/vitrine.md](../../skills/vitrine.md)** — comment un widget se
   publie ici : `package.json`, `vitrine.json`, manifeste, forum.
4. **[../../skills/patterns.md](../../skills/patterns.md)** — les patterns de
   code, dont le respect des droits du document.

---

## En une phrase

Terrain est **la refonte de Grist-AppStore** : ses quatre démonstrateurs
deviennent les briques d'un produit unique, générique — tout type de formulaire,
toute saisie de terrain.

**SURFAC²E sert de référence architecturale, et rien de plus.** Spécialisé sur la
cotation de bâtiments, développé dans un pod Onyxia, il a déjà l'hôte, le contrat
de module et une file hors-ligne éprouvée en production : on copie ce qui a fait
ses preuves. Il est en production, il suit son cours, **on ne le perturbe pas** —
aucune dépendance partagée, aucune convergence attendue.

Le principe tient en une ligne, héritée de SURFAC²E et généralisée :
**une seule chaîne, N façons de la remplir.** Un champ déclare ce qu'il attend ;
des modules d'entrée déclarent ce qu'ils savent produire — la voix, la caméra,
les capteurs, la lecture d'un document. Le clavier reste le repli universel.

---

## L'invariant, à ne jamais contourner

Terrain **consomme** des contrats, il n'en invente pas :

- **FormDef 1.0** — `projects/grist_forms/runtime/formdef.schema.json`
- **Scene Manifest** — partagé entre qgis2grist et Atlas

Quand le contrat manque quelque chose, **on étend le contrat** avec un incrément
de version. On ne contourne pas dans Terrain.

Le critère est vérifiable : un FormDef produit par `grist_forms` doit se remplir
dans Terrain sans adaptation, et une scène produite par Terrain doit s'ouvrir
dans Atlas sans conversion. S'il faut un adaptateur, le contrat a été contourné.

Ces contrats visent aussi à être **produits et interprétés par des agents** —
c'est déjà l'esprit de `qgis-sspcloud` et de QGIS Stream MCP. Le schéma n'est
donc pas de la documentation : c'est la contrainte de génération.

---

## Ce qui existe déjà, et où

| Dépôt | Ce qu'il apporte |
|---|---|
| **SURFAC²E** (pod Onyxia) — *référence, ne pas modifier* | l'hôte, le contrat de module, la file hors-ligne et ses sept règles |
| **[Grist-AppStore](https://github.com/nic01asFr/Grist-AppStore)** | les entrées : voix, vision, entraînement embarqué, catalogue de modèles |
| **Widgets-Grist** (ici) | FormDef, les widgets bureau, la chaîne de publication, Atlas |

Aucun des trois n'a l'ensemble, et c'est pourquoi aucun n'aboutit seul.
« Refondre » se lit donc ici comme **assembler des pièces qui existent** — ni
réécrire, ni modifier les dépôts d'origine, qui restent intacts.

---

## Les deux widgets déjà dans `published/`

`published/terrain-observations/` et `published/terrain-detections/` ont été
migrés depuis Grist-AppStore le 21/08/2026, avec quatre bloquants corrigés
(section `grist` absente, mode démonstration inopérant, garde ACL, contraste du
thème sombre).

**Ils portent `prive: true` et ne seront pas publiés en l'état** : ils seront
refondus comme faces du produit Terrain. Ils restent servis parce qu'ils sont la
meilleure référence de ce que ces vues doivent faire — pas parce qu'ils
attendent une validation.

---

## Ce qui reste à décider

Voir la fin d'[ARCHITECTURE.md](ARCHITECTURE.md). En résumé : le niveau « pro »
de la reconnaissance, où s'applique le modèle entraîné, et le sort des
démonstrateurs.
