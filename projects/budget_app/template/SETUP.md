# Déployer la suite « Budget perso » sur un document neuf

Ce dossier contient de quoi monter la suite copiable sur un **document Grist vierge**,
indépendamment de toute instance personnelle. Les 4 widgets vivent à la racine du
repo (`import.html`, `classement.html`, `suivi.html`, `previsionnel.html`) ; ce
dossier ajoute le bootstrap du schéma et ce guide.

## 1. Créer le document

Dans Grist : **Nouveau document** vierge. (C'est la seule étape qui ne peut pas
être automatisée à distance — un doc Grist se crée côté interface.)

## 2. Bootstrapper le schéma + la taxonomie

Deux voies, au choix.

**Voie A — un bloc (recommandé si tu as l'accès MCP/API).**
Applique les actions de `template/schema.bootstrap.json` (clé `actions`) en une
fois. Cela crée les 6 tables avec **toutes** les colonnes (dont `Provision` et
`Budget_mode` qui accepte `flottant`) et sème les 20 catégories de départ + le
paramètre `objectif_epargne`. Les sous-catégories se créeront à la volée via le
Classement.

**Voie B — laisser l'Import amorcer.**
Ajoute d'abord le widget **Import** (étape 3), puis ouvre-le : sur un document
vide il crée `Transactions`/`Categories`/`Regles`/`Sous_categories` et sème la
taxonomie. ⚠️ Si tu passes par cette voie, ajoute ensuite manuellement la colonne
`Provision` (Numeric) à `Categories` — sinon le mode *Flottant* du Suivi
fonctionne en lecture mais ne peut pas enregistrer la provision. (Le Suivi ne
plante pas sans : il dégrade proprement.)

## 3. Poser les 4 widgets

Pour chaque module, crée une **page** avec un **widget custom** lié à la table
`Transactions`, pointant sur le HTML du widget. Le widget lit les tables par leur
**nom** au runtime — il n'y a rien à configurer d'autre que l'accès.

| Page | Widget | Accès requis |
|------|--------|--------------|
| Import relevé | `import.html` | complet |
| Classement | `classement.html` | complet |
| Suivi mensuel | `suivi.html` | complet |
| Prévisionnel | `previsionnel.html` | complet |

Hébergement du HTML, au choix : URL GitHub Pages (`published/budget/<module>/`),
tout hébergement statique, ou collage du code via l'outil de canvas. Mets l'accès
du widget sur **« Lecture et écriture complètes »** (les 4 écrivent dans Grist).

## 4. Charger tes données

Ouvre **Import**, dépose un relevé CSV : il devine le mapping, normalise, écarte
les doublons et insère dans `Transactions`. Puis **Classement** pour catégoriser
(il apprend des règles au passage). **Suivi** et **Prévisionnel** sont alors
vivants.

## Le contrat, en une ligne

Tout repose sur `Transactions` + le **typage** de `Categories`
(`revenu`/`depense`/`epargne`/`exclu`). Le préfixe `Locatif -` marque le
sous-ensemble immo, ignoré par les lentilles perso. Voir `../README.md` (schéma
complet) et `../docs/DECISIONS.md` (les choix d'architecture).
