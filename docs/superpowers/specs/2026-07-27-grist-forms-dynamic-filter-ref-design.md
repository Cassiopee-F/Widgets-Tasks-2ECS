# Design — Filtre dynamique étendu (parent Ref → même table / colonne lue)

**Date** : 2026-07-27  
**Repo** : Widgets Grist (`projects/grist_forms/`)  
**Statut** : validé et implémenté (2026-07-27)  
**Décision produit** : Approche 1 (étendre `dynamicFilter`, garder `cascade` inchangé)  
**Liens** : FormDef `formdef.schema.json`, `engine.js` (`filterDynamicOptions`, `filterCascadeOptions`), builder panneaux Ref

---

## 1. Problème

Trois scénarios de filtrage de listes Ref sont légitimes :

| Cas | Besoin | Exemple |
|-----|--------|---------|
| **A** | Filtrer par valeur saisie (Choice / Texte / Bool) | Groupe → Contacts |
| **B** | Cascade Ref→Ref (liaison par id) | Région → Commune ; Manager → Collaborateurs |
| **C** | Filtrer en lisant une colonne de la **ligne** Ref parent | Contact → autres Contacts du même Groupe |

**A** et **B** sont déjà couverts (`dynamicFilter` / `cascade`).  
**C** échoue aujourd’hui : si le parent est Ref, le moteur compare l’**id** à `filterColumn` (ex. Nom / Groupe), au lieu de résoudre la ligne puis lire un attribut.

Hors scope de cette spec : lookup / préremplir un champ (« afficher l’email d’Alice ») — feature distincte.

---

## 2. Décision d’architecture

**Approche 1 — Deux panneaux, filtre dynamique étendu.**

```
cascade        → cas B uniquement (inchangé)
dynamicFilter  → cas A + cas C
```

- Pas de 3ᵉ panneau UI.
- Pas d’unification cascade + filtre (évite migration FormDef et risque de régression B).
- Extension minimale du contrat `dynamicFilter` + une fonction `resolveParentFilterValue` dans `engine.js`.

---

## 3. Contrat FormDef

### 3.1 Schéma `dynamicFilter` (étendu)

```json
{
  "parentField": "Contact_referent",
  "filterColumn": "Groupe",
  "parentResolve": "refRow",
  "parentValueColumn": "Groupe"
}
```

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `parentField` | oui | colId de la question amont |
| `filterColumn` | oui | Colonne de la **table liée enfant** comparée à la valeur résolue |
| `parentResolve` | non | `"value"` (défaut) \| `"refRow"` |
| `parentValueColumn` | si `refRow` | Colonne lue sur la **ligne** du parent Ref |

**Compatibilité** : FormDef existants sans `parentResolve` / `parentValueColumn` = comportement actuel (**cas A**). Aucune migration obligatoire.

### 3.2 Cascade (inchangé)

```json
"cascade": { "parentField": "Manager", "parentRefCol": "Manager" }
```

Reste mutuellement exclusif avec `dynamicFilter` (builder : cocher l’un désactive l’autre).

### 3.3 Règles de validité (binding)

| Config | Valide si |
|--------|-----------|
| Cas A | Parent Choice/Text/Bool (ou Ref traité comme valeur brute — déconseillé) ; `filterColumn` présent |
| Cas B | `cascade` complet ; parent Ref ; `parentRefCol` détecté |
| Cas C | Parent **Ref** ; `parentResolve === "refRow"` ; `parentValueColumn` non vide ; `filterColumn` non vide ; tables parent/enfant chargées |

Si cas C incomplet → erreur builder / options enfant vides tant que parent non choisi (comme A aujourd’hui).

---

## 4. Runtime (`engine.js`)

### 4.1 Résolution de la valeur parent

```
resolveParentFilterValue(field, values, formDef, refRecords):
  df = field.dynamicFilter
  raw = values[df.parentField]
  if raw vide → return null

  if df.parentResolve !== "refRow":
    return raw                    // cas A

  parentMeta = findField(formDef, df.parentField)
  parentTable = resolveRefTable(parentMeta)
  records = refRecords[parentTable]
  row = find row where id == raw
  if !row → return null
  return row[df.parentValueColumn]   // cas C
```

