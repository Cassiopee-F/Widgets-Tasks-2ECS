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
 * Décalage minimal entre le sol et le dessous des surfaces, en mètres.
 *
 * Posée exactement à l'altitude du terrain, la face inférieure du prisme est
 * coplanaire avec lui : les deux se disputent le tampon de profondeur et la
 * surface scintille (*z-fighting*). Un demi-mètre suffit à les départager, et
 * reste invisible à toute échelle.
 *
 * **Constante, et non expression de zoom.** MapLibre n'autorise `["zoom"]`
 * qu'à la racine d'une expression de propriété : imbriquée dans un `["+"]`,
 * elle invalide l'expression entière — et `setPaintProperty` la rejette
 * **sans rien signaler**. La base retombait alors à sa valeur par défaut, ce
 * qui annulait tout le calage sur le relief. Mesuré : avec un décalage
 * dépendant du zoom, `getPaintProperty('fill-extrusion-base')` renvoyait `0`.
 */
export const DECALAGE_ANTI_SCINTILLEMENT = 0.5;

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
  const eps = DECALAGE_ANTI_SCINTILLEMENT;
  return {
    base: ['+', sol, eps, base],
    height: ['+', sol, eps, base, height],
  };
}

/** Nombre maximal de points sondés par entité. */
export const MAX_POINTS_SONDES = 8;

/**
 * Points caractéristiques d'une entité, pour sonder le relief sous elle.
 *
 * Une surface est **plane** : la poser à l'altitude de son seul centre la fait
 * traverser tout terrain en pente — bord amont enfoui, bord aval en lévitation.
 * Sur une maille de 200 m et une pente de 10 %, l'écart atteint ±10 m, l'ordre
 * de grandeur de la hauteur d'extrusion elle-même.
 *
 * On sonde donc aussi les sommets, en les parcourant à pas régulier pour ne pas
 * dépendre de la finesse du contour. Sur une grille régulière, ces sommets sont
 * partagés par les mailles voisines : le cache d'altitude absorbe la
 * multiplication des appels.
 */
export function pointsSondes(feature, max = MAX_POINTS_SONDES) {
  const g = feature?.geometry;
  if (!g) return [];
  const estPoint = (c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]);
  if (g.type === 'Point') return estPoint(g.coordinates) ? [g.coordinates] : [];

  // Anneau extérieur : Polygon → coordinates[0] ; MultiPolygon → [0][0].
  const anneau = g.type === 'Polygon' ? g.coordinates?.[0]
    : g.type === 'MultiPolygon' ? g.coordinates?.[0]?.[0]
      : g.type === 'LineString' ? g.coordinates
        : null;
  if (!Array.isArray(anneau) || !anneau.length) return [];

  const pts = [];
  const pas = Math.max(1, Math.ceil(anneau.length / max));
  for (let i = 0; i < anneau.length; i += pas) {
    if (estPoint(anneau[i])) pts.push(anneau[i]);
  }
  return pts;
}

/**
 * Injecte l'altitude du sol dans les entités d'une collection.
 *
 * L'échantillonnage est délégué : l'appelant fournit la même fonction que celle
 * qui pose les modèles 3D. On retient l'altitude **la plus haute** sous
 * l'entité : ainsi elle repose sur son point culminant et ne traverse jamais le
 * sol. Elle décolle un peu côté aval — moindre mal, et c'est l'absence
 * d'interférence qui est recherchée.
 *
 * Une altitude non finie — tuile MNT pas encore chargée — laisse l'entité
 * inchangée plutôt que de la coller à zéro, ce qui la ferait sauter au moment
 * où le relief arrive.
 *
 * @param {{features?: Array}} geojson
 * @param {(lng: number, lat: number) => number} echantillonner
 * @param {(feature: object) => Array<[number, number]>} points
 * @returns {number} nombre d'entités effectivement posées
 */
export function applyTerrainBase(geojson, echantillonner, points = pointsSondes) {
  const feats = geojson?.features;
  if (!Array.isArray(feats) || typeof echantillonner !== 'function') return 0;
  let posees = 0;
  for (const f of feats) {
    let z = null;
    for (const p of (points?.(f) || [])) {
      const v = echantillonner(p[0], p[1]);
      if (Number.isFinite(v) && (z === null || v > z)) z = v;
    }
    if (z === null) continue;
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
