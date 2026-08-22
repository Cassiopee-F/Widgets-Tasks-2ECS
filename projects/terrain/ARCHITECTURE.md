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

### La définition courte

**Terrain fait le lien entre trois choses qu'il ne connaît pas** :

| Il reçoit | D'où | Il n'en sait rien |
|---|---|---|
| **un formulaire** | `grist_forms`, `qgis2grist` depuis QField, ou un agent | il ignore le métier |
| **un contexte de terrain** | l'appareil : position, caméra, micro, absence de réseau | il ignore le lieu |
| **des services** | déclarés : une adresse, une clé, un modèle | il ignore le fournisseur |

Et il produit des lignes dans des tables Grist.

Les trois arrivent par **déclaration**, jamais par du code : le formulaire est un
FormDef, les services sont trois valeurs de configuration, les modèles viennent
d'un catalogue. C'est ce qui le rend générique — non pas parce qu'il aurait été
écrit pour tous les métiers, mais parce qu'il n'en connaît aucun.

**Corollaire pour l'agent de terrain : il ne configure rien, il reçoit.** Toute
la configuration se tient au bureau, dans le document. Ce qui a un coût, traité
en question ouverte n° 4.

### Terrain n'est pas un outil géographique

À ne pas confondre avec la chaîne cartographique, qui est **spécialisée** :

    QGIS ──► qgis2grist ──► Grist ──► Atlas          (données géographiques)

**Terrain n'en est pas un maillon.** Il part de *n'importe quel* formulaire
Grist : un inventaire de matériel, un relevé de compteurs, un audit de fissures
sur un bâtiment n'ont aucun besoin de carte.

    Form Builder ─────┐
                      ├──► FormDef ──► Terrain ──► tables Grist ──► widgets bureau
    qgis2grist ───────┘                                 │
    (depuis QField)                                     └──► Atlas — SEULEMENT si
                                                             données géographiques

Trois conséquences à tenir :

- **La première étape de Terrain, c'est Form Builder.** C'est de là que vient un
  formulaire, dans le cas courant.
- **`qgis2grist` n'est qu'un producteur de FormDef parmi d'autres** — le cas
  particulier où le formulaire est déduit d'une couche QField.
- **Atlas est une sortie optionnelle**, pas le débouché naturel. La position est
  un attribut parmi d'autres ; quand elle est absente, rien ne manque.

Ce qui vaut aussi pour le Scene Manifest : Terrain le respecte **s'il produit de
la donnée cartographique**, et ne s'en préoccupe pas sinon. Le contrat qui le
concerne toujours, c'est FormDef.

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

### Trois contrats, pas deux — et FormDef fait foi

`projects/grist_forms/runtime/` contient deux schémas d'apparence proche. Ce ne
sont pas des concurrents : `shared/survey-project.js` expose
`formDefToSurveyManifest` et `surveyManifestToFormDef`. La répartition est écrite
dans `projects/qgis2grist/docs/QFIELD-COMPLET-GRIST-IDEAL.md` :

    Scene Manifest  ↔  carto               (qgis2grist)
    FormDef         ↔  formulaires         (grist_forms)
    Survey Manifest ↔  projection enquête  (formDefToSurveyManifest)

**Terrain consomme FormDef.** Survey Manifest est une **projection optionnelle**,
dérivée de FormDef et orientée questionnaire — son énumération de types contient
`likert5`, ce qui dit assez qu'il vise le sondage et non la saisie métier. C'est
une **sortie**, pas une entrée : la checklist de l'étude dit « export Survey
Manifest **depuis** au moins un FormDef ».

### Terrain reprend le hors-scope de « QField complet dans Grist »

L'étude `QFIELD-COMPLET-GRIST-IDEAL.md` (27/07/2026) couvre la même famille de
besoins, et déclare **explicitement hors scope** :

> - « Offline-first terrain sans réseau »
> - « Édition géométrie mobile — reste QGIS/QField ou éditeur carto dédié »
> - « Remplacer QFieldSync / app Android »

Son parcours « Terrain » passe par le **navigateur Grist mobile**, avec « sync
live Grist (**pas offline QField**) ».

