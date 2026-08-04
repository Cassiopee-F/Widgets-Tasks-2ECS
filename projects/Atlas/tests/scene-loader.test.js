/**
 * Tests Atlas v7 — lib interop Scene Manifest.
 * node --test projects/Atlas/tests/scene-loader.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchTableToRows, rowsToGeoJSON, boundsFromGeoJSON, inferGeometryTypeFromGeoJSON, resolveSceneGeometryType } from '../lib/grist-rows.js';
import {
  manifestGeometryType,
  primaryColorFromDeclarative,
  applyDeclarativeToLayer,
  syncFeatureColorsFromSymbolization,
  normalizePropertyValue,
} from '../lib/declarative-style.js';
import {
  detectDocMode,
  loadLatestSceneManifest,
  loadSceneManifestLayers,
} from '../lib/scene-loader.js';
import {
  isBasemapLayer,
  defaultLayerVisible,
  featureToRowUpdate,
  mergeFeatureOverrides,
} from '../lib/grist-sync.js';

describe('grist-rows', () => {
  it('fetchTableToRows convertit le format colonnaire', () => {
    const rows = fetchTableToRows({
      id: [1, 2],
      name: ['A', 'B'],
      latitude: [43.1, 43.2],
      longitude: [5.1, 5.2],
    });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].name, 'A');
    assert.equal(rows[1].latitude, 43.2);
  });

  it('rowsToGeoJSON point depuis lat/lon', () => {
    const gj = rowsToGeoJSON(
      [{ id: 10, latitude: 43.5, longitude: 5.4, fill_color: '#ff0000' }],
      { geomType: 'Point' },
      null
    );
    assert.equal(gj.features.length, 1);
    assert.deepEqual(gj.features[0].geometry.coordinates, [5.4, 43.5]);
    assert.equal(gj.features[0].properties._row_id, 10);
  });

  it('rowsToGeoJSON — geometry_json prioritaire sur cfg Point (Fields)', () => {
    const poly = '{"type":"Polygon","coordinates":[[[1,43],[2,43],[2,44],[1,44],[1,43]]]}';
    const gj = rowsToGeoJSON(
      [{
        id: 36,
        latitude: 43.5,
        longitude: 5.4,
        geometry_json: poly,
        plant_species: 'Grass',
      }],
      { geomType: 'Point' },
      null,
    );
    assert.equal(gj.features.length, 1);
    assert.equal(gj.features[0].geometry.type, 'Polygon');
    assert.equal(inferGeometryTypeFromGeoJSON(gj), 'Polygon');
  });

  it('rowToFeature normalise _rawKey → name dans properties', () => {
    const gj = rowsToGeoJSON(
      [{ id: 1, latitude: 43.5, longitude: 5.4, Percentage: 42 }],
      {
        geomType: 'Point',
        fields: [{ name: 'percentage', _rawKey: 'Percentage', gType: 'Int' }],
      },
      null
    );
    assert.equal(gj.features[0].properties.percentage, 42);
  });

  it('boundsFromGeoJSON', () => {
    const b = boundsFromGeoJSON({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [5, 43] }, properties: {} }],
    });
    assert.deepEqual(b, [[5, 43], [5, 43]]);
  });
});

describe('declarative-style', () => {
  it('resolveSceneGeometryType — manifest polygon prioritaire sur vote Point', () => {
    const gj = {
      features: [{ geometry: { type: 'Point', coordinates: [1, 43] } }],
    };
    assert.equal(resolveSceneGeometryType('polygon', 'Point', gj), 'Polygon');
  });

  it('resolveSceneGeometryType — infère sans manifest explicite', () => {
    const gj = {
      features: [{ geometry: { type: 'LineString', coordinates: [[1, 43], [2, 44]] } }],
    };
    assert.equal(resolveSceneGeometryType(null, null, gj), 'LineString');
  });

  it('manifestGeometryType', () => {
    assert.equal(manifestGeometryType('line'), 'LineString');
    assert.equal(manifestGeometryType('point'), 'Point');
  });

  it('applyDeclarativeToLayer categorized', () => {
    const layer = { color: '#111', geometryType: 'Point', style: {} };
    applyDeclarativeToLayer(layer, {
      kind: 'categorized',
      field: 'status',
      stops: [{ value: 'ok', color: '#0f0' }, { value: 'ko', color: '#f00' }],
    });
    assert.equal(layer.style.symbolization.color.mode, 'categorized');
    assert.equal(layer.style.symbolization.color.field, 'status');
    assert.equal(layer.style.symbolization.color.categories.length, 2);
  });

  it('applyDeclarativeToLayer categorized sync data', () => {
    const layer = {
      color: '#111',
      geometryType: 'Point',
      style: {},
      _fields: [{ name: 'beekeeper', _rawKey: 'Beekeeper', label: 'Apiculteur' }],
      geojson: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { beekeeper: 'Stephen Hawking' } },
          { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { beekeeper: 'Rita Levi Montalcini' } },
        ],
      },
    };
    applyDeclarativeToLayer(layer, {
      kind: 'categorized',
      field: 'Beekeeper',
      stops: [
        { value: 'Stephen Hawking', color: '#aa0000' },
        { value: 'Rita Levi Montalcini', color: '#00aa00' },
      ],
    });
    assert.equal(layer.style.symbolization.color.field, 'beekeeper');
    assert.equal(layer.geojson.features[0].properties._fill_color, '#aa0000');
  });

  it('applyDeclarativeToLayer categorized — value QGIS ≠ label (Apiary bees)', () => {
    const layer = {
      color: '#111',
      geometryType: 'Point',
      style: {},
      _fields: [{ name: 'bee_species', label: 'Espèce' }],
      geojson: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { bee_species: 'Apis Mellifera Mellifera' } },
          { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { bee_species: 'Apis Mellifera Carnica' } },
        ],
      },
    };
    applyDeclarativeToLayer(layer, {
      kind: 'categorized',
      field: 'bee_species',
      stops: [
        { value: 'Apis Mellifera Mellifera', label: 'European honey bee', color: '#aa0000' },
        { value: 'Apis Mellifera Carnica', label: 'Carniolan honey bee', color: '#00aa00' },
      ],
    });
    assert.equal(layer.geojson.features[0].properties._fill_color, '#aa0000');
    assert.equal(layer.geojson.features[1].properties._fill_color, '#00aa00');
    assert.equal(layer.style.symbolization.color.categories.length, 2);
  });

  it('applyDeclarativeToLayer graduated avec _rawKey et colonne Grist casse différente', () => {
    const layer = {
      color: '#111',
      geometryType: 'Point',
      style: {},
      _fields: [{ name: 'percentage', _rawKey: 'Percentage', label: 'Percentage', gType: 'Int' }],
      geojson: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { Percentage: 10 } },
          { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: { Percentage: 90 } },
        ],
      },
    };
    applyDeclarativeToLayer(layer, {
      kind: 'graduated',
      field: 'Percentage',
      stops: [{ lower: 0, upper: 50, color: '#0000ff' }, { lower: 50, upper: 100, color: '#ff0000' }],
    });
    assert.equal(layer.style.symbolization.color.mode, 'graduated');
    assert.equal(layer.style.symbolization.color.field, 'percentage');
    assert.ok(layer.geojson.features[0].properties._fill_color);
    assert.notEqual(
      layer.geojson.features[0].properties._fill_color,
      layer.geojson.features[1].properties._fill_color,
    );
  });
});

describe('scene-loader', () => {
  it('detectDocMode scene-manifest', async () => {
    const mode = await detectDocMode({
      listTables: async () => ['SceneManifest', 'Apiary'],
      fetchTable: async () => ({ id: [1], manifest_json: ['{}'] }),
    });
    assert.equal(mode, 'scene-manifest');
  });

  it('loadSceneManifestLayers charge les tables source', async () => {
    const manifest = {
      version: '0.2.1',
      title: 'Bee test',
      layers: [{
        id: 'Apiary',
        name: 'Ruchers',
        geometry_type: 'point',
        source: { type: 'grist', table: 'Apiary' },
        style: { declarative: { kind: 'single', color: '#3e5de7' } },
      }],
    };
    const docApi = {
      fetchTable: async (name) => {
        if (name === 'Apiary') {
          return {
            id: [42],
            latitude: [43.6],
            longitude: [1.44],
            name: ['R1'],
          };
        }
        throw new Error('unknown');
      },
    };
    const { layers, bounds, projectName } = await loadSceneManifestLayers(docApi, manifest, null);
    assert.equal(layers.length, 1);
    assert.equal(layers[0].sourceTable, 'Apiary');
    assert.equal(layers[0].geojson.features.length, 1);
    assert.equal(projectName, 'Bee test');
    assert.ok(bounds);
  });

  it('loadLatestSceneManifest prend la ligne la plus récente', async () => {
    const m = await loadLatestSceneManifest({
      fetchTable: async () => ({
        id: [1, 2],
        created_at: [100, 200],
        manifest_json: ['{"title":"old"}', '{"title":"new"}'],
      }),
    });
    assert.equal(m.title, 'new');
  });
});

describe('grist-sync', () => {
  it('isBasemapLayer détecte buildings volumineux', () => {
    assert.equal(isBasemapLayer({ name: 'buildings', profile: 'A' }, 3798), true);
    assert.equal(isBasemapLayer({ name: 'Apiary', profile: 'A' }, 35), false);
  });

  it('defaultLayerVisible masque basemap par défaut', () => {
    assert.equal(defaultLayerVisible({ name: 'buildings' }, 3798), false);
    assert.equal(defaultLayerVisible({ name: 'Apiary' }, 35), true);
  });

  it('featureToRowUpdate point lat/lon', () => {
    const layer = {
      geometryType: 'Point',
      _gristColumns: ['latitude', 'longitude', 'name'],
      _fields: [{ name: 'name' }],
    };
    const payload = featureToRowUpdate({
      geometry: { type: 'Point', coordinates: [5.4, 43.5] },
      properties: { _row_id: 7, name: 'R1', _scale: 1.2 },
    }, layer);
    assert.equal(payload.rowId, 7);
    assert.equal(payload.update.latitude, 43.5);
    assert.equal(payload.update.longitude, 5.4);
    assert.equal(payload.update.name, 'R1');
  });

  it('featureToRowUpdate — polygone : refuse d\'écrire un Point dans geometry_json', () => {
    const layer = {
      geometryType: 'Polygon',
      source: 'qgis2grist',
      sourceTable: 'Fields',
      _gristColumns: ['geometry_json', 'fill_color'],
      _fields: [],
    };
    const payload = featureToRowUpdate({
      geometry: { type: 'Point', coordinates: [9.25, 46.8] },
      properties: { _row_id: 36, _fill_color: '#f69053' },
    }, layer);
    assert.equal(payload.update.fill_color, '#f69053');
    assert.equal(payload.update.geometry_json, undefined);
    assert.equal(payload.update.latitude, undefined);
  });

  it('normalizePropertyValue Ref/Choice', () => {
    assert.equal(normalizePropertyValue({ label: 'Stephen Hawking' }), 'Stephen Hawking');
    assert.equal(normalizePropertyValue([42]), '42');
  });

  it('mergeFeatureOverrides conserve _scale', () => {
    const oldGj = { features: [{ properties: { _row_id: 1, _scale: 2 } }] };
    const newGj = { features: [{ properties: { _row_id: 1 } }] };
    mergeFeatureOverrides(oldGj, newGj);
    assert.equal(newGj.features[0].properties._scale, 2);
  });

  it('syncFeatureColorsFromSymbolization — fixe / catégorisé / gradué', () => {
    const layer = {
      color: '#111111',
      source: 'qgis2grist',
      style: {
        symbolization: {
          color: { mode: 'single', value: '#ff0000', field: null, categories: [], defaultColor: '#111' },
        },
      },
      geojson: {
        features: [
          { properties: { beekeeper: 'A', n: 1 } },
          { properties: { beekeeper: 'B', n: 9 } },
        ],
      },
    };
    syncFeatureColorsFromSymbolization(layer);
    assert.equal(layer.geojson.features[0].properties._fill_color, '#ff0000');

    layer.style.symbolization.color = {
      mode: 'categorized', field: 'beekeeper', categories: [],
      palette: 'Tableau10', defaultColor: '#111',
    };
    syncFeatureColorsFromSymbolization(layer);
    assert.notEqual(layer.geojson.features[0].properties._fill_color, '#111111');

    layer.style.symbolization.color = {
      mode: 'graduated', field: 'n', defaultColor: '#111',
    };
    syncFeatureColorsFromSymbolization(layer, ['#000000', '#ffffff']);
    assert.ok(layer.geojson.features[1].properties._fill_color);
  });
});
