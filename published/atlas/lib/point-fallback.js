/**
 * Repli en points pour les surfaces trop petites à l'échelle courante.
 *
 * Une maille d'analyse de 200 m mesure moins d'un pixel en vue régionale : le
 * polygone existe, il est chargé, mais rien ne s'affiche. Un point garde en
 * revanche un rayon constant à l'écran. On calcule donc le zoom en deçà duquel
 * les surfaces passent sous le seuil de perception, et on bascule sur leurs
 * centres.
 */

/** En deçà de cette taille à l'écran, une surface n'est plus perceptible. */
export const MIN_FEATURE_PX = 3;
/** Sous ce nombre d'entités, le repli ne se justifie pas. */
export const POINT_FALLBACK_MIN_FEATURES = 300;

const EARTH_CIRCUMFERENCE_PX = 156543.03392;

/** Centre d'une entité : moyenne des sommets de son enveloppe externe. */
export function featureCentroid(feature) {
  const g = feature?.geometry;
  if (!g) return null;
  if (g.type === 'Point') return g.coordinates;
  const ring = g.type === 'Polygon' ? g.coordinates?.[0]
    : g.type === 'MultiPolygon' ? g.coordinates?.[0]?.[0]
    : g.type === 'LineString' ? g.coordinates
    : null;
  if (!ring?.length) return null;
  // Un anneau GeoJSON est fermé : son dernier sommet répète le premier. Le
  // compter deux fois décalerait le centre vers ce sommet.
  const first = ring[0];
  const last = ring[ring.length - 1];
  const closed = ring.length > 1 && first?.[0] === last?.[0] && first?.[1] === last?.[1];
  const end = closed ? ring.length - 1 : ring.length;
  let x = 0, y = 0, n = 0;
  for (let i = 0; i < end; i++) {
    const p = ring[i];
    if (Number.isFinite(p?.[0]) && Number.isFinite(p?.[1])) { x += p[0]; y += p[1]; n++; }
  }
  return n ? [x / n, y / n] : null;
}

/** Plus grande dimension de l'entité, en mètres. */
export function featureSpanMeters(feature, lat) {
  const g = feature?.geometry;
  const ring = g?.type === 'Polygon' ? g.coordinates?.[0]
    : g?.type === 'MultiPolygon' ? g.coordinates?.[0]?.[0] : null;
  if (!ring?.length) return 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of ring) {
    if (!Number.isFinite(p?.[0]) || !Number.isFinite(p?.[1])) continue;
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
  }
  if (!Number.isFinite(minX)) return 0;
  const w = (maxX - minX) * 111320 * Math.cos(lat * Math.PI / 180);
  const h = (maxY - minY) * 110540;
  return Math.max(w, h);
}

/**
 * Zoom sous lequel les surfaces de la couche deviennent imperceptibles.
 * @returns {number|null} null si le repli n'a pas lieu d'être (couche trop
 *   petite en nombre, entités déjà larges, ou géométries inexploitables)
 */
export function pointFallbackZoom(geojson) {
  const feats = geojson?.features || [];
  if (feats.length < POINT_FALLBACK_MIN_FEATURES) return null;
  const c = featureCentroid(feats[0]);
  const lat = Number.isFinite(c?.[1]) ? c[1] : 45;
  const step = Math.max(1, Math.floor(feats.length / 40));
  let sum = 0, n = 0;
  for (let i = 0; i < feats.length; i += step) {
    const s = featureSpanMeters(feats[i], lat);
    if (s > 0) { sum += s; n++; }
  }
  if (!n) return null;
  const mppLimit = (sum / n) / MIN_FEATURE_PX;
  const z = Math.log2(EARTH_CIRCUMFERENCE_PX * Math.cos(lat * Math.PI / 180) / mppLimit);
  if (!Number.isFinite(z) || z <= 3 || z >= 20) return null;
  return +z.toFixed(2);
}

/** Points aux centres des entités, propriétés (donc couleurs) conservées. */
export function centroidCollection(geojson) {
  const features = [];
  for (const f of (geojson?.features || [])) {
    const c = featureCentroid(f);
    if (!c) continue;
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: f.properties });
  }
  return { type: 'FeatureCollection', features };
}
