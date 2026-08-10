import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TERRAIN_BASE_PROP,
  applyTerrainBase,
  clearTerrainBase,
  extrusionExpressions,
  needsTerrainBase,
  pointsSondes,
  DECALAGE_ANTI_SCINTILLEMENT,
  MARGE_MAX_M,
  margeRelief,
} from '../lib/terrain-base.js';

const centre = (f) => (f?.geometry?.coordinates ? [f.geometry.coordinates] : []);
const maille200 = (lng, lat, cote = 0.002) => ({
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [lng, lat], [lng + cote, lat], [lng + cote, lat + cote], [lng, lat + cote], [lng, lat],
    ]],
  },
  properties: {},
});
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
  const eps = DECALAGE_ANTI_SCINTILLEMENT;
  assert.deepEqual(base, ['+', sol, eps, 0]);
  // Le sommet doit inclure la base : sinon une entité posée à 50 m avec une
  // base de 3 m aurait une épaisseur de 12 m à partir de 50 m, pas de 53 m.
  assert.deepEqual(height, ['+', sol, eps, 0, 12]);
});

/* ---------- anti-scintillement ---------- */

test('la base ne repose jamais exactement sur le sol', () => {
  // Coplanaires, terrain et face inférieure se disputent le tampon de
  // profondeur : c'est le scintillement observé à l'écran.
  const { base } = extrusionExpressions(0, 12, true);
  assert.ok(base.includes(DECALAGE_ANTI_SCINTILLEMENT), 'décalage absent de la base');
});

test('le décalage est une constante, jamais une expression de zoom', () => {
  // MapLibre n'autorise ["zoom"] qu'à la racine d'une expression de propriété.
  // Imbriquée dans un ["+"], elle invalide l'expression entière et
  // setPaintProperty la rejette SANS RIEN SIGNALER : la base retombait à sa
  // valeur par défaut, annulant tout le calage. Vérifié à l'écran —
  // getPaintProperty renvoyait 0.
  assert.equal(typeof DECALAGE_ANTI_SCINTILLEMENT, 'number');
  assert.ok(DECALAGE_ANTI_SCINTILLEMENT > 0, 'jamais nul, sinon le scintillement revient');
  assert.ok(DECALAGE_ANTI_SCINTILLEMENT < 2, 'assez petit pour rester invisible');
});

test('aucune sous-expression de zoom dans les expressions produites', () => {
  // Garde anti-régression : la même erreur, ailleurs dans l'expression, serait
  // tout aussi silencieuse.
  const { base, height } = extrusionExpressions(0, 12, true);
  const contientZoom = (e) => Array.isArray(e)
    ? (e[0] === 'zoom' || e.some(contientZoom))
    : false;
  assert.equal(contientZoom(base), false, 'zoom imbriqué dans la base');
  assert.equal(contientZoom(height), false, 'zoom imbriqué dans la hauteur');
});

test('sans terrain, aucun décalage : le rendu d’origine est intact', () => {
  const { base, height } = extrusionExpressions(2, 12, false);
  assert.equal(base, 2);
  assert.equal(height, 12);
});

test('une hauteur graduée reste composable', () => {
  const graduee = ['interpolate', ['linear'], ['get', 'nb_bat'], 0, 2, 134, 40];
  const { height } = extrusionExpressions(3, graduee, true);
  assert.deepEqual(height, [
    '+', ['coalesce', ['get', TERRAIN_BASE_PROP], 0], DECALAGE_ANTI_SCINTILLEMENT, 3, graduee,
  ]);
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
  // Un seul point sondé : amplitude nulle, donc marge plancher.
  assert.equal(fc.features[0].properties[TERRAIN_BASE_PROP], 12.5 + DECALAGE_ANTI_SCINTILLEMENT);
  assert.equal(fc.features[1].properties[TERRAIN_BASE_PROP], 47 + DECALAGE_ANTI_SCINTILLEMENT);
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
  assert.equal(fc.features[0].properties[TERRAIN_BASE_PROP], -8 + DECALAGE_ANTI_SCINTILLEMENT);
});

