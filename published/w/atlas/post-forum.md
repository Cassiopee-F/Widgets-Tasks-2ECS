# Atlas

**En service** — Version 1.2.0. Le widget est utilisé sur des scènes réelles ; l’application Android reste une version de test, non signée.

La carte n’est pas un export de vos données : c’en est une vue. Les couches, la symbolisation, le relief et le récit vivent dans le document Grist — et quand la table change, la carte a déjà changé.

:link: **https://nic01asfr.github.io/Widgets-Grist/atlas/**
:page_facing_up: Présentation détaillée : https://nic01asfr.github.io/Widgets-Grist/w/atlas/
:open_file_folder: Le code : https://github.com/nic01asFr/Widgets-Grist/tree/main/projects/Atlas

---

## Le constat

Une carte faite pour un dossier finit presque toujours au même endroit : un PDF, ou une plateforme cartographique où l’on recopie les données. Dans les deux cas, la carte se fige le jour où on l’exporte. La donnée, elle, continue de vivre — un attribut corrigé, une entité ajoutée, un relevé de terrain — et l’écart s’installe. Grist sait déjà porter cette donnée, avec ses formules, ses liens et ses droits. Il lui manquait une carte qui la lise au lieu d’en faire une copie.

---

## Ce que fait Atlas

- **Vos tables deviennent des couches** — toute table portant une géométrie est reconnue et posée sur la carte, avec ses attributs.
- **Symbolisation par la donnée** — couleur par catégorie ou graduée, étiquettes, extrusion — la règle est enregistrée dans le document et suit la scène.
- **Relief et volumes** — modèles 3D posés sur le terrain réel, ombres portées à l'heure choisie, surfaces extrudées calées sur l'altitude.
- **Un récit se rejoue** — chaque étape retient le cadrage, les couches visibles, les filtres et l'heure ; la lecture les enchaîne.
- **Les droits du document font foi** — en lecture seule, l'édition disparaît et le récit reste consultable — les règles d'accès Grist sont respectées.
- **Import depuis QGIS** — un projet QGIS converti par qgis2grist arrive avec ses couches et sa symbologie.

---

## Où ça tourne

### Dans votre document Grist

Le cas courant : Atlas est un widget de votre document, à côté de vos tables. Ce que vous modifiez dans la carte est écrit dans la table, et l’inverse.

> C’est là que la carte cesse d’être un export : elle lit la donnée vivante, avec ses formules et ses liens entre tables.
### Dans un navigateur, pour diffuser

La même adresse s’ouvre seule, sans document. On y charge un fichier, on importe depuis OpenStreetMap, on consulte une scène partagée en lecture.

> Personne n’a rien à installer pour regarder : un lien suffit, et les droits restent ceux du document.

![Atlas seul dans un navigateur — l’aperçu ci-dessus s’ouvre exactement ainsi.](https://nic01asfr.github.io/Widgets-Grist/w/atlas/apercu.jpg)
*Atlas seul dans un navigateur — l’aperçu ci-dessus s’ouvre exactement ainsi.*
### Sur le terrain, en application

Une application Android ouvre les scènes de votre compte Grist, sans passer par un document. L’interface se replie : la carte occupe l’écran, les panneaux deviennent des feuilles qu’on écarte d’un geste.

> Elle existe parce qu’un navigateur ne peut pas présenter de clé API à l’instance — celle-ci refuse l’en-tête d’authentification au contrôle préalable. L’application émet ses requêtes hors du moteur web, ce qui lève l’obstacle.

![La carte occupe l’écran ; on relève au pied de l’ouvrage.](https://nic01asfr.github.io/Widgets-Grist/w/atlas/mobile-carte.jpg)
*La carte occupe l’écran ; on relève au pied de l’ouvrage.*

![Un panneau se tire à mi-hauteur : on garde la carte sous les yeux.](https://nic01asfr.github.io/Widgets-Grist/w/atlas/mobile-couches.jpg)
*Un panneau se tire à mi-hauteur : on garde la carte sous les yeux.*

![Passer d’une scène à l’autre, sans quitter l’application.](https://nic01asfr.github.io/Widgets-Grist/w/atlas/mobile-menu.jpg)
*Passer d’une scène à l’autre, sans quitter l’application.*

---

## À quoi ça sert

- **Risques et prévention** — porter une étude d’aléa, ses enjeux et ses visites de terrain dans un même document, et la partager en lecture aux partenaires sans leur demander d’installer quoi que ce soit.
- **Inventaire et patrimoine** — un objet inspecté est une ligne éditable avec sa géométrie ; la carte et la table sont la même chose vue de deux côtés.
- **Aménagement** — montrer un projet en trois dimensions sur le relief réel, avec l’ombre portée à l’heure et à la date qu’on veut.
- **Restitution** — un récit rejouable remplace le diaporama : chaque étape retient le cadrage, les couches et les filtres, et reste juste quand la donnée évolue.
- **Terrain** — l’application Android ouvre les scènes du compte et sert au pied de l’ouvrage, là où le navigateur ne peut pas s’authentifier.

---

## Comment l’essayer

Dans un document Grist : **Ajouter un widget** → **Custom** → coller l’adresse
```
https://nic01asfr.github.io/Widgets-Grist/atlas/
```
et donner l’accès **lecture et écriture**.

Le widget est un fichier HTML autonome : il fonctionne sur n’importe quelle instance Grist, y compris auto-hébergée.

Sur le terrain, sans navigateur — Une application Android ouvre vos scènes depuis votre compte Grist. Elle existe parce qu'un navigateur ne peut pas présenter de clé API à l'instance : celle-ci refuse l'en-tête d'authentification au contrôle préalable, et cela ne se change pas côté serveur. L'application émet ses requêtes hors du moteur web, ce qui lève l'obstacle.

:arrow_down: https://github.com/nic01asFr/Widgets-Grist/releases/latest/download/atlas.apk

---

## Ce qui a changé

- **v1.2.0** — Atlas sait où il tourne : dans un document il ne change pas, ouvert seul il explique et propose l’application, sur un téléphone les panneaux deviennent des feuilles qu’on écarte d’un geste. Enregistrer, charger et exporter deviennent accessibles en mobile, où ils manquaient.
- **v1.1.3** — Placement 3D corrigé — le viewport de la scène ne suivait pas l'ouverture d'un panneau. Droits en lecture respectés à l'édition. Récit enregistré de façon atomique.
- **v1.1.2** — Sept correctifs, dont le calage des volumes sur le relief : les surfaces extrudées se comptaient depuis le niveau de la mer, pas depuis le sol.
- **v1.1.1** — Palette et méthode de graduation atteignent la carte ; le réglage du bâti ne masque plus les couches Atlas.

---

## Vos retours

Il marche sur les cas que j’ai pu tester, et je ne connais que les miens.
Si quelque chose échoue ou vous surprend, dites-le dans ce fil — en précisant :

- ce que vous avez ouvert (quel document, quelles tables) ;
- le message d’erreur exact, s’il y en a un ;
- ou simplement ce qui vous a paru bizarre.

C’est ce qui permet de couvrir des usages au-delà des miens.
