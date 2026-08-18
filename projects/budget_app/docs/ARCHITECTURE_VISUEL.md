# Planche d'architecture — besoin

Brief pour Claude Design. On exprime le besoin, le contenu et les contraintes ; les choix de mise en forme (mise en page, palette, typo, type de schéma) lui reviennent.

## Besoin

Une planche unique qui fait comprendre, d'un coup d'œil, comment la suite « Budget perso » est organisée : un socle de données commun et des modules autonomes branchés dessus, à la manière de TaskFlow (des vues indépendantes sur un même schéma). On doit saisir sans explication que tout repose sur un registre partagé et que chaque module est une brique remplaçable.

Public : moi et des pairs techniques. Usage : document d'architecture de référence et appui de présentation.

## Ce qui doit apparaître (contenu, pas mise en forme)

Le socle, partagé par tout :
- Registre — table `Transactions` (le journal unique des opérations).
- Référentiels — `Categories` (avec leur `Type`), `Regles`, `Sous_categories`.

Les quatre modules, chacun avec sa fonction en une ligne et la ou les tables qu'il touche :
- Import — ingère les relevés CSV multi-banques → écrit `Transactions`.
- Classement — catégorise sur deux niveaux et apprend des règles → `Transactions`, `Regles`.
- Suivi — enveloppes et reste-à-vivre mensuel → lit `Transactions`, écrit les seuils dans `Categories`.
- Prévisionnel — objectif d'épargne et trajectoire → `Previsionnel`, `Parametres`.

Le point de couplage unique, à rendre lisible comme tel : le **typage** des catégories (`Type` = revenu / dépense / épargne / exclu) est la seule chose que tous les modules partagent. C'est l'interface entre le socle et les modules.

Optionnel si ça n'alourdit pas : la boucle où l'épargne dégagée finance un achat dont les loyers réintègrent le registre.

## Contraintes

- Français, casse phrase.
- Lisible sans légende longue ; tient sur une seule vue.
- Hiérarchie claire : socle → modules.
- Sobre, cohérent avec une UI de données soignée.
- Exportable (image ou PDF).

## Ce que je ne fige pas

Mise en page, palette, typographie, choix du type de représentation (carte de modules, diagramme structurel, autre) : à proposer.
