# Tests manuels LOD — qgis2grist v2

Checklist pour valider les profils A/B/C et le garde-fou taille fichier.

## Prérequis

```bash
cd projects/qgis2grist
node --test tests/*.test.js          # 45+ tests automatisés
python tests/fixtures/make_demo_gpkg.py
python tests/fixtures/make_profile_b_gpkg.py
python -m http.server 8765
```

Ouvrir `http://localhost:8765/index_v2.html` (panneau **Dev localhost** visible).

---

## 1. Profil A — petit volume (≤50k)

| Étape | Attendu |
|-------|---------|
| Dev → **demo GPKG** | Preview : pas de badge Profil B/C |
| **Voir la carte** | 3 points visibles, toggle actif |
| Zoom / pan | Toutes les entités restent visibles (mode `full`) |

Fixture : `tests/fixtures/demo_points.gpkg` (3 points).

---

## 2. Profil B — viewport (>50k, ≤500k)

| Étape | Attendu |
|-------|---------|
| Dev → **Profil B GPKG** (~55k) | Preview : badge **Profil B**, hint viewport |
| **Voir la carte** | Toggle `[B]` ; entités visibles dans le viewport |
| Zoom arrière (France entière) | Densité réduite / plafond 10k entités dans la vue |
| Pan / zoom | Rafraîchissement après ~300 ms (`moveend`) |

Fixture : `tests/fixtures/profile_b_points.gpkg` (générer avec `make_profile_b_gpkg.py`).

---

## 3. Profil C — attributs sans géométrie widget (>500k)

| Étape | Attendu |
|-------|---------|
| Dev → **Profil C synth.** | Preview : badge **Profil C**, hint « pas de géométrie widget » |
| **Voir la carte** | Toggle `[C]` en pointillés ; **aucune** couche MapLibre |
| Clic sur toggle `[C]` | Toast « attributs sans géométrie… » |
| Import Grist (si connecté) | Toast Profil C ; table **sans** colonnes `geometry_json` / lat-lng |

Pas de PMTiles dans le widget — la géométrie carto est déléguée à un flux/tuileur amont.

---

## 4. Rejet fichier >500 Mo

| Étape | Attendu |
|-------|---------|
| Dev → **fichier >500 Mo (simulé)** | État erreur avant lecture `arrayBuffer` |
| Message | « Fichier trop volumineux … Limite navigateur : 500 Mo » |

Le bouton dev simule un `File` de 500 Mo + 1 octet sans allouer de gros blob.

Alternative PowerShell (vrai fichier vide) :

```powershell
fsutil file createnew oversized.gpkg 524288001
```

Puis glisser-déposer sur la zone de drop.

---

## Tests automatisés associés

- `tests/scene-lod.test.js` — profils, viewport, import sans géométrie Profil C, garde-fou 500 Mo
