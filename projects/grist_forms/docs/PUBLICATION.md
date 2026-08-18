# Publication — grist_forms (Form Builder)

> Audit de pré-publication — 2026-07-27

## Verdict

| Zone | Statut | Note |
|------|--------|------|
| Tests auto | ✅ | 83 tests (`node --test projects/grist_forms/tests/*.test.js`) |
| Runtime publish | ✅ | Bundle : bridge + types + attachments + **session-context** + engine + CSS |
| UX / libellés FR | ✅ | Audience + conditions avec infobulles `?` |
| Standards repo | ✅ | `grist.ready`, GristBridge, pas de CDN DSFR, `projects/` → `published/` |
| Documentation | ✅ | CLAUDE.md, MANUAL_TEST, ce fichier |
| Validation live | ⚠️ | Checklist §4–5 `MANUAL_TEST.md` à finaliser sur `grist.numerique` |
| PJ cross-origin | ⏸ | CORS — différé (formulaire natif Grist en alternative) |

**Prêt pour promote + manifest + push** vers GitHub Pages. La validation utilisateur live reste recommandée avant annonce large.

---

## Checklist publication (opérateur)

```bash
# 1. Tests
node --test projects/grist_forms/tests/*.test.js

# 2. Promote vers published/
npm run promote:grist-forms

# 3. Manifest catalogue Grist
npm run manifest

# 4. Commit + push main → CI déploie gh-pages
git add projects/grist_forms published/grist_forms published/manifest.json
git commit -m "feat(grist-forms): publish Form Builder v1.0.0"
git push
```

### URL widget (après déploiement)

```
https://nicO1asFr.github.io/Widgets-Grist/grist_forms/builder.html
```

Variable Grist (instance self-hosted) :

```bash
GRIST_WIDGET_LIST_URL=https://nicO1asFr.github.io/Widgets-Grist/manifest.json
```

### Configuration widget dans un document

- Type : **Custom widget**
- URL : URL ci-dessus (ou `npm run serve:dev` en dev)
- Accès : **full**
- Table liée : optionnelle pour le builder (lit le document entier)

---

## Audit fonctionnel

### Livré et testé (auto)

- Wizard créer / brancher, templates
- ensureSchema + bind colonnes existantes
- Sections, champs, types Grist (Text, Bool, Choice, Ref, Date, Attachments…)
- Chemins d’étapes + conditions champ (ET/OU)
- Contexte (`inGristWidget`, connecté, email session)
- Audience (table document, email/groupe, reconnaissance auto `user.Email`)
- Cascade Ref + filtre dynamique
- Aperçu = même moteur que runtime publié
- Publish intra-doc (CreateViewSection + snapshot `_html/_js`)
- Republish (Version++, remplace bundle figé)

### À valider manuellement

Voir `MANUAL_TEST.md` §4 (audience) et §5 (publish + republish).

---

## Audit UI

| Élément | État |
|---------|------|
| Parcours 4 onglets | OK |
| Accueil / Fin comme slides | OK |
| Audience intégrée Accueil | OK |
| Infobulles audience | OK |
| Infobulles conditions | OK |
| Panneau publish (republish, bundle) | OK (fignolé) |
| Responsive rule-row | OK (grille → 1 col &lt; 640px) |
| Toasts FR | OK |

---

## Audit sécurité / standards

- Échappement XSS : tests `engine.test.js`
- Conditions audience = **UX** ; ACL Grist = autorité
- Pas de secrets dans le repo
- `grist-plugin-api.js` depuis docs.getgrist.com (standard widgets)
- Pas de dépendance npm runtime (widget statique)

### Limites connues

1. **Attachments** : upload depuis vue custom hors origine Grist → CORS
2. **Probe email** : nécessite formule trigger sur colonne email (auto si coché)
3. **Builder URL** : en dev, `localhost:3001` ; en prod, GH Pages

---

## Structure `published/grist_forms/`

```
published/grist_forms/
├── package.json      # métadonnées manifest Grist
├── builder.html      # point d'entrée
├── shared/           # bridge, types, publish, session-context, audience-setup, …
└── runtime/          # engine.js, schémas JSON
```

Fichiers **non** publiés : `tests/`, `docs/`, `CLAUDE.md` (restent dans `projects/`).

---

## Post-publication

1. Cocher les items live dans `MANUAL_TEST.md`
2. Tag git optionnel : `v1.0.0-grist-forms`
3. Étude séparée : binding BlockNote / offre de service (réutiliser FormDef, ensureSchema)
