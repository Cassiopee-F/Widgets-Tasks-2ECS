# Terrain — note d'architecture

> **État : cadrage. Aucun code écrit.** Cette note fixe ce qui a été établi le
> 21 août 2026, en explorant trois dépôts existants. Elle sert à reprendre à
> froid sans refaire le chemin.

---

## Ce qu'est Terrain

Terrain est **le socle générique de saisie de terrain** : ce qui permet à un
professionnel de relever quelque chose sur place et de le déposer dans un
document Grist, quel que soit le métier.

SURFAC²E en est la première instance — spécialisée sur la cotation de bâtiments.
Terrain, c'est SURFAC²E dont on a retiré le métier.

Terrain n'est donc **pas un nouveau produit à inventer**. C'est un socle à
extraire de ce qui existe déjà, en trois endroits, et qu'aucun des trois ne
possède en entier.

---

## Le principe : une chaîne, N façons de la remplir

Le module documentaire de SURFAC²E le pose déjà, pour deux modalités :

> « Le mode vaut `vision` (lu par un service) ou `saisie` (rempli à la main) —
> **une seule chaîne, deux façons de la remplir**. »

Terrain généralise à N. Un champ de formulaire déclare **ce qu'il attend** ; les
modules d'entrée déclarent **ce qu'ils savent produire**. Sur place, l'agent
choisit : il dicte, il photographie, il scanne un document, il laisse le capteur
répondre, ou il tape.

Deux règles héritées de SURFAC²E, et non négociables :

- **Chaque étape propose, aucune n'impose.** Toute valeur produite
  automatiquement est arbitrée par une personne avant d'être écrite.
- **Le clavier est le repli universel.** Si le service d'entrée manque, la
  chaîne reste complète en manuel — sinon ce n'est pas un repli.

---

## Les contrats — invariant du chantier

Terrain est **consommateur** de contrats existants, jamais auteur de formats.

| Contrat | Où il vit | Ce qu'il porte |
|---|---|---|
| **FormDef 1.0** | `projects/grist_forms/runtime/formdef.schema.json` | la définition d'un formulaire |
| **Scene Manifest** | partagé qgis2grist ↔ Atlas | la restitution cartographique |

**Quand le contrat manque quelque chose, on étend le contrat — on ne contourne
pas dans Terrain.** Une extension s'accompagne d'un incrément de version
(`manifest_version` pour FormDef).

Le précédent sain est celui de SURFAC²E, qui a contourné une fois **en l'écrivant
en tête de fichier** : « limite assumée », « manque générique identifié, à porter
au contrat si le besoin se confirme ailleurs ». Une dette écrite se rembourse ;
une dette silencieuse produit un format maison, et six mois plus tard le mot
« FormDef » ne garantit plus rien parce que deux implémentations en ont chacune
leur version.

**Le critère qui tranche, et il est vérifiable :** un FormDef produit par
`grist_forms` doit se remplir dans Terrain **sans adaptation**, et une scène
produite par Terrain doit s'ouvrir dans Atlas **sans conversion**. Le jour où il
faut écrire un adaptateur entre les deux, le contrat a été contourné — pas
dépassé.

### Les contrats sont la surface d'écriture des agents

Ce n'est pas seulement une convention entre outils. L'intention est qu'un agent —
ou une solution d'IA — puisse **produire, interpréter et configurer** du contenu
conforme, et donc opérable par les solutions, sans intégration deux à deux. C'est
déjà l'esprit de `qgis-sspcloud` et de QGIS Stream MCP.

Cela déplace le rôle du schéma : **ce n'est plus de la documentation, c'est la
contrainte de génération** — ce qu'on met dans un `response_format` pour qu'un
modèle ne puisse produire que du valide. Le pattern est déjà appliqué à
l'intérieur de SURFAC²E, où `champs_attendus` devient un JSON Schema via
`extraction.versSchema()` pour contraindre la réponse du service de lecture.

**Constat au 21/08/2026 : il n'est pas appliqué aux contrats eux-mêmes.**

