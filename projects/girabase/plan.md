# Plan — Widget Grist Girabase

## Contexte
Girabase (FastAPI + index.html, port 8090) reste intact.
On crée `grist_widget.html` servi depuis le même serveur.
Le widget : édition intégrée des bras et matrices O-D, données stockées dans Grist,
calcul délégué à l'API existante `/api/capacite`.

## Architecture

```
Grist document
  ├── Giratoires   ← géométrie + formules Python (Rext, RU, LAU, LEU, Tg, Te, Tf1...)
  ├── Bras         ← bras par giratoire + formules (LE, Tf)
  ├── Periodes     ← périodes par giratoire
  ├── FluxOD       ← matrice O-D normalisée (bras_origine × bras_dest × periode)
  └── Resultats    ← résultats écrits par widget + formules rc_level, saturated...

Widget (iframe http://localhost:8090/grist_widget.html)
  ├── Setup schema  (load → vérifier/créer tables + colonnes en ordre)
  ├── onRecord      (sélection giratoire → charger tout)
  ├── Édition       (géométrie, bras, périodes, matrices O-D)
  └── Calculer      (POST /api/capacite → upsert Resultats → afficher)
```

## Schéma Grist — 5 tables

### 1. `Giratoires`
| Colonne | Type | Formule Python Grist |
|---------|------|----------------------|
| nom | Text | — |
| localisation | Text | — |
| reference | Text | — |
| date_etude | Date | — |
| R | Numeric | — |
| LA | Numeric | — |
| Bf | Numeric | — |
| milieu | Choice | — (RC/PU/CV) |
| Rext | Numeric ✦ | `$R + $Bf + $LA` |
| RU | Numeric ✦ | `3.5 if $R==0 else $R + 0.5*$Bf` |
| LAU | Numeric ✦ | `$LA+$Bf-3.5 if $R==0 else $LA+0.5*$Bf` |
| LEU | Numeric ✦ | `$LAU/(1.2*(1+1/(2*$RU))) if $RU>0 else 0` |
| LImax | Numeric ✦ | `import math; $Tg*math.sqrt($RU+$LAU/2) if $RU>0 else 0` |
| Tg | Numeric ✦ | `{'RC':4.75,'PU':4.55,'CV':4.40}.get($milieu,4.55)` |
| Te | Numeric ✦ | `{'RC':0.70,'PU':0.80,'CV':0.85}.get($milieu,0.80)` |
| Tf1 | Numeric ✦ | `{'RC':2.25,'PU':2.05,'CV':1.80}.get($milieu,2.05)` |

### 2. `Bras`
| Colonne | Type | Formule Python Grist |
|---------|------|----------------------|
| giratoire | Ref:Giratoires | — |
| nom | Text | — |
| angle_deg | Numeric | — |
| LE4m | Numeric | — |
| LE15m | Numeric | — |
| LI | Numeric | — |
| LS | Numeric | — |
| evasee | Bool | — |
| has_ramp | Bool | — |
| has_right_turn | Bool | — |
| pedestrians_per_hour | Int | — |
| exit_only | Bool | — |
| LE | Numeric ✦ | `($LE4m+$LE15m)/2.0 if $evasee else $LE4m` |
| Tf | Numeric ✦ | `$giratoire.Tf1*1.35 if $has_ramp else $giratoire.Tf1` |

### 3. `Periodes`
| Colonne | Type |
|---------|------|
| giratoire | Ref:Giratoires |
| nom | Text |

### 4. `FluxOD`
| Colonne | Type | Formule Python Grist |
|---------|------|----------------------|
| periode | Ref:Periodes | — |
| bras_origine | Ref:Bras | — |
| bras_dest | Ref:Bras | — |
| flux_veh_h | Numeric | — |
| giratoire | Ref:Giratoires ✦ | `$periode.giratoire` |

