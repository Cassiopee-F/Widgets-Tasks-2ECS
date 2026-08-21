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

Terrain, c'est **SURFAC²E dont on a retiré le métier**. SURFAC²E — développé
dans un pod Onyxia, spécialisé sur la cotation de bâtiments — a déjà l'hôte, le
contrat de module et une file hors-ligne éprouvée en production. Terrain extrait
ce socle et le rend générique : tout type de formulaire, toute saisie de terrain.

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
| **SURFAC²E** (pod Onyxia `proj-surfac2e-terrain`) | l'hôte, le contrat de module, la file hors-ligne et ses sept règles |
| **[Grist-AppStore](https://github.com/nic01asFr/Grist-AppStore)** | les entrées : voix, vision, entraînement embarqué, catalogue de modèles |
| **Widgets-Grist** (ici) | FormDef, les widgets bureau, la chaîne de publication, Atlas |

Aucun des trois n'a l'ensemble. C'est pourquoi aucun n'aboutit seul, et pourquoi
« refondre » se lit ici comme **extraire un socle**, pas comme réécrire.

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

Voir la fin d'[ARCHITECTURE.md](ARCHITECTURE.md). En résumé : le rapport à
SURFAC²E qui est en production, le niveau « pro » de la reconnaissance, où
s'applique le modèle entraîné, et le sort des démonstrateurs.
