/**
 * Tests Atlas v7 — repli en points des surfaces sous-pixel.
 * node --test projects/Atlas/tests/point-fallback.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  featureCentroid,
  featureSpanMeters,
  pointFallbackZoom,
  centroidCollection,
  POINT_FALLBACK_MIN_FEATURES,
} from '../lib/point-fallback.js';

/** Maille carrée de ~200 m centrée sur (lon, lat). */
function maille(lon, lat, metres = 200) {
  const dLon = metres / (111320 * Math.cos(lat * Math.PI / 180)) / 2;
  const dLat = metres / 110540 / 2;
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[
      [lon - dLon, lat - dLat], [lon + dLon, lat - dLat],
      [lon + dLon, lat + dLat], [lon - dLon, lat + dLat], [lon - dLon, lat - dLat],
    ]] },
    properties: { _fill_color: '#123456', _fill_opacity: 0.8 },
  };
}
const grille = (n, metres = 200) => ({
  type: 'FeatureCollection',
  features: Array.from({ length: n }, (_, i) => maille(8.9 + i * 0.003, 40.0, metres)),
});

describe('featureCentroid', () => {
  it('centre une maille sur son milieu', () => {
    const c = featureCentroid(maille(8.9, 40.0));
    assert.ok(Math.abs(c[0] - 8.9) < 1e-6);
    assert.ok(Math.abs(c[1] - 40.0) < 1e-6);
  });

  it('rend les coordonnées telles quelles pour un point', () => {
    assert.deepEqual(featureCentroid({ geometry: { type: 'Point', coordinates: [1, 2] } }), [1, 2]);
  });

  it('null sur une géométrie inexploitable', () => {
    assert.equal(featureCentroid({ geometry: null }), null);
    assert.equal(featureCentroid({ geometry: { type: 'Polygon', coordinates: [] } }), null);
  });
});

describe('featureSpanMeters', () => {
  it('mesure une maille de 200 m', () => {
    const s = featureSpanMeters(maille(8.9, 40.0, 200), 40);
    assert.ok(Math.abs(s - 200) < 5, `attendu ~200 m, obtenu ${s}`);
  });
});

describe('pointFallbackZoom', () => {
  it('null en dessous du seuil d\'entités', () => {
    assert.equal(pointFallbackZoom(grille(POINT_FALLBACK_MIN_FEATURES - 1)), null);
  });

  it('mailles de 200 m → bascule autour de z10-11', () => {
    const z = pointFallbackZoom(grille(400, 200));
    assert.ok(z > 10 && z < 11.5, `attendu ~10,8 obtenu ${z}`);
  });

  it('entités plus larges → seuil plus bas', () => {
    const petit = pointFallbackZoom(grille(400, 200));
    const grand = pointFallbackZoom(grille(400, 2000));
    assert.ok(grand < petit, 'une entité 10× plus large bascule bien plus tard');
  });

  it('null si aucune géométrie surfacique exploitable', () => {
    const fc = { type: 'FeatureCollection', features: Array.from({ length: 400 },
      () => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [8.9, 40] }, properties: {} })) };
    assert.equal(pointFallbackZoom(fc), null);
  });
});

describe('centroidCollection', () => {
  it('un point par entité, propriétés conservées', () => {
    const fc = centroidCollection(grille(5));
    assert.equal(fc.features.length, 5);
    assert.equal(fc.features[0].geometry.type, 'Point');
    // La couleur doit suivre, sinon les points seraient peints en couleur de repli.
    assert.equal(fc.features[0].properties._fill_color, '#123456');
    assert.equal(fc.features[0].properties._fill_opacity, 0.8);
  });

  it('ignore les entités sans géométrie utilisable', () => {
    const fc = centroidCollection({ type: 'FeatureCollection', features: [
      maille(8.9, 40), { type: 'Feature', geometry: null, properties: {} },
    ] });
    assert.equal(fc.features.length, 1);
  });
});