Puis :

```
filterDynamicOptions(choices, childRecords, filterColumn, resolvedValue)
```

(inchangé sur la comparaison ; seule la valeur d’entrée change.)

### 4.2 Cascade

Aucun changement à `filterCascadeOptions` / branche `field.cascade`.

### 4.3 Prune

`pruneInvalidFilteredValues` continue d’invalider l’enfant si hors liste filtrée (A/B/C).

### 4.4 Chargement tables

Cas C exige que la **table du parent Ref** soit dans `refRecords` (déjà via `collectRefTableIds` si le parent est un champ Ref du FormDef). Vérifier que le parent Ref est bien collecté même s’il n’est pas l’enfant filtré.

---

## 5. Builder UX

### 5.1 Panneau « Filtre par valeur d’une autre question »

Quand le parent sélectionné est **Ref** :

```
☑ Filtrer selon la valeur d’une question au-dessus
  Question au-dessus        : [Contact référent (Référence)]
  Lire sur la ligne choisie : [Groupe ▼]     ← parentValueColumn
  Filtrer les lignes où     : [Groupe ▼]     ← filterColumn (table liée enfant)
```

Quand le parent est Choice/Texte/Bool :

```
  Question au-dessus        : [Groupe (Liste)]
  Filtrer les lignes où     : [Groupe ▼]     ← pas de « Lire sur la ligne »
```

À la sélection d’un parent Ref → poser automatiquement :

- `parentResolve: "refRow"`
- `parentValueColumn` = première colonne Text/Choice commune si détectable, sinon vide (obligatoire avant save)

À la sélection d’un parent non-Ref → `parentResolve: "value"`, supprimer `parentValueColumn`.

### 5.2 Messages

- Cas C sans `parentValueColumn` : hint « Indiquez quelle colonne lire sur le contact / la ligne choisie ».
- Infobulle : « On lit une valeur sur la ligne sélectionnée au-dessus, puis on ne garde que les lignes où cette colonne est égale. »

### 5.3 Cascade

Inchangé (messages empty-state déjà ajoutés).

---

## 6. Projection Survey Manifest

Phase minimale : **ne pas** projeter `parentResolve` / `parentValueColumn` dans SM (comme cascade aujourd’hui — reste FormDef-only).  
Documenter le gap ; extension SM ultérieure si BlockNote / offre-de-service en ont besoin.

---

## 7. Tests

| Test | Contenu |
|------|---------|
| Unit `resolveParentFilterValue` | value vs refRow ; id manquant → null |
| Unit `filterDynamicOptions` | inchangé (valeur déjà résolue) |
| Mount cas A | Choice → Contacts.Groupe |
| Mount cas C | Ref Contacts → Ref Contacts, Groupe→Groupe ; sans parent → liste vide ; parent Alice → Agents |
| Mount cas B | régression cascade Manager / Region→Ville |
| Builder | toggle parent Ref affiche `parentValueColumn` |

---

## 8. Hors scope

- Lookup / préremplir champs depuis Ref
- Filtre multi-colonnes / opérateurs ≠ `==`
- Exclure la ligne parent de la liste enfant (option future `excludeParentRow`)
- Projection SM des filtres avancés

---

## 9. Décisions

| ID | Décision |
|----|----------|
| D1 | Approche 1 : étendre `dynamicFilter`, garder `cascade` |
| D2 | Cas C via `parentResolve: "refRow"` + `parentValueColumn` |
| D3 | Défaut absents = cas A (rétrocompat) |
| D4 | Lookup hors scope |
| D5 | SM : pas de projection des nouveaux champs en v1 de cette feature |

---

## 10. Critères de succès

- [ ] Cas A inchangé (tests verts)
- [ ] Cas B inchangé (tests verts)
- [ ] Cas C : FormDef + engine + builder + tests mount
- [ ] UI : parent Ref → 3e liste « Lire sur la ligne choisie »
- [ ] MANUAL_TEST : scénario Contacts Groupe documenté
