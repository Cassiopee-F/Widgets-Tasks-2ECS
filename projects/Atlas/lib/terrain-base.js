/**
 * Poser les surfaces en volume sur le relief.
 *
 * Dans MapLibre, `fill-extrusion-base` et `fill-extrusion-height` se comptent
 * depuis le **niveau de la mer**, pas depuis le sol. Une entité extrudée de 0 à
 * 12 m est donc ancrée à l'altitude zéro : sur un relief à 50 m elle est
 * entièrement enfouie, et sur un relief à 10 m seuls deux mètres dépassent —
 * d'où les interférences entre la donnée et le terrain.
 *
 * Les modèles 3D three.js, eux, étaient déjà posés correctement (`Models3D`
 * interroge le MNT). Ce module applique la même règle aux surfaces, en
 * réutilisant **le même échantillonnage** : un lampadaire et le bâtiment sous
 * lui reposent ainsi à la même altitude par construction, quelle que soit
 * l'exagération du relief.
 */

/** Propriété portant l'altitude du sol, injectée dans chaque entité. */
export const TERRAIN_BASE_PROP = '_sol';

/**
 * Expressions d'extrusion posées sur le sol.
 *
 * `base` et `height` peuvent être des nombres ou des expressions MapLibre
 * (hauteur graduée, champ de la donnée) : elles sont composées telles quelles.
 *
 * @param {number|Array} base hauteur du dessous, au-dessus du sol
 * @param {number|Array} height épaisseur au-dessus de la base
 * @param {boolean} surTerrain false = comportement d'origine, ancré au niveau de la mer
 */
export function extrusionExpressions(base, height, surTerrain) {
  if (!surTerrain) return { base, height };
  const sol = ['coalesce', ['get', TERRAIN_BASE_PROP], 0];
  return {
    base: ['+', sol, base],
    height: ['+', sol, base, height],
  };
}

/**
 * Injecte l'altitude du sol dans les entités d'une collection.
 *
 * L'échantillonnage est délégué : l'appelant fournit la même fonction que celle
 * qui pose les modèles 3D. Une altitude non finie — tuile MNT pas encore
 * chargée — laisse l'entité inchangée plutôt que de la coller à zéro, ce qui la
 * ferait sauter au moment où le relief arrive.
 *
 * @param {{features?: Array}} geojson
 * @param {(lng: number, lat: number) => number} echantillonner
 * @param {(feature: object) => [number, number]|null} centre
 * @returns {number} nombre d'entités effectivement posées
 */
export function applyTerrainBase(geojson, echantillonner, centre) {
  const feats = geojson?.features;
  if (!Array.isArray(feats) || typeof echantillonner !== 'function') return 0;
  let posees = 0;
  for (const f of feats) {
    const c = centre?.(f);
    if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    const z = echantillonner(c[0], c[1]);
    if (!Number.isFinite(z)) continue;
    (f.properties = f.properties || {})[TERRAIN_BASE_PROP] = z;
    posees++;
  }
  return posees;
}

/**
 * Retire l'altitude injectée.
 *
 * Nécessaire quand le relief est coupé : l'expression retomberait sinon sur une
 * valeur périmée et laisserait les entités en lévitation.
 *
 * @returns {number} nombre d'entités nettoyées
 */
export function clearTerrainBase(geojson) {
  const feats = geojson?.features;
  if (!Array.isArray(feats)) return 0;
  let n = 0;
  for (const f of feats) {
    if (f?.properties && TERRAIN_BASE_PROP in f.properties) {
      delete f.properties[TERRAIN_BASE_PROP];
      n++;
    }
  }
  return n;
}

/**
 * Une couche a-t-elle besoin d'être posée sur le relief ?
 *
 * Seules les surfaces **en volume** sont concernées : à plat, MapLibre drape
 * déjà le remplissage sur le terrain. Les points et les lignes sont drapés eux
 * aussi. Sans cette garde, on paierait un échantillonnage inutile sur toute
 * couche visible.
 */
export function needsTerrainBase(layer, terrainActif) {
  if (!terrainActif || !layer) return false;
  const g = layer.geometryType;
  const surfacique = g === 'Polygon' || g === 'MultiPolygon';
  return surfacique && layer.style?.polygonMode !== 'flat';
}
