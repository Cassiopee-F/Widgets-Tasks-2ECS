La carte n’est pas un export de vos données : c’en est une vue. Les couches, la symbolisation, le relief et le récit vivent dans le document Grist — et quand la table change, la carte a déjà changé.

**À coller dans un widget personnalisé :**
```
https://nic01asfr.github.io/Widgets-Grist/atlas/
```
Accès à donner : **lecture et écriture**. C'est un fichier HTML autonome — il fonctionne sur n'importe quelle instance Grist, y compris auto-hébergée.

*En service — Version 1.2.0. Le widget est utilisé sur des scènes réelles ; l’application Android reste une version de test, non signée.*

---

## Le constat

Grist embarque un widget de carte : il place des marqueurs à partir de colonnes de latitude et de longitude. C’est utile, et cela s’arrête là — pas de lignes, pas de polygones, pas de symbolisation par la donnée, pas de relief.

Alors on sort les données vers un PDF ou une plateforme cartographique, et la carte se fige le jour de l’export pendant que la donnée continue de vivre. Atlas essaie l’inverse : lire les tables là où elles sont.

---

## Ce que fait Atlas

- **Vos tables deviennent des couches** — toute table portant une géométrie est reconnue et posée sur la carte, avec ses attributs.
- **Symbolisation par la donnée** — couleur par catégorie ou graduée, étiquettes, extrusion. La règle est enregistrée dans le document et suit la scène.
- **Relief et volumes** — modèles 3D posés sur le terrain réel, ombres portées à l’heure choisie, surfaces extrudées calées sur l’altitude.
- **Un récit qui se rejoue** — chaque étape retient le cadrage, les couches visibles, les filtres et l’heure — et reste juste quand la donnée change.
- **Les droits du document font foi** — aucune liste d’accès propre à Atlas : en lecture seule l’édition disparaît, le récit reste consultable.

---

## Construire, diffuser, relever

### Construire, dans votre document

Atlas est un widget de votre document, à côté de vos tables. Ce que vous modifiez sur la carte est écrit dans la table, et l’inverse. Les règles d’accès du document s’appliquent telles quelles : qui peut écrire édite, qui ne peut que lire voit la scène et le récit, sans que l’édition lui soit proposée.

> Il n’y a pas de droits Atlas à configurer en plus de ceux de Grist. C’est le document qui décide, y compris au niveau d’une table ou d’une ligne.

![Les outils d’édition : lieu, couches, soleil, vues, contrôles, récit — et la carte en volume.](https://nic01asfr.github.io/Widgets-Grist/w/atlas/apercu.jpg)
*Les outils d’édition : lieu, couches, soleil, vues, contrôles, récit — et la carte en volume.*

### Diffuser en lecture, sans rien installer

Grist sait s’intégrer dans une page : en ajoutant `?embed=true&style=singlePage` à l’adresse d’une page de votre document, vous obtenez la scène seule, plein cadre. Ce lien se met dans un courriel, un intranet, un article — et la personne qui l’ouvre voit la carte et peut jouer le récit, sans compte et sans installation.

> C’est le partage d’un document Grist, pas une publication à part : si vous retirez l’accès, le lien cesse de fonctionner. Rien n’a été recopié ailleurs.

![La même scène ouverte par un visiteur sans compte : le badge « Lecture » remplace l’édition, la carte et la légende restent entières.](https://nic01asfr.github.io/Widgets-Grist/w/atlas/dans-grist.jpg)
*La même scène ouverte par un visiteur sans compte : le badge « Lecture » remplace l’édition, la carte et la légende restent entières.*

### Relever sur le terrain

Une application Android ouvre les scènes de votre compte sans passer par un document. Ce n’est pas une interface différente pour le plaisir : c’est le seul moyen d’être authentifié hors du navigateur, celui-ci ne pouvant pas présenter de clé API à l’instance.

![Sur place, la carte occupe l’écran ; les panneaux se tirent au doigt.](https://nic01asfr.github.io/Widgets-Grist/w/atlas/mobile-carte.jpg)
*Sur place, la carte occupe l’écran ; les panneaux se tirent au doigt.*


---

## À quoi ça sert

- **Risques et prévention** — une étude d’aléa, ses enjeux et ses visites de terrain dans le même document, partagée en lecture aux partenaires.
- **Inventaire et patrimoine** — un objet inspecté est une ligne éditable avec sa géométrie ; la carte et la table sont la même chose vue de deux côtés.
- **Aménagement** — montrer un projet en volume sur le relief réel, avec l’ombre portée à l’heure et à la date voulues.

---

**Télécharger l'application** : https://github.com/nic01asFr/Widgets-Grist/releases/latest/download/atlas.apk
Le code, sous licence MIT : https://github.com/nic01asFr/Widgets-Grist/tree/main/projects/Atlas

---

## Vos retours

Il marche sur les cas que j’ai pu tester, et je ne connais que les miens.
Si quelque chose échoue ou vous surprend, dites-le dans ce fil — en précisant :

- ce que vous avez ouvert (quel document, quelles tables) ;
- le message d’erreur exact, s’il y en a un ;
- ou simplement ce qui vous a paru bizarre.

C’est ce qui permet de couvrir des usages au-delà des miens.

---

<sub>Ce message est rédigé automatiquement à partir de la fiche du projet, versionnée avec son code. Il est remis à jour depuis cette même source quand le widget évolue — les modifications restent visibles dans l’historique du message.</sub>