### 5. `Resultats`
| Colonne | Type | Formule Python Grist |
|---------|------|----------------------|
| bras | Ref:Bras | — |
| periode | Ref:Periodes | — |
| giratoire | Ref:Giratoires ✦ | `$bras.giratoire` |
| arm_name | Text ✦ | `$bras.nom` |
| period_name | Text ✦ | `$periode.nom` |
| QE | Numeric | — |
| QG | Numeric | — |
| capacity | Numeric | — |
| capacity_adj | Numeric | — |
| reserve_pct | Numeric | — |
| mean_delay_s | Numeric | — |
| mean_queue_veh | Numeric | — |
| max_queue_veh | Numeric | — |
| rc_level | Text ✦ | `'overdesigned' if $reserve_pct>80 else 'oversize' if $reserve_pct>50 else 'ok' if $reserve_pct>=25 else 'warning' if $reserve_pct>=5 else 'critical'` |
| rc_text | Text ✦ | `{'overdesigned':'Non justifié','oversize':'Surdimensionné','ok':'Bon fonctionnement','warning':'Files possibles','critical':'Saturation sévère'}.get($rc_level,'')` |
| saturated | Bool ✦ | `$QE>=$capacity_adj and $capacity_adj>0` |

✦ = formule Python Grist (computed, non éditable)

## Ordre de setup au chargement

```
1. listTables() → identifier tables manquantes
2. applyUserActions( AddTable Giratoires )      [pas de Ref]
3. applyUserActions( AddTable Bras )            [Ref:Giratoires]
4. applyUserActions( AddTable Periodes )        [Ref:Giratoires]
5. applyUserActions( AddTable FluxOD )         [Ref:Periodes, Ref:Bras]
6. applyUserActions( AddTable Resultats )       [Ref:Bras, Ref:Periodes]
7. Pour chaque table : fetchTable → vérifier colonnes manquantes
8. applyUserActions( AddColumn formules )       [après que toutes les tables existent]
9. Widget prêt → grist.onRecord(handler)
```

Chaque étape vérifie avant d'agir (idempotent). Affichage d'un spinner "Initialisation…"
pendant les phases 1-8.

## Fichier à créer

**`cerema-services/girabase/static/grist_widget.html`** (~900 lignes, monofichier)

Structure JS :
```
SCHEMA         const — définition 5 tables + colonnes + formules
setupSchema()  — setup séquentiel idempotent
loadGiratoire(row)    — fetch Bras, Periodes, FluxOD → remplir formulaire
buildMatrix(brasIds, periodeId, fluxRows) → float[][] depuis FluxOD
calculate()    — construit payload → POST /api/capacite → upsert Resultats
renderResults(apiResult) — table + mini-graphique SVG (réutilise logique index.html)
editArm(i)     — UpdateRecord Bras
addArm()       — AddRecord Bras + AddRecord FluxOD (N×N non-diag)
removeArm(id)  — RemoveRecord Bras + FluxOD cascade
addPeriode()   — AddRecord Periodes + AddRecord FluxOD (N×N non-diag)
setFlux(origId, destId, periodeId, val) — UpdateRecord/AddRecord FluxOD
```

UI :
```
[spinner setup]      → affiché pendant phases 1-8
[fiche giratoire]    → inputs R/LA/Bf/milieu + strip Rext/RU/LAU/LEU (lus depuis Grist)
[tableau bras]       → même colonnes que index.html + boutons + / ×
[onglets périodes]   → + Période / × + matrice O-D éditable (lue/écrite FluxOD)
[bouton Calculer]    → spinner → résultats
[zone résultats]     → table RC + badge + mini-graphique SVG
```

## Fichier modifié

**`cerema-services/girabase/Dockerfile`** — `COPY static/ ./static/` déjà présent → rebuild suffit

## Vérification
1. Rebuild + run container → `curl http://localhost:8090/grist_widget.html` → 200
2. Grist → widget personnalisé → `http://localhost:8090/grist_widget.html` → accès "full"
3. Chargement : 5 tables créées automatiquement dans le document
4. Créer 1 giratoire → widget le charge → saisir bras + O-D → Calculer
5. Table Resultats remplie → colonnes rc_level/saturated calculées par Grist
