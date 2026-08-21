# Terrain — note d'architecture

> **État : cadrage. Aucun code écrit.** Cette note fixe ce qui a été établi le
> 21 août 2026, en explorant trois dépôts existants. Elle sert à reprendre à
> froid sans refaire le chemin.

---

## Ce qu'est Terrain

Terrain est **le socle générique de saisie de terrain** : ce qui permet à un
professionnel de relever quelque chose sur place et de le déposer dans un
document Grist, quel que soit le métier.

**Terrain est la refonte de Grist-AppStore**, dont les quatre démonstrateurs
deviennent des briques d'un produit unique.

**SURFAC²E est une référence architecturale, pas un projet à faire converger.**
Il est en production, il suit son cours, et rien ici ne l'engage : on lui
emprunte des solutions éprouvées — la forme de son hôte, son client Grist et sa
file hors-ligne — comme on copie un plan qui a fait ses preuves. Aucune
dépendance partagée, aucune exigence qu'il repose un jour sur Terrain.

Terrain n'est donc **pas un nouveau produit à inventer** : ses pièces existent
déjà, réparties en trois endroits dont aucun ne les possède toutes.

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

### FormDef a déjà plusieurs producteurs — l'extension ne sert pas qu'à Terrain

Vérifié dans le dépôt :

| | Rôle vis-à-vis de FormDef |
|---|---|
| `grist_forms` | le producteur de référence — on y conçoit le formulaire |
| `qgis2grist` (`lib/qgis-form-to-formdef.js`) | **producteur** : convertit une couche QGIS/QField en FormDef |
| `qgis2grist` (`lib/terrain-provision.js`) | provisionne la table `Formulaires` après import QField ; importe déjà `grist_forms/shared/formulaires-table.js` |
| **Atlas** | **futur consommateur** : reprendra la partie formulaire au format FormDef, adaptée à son interface, pour associer un formulaire à la saisie cartographique |
| **Terrain** | consommateur |

Deux conséquences :

- **Porter le répétable au contrat sert à tout le monde.** Le pont QField gère
  les `Ref` (`inferVisibleCol`) mais **rien pour les relations 1-N**, alors que
  QField les pratique. Le manque est donc partagé par `grist_forms`, `qgis2grist`
  et SURFAC²E — trois contournements possibles, ou une extension.
- **Un précédent existe pour les sources d'entrée.** `qgis-form-to-formdef.js`
  reconnaît et écarte les colonnes que QField remplit tout seul —
  `QFIELD_GPS` : `x`, `y`, `z`, `horizontal_accuracy`, `nr_used_satellites`,
  `fix_status`, `pdop`… Autrement dit, la notion de « champ rempli par un
  capteur » est **déjà pratiquée**, mais en dur et par exclusion. L'extension
  consisterait à la déclarer plutôt qu'à la deviner.

### Atlas n'est pas seulement un widget

Atlas a aussi pour visée d'être une **brique web réutilisable pour bâtir de la
cartographie web**. Terrain en reprend donc les **primitives**, pas seulement le
Scene Manifest : c'est le même principe qu'avec SURFAC²E pour le hors-ligne — on
ne réécrit pas ce qui existe et qui a été éprouvé.

Terrain se tient ainsi à l'intersection de deux conventions établies : les
**formulaires** (FormDef, partagé avec `grist_forms` et `qgis2grist`) et la
**cartographie** (Atlas, primitives et Scene Manifest).

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
| **SURFAC²E** (pod Onyxia `proj-surfac2e-terrain`) | *référence à copier* : l'hôte, le contrat de module, la file hors-ligne et ses leçons | en production — **ne pas modifier** |
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

### Les interfaces existantes, revues à l'écran le 21/08/2026

Ce que Terrain aura à reprendre, et qui est déjà dessiné :

| Interface | Parcours | Ce qu'elle apporte |
|---|---|---|
| **catalogue** (`index.html`) | — | décrit **déjà** chaque app comme un triptyque *App Android · Widget Grist · Table Grist*, avec ses permissions déclarées. Le modèle de Terrain y est énoncé avant d'être implémenté. |
| **app** (voix) | Visite → Audio → Texte → Validation | quatre étapes numérotées, dictée, photo, badge « Mode démo », « Continuer » désactivé tant que la connexion n'est pas testée |
| **app-video** (vision) | plein écran caméra | badges FPS · GPS · Démo, bouton **Détecter**, bascule de caméra, réglages. Le modèle se charge et s'annonce prêt. |
| **app-ml-lite** | 📷 Capturer → 🧠 Entraîner → ▶ Utiliser | classes par défaut **`fissure` / `Sain`**, compteur d'exemples par classe, « + Classe » |
| **app-ml-pro** | 📷 Capturer → 📊 Dataset → 🧠 Modèles | **annotation par rectangles** — « dessiner un rectangle pour annoter ; appuyer sans dessiner = image entière » |

**Ce que `ml-lite` et `ml-pro` sont pour Terrain** : non pas des applications,
mais les **outils qui entraînent et spécialisent les modèles servant à
automatiser les entrées**. Ils ferment la boucle du projet :

```
saisir sur place → corriger l'étiquette proposée → ces corrections sont des exemples
  → réentraîner → publier dans ML_Models → l'équipe reçoit le modèle
  → la saisie suivante arrive pré-remplie
```

La donnée produite améliore l'outil qui la produit. C'est la lecture exacte de
« produire de la donnée à travers la saisie terrain ».

Et les deux tâches alimentent **deux natures de champ différentes** :

| Outil | Produit | Remplit un champ de type |
|---|---|---|
| `ml-lite` (classification) | une classe pour l'image entière | un **choix** — « nature du désordre : fissure » |
| `ml-pro` (détection) | N objets localisés dans l'image | une **liste** — N détections, donc N lignes |

