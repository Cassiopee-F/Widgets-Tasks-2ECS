/**
 * Tests Atlas v7 — colonnes géométriques déclarées / collision de noms.
 * node --test projects/Atlas/tests/geometry-fields.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rowToFeature, rowsToGeoJSON } from '../lib/grist-rows.js';
import { defaultLayerVisible } from '../lib/grist-sync.js';
import { boundsFromVisibleLayers } from '../lib/scene-loader.js';

/** FeatureCollection minimale couvrant une bbox. */
function fcAt(coords) {
  return {
    type: 'FeatureCollection',
    features: coords.map((c) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: c },
      properties: {},
    })),
  };
}

describe('boundsFromVisibleLayers — scène multi-sites', () => {
  const grille = {
    visible: true,
    geometryType: 'Polygon',
    geojson: fcAt([[9.05, 39.18], [9.2, 39.28]]),
  };
  const sites = {
    visible: true,
    geometryType: 'Point',
    geojson: fcAt([[7.32, 43.6], [9.33, 44.32], [9.11, 39.22]]),
  };

  it('cadre sur les surfaces, pas sur des repères dispersés', () => {
    const b = boundsFromVisibleLayers([grille, sites]);
    // S'arrête à la grille de Cagliari : sinon Nice (43.6) imposerait une
    // échelle où une maille de 200 m est sous-pixel.
    assert.equal(b[0][0], 9.05);
    assert.equal(b[1][1], 39.28);
  });

  it('utilise les points quand aucune surface n\'est visible', () => {
    const b = boundsFromVisibleLayers([{ ...grille, visible: false }, sites]);
    assert.equal(b[0][0], 7.32);
    assert.equal(b[1][1], 44.32);
  });

  it('ignore les couches masquées', () => {
    const b = boundsFromVisibleLayers([grille, { ...sites, visible: false }]);
    assert.equal(b[1][1], 39.28);
  });

  it('rend null si rien n\'est visible', () => {
    const b = boundsFromVisibleLayers([{ ...grille, visible: false }]);
    assert.equal(b, null);
  });
});

describe('rowToFeature — source.geometry_fields', () => {
  it('lit les colonnes déclarées par le manifest', () => {
    const f = rowToFeature(
      { id: 1, latitude: 0, longitude: 0, latitude2: 39.22, longitude2: 9.11 },
      { geomType: 'Point', geometryFields: { lat: 'latitude2', lon: 'longitude2' } },
      '#ef4444'
    );
    assert.deepEqual(f.geometry.coordinates, [9.11, 39.22]);
  });

  it('les colonnes géométriques ne fuient pas dans les properties', () => {
    const f = rowToFeature(
      { id: 1, latitude: 0, longitude: 0, latitude2: 39.22, longitude2: 9.11 },
      {
        geomType: 'Point',
        geometryFields: { lat: 'latitude2', lon: 'longitude2' },
        fields: [{ name: 'latitude2' }, { name: 'longitude2' }],
      },
      '#ef4444'
    );
    assert.equal(f.properties.latitude2, undefined);
    assert.equal(f.properties.longitude2, undefined);
  });

  it('geojson déclaré sous un colId suffixé', () => {
    const poly = '{"type":"Polygon","coordinates":[[[1,43],[2,43],[2,44],[1,43]]]}';
    const f = rowToFeature(
      { id: 2, geometry_json2: poly },
      { geomType: 'Polygon', geometryFields: { geojson: 'geometry_json2' } },
      '#000000'
    );
    assert.equal(f.geometry.type, 'Polygon');
  });
});

describe('rowToFeature — repli sans geometry_fields (imports antérieurs)', () => {
  it('bascule sur latitude2/longitude2 quand lat/lon valent 0', () => {
    const f = rowToFeature(
      { id: 1, latitude: 0, longitude: 0, latitude2: 39.22, longitude2: 9.11 },
      { geomType: 'Point' },
      '#ef4444'
    );
    assert.deepEqual(f.geometry.coordinates, [9.11, 39.22]);
  });

  it('garde lat/lon quand elles sont valides', () => {
    const f = rowToFeature(
      { id: 1, latitude: 43.5, longitude: 5.4, latitude2: 0, longitude2: 0 },
      { geomType: 'Point' },
      '#ef4444'
    );
    assert.deepEqual(f.geometry.coordinates, [5.4, 43.5]);
  });

  it('rejette une ligne sans coordonnée exploitable', () => {
    const f = rowToFeature({ id: 1, latitude: 0, longitude: 0 }, { geomType: 'Point' }, '#000');
    assert.equal(f, null);
  });

  it('rowsToGeoJSON écarte les lignes non localisées sans casser les autres', () => {
    const gj = rowsToGeoJSON(
      [
        { id: 1, latitude: 0, longitude: 0 },
        { id: 2, latitude: 0, longitude: 0, latitude2: 44.05, longitude2: 8.22 },
      ],
      { geomType: 'Point' },
      null
    );
    assert.equal(gj.features.length, 1);
    assert.equal(gj.features[0].properties._row_id, 2);
  });
});

describe('defaultLayerVisible — defaultVisible explicite', () => {
  it('force la visibilité au-delà du seuil basemap de 2500', () => {
    const ml = { name: 'Grille d\'analyse 200 m', visibility: { defaultVisible: true } };
    assert.equal(defaultLayerVisible(ml, 2600), true);
  });

  it('sans defaultVisible, une couche volumineuse reste masquée', () => {
    assert.equal(defaultLayerVisible({ name: 'Grille d\'analyse 200 m' }, 2600), false);
  });

  it('defaultVisible false masque une petite couche', () => {
    assert.equal(defaultLayerVisible({ name: 'Sites', visibility: { defaultVisible: false } }, 10), false);
  });
});