| | État |
|---|---|
| `$id` de `formdef.schema.json` | `https://widgets-grist.local/…` — domaine fictif, non résolvable |
| schéma servi publiquement | 404 sur les emplacements plausibles |
| Scene Manifest | Markdown v0.2.2 + implémentation JS, **aucun JSON Schema** |

Les deux contrats sont donc respectés par des humains qui lisent la doc, et
inatteignables par un agent : une prose Markdown ne se met pas dans un
`response_format`, et un `$id` qui pointe dans le vide interdit toute résolution
de référence.

Trois gestes, peu coûteux puisqu'il s'agit de fichiers statiques et que
`published/` est déjà un site :

1. donner à FormDef un `$id` réel, et le servir ;
2. écrire le JSON Schema du Scene Manifest, à partir de
   `projects/qgis2grist/docs/SCENE-MANIFEST-v0.2.2.md` et de
   `projects/qgis2grist/lib/scene-manifest.js`, qui en portent déjà la
   définition ;
3. les publier à une adresse **stable et versionnée**, pour qu'un agent puisse
   cibler une version précise plutôt que « la dernière ».

Conséquence directe pour Terrain : les deux extensions à porter au contrat
(section répétable, sources d'entrée) doivent être écrites pour être
**générables** — donc exprimables en JSON Schema, sans convention implicite qu'un
modèle ne pourrait pas deviner.

Bénéfice direct : Atlas lit déjà du Scene Manifest écrit par qgis2grist sans rien
savoir de QGIS. Si Terrain produit le même contrat, la restitution est acquise
sans une ligne de code cartographique de plus.

---

## L'architecture : hôte, modules, services

Reprise du modèle SURFAC²E, vérifié dans `pwa/app-terrain/host.js` :

```
_core/      les services transverses (client Grist + file, carte, photo,
            position, géocodage, formdef, extraction…)
modules/    les fonctions métier, chargées à la demande
hôtes/      des compositions : chaque hôte déclare les modules qu'il expose
```

Un hôte est **un registre déclaratif**, pas un assemblage câblé :

```js
const MODULES = [
  { id: "coter", libelle: "Coter", description: "Relever et noter, sur site",
    horsLigne: true,
    charger: () => import("../modules/coter/module.js").then(m => m.default) },
];
```

Ce qui en découle, et qui est l'essentiel du modèle :

- **`horsLigne` est une propriété déclarée**, pas un espoir : l'hôte grise seul
  les modules indisponibles sans réseau.
- **Contrat de module minuscule** : `monter({entite}, client, config, zone)` et
  `demonter()`.
- **Un même vivier, plusieurs compositions.** Dans SURFAC²E, `app-terrain`
  n'expose qu'un module sur les dix disponibles. Le terrain n'est pas une autre
  application, c'est un **sous-ensemble assumé**.
- **Un module s'installe dans le document, pas dans l'application** : ajouter ses
  tables Grist suffit, l'hôte sonde leur présence au démarrage. C'est le même
  opt-in que TaskFlow, où le Plan est seul créateur de ses colonnes.
- **Les replis sont en cascade** : module absent → l'application de base marche
  inchangée ; service absent → plus d'automatisme, mais la chaîne reste entière.

---

## Ce qui existe déjà, et où

Aucun des trois dépôts n'a l'ensemble ; chacun détient une pièce que les autres
n'ont pas. C'est pourquoi aucun n'aboutit seul.

| Dépôt | Ce qu'il apporte | État vérifié |
|---|---|---|
| **SURFAC²E** (pod Onyxia `proj-surfac2e-terrain`) | l'hôte, le contrat de module, la file hors-ligne et ses leçons | en production |
| **Grist-AppStore** | les entrées : voix, vision, entraînement embarqué, catalogue de modèles | démonstrateurs |
| **Widgets-Grist** (ici) | FormDef, les widgets bureau, la chaîne de publication, Atlas | publié |

### Ce que les démonstrateurs ont prouvé, et qu'il ne faut pas jeter

- **La transcription fonctionne** : `MediaRecorder` → API compatible Whisper,
  vers Albert (`albert.api.etalab.gouv.fr`) ou `llm.lab.sspcloud.fr`, avec repli
  Ollama → format OpenAI. Ce repli n'a rien d'évident : c'est le résidu d'un
  échec rencontré, personne ne le réécrirait spontanément.
- **L'entraînement embarqué fonctionne** : transfer learning MobileNet → tête
  dense. **Mesuré le 21/08/2026 : 16 exemples, 535 ms, 4 bonnes réponses sur 4**
  sur des images jamais vues. Le modèle survit à la sauvegarde IndexedDB.
- **Le catalogue de modèles en table Grist** (`ML_Models` dans
  `shared/ml-models.js`) : versions, URL, justesse remontée après usage. Jamais
  appelé, mais c'est la pièce qui transformerait un modèle personnel en modèle
  d'équipe.

### Ce qu'ils n'ont pas prouvé

**Qu'on peut les assembler.** Le défaut central est mesuré : le modèle entraîné
part dans `indexeddb://custom-classifier-v1` et **aucune des deux applications de
saisie ne le charge** — zéro référence. On peut apprendre « fissure » et cette
connaissance ne produit aucune donnée.

Tous les autres défauts relevés découlent de la même cause — une découpe en
applications là où il y avait des briques :

- deux service workers pour un même produit, dont chacun **efface le cache de
  l'autre** à l'activation (reproduit) ;
- l'application voix **ne démarre pas hors réseau** : son cache contient
  `index.html` mais aucun des quatre scripts qu'elle charge, et son handler
  `fetch` ne met jamais rien en cache ;
- `lite` et `pro` diffèrent par l'interface, pas par l'architecture ;
- neuf `catch` vides sur la transcription : quand les deux tentatives échouent,
  l'agent parle et rien ne se passe, sans savoir pourquoi.

Chaque brique a dû réimplémenter son emballage — service worker, manifeste, écran
de connexion — alors qu'elles participent toutes du même geste.

---

## Les deux extensions à porter au contrat FormDef

Vérifié dans `formdef.schema.json` : ni l'une ni l'autre n'existe aujourd'hui.

1. **La section répétable.** Trois fissures sur un ouvrage, c'est trois fois les
   mêmes champs. SURFAC²E l'a contourné pour ses constats et l'a signalé comme
   « manque générique, à porter au contrat si le besoin se confirme ailleurs ».
   Terrain générique **est** cet ailleurs.

2. **Les sources d'entrée d'un champ.** Un champ y déclare son type et son
   libellé, pas ce qui peut le remplir. C'est l'extension centrale : dire qu'un
   champ « nature du désordre » accepte une classe issue de la caméra, qu'un
   champ « constat » accepte une dictée, qu'un champ « position » se prend du
   capteur.

Modèle à suivre pour la seconde : `champs_attendus` dans SURFAC²E, **une
déclaration JSON qui sert six fois** — contraindre le service, rédiger la
consigne, valider la réponse, typer le stockage, générer le formulaire de repli,
documenter. « Ajouter un champ enrichit tout, sans toucher au code. »

---

## Le hors-ligne : sept règles déjà payées

`docs/hors-ligne.md` de SURFAC²E documente, **avec les chiffres de production**,
exactement les défauts que Grist-AppStore porte encore. Ne pas réimplémenter :
reprendre le `grist-client.js` de SURFAC²E et sa file.

1. **Le document est servi réseau d'abord**, cache en secours. En cache d'abord,
   `index.html` restait figé, donc les modules aussi — *« aucune correction
   n'atteignait l'appareil. Ce défaut masquait tous les autres. »* Les autres
   fichiers gardent cache d'abord, leur adresse portant un `?v=`.
2. **Toute écriture doit pouvoir être rejouée sans changer le résultat** : la
   file livre « au moins une fois ». `AddOrUpdateRecord` sur clé métier, jamais
   `AddRecord`/`UpdateRecord` conditionnel. *Constaté : 437 cotations dupliquées,
   une photo téléversée quatre fois.*
3. **Ne jamais exiger un identifiant serveur** pour autoriser un geste : hors
   ligne, une ligne créée n'en a pas. Viser la clé métier.
4. **Deux files ordonnées** : les actions d'abord, les binaires ensuite — leur
   ligne cible doit exister pour qu'on s'y rattache, retrouvée par clé locale.
5. **Distinguer coupure réseau et refus serveur.** Sans cette distinction, *une
   action mal formée retenait 123 saisies derrière elle, indéfiniment*. Les
   entrées refusées sont comptées et affichées.
6. **Un seul passage à la fois**, avec verrou et marquage « en vol ». Quatre
   déclencheurs — démarrage, `online`, retour au premier plan, relance
   périodique — car *« l'événement `online` est peu fiable sur mobile »*.
7. **Affichage optimiste** : ce qui vient d'être fait s'affiche tout de suite.
   *« Sans cela, l'agent croit que son geste a échoué — et le refait. »*

Le test qui tranche : couper le réseau, agir, déclencher plusieurs
synchronisations d'un coup au retour, vérifier qu'il n'y a ni doublon ni perte.

---

## Ce qui reste à décider

1. **Le rapport à SURFAC²E.** Terrain est son socle extrait — donc SURFAC²E doit
   à terme reposer dessus. Cela engage SURFAC²E, qui est en production : ce n'est
   pas une décision unilatérale du chantier Terrain.
2. **Le niveau « pro » de la reconnaissance.** Un vrai service web, ou le même
   socle avec un modèle plus lourd que le catalogue Grist distribue ? Aujourd'hui
   il n'y a aucun backend : `ml-models.js` sait charger depuis une URL, rien de
   plus.
3. **Où le modèle entraîné s'applique** : dans la vision temps réel, sur la photo
   d'une saisie vocale, ou les deux.
4. **Le coût du modèle déclaratif.** Il déplace la complexité vers le bureau au
   lieu de la supprimer : quelqu'un doit tenir les tables de configuration. Gain
   net pour une équipe qui a un référent Grist ; pour un agent seul, il faut des
   valeurs par défaut qui marchent sans rien configurer.
5. **Le sort des démonstrateurs.** Un démonstrateur qui a fait sa preuve n'a pas
   besoin de devenir un produit : il doit céder sa brique et disparaître.
   Chercher à rendre chacun pertinent en tant qu'application produirait quatre
   applications moyennes qui se disputent le même téléphone — c'est déjà ce qui
   arrive.

---

## Ce qui est mesuré, ce qui ne l'est pas

Pour ne pas transmettre des suppositions comme des faits.

**Vérifié le 21/08/2026, dans un navigateur ou par lecture du code :**
l'entraînement embarqué (535 ms, 4/4) · les caches qui s'effacent mutuellement ·
l'absence des scripts au cache de l'application voix · l'absence de référence au
modèle entraîné dans les deux applications de saisie · l'absence de section
répétable et de sources d'entrée dans `formdef.schema.json` · le registre de
modules et le contrat `monter`/`demonter` de SURFAC²E.

**Non vérifié :** le comportement réel sur un téléphone (tout a été testé en
émulation) · la transcription contre un vrai service, avec une vraie clé · le
comportement de la file de SURFAC²E sous coupure réelle · si des PWA
Grist-AppStore sont installées quelque part, ce qui déciderait du coût d'un
changement d'URL.

**Deux erreurs commises et corrigées pendant l'exploration**, à ne pas
reproduire : avoir conclu que le chargement de MobileNet était cassé sur la foi
d'un `curl` sur l'URL nue, alors que TFJS en construit une autre avec
`fromTFHub` — le chargement réussit en 1 s ; et avoir cru le classifieur fautif
alors que les images de test étaient tracées hors du cadre. **Un test négatif se
vérifie avant d'être rapporté.**