**La détection produit nativement du 1-N.** Elle rejoint donc exactement
l'extension « section répétable » à porter au contrat FormDef : les deux besoins
n'en font qu'un. Un rectangle annoté et un constat répété sont la même structure.

### Ce qui sépare vraiment les démonstrateurs du produit

**Leurs formulaires sont codés en dur.** Vérifié dans `app/index.html` :
`f-type_observation`, `f-materiaux_concernes`, `f-surface_estimee`,
`f-localisation_precise`, `f-actions_requises`… et **zéro occurrence de
FormDef**. Le parcours en quatre étapes, les champs, la table `Visites_terrain` :
tout est figé pour un métier — l'inspection de voirie.

C'est exactement ce qui sépare *« une application de saisie pour la voirie »* de
*« un socle générique de saisie de terrain »*. Le reste — la voix, la caméra,
l'entraînement, la position — est déjà générique par nature : ce sont des
capteurs, ils ne connaissent aucun métier. **Le seul verrou est le formulaire.**

Terrain ne consiste donc pas à réécrire ces interfaces, mais à **remplacer leurs
champs en dur par un FormDef reçu du document**. Le jour où l'app voix affiche
les champs que la table déclare au lieu des siens, elle cesse d'être SCOUT et
devient Terrain.

### Les entrées ne sont pas des modes de saisie : elles remplissent des champs

C'est le point qui unifie tout. **Un FormDef est une description complète de
champs Grist typés** — vérifié dans le schéma :

| Propriété d'un champ | Ce qu'elle porte |
|---|---|
| `type` | le **type Grist** : `Text`, `Int`, `Bool`, `Date`, `Choice`, `Ref:Table`… |
| `widget` | le rendu, séparé du type |
| `options` | `refTable`, `visibleCol`, `step`, `placeholder` |
| `cascade` | Ref→Ref (`parentField`, `parentRefCol`) |
| `dynamicFilter` | filtre dynamique sur un champ parent |
| `condition` | affichage conditionnel |

La voix, la vision, les capteurs ne sont donc pas des « façons d'utiliser
l'application » posées à côté du formulaire : ce sont des **fonctions qui
produisent des valeurs typées pour ses champs**.

```
capteur  →  valeurs conformes au FormDef  →  arbitrage humain  →  écriture Grist
```

Et le mécanisme existe déjà, écrit pour les documents dans SURFAC²E :
`champs_attendus` → `extraction.versSchema()` → JSON Schema → contrainte de la
réponse du service → normalisation → arbitrage. **La voix n'est qu'un autre cas
du même mécanisme** : le document devient l'audio, la lecture devient la
transcription puis la structuration, et tout le reste est identique. La vision
également : une classe alimente un `Choice`, une détection alimente une liste.

Puisque le type Grist est déjà dans le FormDef, la valeur produite **arrive
typée et directement écrivable**. Il n'y a pas de conversion à inventer entre ce
qu'un modèle rend et ce qu'une table attend.

> **Limite à connaître pour l'extension** : `type` est déclaré comme une *chaîne
> libre* avec une description en prose, pas un `enum`. Suffisant pour un humain,
> insuffisant pour contraindre un agent. À traiter avec les deux extensions —
> c'est le même sujet que le blocker sur l'accessibilité des schémas.

Trois enseignements de plus :

- **Le catalogue ne liste que deux applications.** `ml-lite` et `ml-pro` n'y
  figurent pas : leurs auteurs ne les ont jamais considérées comme des produits.
  C'est cohérent avec leur nature d'outils.
- **`lite` et `pro` ne sont pas deux habillages d'une même chose** : classer une
  image entière et annoter des rectangles sont **deux tâches d'apprentissage
  distinctes**. Ce qui les rapproche, c'est qu'aucune n'a de backend.
- **Le parcours en étapes numérotées est le motif commun** aux quatre. C'est ce
  qu'un hôte Terrain doit savoir rendre, une fois, pour tous les modules.

> **Précaution de test** : `app-video` ouvre le flux caméra dès le chargement
> quand la permission a déjà été accordée à l'origine — comportement normal et
> même souhaitable sur le terrain, où l'on ne veut pas d'écran entre l'agent et
> ce qu'il doit photographier. Mais en test au navigateur, la webcam s'allume
> aussitôt : préférer `take_snapshot` (arbre d'accessibilité) à une capture
> d'écran pour inspecter ces interfaces.

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
- `lite` et `pro` ne partagent ni dataset, ni modèle, ni écran de connexion,
  alors qu'ils s'adressent au même agent sur le même téléphone ;
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

1. ~~Le rapport à SURFAC²E.~~ **Tranché** : SURFAC²E reste indépendant et n'est
   pas perturbé. Il sert de référence ; son code se copie et s'adapte, il ne se
   partage pas. Ne pas rouvrir cette question sans décision explicite.
2. **Le niveau « pro » de la reconnaissance.** Revu à l'écran le 21/08 : `lite`
   et `pro` ne sont pas deux habillages d'une même chose, ce sont **deux tâches
   d'apprentissage distinctes** — `lite` classe une image entière (parcours
   Capturer → Entraîner → Utiliser, classes `fissure` / `Sain` par défaut),
   `pro` annote des rectangles pour de la détection (parcours Capturer →
   Dataset → Modèles). Ce qui reste ouvert n'est donc pas « les fusionner » mais :
   le « service web associé » annoncé n'existe pas — aucun backend, `ml-models.js`
   sait seulement charger depuis une URL. Un vrai service, ou tout sur l'appareil
   avec le catalogue Grist pour distribuer ?
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
