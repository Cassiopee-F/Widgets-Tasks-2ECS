# Cadrage — identité utilisateur et droits dans Atlas

## 1. Constat

**Atlas ne sait pas qui l'utilise.** Aucune lecture de l'identité : ni
`getAccessToken`, ni `userId`, ni email. L'avatar du bandeau est une chaîne
littérale dans le HTML — `<div class="avatar">MT</div>` (`index_v7.html:933`) —
identique pour tout le monde.

**Il ne connaît ses droits qu'après coup.** `viewMode` est déduit soit de
`?mode=view`, soit d'une **détection d'erreur** au premier échec d'écriture
(`lib/view-mode.js` reconnaît « lecture seule », « acl », « denied »…). C'est un
repli honnête, mais le bandeau lecture seule n'apparaît qu'*après* une tentative
refusée.

**Et son modèle de données ignore l'utilisateur** — c'est le point structurant :

| Table | Colonnes | Auteur ? |
|---|---|---|
| `Atlas_LayerPrefs` | `source_table`, `StyleJSON`, `Visible`, `UpdatedAt` | **non** |
| `Atlas_Story` | `Step`, `Title`, `Description`, `StateJSON` | **non** |
| `Atlas_ScenePrefs` | préférences de scène | **non** |

Conséquence directe : **tout est global**. Deux personnes qui règlent l'opacité
d'une couche s'écrasent mutuellement ; il n'existe qu'un seul récit par document ;
personne ne sait qui a produit quoi. Le rafraîchissement périodique relit ces
tables toutes les 30 s : la dernière écriture gagne, en silence.

## 2. Ce que l'API Grist permet — vérifié

**L'identité** s'obtient via le jeton d'accès, décodé côté widget :

```js
const tok = await grist.docApi.getAccessToken({ readOnly: true });
const payload = JSON.parse(atob(tok.token.split('.')[1]));
payload.userId;   // identifiant numérique
```

**Les droits** s'expriment en règles ACL évaluées **côté serveur**, où
`user.Email` et `user.Access` sont disponibles :

```
not (user.Access == 'owners' or user.Email == rec.membreEmail)
not (user.Access == 'owners' or (',' + user.Email + ',') in rec.ownerChefsEmails)
```

Point important : le widget n'a pas besoin de connaître l'email pour que les
règles s'appliquent — **c'est Grist qui filtre**. Le widget ne voit déjà que ce
que l'utilisateur a le droit de voir.

## 3. La référence est dans le dépôt

`projects/tasks_app/orgchart.html` et `cra.html` implémentent déjà tout cela, en
production : identification par jeton, colonnes formule d'emails autorisés,
écriture des règles dans `_grist_ACLResources` / `_grist_ACLRules`, repérage des
règles posées par le widget via un `memo`.

**Ne pas réinventer.** Deux pièges y sont déjà documentés :

- écrire dans les tables ACL **recharge la page Grist** → tout doit partir en
  **un seul bundle atomique** `applyUserActions` ;
- les identifiants de ressource doivent être **explicites**, pour qu'une règle
  puisse référencer une ressource créée dans le même bundle.

## 4. Les besoins, par ordre de réalité

### A. Dire qui l'on est · FAIT (2026-08-05), avec une réserve

`MT` est retiré. Le badge affiche désormais soit les **initiales réelles**, soit
le **droit** (✎ / 👁) quand l'identité n'est pas résoluble — jamais une identité
inventée.

Ce qui est acquis : le jeton livre l'`userId`. Attention, sa charge utile est en
**base64url** — sans conversion, `atob` échoue et l'identification tombe en
silence (`decodeAccessToken`, testé).

**Le nom n'est pas accessible par l'API — mesuré, tranché.** Essai en conditions
réelles le 2026-08-05, jeton valide émis par le widget :

```
GET /api/docs/{id}/access?auth=<jeton>   →  403
payload du jeton : { readOnly: true, userId: 37212, docId: …, iat, exp }
```

**403, pas 401** : le jeton est authentifié, mais la gestion du partage est hors
de son périmètre. Les données existent pourtant côté serveur — `/api/profile/user`
renvoie `{id, email, name}`, `/access` liste les collaborateurs — mais elles
exigent une session, que le widget n'a pas (origine distincte).

L'appel a donc été **retiré** : on ne conserve pas une requête dont l'échec est
prouvé. `setUserIdentity()` reste le point d'entrée unique pour une future source
de noms. La seule voie ouverte est un **annuaire dans le document** (méthode
TaskFlow), qui servira de toute façon aux règles ACL.

À retenir : `userId` est acquis et fiable — il suffit aux lots B et C ci-dessous,
qui n'ont pas besoin de nom.

### B. Connaître ses droits à l'ouverture · FAIT (2026-08-05)

**Règle arrêtée : les droits transmis par Grist font autorité ; `?mode=` ne peut
que restreindre.**

