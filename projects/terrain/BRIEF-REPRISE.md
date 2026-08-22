# Brief de reprise — Terrain

> Pour l'agent qui travaille sur **Grist-AppStore**, et pour tout agent arrivant
> **sans contexte**. Écrit le 21/08/2026 au terme d'une exploration des trois
> dépôts concernés.
>
> Objectif : que personne ne refasse le chemin, ni ne reprenne comme un fait ce
> qui n'a pas été vérifié.

---

## 1. Ce qui a changé, et qui prime sur les consignes précédentes

Une migration de deux widgets vers `Widgets-Grist/published/` était en cours.
**Elle est faite.** Mais le cadrage a changé pendant : il ne s'agit plus de
corriger des widgets un par un, il s'agit de **reformer un produit complet**,
nommé **Terrain**, dont ces widgets seront des faces.

Conséquences immédiates :

- **Ne plus migrer quoi que ce soit depuis `to-publish/`.** C'est fait, et la
  destination a changé de nature.
- **Ne pas chercher à rendre chaque application de `Grist-AppStore` pertinente
  pour elle-même.** Un démonstrateur qui a fait sa preuve n'a pas à devenir un
  produit : il doit céder sa brique et disparaître. Quatre applications
  autonomes se disputent déjà le même téléphone — c'est mesurable, voir §4.
- **Lire [ARCHITECTURE.md](ARCHITECTURE.md) avant toute décision technique.**

---

## 2. Ce qui a été fait, précisément

Dans `Widgets-Grist` :

| | |
|---|---|
| `projects/terrain-observations/`, `projects/terrain-detections/` | repris, quatre bloquants corrigés — **en développement**, pas publiés |
| leur emplacement | partis dans `published/` le 21, **ramenés dans `projects/` le 22** : jamais tournés dans un document réel, et destinés à être refondus |
| `projects/terrain/ARCHITECTURE.md` | le cadrage, 300+ lignes |
| `skills/vitrine.md` | le format de publication, qui n'était documenté nulle part |
| `skills/patterns.md` | complété : respect des droits du document |
| `scripts/generate-manifest.js` | avertit désormais quand un widget est absent du catalogue |

Les quatre bloquants corrigés, pour mémoire — ils sont instructifs :

1. **Section `grist` absente du `package.json`.** Une section `widget` avait été
   inventée ; rien ne la lit. Le générateur ignorait les deux widgets **en
   silence**. C'était autant un défaut de l'outil que du widget : l'outil prévient
   maintenant.
2. **Mode démonstration inopérant.** Il testait `typeof grist !== 'undefined'`.
   Or le bundle `grist-plugin-api.js` se termine par `grist = __webpack_exports__`
   — une affectation sans déclaration, donc une globale posée dès que le script
   se charge, iframe ou pas. La page restait vide et muette hors Grist. **Tester
   le contexte** (`window.self !== window.top`), jamais la présence de `grist`.
3. **Aucune garde en écriture.** Un refus ACL remontait en `alert()` avec le
   message brut du serveur. Voir `skills/patterns.md`.
4. **Thème sombre incomplet.** Les fonds étaient redéfinis, pas les teintes de
   statut : la ligne sélectionnée affichait un texte crème sur fond vert pâle,
   **contraste mesuré à 1,1 pour un seuil AA de 4,5**.

---

## 3. La répartition convenue

| Qui | Quoi |
|---|---|
| **Agent Grist-AppStore** | `to-publish/`, `grist-widget*/`, les README racine, la passe de retrait des mentions d'employeur |
| **Agent Widgets-Grist** | `projects/terrain*`, `skills/`, les scripts, les schémas |

Cette répartition évitait de se croiser. Elle vaut toujours pour ne pas écraser
de travail en cours, mais **son objet a changé** : ce ne sont plus des
corrections à faire chacun de son côté, c'est un produit à assembler à partir de
pièces qui existent déjà — sans modifier les dépôts d'où elles viennent.

---

## 4. Ce qui est mesuré dans Grist-AppStore — à ne pas redécouvrir

Vérifié le 21/08/2026, dans un navigateur.

**Ce qui marche et doit être préservé :**

- La transcription : `MediaRecorder` → API compatible Whisper, vers Albert
  (`albert.api.etalab.gouv.fr`) ou `llm.lab.sspcloud.fr`, **avec repli Ollama →
  format OpenAI**. Ce repli est le résidu d'un échec rencontré : personne ne le
  réécrirait spontanément. Le perdre, c'est le retrouver sur le terrain.
- L'entraînement embarqué (`app-ml-lite`) : transfer learning MobileNet.
  **16 exemples, 535 ms, 4 bonnes réponses sur 4** sur des images jamais vues, et
  le modèle survit à la sauvegarde IndexedDB. **Il fonctionne.**
