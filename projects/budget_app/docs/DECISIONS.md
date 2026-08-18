# Décisions d'architecture — suite Budget perso

Arbitrages instruits puis tranchés sur les questions laissées ouvertes par la
revue du travail de Claude Design. Chaque point note la décision *et* sa raison.

---

## D1 · Mode « Flottant » et schéma

**Décision.** On adopte le 3ᵉ mode d'enveloppe proposé par Claude Design. Côté
schéma, coût minimal : `Categories.Budget_mode` accepte une 3ᵉ valeur
`'flottant'` (champ texte, aucune migration) + **une seule** colonne nouvelle,
`Provision` (Numeric). La **part fixe** n'est pas un champ : elle est
auto-détectée à l'exécution (récurrents), avec override manuel rangé dans
`Budget_mensuel` (>0 = forcé, sinon auto).

**Raison.** Stocker la réserve dans une colonne imposerait une mise à jour
mensuelle — état fragile, synchro, divergence garantie. La réserve est donc
**dérivée, jamais stockée** : recalculée à la volée comme le cumul, sur une
fenêtre glissante de 12 mois, de `provision − max(0, dépensé − part_fixe)`,
plancher à zéro. Cohérent avec tout le reste de la suite (tout est calculé
depuis `Transactions` au runtime), zéro écriture périodique.
Implémenté dans `core/budget-core.js` : `detectRecurrents`, `deriveReserve`.

---

## D2 · Locatif en revenu, dépense ou exclu

**Décision.** Convention de **préfixe**, pas de bascule de `Type`. Les
catégories préfixées `Locatif -` gardent leur `Type` réel (revenu/dépense) pour
les widgets immo ; les lentilles perso (Suivi, Prévisionnel) les **filtrent par
préfixe** et les ignorent dans le reste-à-vivre et les enveloppes.

**Raison.** Le dilemme « revenu pour l'immo / exclu pour le perso » était
insoluble via un `Type` global. Le préfixe résout les deux usages d'une même
ligne sans la dupliquer. C'est la solution que Claude Design a lui-même écrite
dans la planche d'architecture (« `Locatif -` transparent pour le budget
perso »). Implémenté : `BP.isLocatif`. Effet : le RAV perso cesse d'être gonflé
par les ~11 k€ de loyers perçus.

---

## D3 · Recâblage des maquettes Claude Design

**Décision.** Ni drop-in, ni table rase. La **logique de vue** des classes DC
(`decorate`, `median`, `amortY`, barèmes d'abattement) migre dans `core/` —
~70 % portable telle quelle. Le **markup** DC (`{{ }}`, `sc-for`) est ré-exprimé
en HTML vanilla pour rester cohérent avec les widgets déployés (un seul fichier,
sans framework, sans React-depuis-unpkg). La **couche données** est neuve
(`fetchTable` + `applyUserActions`). On câble le **Suivi en premier** (le plus
riche : teste lecture, écriture des seuils, calcul, et tranche le Flottant).

**Raison.** Les `.dc.html` ne sont pas des widgets Grist : runtime « Design
Component » maison, données mockées, React externe. Mais le JS de calcul est
propre et réutilisable — c'est une spec haute-fidélité, pas du jetable.
→ Livré : `suivi.html` (widget Grist réel) + extensions de `core/`.

---

## D4 · Rigueur fiscale des simulateurs immo

**Décision.** Séparer les usages. **Sim = décision** (micro vs réel, garder vs
céder) : les approximations de Claude Design tiennent (classement relatif et
ordres de grandeur justes). **Déclaratif = `CCP_Bilan_Locatif`** sur données
réelles : c'est lui qui doit être exact, pas le simulateur. Une correction vaut
le coup (~10 lignes) : dissocier dans le calcul du réel meublé le déficit
déductible (charges + intérêts, reportable) du report d'amortissement (illimité,
ARD), là où le `Math.max(0, BIC)` les confond.

**À confirmer (hors session).** Claude Design affiche la « réforme LMNP 2025 »
(réintégration des amortissements dans la plus-value) comme un fait. C'est
globalement passé en loi de finances, mais **modalités et date d'application à
vérifier** (Légifrance / comptable) avant tout arbitrage de revente. À marquer
« à confirmer » dans le simulateur tant que non vérifié.

---

## D5 · Périmètre de la suite immo

**Décision.** Consolider l'immo à **2 modules**, pas 4. Claude Design a livré
Acquisition + Exploitation + Fiscalité + Simulateur, avec recouvrement (le
« Simulateur tout-en-un » subsume largement Acquisition + Exploitation pour un
bien). On retient **Fiscalité + Simulateur-comparateur** comme couche de
*décision*, calibrée par les ratios réels ; Acquisition et Exploitation se
replient en sections du comparateur. Ils se branchent **en aval** du
`CCP_Bilan_Locatif` (déclaratif réel), pas à côté.

**Raison.** Quatre outils à câbler et maintenir = surface qui s'étale (le risque
récurrent : beaucoup de génération, distribution faible). L'histoire cohérente
est celle du pitch : le bilan réel mesure, le simulateur projette à partir de
cette mesure.

---

## Schéma résultant (delta)

| Table | Changement |
|-------|-----------|
| `Categories` | `Budget_mode` accepte `flottant` ; **+ colonne `Provision`** (Numeric) |
| *(aucune autre)* | la réserve est dérivée, la part fixe est calculée ou rangée dans `Budget_mensuel` |

Convention transverse : préfixe `Locatif -` = sous-ensemble immo/LMNP, ignoré
par les lentilles perso, conservé pour les lentilles immo.
