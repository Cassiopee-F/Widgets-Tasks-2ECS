# Récit CRESO / SEVI — conception des 11 étapes

Document de conception du récit `Atlas_Story` du document SEVI (`g6MXJMbjseTn`).
Chaque étape associe un propos, un cadrage et **une symbolisation qui sert ce
propos** — c'est le principal écart corrigé par rapport à la version précédente,
où toutes les étapes imposaient le même dégradé `lg_route_m` à la grille, y
compris celles qui parlaient de densité bâtie ou d'hébergement.

## Données de référence (mesurées, pas estimées)

### `Grille_sardaigne_200m_selinf10m` — 42 182 cellules

Emprise réelle : **lon 8,132 → 9,830 · lat 38,864 → 41,313** (côte ouest sarde,
~270 km). Centre de gravité des cellules porteuses d'enjeux : `[8,99 · 40,07]`.

| Champ | Cellules > 0 | médiane | q75 | q90 | q97 | max |
|---|---|---|---|---|---|---|
| `nb_bat` | 14 078 | 3 | 8 | 18 | 32 | 134 |
| `nb_residence` | 12 614 | 2 | 7 | 17 | 30 | 75 |
| `nb_bat_hebergement` | **97** | 0 | 0 | 0 | 0 | 49 |
| `nb_bat_camping` | **79** | 0 | 0 | 0 | 0 | 31 |
| `lg_route_m` | 8 105 (19 %) | 0 | 0 | 146 | 285 | **1 979** |
| `lg_ferre_m` | 489 | 0 | 0 | 0 | 0 | 4 235 |
| `lg_porti_m` | 1 032 | 0 | 0 | 0 | 0 | 1 739 |

> Les stops hérités graduaient `lg_route_m` de 0 à **50 000** alors que le max
> réel est 1 979 : plus de 95 % des cellules tombaient dans la première classe,
> quasi blanche. Les seuils ci-dessous suivent les quantiles observés.

### `Grille_analyse_200m_3` — 3 843 cellules (Cagliari)

| Champ | Cellules > 0 | médiane | q75 | q90 | max |
|---|---|---|---|---|---|
| `score_enjeu` | 3 843 | 0,164 | 0,461 | 0,757 | 1 |
| `nb_bat` | 3 843 | 6 | 17 | 35 | 154 |
| `nb_residence` | 3 741 | 5 | 13 | 25 | 154 |
| `nb_bat_hebergement` | **5** | 0 | 0 | 0 | 1 |
| `lg_route_m` | 2 118 | 356 | 1 384 | 2 187 | 19 012 |
| `surf_bat_m2` | 3 843 | 1 986 | 9 589 | 22 317 | 65 035 |

### Autres couches

- `Batiments_3` — 38 848 · `score_sevi_b` : 1,0 (29 699) · 0,5 (1 785) · 0,3 (62) · 0,1 (7 104)
  — `nb_etages` renseigné pour ~180 objets seulement → **pas d'extrusion utile**.
- `Routes_3` — 6 934 · `score_sevi_r` : 1,0 (5 513) · 0,7 (909) · 0,3 (512)
- `Ctr_dbtopo_v_f010105` — 52 165 (BD TOPO Italie, `def_tipo`)
- `PERIMETRES_GEO` — 10 sites pilotes (Corse, PACA, Ligurie, Sardaigne)

## Les 11 étapes

| # | Propos | Cadrage | Couche mise en scène | Symbolisation | Filtre |
|---|---|---|---|---|---|
| 1 | Contexte INTERREG | `[8,8 · 42,0]` z5,3 | `PERIMETRES_GEO` | catégorisé `Case_study` | **aucun** (les 10 sites) |
| 2 | Zone d'étude sarde | `[8,99 · 40,07]` z7,5 | Grille Sardaigne | aplat neutre translucide | — |
| 3 | Réseaux (SEVI_R) | `[8,99 · 40,07]` z7,5 | Grille Sardaigne | gradué `lg_route_m` 1/50/146/285/1979 | `lg_route_m ≥ 1` |
| 4 | Bâti BD TOPO (SEVI_B) | `[9,84 · 44,17]` z15 p45 | `Ctr_dbtopo` | catégorisé `def_tipo` | 2 typologies |
| 5 | Densité bâtie | `[8,99 · 40,07]` z7,5 | Grille Sardaigne | gradué **`nb_bat`** 1/3/8/18/134 | `nb_bat ≥ 1` |
| 6 | Hébergement (SEVI_A) | `[8,99 · 40,07]` z7,5 | Grille Sardaigne | gradué **`nb_bat_hebergement`** 1/2/5/10/49 | `≥ 1` (97 cellules) |
| 7 | Synthèse Cagliari | `[9,11 · 39,22]` z11,5 p40 | Grille Cagliari + routes | `score_enjeu` (quantiles) | sites Cagliari 1-2 |
| 8 | Comparaison multi-sites | `[8,8 · 42,0]` z5,3 | `PERIMETRES_GEO` | catégorisé `Case_study` | **aucun** |
| 9 | Vulnérabilité bâti | `[9,11 · 39,22]` z14 p45 | `Batiments_3` | gradué `score_sevi_b` | — |
| 10 | Vulnérabilité réseaux | `[9,11 · 39,22]` z13 | `Routes_3` | gradué `score_sevi_r` 0,3/0,7/1 | — |
| 11 | Grille d'enjeux | `[9,11 · 39,22]` z11,5 p40 | Grille Cagliari | `score_enjeu` (quantiles) | — |

### Principes appliqués

1. **Une étape = une couche mise en scène**, les autres masquées. Chaque étape
   décrit l'état des 7 couches, donc rien ne traîne d'une vue à l'autre.
2. **La symbolisation sert le propos** : l'étape « densité bâtie » colore par
   `nb_bat`, celle sur les réseaux par `lg_route_m`, celle sur l'hébergement par
   `nb_bat_hebergement`.
3. **Les seuils suivent les quantiles mesurés**, pour que les classes soient
   peuplées et la carte lisible.
4. **Les filtres cachent le bruit** : sur les vues thématiques, les cellules à
   zéro sont écartées (81 % pour les routes) au lieu d'être peintes en pâle.
5. **Cadrage à l'échelle du phénomène** : les enjeux sont dispersés sur 270 km,
   donc les vues thématiques embrassent toute la côte.
6. **Étapes 1 et 8 sans filtre de site** : leur propos est le multi-sites ; la
   version précédente n'affichait qu'un point.