Les deux travaux ne se recouvrent donc pas, ils s'emboîtent :

| | Couvre |
|---|---|
| **QField complet dans Grist** | le bureau (import, FormDef, publication) et le terrain **connecté**, dans le navigateur |
| **Terrain** | le terrain **déconnecté** : application dédiée, file d'attente, capteurs, entrées automatiques |

À lire avant de commencer : cette étude porte déjà le FormDef idéal d'une couche,
le Scene Manifest idéal, et une matrice de complétude. Son « pont manquant
prioritaire — `qgisFormToFormDef` » a d'ailleurs été construit depuis.

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
| **app-ml-pro** | 📷 Capturer → 📊 Dataset → 🧠 Modèles | **annotation par rectangles** puis `exportCOCO()`. Il n'entraîne pas : il constitue un jeu de données et réimporte un modèle entraîné ailleurs. |

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

## Le « service » est une compatibilité, pas un backend

**Tranché.** Il n'y a aucun service web à construire. Le modèle est celui de
SURFAC²E, écrit en tête de `_core/extraction.js` :

> « **GÉNÉRIQUE : parle à tout service compatible OpenAI** (Albert, SSPCloud,
> Mistral, un vLLM auto-hébergé). Une adresse, une clé, un nom de modèle —
> interchangeable. »

Un service se réduit donc à **trois valeurs de configuration**, qui ont leur
place dans une table du document comme tout le reste. Le niveau « pro » n'est
pas une architecture différente : c'est le même socle avec un modèle plus
capable au bout. Et le repli tient toujours — sans service, la chaîne reste
entière en saisie manuelle.

Le pattern est déjà pratiqué dans Grist-AppStore, qui tente Ollama puis le
format OpenAI. Il ne reste qu'à le généraliser au lieu de le coder deux fois.

### Les garde-fous à reprendre, tous mesurés

- **Trois garde-fous distincts, aucun ne remplace les autres** : le schéma
  garantit la **forme**, la normalisation l'**exploitabilité**, la consigne la
  **qualité**. Vérifié dans SURFAC²E : « schéma actif + consigne faible = JSON
  parfait mais verdict FAUX ».
- **Séparer `[CONSIGNE]` et `[DONNÉES]` dans le message, jamais les fondre.**
  Le contenu vient de Grist, donc de l'utilisateur : un site nommé « ignore les
  instructions précédentes » serait une injection. Vaut pour Terrain, dont toute
  la configuration viendra de tables.
- **Borner les échelles dans le schéma.** Sans `minimum`/`maximum`, une
  confiance revient « en 100 ou en 1 selon l'humeur du modèle, et le seuil
  devient ininterprétable ».
- **Le schéma ne contraint pas le format.** « 12 mars 2025 » est une chaîne
  valide et une date inexploitable — d'où une étape de normalisation, et la
  règle : non normalisable → `null`, **jamais une valeur approchée**.
- **Réessayer** : le service renvoie parfois une réponse vide (3 tentatives).
- **Mode vision plutôt que texte** quand la source est un document : « le même
  modèle échoue en texte et réussit en vision sur le même document ; les cases à
  cocher et les tableaux ne survivent pas à l'extraction de texte ».

---

## Le modèle appartient au formulaire, pas à l'application

**Le cas qui tranche** : un agent part faire un audit à la recherche de fissures.
Son formulaire a été configuré pour cela — soit par un référent, soit en se
configurant tout seul. Le classifieur « fissure » lui sert **parce que son
formulaire le réclame**, pas parce qu'il a ouvert telle ou telle application.

Le modèle est donc **un attribut du champ**, porté par l'extension « sources
d'entrée » :

    champ « nature du désordre »  (type Choice)
      └── source : classification, modèle « fissure-v3 » du catalogue ML_Models

Ce qui fait tomber la question posée en ces termes : ni « dans la vision temps
réel » ni « sur la photo » dans l'absolu — **là où c'est déclaré**. Un champ
`Choice` déclare une classification sur une photo ; un champ liste déclare une
détection, sur une photo ou sur un flux. La même application sert les deux sans
rien savoir du métier.