test('entité sans géométrie : ignorée', () => {
  const fc = { features: [{ type: 'Feature', geometry: null, properties: {} }] };
  assert.equal(applyTerrainBase(fc, () => 10, centre), 0);
});

/* ---------- points sondés : le cœur de la correction ---------- */

test('une surface est sondée sur ses sommets, pas seulement son centre', () => {
  // Une facette plane posée à l'altitude de son centre traverse tout terrain
  // en pente : bord amont enfoui, bord aval en lévitation.
  const pts = pointsSondes(maille200(9.1, 39.2));
  assert.ok(pts.length >= 4, `attendu au moins les 4 coins, obtenu ${pts.length}`);
});

test('on retient l’altitude la plus haute sous l’entité, plus une marge', () => {
  const fc = { features: [maille200(9.1, 39.2)] };
  // Terrain en pente : l'altitude croît avec la longitude, de 0 à 10 m.
  applyTerrainBase(fc, (lng) => (lng - 9.1) * 5000, pointsSondes);
  // Point culminant à 10 m, amplitude 10 m → marge de 5 m.
  const z = fc.features[0].properties[TERRAIN_BASE_PROP];
  assert.ok(Math.abs(z - 15) < 1e-3, `attendu ~15 (10 + marge 5), obtenu ${z}`);
});

/* ---------- marge adaptative ---------- */

test('terrain plat : la marge se réduit au décalage minimal', () => {
  assert.equal(margeRelief(0), DECALAGE_ANTI_SCINTILLEMENT);
  assert.equal(margeRelief(0.2), DECALAGE_ANTI_SCINTILLEMENT);
});

test('la marge croît avec la rugosité du terrain', () => {
  // MapLibre simplifie le maillage du relief selon la distance, et cette
  // simplification CHANGE pendant la navigation : l'altitude rendue s'écarte
  // de celle mesurée. C'est ce qui faisait encore traverser les prismes plats.
  assert.ok(margeRelief(10) > margeRelief(4));
  assert.equal(margeRelief(10), 5);
});

test('la marge est plafonnée : pas de lévitation visible sur une falaise', () => {
  assert.equal(margeRelief(200), MARGE_MAX_M);
  assert.ok(MARGE_MAX_M > DECALAGE_ANTI_SCINTILLEMENT);
});

test('amplitude invalide : plancher', () => {
  assert.equal(margeRelief(NaN), DECALAGE_ANTI_SCINTILLEMENT);
  assert.equal(margeRelief(undefined), DECALAGE_ANTI_SCINTILLEMENT);
  assert.equal(margeRelief(-6), 3, 'une amplitude négative est une amplitude');
});

test('le nombre de points sondés reste borné', () => {
  // Un contour très détaillé ne doit pas faire exploser le coût.
  const anneau = Array.from({ length: 500 }, (_, i) => [9 + i * 1e-5, 39]);
  const f = { geometry: { type: 'Polygon', coordinates: [anneau] } };
  assert.ok(pointsSondes(f).length <= 8);
});

test('un point n’a qu’un seul point sondé', () => {
  assert.deepEqual(pointsSondes(maille(9.1, 39.2)), [[9.1, 39.2]]);
});

test('MultiPolygon : l’anneau extérieur du premier polygone', () => {
  const f = {
    geometry: {
      type: 'MultiPolygon',
      coordinates: [[[[9, 39], [9.1, 39], [9.1, 39.1], [9, 39]]]],
    },
  };
  assert.equal(pointsSondes(f).length, 4);
});

test('géométrie inexploitable : aucun point', () => {
  assert.deepEqual(pointsSondes({ geometry: { type: 'Polygon', coordinates: [] } }), []);
  assert.deepEqual(pointsSondes(null), []);
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
