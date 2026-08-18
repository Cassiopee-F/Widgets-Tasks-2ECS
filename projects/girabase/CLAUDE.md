# Projet : Girabase — Widget Grist

## Contexte

Girabase est un service FastAPI (port 8090) de calcul de capacité de giratoires (modèle Siegloch/CERTU).
Il dispose d'une UI web autonome de référence (`static/index.html`).

**Objectif** : créer `grist_widget.html` — un widget Grist **100% autonome** :
- Le moteur Siegloch est **embarqué en JavaScript** (pas d'appel externe)
- Les données sont stockées dans Grist (5 tables)
- Le widget fonctionne servi depuis n'importe quelle origine (GitHub Pages, local, Grist)

**Projet de référence** (lecture seule, ne pas modifier) :
```
C:\Users\Omen\Desktop\LAVAL\Github Repositories\BlenderRoads\cerema-services\girabase\
├── engine.py       (moteur Siegloch Python — source pour le port JS)
├── static/
│   └── index.html  (UI autonome — référence CSS/SVG/palette RC)
```

---

## Architecture

```
Grist document
  ├── Giratoires   ← géométrie + formules Python
  ├── Bras         ← bras par giratoire + formules
  ├── Periodes     ← périodes par giratoire
  ├── FluxOD       ← matrice O-D (bras_origine × bras_dest × periode)
  └── Resultats    ← résultats écrits par widget + formules rc_level, saturated…

Widget (iframe http://localhost:8090/grist_widget.html)
  ├── setupSchema()   → créer les 5 tables si absentes (idempotent)
  ├── onRecord()      → sélection giratoire → charger tout
  ├── Édition         → géométrie, bras, périodes, matrices O-D
  └── calculate()     → POST /api/capacite → upsert Resultats → afficher
```

---

## Schéma Grist — 5 tables

### Ordre de création (contraintes Ref)
```
1. Giratoires  (aucune Ref)
2. Bras        (Ref:Giratoires)
3. Periodes    (Ref:Giratoires)
4. FluxOD      (Ref:Periodes, Ref:Bras)
5. Resultats   (Ref:Bras, Ref:Periodes)
```

### 1. `Giratoires`
| Colonne | Type | Formule |
|---------|------|---------|
| nom | Text | — |
| localisation | Text | — |
| reference | Text | — |
| date_etude | Date | — |
| R | Numeric | — |
| LA | Numeric | — |
| Bf | Numeric | — |
| milieu | Choice (RC/PU/CV) | — |
| Rext | Numeric ✦ | `$R + $Bf + $LA` |
| RU | Numeric ✦ | `3.5 if $R==0 else $R + 0.5*$Bf` |
| LAU | Numeric ✦ | `$LA+$Bf-3.5 if $R==0 else $LA+0.5*$Bf` |
| LEU | Numeric ✦ | `$LAU/(1.2*(1+1/(2*$RU))) if $RU>0 else 0` |
| LImax | Numeric ✦ | `import math; $Tg*math.sqrt($RU+$LAU/2) if $RU>0 else 0` |
| Tg | Numeric ✦ | `{'RC':4.75,'PU':4.55,'CV':4.40}.get($milieu,4.55)` |
| Te | Numeric ✦ | `{'RC':0.70,'PU':0.80,'CV':0.85}.get($milieu,0.80)` |
| Tf1 | Numeric ✦ | `{'RC':2.25,'PU':2.05,'CV':1.80}.get($milieu,2.05)` |

### 2. `Bras`
| Colonne | Type | Formule |
|---------|------|---------|
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
| Colonne | Type | Formule |
|---------|------|---------|
| periode | Ref:Periodes | — |
| bras_origine | Ref:Bras | — |
| bras_dest | Ref:Bras | — |
| flux_veh_h | Numeric | — |
| giratoire | Ref:Giratoires ✦ | `$periode.giratoire` |

### 5. `Resultats`
| Colonne | Type | Formule |
|---------|------|---------|
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

✦ = formule Python Grist (calculée, non éditable via widget)

---

## API `/api/capacite`

### Input
```json
{
  "R": 10.0, "LA": 7.0, "Bf": 0.0, "milieu": "PU",
  "arms": [
    {
      "name": "Nord", "LE4m": 4.0, "LE15m": 0.0, "LI": 0.0, "LS": 5.0,
      "evasee": false, "has_ramp": false, "has_right_turn": false,
      "pedestrians_per_hour": 0, "exit_only": false
    }
  ],
  "periods": [
    {
      "name": "HPM",
      "flows": [[0,100,50,200],[80,0,120,60],[40,90,0,110],[150,70,80,0]]
    }
  ]
}
```

### Output clé (par bras par période)
```json
{
  "arm": "Nord",
  "QE": 350, "QG": 450,
  "capacity": 480, "capacity_adj": 475,
  "reserve_pct": 35.7,
  "saturated": false,
  "rc_level": "ok", "rc_text": "Bon fonctionnement",
  "mean_delay_s": 12.5,
  "mean_queue_veh": 2.3, "max_queue_veh": 5.1
}
```

---

## Moteur JS embarqué — Port de engine.py

### Constantes
```javascript
const MILIEU = { RC:0, PU:1, CV:2 };
const Tg_TAB  = [4.75, 4.55, 4.40];
const Te_TAB  = [0.70, 0.80, 0.85];
const Tf1_TAB = [2.25, 2.05, 1.80];
const COEF_LEU = 1.2;
const RAMP_TF_FACTOR = 1.35;
```

### Fonctions principales
```javascript
computeGlobalParams(R, LA, Bf, milieu)
// → { RU, LAU, LEU, LImax, KI, KE, Rext, Tg, Te, Tf1 }

computeArmParams(arm, globalParams)
// → { LE, LEg, Tf, KS, TTP }

passesEntry(origin, entry, dest, n)   // port de _passes_entry
// (entry-origin)%n < (dest-origin)%n AND d_entry > 0

computeCirculatingFlows(flows, armParams, n)  // port de _circulating_flows
// → QG[] avec correction gêne sortant KS

computeCapacity(armIdx, QG, globalParams, armParams)
// Ci = (3600/Tf) × exp(-QG/3600 × (Tg - Tf/2))
// Cvh = Ci × (LEg/3.5)^Te
// → { cap, exposant }

computePedestrianCorrection(TTP, pedestrians, exposant)
// Cp = (TTP/10) × (1−exp(−P/360)) × (1800+P)/2160 × exp(exposant)
// → Cp (0..1)

computeQueuing(QE, cap_adj)
// M/M/1 : Wq = QE×3600/(C×(C-QE)), Lq = QE²/(C×(C-QE)), Lmax = Lq+2√Lq
// → { mean_delay_s, mean_queue_veh, max_queue_veh }

computeAll(geom, arms, periods)
// Point d'entrée principal → { globalParams, periodResults[] }
```

### Fonction `passesEntry` (critique)
```javascript
function passesEntry(origin, entry, dest, n) {
    if (origin === dest) return false;
    const dEntry = (entry - origin + n) % n;
    const dDest  = (dest  - origin + n) % n;
    return dEntry > 0 && dEntry < dDest;
}
```

## Structure JS du widget

```
ENGINE              fonctions calcul Siegloch embarquées (port engine.py)
SCHEMA              const — 5 tables + colonnes + formules Grist
S                   état global (giratoire courant, bras, périodes, flux, résultats)

setupSchema()       setup séquentiel idempotent (voir skills/schema.md)
loadGiratoire(row)  fetch Bras + Periodes + FluxOD → remplir formulaire
calculate()         computeAll(S) → upsert Resultats → renderResults()
renderResults(res)  table RC + badges + SVG schéma (réutiliser index.html)

editGiratoire()     UpdateRecord Giratoires (R, LA, Bf, milieu)
addArm()            AddRecord Bras + FluxOD cascade N×N
editArm(id)         UpdateRecord Bras
removeArm(id)       RemoveRecord Bras + FluxOD cascade
addPeriode()        AddRecord Periodes + FluxOD cascade N×N
removePeriode(id)   RemoveRecord Periodes + FluxOD cascade
setFlux(o,d,p,val)  UpdateRecord/AddRecord FluxOD
```

---

## UI — Sections

```
[spinner setup]      phases 1-8 (ensureSchema)
[fiche giratoire]    inputs R/LA/Bf/milieu + strip Rext/RU/LAU/LEU (lus Grist)
[tableau bras]       colonnes = index.html + boutons + / ×
[onglets périodes]   + Période / × + matrice O-D éditable
[bouton Calculer]    spinner → résultats
[zone résultats]     table RC + badges + SVG schéma + SVG courbe
```

---

## Conventions

- **Aucun appel réseau externe** — moteur embarqué JS, widget 100% autonome
- Widget servi depuis n'importe quelle URL (GitHub Pages, local, Grist direct)
- `grist.ready({ requiredAccess: 'full' })` — accès complet
- Le widget se lie à la table `Giratoires` (onRecord = sélection d'un giratoire)
- Mode démo : données hardcodées d'un giratoire exemple 4 bras / 1 période
- Pas de frameworks JS — HTML monofichier
- Réutiliser CSS et logique SVG de `index.html` (palette RC, schéma)

---

## État actuel

- [ ] `grist_widget.html` à créer
- [ ] Tests en local (Docker rebuild)
- [ ] Publication : copier dans `BlenderRoads/cerema-services/girabase/static/`

## Points d'attention

- **Ordre Ref** : FluxOD référence Periodes ET Bras → créer Periodes et Bras avant FluxOD
- **Formules avec `import`** : `LImax` utilise `import math` dans la formule inline Grist
- **Matrice O-D** : diagonale toujours 0 (flux i→i impossible)
- **Upsert Resultats** : chercher row existante (bras+periode) avant AddRecord, sinon UpdateRecord
- **Bras angle** : utilisé uniquement pour le schéma SVG, pas pour le calcul
- **exit_only** : si vrai, le bras n'a pas de capacité d'entrée (QE=0)
- **API URL** : en mode Grist widget, l'iframe est sur `localhost:8090` → fetch relatif `/api/capacite` fonctionne