**La boucle complète :**

    1. le formulaire « Audit fissures » est configuré dans le document
         ├── champs : localisation · nature · gravité · photo
         └── le champ « nature » déclare le classifieur fissure-v3
    2. l'agent part avec ce formulaire
         → Terrain charge le formulaire ET les modèles qu'il déclare
    3. il photographie → « nature » se pré-remplit → il arbitre
    4. ses corrections deviennent des exemples d'entraînement
    5. réentraînement → fissure-v4 publiée au catalogue
    6. l'équipe reçoit la version suivante

**Conséquence pratique pour le hors-ligne**, à ne pas manquer : puisque le
formulaire déclare ses modèles, Terrain doit les **précharger avec les données**,
avant le départ. Un modèle qu'il faudrait aller chercher sur le réseau au moment
de photographier ne servirait à rien — c'est précisément là qu'il n'y a pas de
réseau. Le modèle rejoint donc ce qu'on emporte, au même titre que les entités et
le référentiel.

---

## Comment on bâtit : trois temps, deux lieux

`ml-lite` et `ml-pro` sont des **démonstrateurs**, et ils ne font pas la même
chose : `ml-lite` entraîne sur l'appareil, `ml-pro` annote et exporte.
L'entraînement sur l'appareil fonctionne — mesuré : 16 exemples, 535 ms, 4 bonnes réponses sur 4 — mais un
modèle *réellement valable* demande un jeu de données autrement plus conséquent.
L'entraînement sérieux se fera donc ailleurs, sur des données accumulées.

D'où la répartition, qui est la clé de l'architecture :

| Temps | Où | Ce qui s'y passe |
|---|---|---|
| **Collecter** | terrain | remplir un formulaire, photographier, corriger une étiquette |
| **Apprendre** | ailleurs (poste, serveur, SSP Cloud) | entraîner sur le jeu accumulé, publier au catalogue |
| **Appliquer** | terrain | le modèle du catalogue pré-remplit les champs |

**Terrain collecte et applique. Il n'entraîne pas** — sinon à titre d'amorçage,
pour démarrer sans rien ou éprouver une idée sur place. C'est un mode, pas le
régime nominal.

### Le point qui rend tout cela gratuit

**Annoter, c'est saisir.** Quand l'agent corrige « nature = fissure » sur sa
photo, il produit d'un même geste :

- une **donnée métier** — la ligne qu'on lui demandait ;
- un **exemple d'entraînement** — la photo et son étiquette validée.

Le jeu de données n'est donc pas un travail supplémentaire : c'est un
sous-produit de la saisie ordinaire. Personne n'a à « faire de l'annotation » ;
il suffit que le geste de correction soit conservé.

Conséquence : **le premier livrable de Terrain n'est pas le modèle, c'est le jeu
de données.** Un corpus d'exemples annotés, dans des tables Grist — photos en
`Attachments`, étiquettes validées, position, date, auteur — exportable vers
n'importe quel outil d'entraînement. Le modèle vient après, et d'ailleurs.

### Un piège déjà rencontré : les photos et le CORS