Grist construit lui-même l'URL de l'iframe et y place les droits réels :
`?access=full&readonly=false`. C'est la seule source fiable — `?mode=` est écrit
par qui ouvre la page, et ne peut donc pas octroyer de droits.

| Situation | Résultat |
|---|---|
| `access=full&readonly=false` | édition, **sans sonde** |
| document partagé en lecture | mode visite automatique, sans paramètre ni connexion |
| lecteur authentifié non éditeur | lecture |
| `?mode=edit` posé par un lecteur | **lecture** — l'URL n'octroie rien |
| `?mode=view` posé par un éditeur | lecture — restreindre reste permis |
| rien de transmis (hors Grist) | repli sur `probeCanWriteDoc` |

Conséquence : c'est **le partage du document** qui décide de ce que voit un
visiteur, pas un paramètre d'Atlas. Un document rendu public s'ouvre en mode
visite pour tout le monde ; un document privé reste protégé par Grist, qui exige
la connexion avant même qu'Atlas ne démarre.

Implémenté dans `resolveAccess()` (`lib/view-mode.js`), 10 tests.
La sonde d'écriture ne s'exécute plus que si Grist n'a rien transmis.

### C. Des préférences par utilisateur · structurant

C'est le vrai manque. Aujourd'hui, régler une opacité écrase le réglage de
tout le monde.

Modèle proposé : **un défaut de scène partagé, une surcharge personnelle**.
`Atlas_LayerPrefs` gagne une colonne `owner` (vide = défaut du document, sinon
l'utilisateur). À la lecture : la surcharge personnelle prime, sinon le défaut.
Un bouton « en faire le défaut de la scène » réservé aux droits suffisants.

### D. Plusieurs récits, avec auteur · structurant

`Atlas_Story` n'a ni identifiant de récit ni auteur : un document = un récit.
Or un récit est un livrable de présentation ; plusieurs personnes peuvent en
vouloir plusieurs (comité, terrain, technique).

Ajouter `story_id` + `owner` + `shared`. Rétrocompatible : les lignes existantes
forment le récit par défaut.

### E. Droits par couche · à trancher, pas à coder tout de suite

Aujourd'hui, la protection vient des ACL Grist sur les **tables sources** — ce
qui est déjà solide : une couche dont la table est refusée n'a simplement pas de
données. Une couche sensible se protège donc en protégeant sa table.

La question ouverte est celle du **récit partagé en lecture** : si Atlas devient
le runtime de l'offre de service, un récit publié à des lecteurs sans droits sur
toutes les tables affichera des étapes vides. Il faudra soit le détecter et le
dire, soit prévoir un instantané.

## 5. Lots proposés

| Lot | Contenu | Dépendances |
|---|---|---|
| **1** | Identité réelle (`getMyUserId`, initiales) + droits connus à l'ouverture | aucune |
| **2** | `owner` dans `Atlas_LayerPrefs` : surcharge personnelle sur défaut partagé | lot 1 |
| **3** | `story_id` + `owner` dans `Atlas_Story` : plusieurs récits | lot 1 |
| **4** | Récit partagé en lecture : détecter les couches inaccessibles au lecteur | lots 1-3 |
| **5** | Pose de règles ACL par Atlas (sur le modèle TaskFlow) | à arbitrer — voir §7 |

Les lots 1 à 3 sont additifs et rétrocompatibles : une colonne absente se traite
comme aujourd'hui.

## 6. Invariants

- **L'empreinte reste opt-in.** Atlas ne crée ses tables que lorsqu'on s'en sert.
  Ajouter des colonnes ne doit pas rendre obligatoire ce qui était facultatif.
- **Rétrocompatibilité stricte** : un document existant, sans `owner` ni
  `story_id`, doit continuer de fonctionner à l'identique.
- **Le mode lecture ne doit jamais écrire** — y compris pour créer une colonne.
  `ensureAtlasPrefsTable` respecte déjà `viewMode`, la règle doit tenir.
- **Ne pas dupliquer les ACL Grist.** Le serveur filtre déjà ; le widget ne doit
  pas ré-implémenter un contrôle d'accès, seulement s'y adapter.

## 7. À trancher avant de coder

**Atlas doit-il poser des règles ACL lui-même ?** TaskFlow le fait, parce qu'il
gère un organigramme et des droits métier. Atlas est un outil de représentation :
il peut se contenter de **subir** les ACL du document. Poser des règles est
puissant mais intrusif — cela modifie la gouvernance du document de
l'utilisateur, et recharge sa page.

Recommandation : **non par défaut**. Atlas lit et s'adapte ; la pose de règles
reste au projet qui possède le modèle métier.

**Que voit un lecteur d'un récit partagé ?** C'est le cas d'usage qui décidera de
l'effort : consultation simple, ou instantané figé indépendant des droits.

**L'identité, jusqu'où ?** Le jeton donne `userId`. Afficher un nom ou un email
demande une source supplémentaire (table d'annuaire du document, comme TaskFlow).
Sans elle, on peut afficher un identifiant stable mais pas un nom.
