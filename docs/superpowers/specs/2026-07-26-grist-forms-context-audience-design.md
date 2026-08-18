# Form Builder — Contexte & audience (conditions)

## Objectif
Étendre les conditions d’affichage (étapes / questions) au-delà des champs précédents : widget Grist, session, personnes / groupes — sans casser le FormDef legacy.

## Formalisme
Règle atomique (compatible `{ field, operator, value }`) :

- `source`: `field` | `context` | `audience` (défaut `field`)
- `path` ou `field` : identifiant (`Email`, `inGristWidget`, `group`…)
- `operator` / `value` : inchangés (+ `in` / `notIn`)
- `bind` (audience) : `{ tableId, emailCol, groupCol, groups? }`

Raccourci : `field: "context.inGristWidget"` ⇒ `source: context`.

Composés ET/OU inchangés. `gate` Bool legacy inchangé.

## formDef.audience (optionnel)
```json
{
  "mode": "none" | "bind",
  "tableId": "Agents",
  "emailCol": "Email",
  "groupCol": "Groupe",
  "probe": false
}
```
- `none` : contexte widget seulement  
- `bind` : table **existante** du document pour email / groupes  
- `probe` : si true, reconnaissance auto via trigger `user.Email` sur colonne email (`audience-setup.js`)

## context (runtime)
| Clé | Origine |
|-----|---------|
| `inGristWidget` | Chartreux : `grist` + iframe + ready |
| `canWriteNative` | listTables / API OK |
| `userEmail` | probe ou bridge |
| `isLoggedIn` | `!!userEmail` sinon approx. `inGristWidget` |
| `groups` | lignes audience où email = userEmail |

## Phases livrées
A widget · B login (probe optionnel) · C audience bind table existante

## Sécurité
Conditions = UX. ACL Grist = autorité réelle.