`grist_forms` a buté dessus et l'a consigné : *« `getAccessToken` OK ; `POST
…/attachments` depuis une vue custom hors origine → CORS. Alternative :
formulaire natif Grist sur colonne `Attachments`. »*

Terrain envoie des photos — c'est le cœur de son usage. Il rencontrera donc la
même barrière, **sauf par deux voies** :

- **l'application empaquetée**, où `CapacitorHttp` émet hors du moteur web et
  ignore le CORS. C'est déjà ce qui rend l'application Atlas nécessaire, pour la
  même raison : `grist.numerique.gouv.fr` refuse l'en-tête `Authorization` au
  préflight ;
- **la PWA servie depuis la même origine** que l'instance, cas rare.

À vérifier tôt : c'est le genre de mur qui ne se voit qu'au premier envoi réel,
et qui condamnerait une architecture entière si on le découvrait tard. Le
contournement existe et est éprouvé — encore faut-il l'avoir prévu.

### Ce que cela demande

- **Conserver l'arbitrage, pas seulement son résultat.** Si l'agent corrige une
  proposition, il faut savoir *que* c'était une correction — c'est ce qui
  distingue un exemple utile d'une saisie ordinaire. Une colonne suffit.
- **Un format d'export standard** pour le jeu de données, plutôt qu'un format
  maison : c'est la même règle que pour les contrats. À choisir en fonction de la
  tâche (classification, détection).
- **L'entraînement reste un service**, au sens déjà tranché : une adresse, une
  clé, un modèle. Terrain ne l'héberge pas.

### Qui entraîne ? Trois niveaux, un seul aboutissement

Terrain **ne fournit pas de service d'entraînement**, et ne doit pas en fournir :
il faudrait l'héberger, le maintenir, le sécuriser et le financer. C'est la même
règle que pour les services d'extraction — on parle un standard, on n'exploite
pas d'infrastructure.

Mais ne rien fournir laisserait le corpus inexploité. Ce qui manque n'est pas un
service : c'est **le chemin entre le corpus et le catalogue**. Trois niveaux, du
plus immédiat au plus sérieux :

| Niveau | Où | Pour quoi | Ce que ça vaut |
|---|---|---|---|
| **Amorçage** | sur l'appareil (`ml-lite`) | démarrer sans rien, éprouver une idée sur place | quelques dizaines d'exemples — imparfait, immédiat |
| **Recette** | poste, Colab, SSP Cloud | le régime nominal | un vrai jeu de données, reproductible |
| **Service** | une organisation qui enveloppe la recette | passage à l'échelle | Terrain sait déjà en parler (`exécution: service`) |

**Bonne nouvelle vérifiée le 22/08 : `ml-pro` était déjà conçu ainsi.** Contrairement
à ce que son titre laisse croire, **il n'entraîne pas** — zéro `.fit(` dans son
code. Il **annote et exporte** :

- annotation par rectangles, classes définies par l'utilisateur ;
- **`exportCOCO()`** — un vrai COCO JSON (`images`, `annotations`, `categories`),
  le format standard de la détection d'objets ;
- `importModel()`, `loadPresetModel()`, `activateModel()` — le retour du modèle
  entraîné ailleurs.

C'est exactement la chaîne décrite ci-dessus : annoter → exporter au standard →
entraîner ailleurs → réimporter. L'intention était juste dès l'origine.

**Et le maillon manquant est nommé dans le code** :

```js
async function syncToGrist() {
  toast('Sync Grist non implémenté (à venir)');
}
```

Le corpus reste en IndexedDB, sur l'appareil : ni partagé, ni sauvegardé, ni
exploitable par l'équipe — il disparaît avec le cache du navigateur.

**Ce trou ne se comble pas dans `ml-pro` : il dit ce que Terrain doit apporter.**
On ne rafistole pas les démonstrateurs, on construit **pour et dans Terrain**,
pour deux raisons :

- brancher correctement l'écriture demanderait d'importer dans `ml-pro` la
  moitié de Terrain — client Grist, file, idempotence, verrou — soit du travail
  perdu deux fois, dans un fichier destiné à disparaître ;
- **un démonstrateur qu'on améliore devient un outil utilisé**, donc impossible à
  archiver. C'est ainsi qu'on se retrouve avec quatre applications à maintenir.

Ce que `ml-pro` apporte est donc une **preuve et un modèle**, pas une base de
code : le format de sortie (COCO), l'ergonomie d'annotation, la détection de
format au chargement. Le module « annoter » de Terrain naît avec le client Grist
et sa file dès la première ligne.

**Ce que le projet doit livrer, c'est le deuxième niveau** — et il tient en deux
choses :

1. **Un export du corpus dans un format standard** (selon la tâche :
   classification, détection), jamais un format maison. Même règle que pour les
   contrats : si l'export demande un convertisseur pour entrer dans un outil
   d'entraînement courant, il est raté.
2. **Une recette d'entraînement de référence** — un script ou un carnet qui prend
   l'export et rend un modèle. Exécutable là où l'utilisateur veut, sans rien
   demander au projet.

**Le point à ne pas manquer : ce que la recette produit n'est pas un fichier de
poids, c'est un modèle ET son descripteur.** Des poids seuls, personne ne sait
les brancher. La recette doit rendre une ligne prête pour `ML_Models` — exécution,
tâche, entrée, sortie, rattachement — sans quoi il reste un travail
d'interprétation à chaque fois, et c'est exactement ce qu'on cherche à supprimer.

Les trois niveaux aboutissent donc au **même endroit** et sous la **même forme** :
une entrée de catalogue. Terrain ne sait pas — et n'a pas à savoir — lequel des
trois a produit le modèle qu'il exécute.

### Un modèle se décrit, il ne se code pas en dur

Même exigence que pour les services : Terrain ne doit connaître **ni TensorFlow.js,
ni COCO-SSD, ni tel fournisseur** en particulier. Il doit savoir exécuter *ce qu'on
lui décrit*. Le catalogue `ML_Models` devient donc un descripteur, et non une
liste d'URL.

Cinq attributs suffisent à rendre un modèle utilisable sans le connaître :

| Attribut | Ce qu'il dit | Valeurs |
|---|---|---|
| **exécution** | où et comment il tourne | `tfjs-layers` · `tfjs-graph` · `onnx` · `mediapipe` · `service` (API distante) |
| **tâche** | ce qu'il sait faire | classification · détection · segmentation · transcription · extraction structurée |
| **entrée** | ce qu'il consomme | image (taille, normalisation) · audio · texte |
| **sortie** | la forme du résultat | classe + confiance · boîtes + classes · masque · texte · JSON typé |
| **rattachement** | à quels champs il peut se brancher | les types FormDef qu'il sait remplir |

Le dernier attribut est la charnière : c'est lui qui relie le catalogue à
l'extension « sources d'entrée » d'un champ.

**La correspondance tâche → champ découle du format de sortie**, elle ne
s'invente pas :

| Tâche | Sortie | Remplit un champ |
|---|---|---|
| classification | une classe, une confiance | `Choice`, `Text` |
| détection | N objets localisés | une **liste** — donc une section répétable |
| segmentation | un masque | une surface (`Numeric`), une géométrie |
| transcription | du texte | `Text` |
| extraction structurée | du JSON typé | **plusieurs champs à la fois** |

**Conséquence qui unifie tout** : un service distant et un modèle embarqué ne
sont pas deux mécanismes, mais **le même descripteur avec une valeur d'exécution
différente**. Le LLM qui structure une dictée est un « modèle » au même titre
qu'un classifieur de fissures — il a simplement `exécution: service` et
`sortie: JSON typé`. Terrain n'a donc pas quatre intégrations à écrire, mais un
seul mécanisme et des adaptateurs d'exécution.

Ce qui laisse une frontière nette : **ajouter un moteur d'exécution est un
travail de développement** (`onnx` demande son runtime) ; **ajouter un modèle est
une ligne dans une table**. La seconde opération doit rester à la portée de
quelqu'un qui ne programme pas.

### Piste — le catalogue de modèles comme service à part

**Cadré, pas construit.** À ouvrir seulement après le premier maillon de Terrain.

Terrain *exécute* des modèles ; tenir leur inventaire est un autre métier, avec
un autre rythme. Un catalogue bouge quand un modèle paraît ou qu'une URL se
périme — constaté le 21/08 : `tfhub.dev` redirige désormais vers Kaggle. Rien de
tout cela n'a de raison d'être cadencé sur les versions de Terrain. Et d'autres
que Terrain peuvent en vouloir : Atlas, un widget de bureau, un agent.

**« Service » au sens des contrats déjà publiés** : une ressource décrite,
versionnée, servie en fichier statique. Pas un serveur à héberger, sécuriser et
financer — même règle que pour l'extraction et l'entraînement.

Ce qui donne un **troisième contrat**, symétrique des deux autres :

| Contrat | Décrit |
|---|---|
| **FormDef** | ce qu'il faut **saisir** |
| **Scene Manifest** | ce qu'il faut **dresser** |
| **Model Catalog** | ce qui peut **remplir** |

Deux niveaux à ne pas confondre :

- le **catalogue commun**, publié par le projet : des modèles open source décrits
  une fois pour toutes, avec leurs cinq attributs ;
- le **catalogue de document** (`ML_Models`) : ce que l'équipe emploie vraiment,
  avec ses versions et sa justesse mesurée. On y recopie une entrée du commun,
  et elle y vit ensuite sa vie propre.

L'ébauche existe déjà : les trois modèles figés dans le HTML de `ml-pro`
(EfficientDet-Lite0, Lite2, COCO-SSD) avec taille et nombre de classes. Il
s'agirait de les sortir du HTML et de les décrire complètement.

**Le coût à connaître avant de s'y engager** : une liste de modèles se périme, et
la publier est un engagement d'entretien. Mieux vaut **peu de modèles vraiment
vérifiés** qu'une longue liste dont la moitié ne charge plus — c'est exactement
ce qui est arrivé à `tfhub.dev`.

### L'agencement, pour que ce soit simple

L'exigence est claire : **utilisable par quelqu'un qui n'a rien configuré**. Elle
n'entre pas en contradiction avec tout ce qui précède, à une condition — que la
complexité reste **au bureau**, et la simplicité **sur le terrain**.

Sur le terrain, l'agent ne voit qu'une chose : un formulaire à remplir, avec des
champs qui se pré-remplissent parfois. Il ne choisit pas de modèle, ne configure
pas de service, ne connaît pas le catalogue. Il ne voit ni FormDef, ni JSON
Schema, ni ML_Models.

Deux entrées seulement, sur le modèle de l'hôte SURFAC²E :

    connexion (une fois, mémorisée)
      └── que faire ?
           ├── Saisir     → choisir un formulaire → remplir
           └── Outiller   → contribuer des exemples · ajuster une nomenclature
                            (n'apparaît que si les tables de configuration existent)

Le second menu suit l'opt-in de TaskFlow : absent tant que personne n'en a besoin.

---

## Le socle d'abord, les briques ensuite

### Le socle — sans lui, rien ne marche

Sept pièces, et pas une de plus. Aucune n'est optionnelle, aucune ne suppose de
capteur, de service ou de modèle.

| | Pièce | Pourquoi elle est au socle |
|---|---|---|
| 1 | **Connexion** — instance, document, clé, mémorisées | une fois, jamais redemandée |
| 2 | **Client Grist avec file** — idempotence par clé métier, deux queues ordonnées, verrou, quatre déclencheurs | copié de SURFAC²E ; c'est le seul vrai savoir-faire |
| 3 | **Lecture d'un FormDef** depuis le document | ce que Terrain doit faire remplir |
| 4 | **Moteur de rendu autonome** | sans DSFR ni API Grist : la leçon écrite par SURFAC²E |
| 5 | **Écriture des réponses** dans la table | par la file, donc hors ligne |
| 6 | **L'hôte** — registre déclaratif, `monter`/`demonter`, `horsLigne` déclaré | ce qui accueillera tout le reste |
| 7 | **Service worker** — document réseau d'abord, reste en cache | sans quoi aucune correction n'atteint l'appareil |

**Avec cela seul, Terrain est déjà utile** : remplir un formulaire sur place,
sans réseau, et retrouver ses saisies au bureau. C'est le premier livrable, et il
se suffit — pas de photo, pas de voix, pas de modèle, pas de carte.

### Les briques — chacune se rattache sans que le socle bouge

| Brique | Ce qu'elle apporte | Besoins |
|---|---|---|
| **Capteurs** | position, horodatage | — |
| **Photo** | image en `Attachments` | caméra · *attention CORS* |
| **Voix** | dictée transcrite | micro · réseau |
| **Extraction** | plusieurs champs d'un coup, depuis un texte ou un document | réseau |
| **Vision** | classe ou détections depuis une image | modèle préchargé |
| **Annotation** | constitue le corpus | caméra |
| **Carte** | Atlas monté comme module | données géographiques |

Aucune n'est nécessaire aux autres. On peut n'en livrer aucune, ou une seule.

### L'articulation — comment une brique s'attache

**Par déclaration côté champ, jamais par du code côté application.** C'est
l'extension « sources d'entrée » qui porte le lien :

    champ « nature du désordre »  (type Choice)
      └── source : vision, modèle « fissure-v3 »

L'hôte lit le FormDef, et pour chaque champ qui déclare une source, charge la
brique correspondante — import dynamique, comme les modules de SURFAC²E.

**Le contrat d'une brique d'entrée**, minuscule et symétrique de celui des
modules :

```js
{
  id: 'vision',
  besoins: ['camera'],          // permissions et ressources requises
  produit: ['Choice', 'Text'],  // les types de champ qu'elle sait remplir
  horsLigne: true,              // utilisable sans réseau ?
  async produire(champ, contexte) {
    return { valeur, confiance, origine };  // jamais écrit directement
  }
}
```

Trois règles qui découlent du reste et ne se négocient pas :

- **Elle propose, elle n'écrit pas.** La valeur retournée passe par l'arbitrage
  humain avant d'atteindre la table. C'est aussi ce qui permet de conserver
  l'origine, donc de constituer le corpus.
- **Elle est facultative en toutes circonstances.** Brique absente, permission
  refusée, service injoignable, modèle non préchargé : le champ reste saisissable
  au clavier. L'hôte n'a pas à le savoir à l'avance — il essaie, et retombe.
- **`produit` est le seul contrôle de compatibilité.** Une brique ne se rattache
  qu'à un champ dont elle sait produire le type. C'est ce qui empêche de brancher
  un détecteur sur une date.

### L'ordre dans lequel construire

1. **Le socle** — un formulaire, une file, une table. Utile seul.
2. **Capteurs, puis photo** — sans service ni modèle ; la photo tôt, parce
   qu'elle porte le risque CORS et qu'il vaut mieux le lever avant tout le reste.
3. **Voix et extraction** — les deux passent par un service compatible OpenAI,
   donc un seul mécanisme pour les deux.
4. **Vision et annotation** — ensemble, car l'une nourrit l'autre.
5. **Carte** — en dernier, et seulement si un usage la réclame.

Chaque étape est livrable et vérifiable seule. Aucune ne remet en cause la
précédente : c'est précisément ce qu'un socle est censé garantir.

---

## Ce qui reste à décider

1. ~~Le rapport à SURFAC²E.~~ **Tranché** : SURFAC²E reste indépendant et n'est
   pas perturbé. Il sert de référence ; son code se copie et s'adapte, il ne se
   partage pas. Ne pas rouvrir cette question sans décision explicite.
2. ~~Le niveau « pro » de la reconnaissance.~~ **Tranché** : il n'y a **pas de
   backend à construire**. Le « service » est une compatibilité, pas une
   dépendance — voir la section précédente.
3. ~~Où le modèle entraîné s'applique.~~ **Tranché** : là où le **formulaire le
   déclare**. Le modèle est un attribut du champ, pas un mode de l'application —
   voir « Le modèle appartient au formulaire » ci-dessus.
4. **Le coût du modèle déclaratif** — *fortement réduit*. Déclaratif ne veut pas
   dire « écrire du JSON » : `grist_forms/builder.html` (162 Ko) offre un
   **wizard Créer / Brancher, des templates**, des conditions avec opérateurs,
   les cascades Ref→Ref, la gestion d'audience et la publication intra-document.
   La configuration se fait donc à l'interface, pas à la main.
   Ce qui reste ouvert est plus étroit : **le parcours de démarrage bout en
   bout**, d'un document vide à une première saisie sur le terrain. Et la piste
   de la génération assistée — « décris ton métier, je fabrique le
   formulaire » — reste valable comme raccourci, pas comme substitut.

6. ~~Quel contrat de formulaire fait foi ?~~ **Tranché : FormDef.** Voir « Trois
   contrats, pas deux » ci-dessus.
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
