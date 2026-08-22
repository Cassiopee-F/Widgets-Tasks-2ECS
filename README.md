# Widgets Grist

Des vues qui lisent vos tables [Grist](https://www.getgrist.com/) au lieu de les
copier — carte, planning, formulaire, plan de charge — et la chaîne qui permet de
les fabriquer.

**→ [Voir les widgets et ce qu'ils font](https://nic01asfr.github.io/Widgets-Grist/)**

Un widget est une vue, pas un export : il lit la table avec ses formules et ses
liens, et quand elle change, la vue a déjà changé. Les droits sont ceux du
document — aucun système d'accès en plus de celui de Grist. Ce sont des fichiers
statiques, qui fonctionnent sur n'importe quelle instance, y compris
auto-hébergée.

---

## Ce qui est publié

| Projet | Ce qu'il fait | Widgets |
|---|---|---|
| **[Atlas](https://nic01asfr.github.io/Widgets-Grist/w/atlas/)** | La carte comme vue de vos tables : couches, symbolisation par la donnée, relief, récit rejouable. Application Android pour le terrain. | 1 |
| **[TaskFlow](https://nic01asfr.github.io/Widgets-Grist/w/taskflow/)** | Suite de gestion de projet sur vos propres tables : Kanban, Gantt, Calendrier, Tableau de bord, Plan de charge, Feuille de temps, Annuaire. | 8 |
| **[qgis2grist](https://nic01asfr.github.io/Widgets-Grist/w/qgis2grist/)** | Un projet QGIS devient un document Grist — couches, attributs et symbologie importés, schéma déduit de la donnée. | 2 |
| **[Form Builder](https://nic01asfr.github.io/Widgets-Grist/w/grist_forms/)** | Des questionnaires branchés sur vos tables : conditions, chemins, audience, publication dans le document. | 1 |
| **[Artefactory](https://nic01asfr.github.io/Widgets-Grist/w/artefactory/)** | Un atelier pour écrire ses propres widgets sans quitter Grist. | 1 |

Chaque page décrit le widget, montre une démonstration et renvoie à son fil de
discussion sur le [forum Grist francophone](https://forum.grist.libre.sh).

---

## Utiliser un widget

**Une adresse à coller.** Dans Grist : **Ajouter un widget** → **Custom** →
l'adresse du widget, puis l'accès qu'il demande.

**Ou tout le catalogue**, sur une instance auto-hébergée :

```bash
GRIST_WIDGET_LIST_URL=https://nic01asfr.github.io/Widgets-Grist/manifest.json
```

Les widgets apparaissent alors dans le sélecteur « Custom Widget ».

---

## Les contrats

Ces widgets ne partagent pas de code — ils partagent des **contrats
déclaratifs** : un outil écrit, un autre lit, et aucun des deux n'a besoin de
connaître l'autre. C'est ce qui permet à `qgis2grist` d'alimenter Atlas sans que
l'un contienne une ligne de l'autre.

| Contrat | Ce qu'il décrit | Schéma |
|---|---|---|
| **FormDef 1.0** | un formulaire : champs typés Grist, conditions, cascades de références | [`formdef-1.0.schema.json`](https://nic01asfr.github.io/Widgets-Grist/schemas/formdef-1.0.schema.json) |
| **Scene Manifest 0.2.2** | une scène cartographique : couches, symbolisation, contrôles, récit | [`scene-manifest-0.2.2.schema.json`](https://nic01asfr.github.io/Widgets-Grist/schemas/scene-manifest-0.2.2.schema.json) |

Ils sont servis à une adresse **stable et versionnée**, et décrits en JSON Schema
— pour être produits et interprétés par des agents autant que par des humains.
Point d'entrée :
[`schemas/index.json`](https://nic01asfr.github.io/Widgets-Grist/schemas/index.json).

---

## Structure

```
published/    les widgets en production, déployés sur GitHub Pages
projects/     le développement — un CLAUDE.md par projet
packages/     les empaquetages applicatifs (Capacitor)
skills/       les patterns de code réutilisables pour Grist
scripts/      la génération du manifeste, de la vitrine, des annonces
```

Pour comprendre l'architecture ou contribuer : [CLAUDE.md](CLAUDE.md), et
[skills/vitrine.md](skills/vitrine.md) pour la chaîne de publication.

---

## Contribuer

Les retours d'usage sont les plus utiles : ces widgets marchent sur les cas qui
ont pu être testés, et ceux-là seulement.

- **Un bug, une surprise** : [ouvrir une issue](../../issues/new), ou en parler
  dans le fil du widget sur le forum ;
- **Une idée** : [Discussions](../../discussions).

---

## Ressources

- [Documentation Grist](https://support.getgrist.com/) ·
  [Custom Widgets](https://support.getgrist.com/widget-custom/) ·
  [Plugin API](https://support.getgrist.com/code/modules/grist_plugin_api/)
- [grist-core](https://github.com/gristlabs/grist-core) — le code source de
  Grist, sous licence Apache 2.0
- [forum.grist.libre.sh](https://forum.grist.libre.sh) — le forum francophone
- Instances publiques françaises :
  [DINUM](https://grist.numerique.gouv.fr) ·
  [ANCT](https://grist.incubateur.anct.gouv.fr)

---

## Licence

MIT — voir [LICENSE](LICENSE). Cette page est personnelle : elle n'exprime la
position d'aucune organisation.