- `shared/ml-models.js` : catalogue de modèles dans une table Grist `ML_Models`,
  avec justesse remontée après usage. Jamais appelé, mais c'est la pièce qui
  ferait d'un modèle personnel un modèle d'équipe.

**Ce qui est cassé, avec la cause :**

- **Le modèle entraîné ne sert nulle part.** Il part dans
  `indexeddb://custom-classifier-v1` et **aucune des deux applications de saisie
  ne le charge** — zéro référence. On peut apprendre « fissure » sans que cette
  connaissance produise la moindre donnée.
- **Les deux service workers s'effacent mutuellement leur cache.** Chacun purge à
  l'activation tous les caches dont le nom diffère du sien ; ils partagent
  l'origine `nic01asfr.github.io`. Reproduit : un seul cache survit à la fois.
  Correctif : filtrer sur un préfixe, pas sur l'égalité stricte.
- **`app/` ne démarre pas hors réseau.** Son cache contient `index.html` mais
  aucun des quatre scripts qu'il charge, et son handler `fetch` n'écrit jamais
  dans le cache.
- **Le précache est tout-ou-rien** (`addAll`) : une URL indisponible et le service
  worker ne s'installe pas du tout.
- **Neuf `catch` vides** sur la transcription : quand les deux tentatives
  échouent, l'agent parle et rien ne se passe, sans savoir pourquoi.
- **`app-ml-lite` et `app-ml-pro` n'ont ni service worker ni manifeste** : ce sont
  des pages, pas des applications. Cohérent avec leur nature réelle — ce sont des
  **briques**, pas des produits.
- `apps/scout-ia.html` est une **version antérieure** de `app/index.html`
  (11 Ko contre 59) — un doublon historique.

**Deux erreurs commises pendant l'exploration, corrigées, à ne pas reprendre :**

- avoir conclu que le chargement de MobileNet était cassé sur la foi d'un `curl`
  sur l'URL nue, alors que TFJS en construit une autre avec `fromTFHub` — **le
  chargement réussit en 1 s** ;
- avoir cru le classifieur fautif alors que les images du test étaient tracées
  hors du cadre.

> **Règle qui en découle : un test négatif se vérifie avant d'être rapporté.**

---

## 5. Ce qu'il ne faut surtout pas réimplémenter

**La gestion du hors-ligne.** SURFAC²E l'a payée en production : 437 cotations
dupliquées, une photo téléversée quatre fois, 123 saisies bloquées derrière une
action mal formée. On copie ses solutions **sans toucher à son dépôt** — c'est
une référence, pas une dépendance. Ses sept règles sont reprises dans
[ARCHITECTURE.md](ARCHITECTURE.md#le-hors-ligne--sept-règles-déjà-payées).

La plus contre-intuitive, et celle qui masquait toutes les autres :
**le document (`index.html`) se sert réseau d'abord, cache en secours.** En cache
d'abord, il reste figé — donc les modules aussi, puisqu'il porte leur version —
et **aucune correction n'atteint l'appareil**, quel que soit le nombre de
rechargements.

Reprendre le `grist-client.js` de SURFAC²E et sa file, ne pas en écrire un neuf.

---

## 6. Les contrats — non négociable

Terrain **consomme** FormDef 1.0 et Scene Manifest, il n'invente aucun format.
Quand un contrat manque quelque chose, **on étend le contrat** avec un incrément
de version ; on ne contourne pas.

Deux extensions sont identifiées et à porter : la **section répétable** et les
**sources d'entrée d'un champ**. Elles doivent être exprimables en JSON Schema,
parce que ces contrats visent aussi à être produits par des agents.

---

## 7. Ce qu'on attend maintenant

Rien d'urgent, et surtout **pas de code avant décision**. Les questions ouvertes
sont en fin d'[ARCHITECTURE.md](ARCHITECTURE.md) et appartiennent à
l'utilisateur : le niveau « pro » de la reconnaissance, et l'endroit où
s'applique le modèle entraîné.

**Point déjà tranché, à ne pas rouvrir : SURFAC²E n'est pas touché.** Il est en
production et sert de référence architecturale ; son code se copie et s'adapte,
il ne se partage pas, et aucune convergence n'est attendue de lui.

Ce qui peut avancer sans les attendre : retirer les mentions d'employeur du dépôt
`Grist-AppStore`, marquer `to-publish/` comme obsolète, et — utile pour tout le
monde — **écrire le JSON Schema du Scene Manifest**, dont la définition existe
déjà dispersée entre `projects/qgis2grist/docs/SCENE-MANIFEST-v0.2.2.md` et
`projects/qgis2grist/lib/scene-manifest.js`.
