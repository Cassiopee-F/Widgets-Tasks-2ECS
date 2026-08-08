import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TERRAIN_BASE_PROP,
  applyTerrainBase,
  clearTerrainBase,
  extrusionExpressions,
  needsTerrainBase,
} from '../lib/terrain-base.js';

const centre = (f) => f?.geometry?.coordinates || null;
const maille = (lng, lat, props = {}) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lng, lat] },
  properties: { ...props },
});

/* ---------- expressions ---------- */

test('sans terrain : les valeurs passent telles quelles', () => {
  const { base, height } = extrusionExpressions(0, 12, false);
  assert.equal(base, 0);
  assert.equal(height, 12);
});

test('sur terrain : base et sommet décalés de l’altitude du sol', () => {
  const { base, height } = extrusionExpressions(0, 12, true);
  const sol = ['coalesce', ['get', TERRAIN_BASE_PROP], 0];
  assert.deepEqual(base, ['+', sol, 0]);
  // Le sommet doit inclure la base : sinon une entité posée à 50 m avec une
  // base de 3 m aurait une épaisseur de 12 m à partir de 50 m, pas de 53 m.
  assert.deepEqual(height, ['+', sol, 0, 12]);
});

test('une hauteur graduée reste composable', () => {
  const graduee = ['interpolate', ['linear'], ['get', 'nb_bat'], 0, 2, 134, 40];
  const { height } = extrusionExpressions(3, graduee, true);
  assert.deepEqual(height, ['+', ['coalesce', ['get', TERRAIN_BASE_PROP], 0], 3, graduee]);
});

test('sol absent : l’entité retombe au niveau de la mer, pas d’erreur', () => {
  // `coalesce` garantit qu'une entité non échantillonnée reste rendue.
  const { base } = extrusionExpressions(0, 12, true);
  assert.equal(base[1][0], 'coalesce');
  assert.equal(base[1][2], 0);
});

/* ---------- injection ---------- */

test('pose l’altitude sur chaque entité', () => {
  const fc = { features: [maille(9.1, 39.2), maille(9.2, 39.3)] };
  const n = applyTerrainBase(fc, (lng) => (lng === 9.1 ? 12.5 : 47), centre);
  assert.equal(n, 2);
  assert.equal(fc.features[0].properties[TERRAIN_BASE_PROP], 12.5);
  assert.equal(fc.features[1].properties[TERRAIN_BASE_PROP], 47);
});

test('altitude indisponible : l’entité est laissée intacte', () => {
  // Tuile MNT pas encore chargée. L'écraser à zéro ferait sauter l'entité au
  // moment où le relief arrive — mieux vaut ne rien poser et rejouer.
  const fc = { features: [maille(9.1, 39.2, { nb: 3 })] };
  const n = applyTerrainBase(fc, () => null, centre);
  assert.equal(n, 0);
  assert.equal(TERRAIN_BASE_PROP in fc.features[0].properties, false);
  assert.equal(fc.features[0].properties.nb, 3, 'les autres attributs sont préservés');
});

test('altitude négative (dépression, bathymétrie) acceptée', () => {
  const fc = { features: [maille(9.1, 39.2)] };
  applyTerrainBase(fc, () => -8, centre);
  assert.equal(fc.features[0].properties[TERRAIN_BASE_PROP], -8);
});

test('entité sans centre calculable : ignorée', () => {
  const fc = { features: [{ type: 'Feature', geometry: null, properties: {} }] };
  assert.equal(applyTerrainBase(fc, () => 10, centre), 0);
});

test('entrées invalides', () => {
  assert.equal(applyTerrainBase(null, () => 1, centre), 0);
  assert.equal(applyTerrainBase({ features: [] }, () => 1, centre), 0);
  assert.equal(applyTerrainBase({ features: [maille(1, 1)] }, null, centre), 0);
});

/* ---------- nettoyage ---------- */

test('couper le relief retire l’altitude', () => {
  // Sans cela, l'expression retomberait sur une valeur périmée et les entités
  // resteraient en lévitation au-dessus d'une carte redevenue plate.
  const fc = { features: [maille(9.1, 39.2), maille(9.2, 39.3)] };
  applyTerrainBase(fc, () => 30, centre);
  assert.equal(clearTerrainBase(fc), 2);
  assert.equal(TERRAIN_BASE_PROP in fc.features[0].properties, false);
});

test('nettoyer une collection déjà propre ne casse rien', () => {
  assert.equal(clearTerrainBase({ features: [maille(1, 1)] }), 0);
  assert.equal(clearTerrainBase(null), 0);
});

/* ---------- garde ---------- */

test('seules les surfaces en volume sont concernées', () => {
  const enVolume = { geometryType: 'Polygon', style: {} };
  const aPlat = { geometryType: 'Polygon', style: { polygonMode: 'flat' } };
  assert.equal(needsTerrainBase(enVolume, true), true);
  // À plat, MapLibre drape déjà le remplissage sur le relief.
  assert.equal(needsTerrainBase(aPlat, true), false);
  assert.equal(needsTerrainBase({ geometryType: 'LineString' }, true), false);
  assert.equal(needsTerrainBase({ geometryType: 'Point' }, true), false);
  assert.equal(needsTerrainBase({ geometryType: 'MultiPolygon', style: {} }, true), true);
});

test('relief coupé : aucune couche concernée', () => {
  assert.equal(needsTerrainBase({ geometryType: 'Polygon', style: {} }, false), false);
  assert.equal(needsTerrainBase(null, true), false);
});
