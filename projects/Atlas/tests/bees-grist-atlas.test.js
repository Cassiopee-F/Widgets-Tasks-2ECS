/**
 * Atlas v7 — pipeline Scene Manifest + données Grist réelles (doc bees cPkapbqG3URa).
 * Valide le binding label Choice Grist ↔ stops value/label du manifest.
 *
 * node --test projects/Atlas/tests/bees-grist-atlas.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSceneManifestLayers } from '../lib/scene-loader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(__dirname, 'fixtures');

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(FIX, name), 'utf8'));
}

function stripMeta(obj) {
  const { _source, ...rest } = obj;
  return rest;
}

/** Couleurs attendues alignées sur fill_color Grist (post-import qgis2grist). */
const APIARY_COLORS = {
  'European honey bee': '#de7300',
  'Buckfast bee': '#2da4ff',
  'Carniolan honey bee': '#9d3796',
};

const FIELDS_COLORS = {
  Lavender: '#daafc1',
  Dandelions: '#90c6a9',
  Grass: '#f69053',
  Colza: '#d7191c',
  Weed: '#90c6a9',
};

function mockDocApi() {
  const apiary = stripMeta(loadJson('grist-apiary-sample.json'));
  const fields = stripMeta(loadJson('grist-fields-sample.json'));
  return {
    listTables: async () => ['SceneManifest', 'Apiary', 'Fields', 'Pollen_Consumption'],
    fetchTable: async (name) => {
      if (name === 'Apiary') return apiary;
      if (name === 'Fields') return fields;
      if (name === 'Pollen_Consumption') {
        return {
          id: [1],
          latitude: [46.808],
          longitude: [9.257],
          percentage: [55],
        };
      }
      throw new Error('table inconnue: ' + name);
    },
  };
}

describe('Bees Grist — Atlas scene-loader (données réelles)', () => {
  it('charge manifest Grist + 3 couches métier', async () => {
    const manifest = loadJson('scene-manifest-bees-grist.json');
    const { layers, projectName, bounds } = await loadSceneManifestLayers(mockDocApi(), manifest, null);

    assert.equal(projectName, 'qfield_bees.zip');
    assert.equal(layers.length, 3);
    assert.ok(bounds);

    const apiary = layers.find((l) => l.sourceTable === 'Apiary');
    const fields = layers.find((l) => l.sourceTable === 'Fields');
    const pollen = layers.find((l) => l.sourceTable === 'Pollen_Consumption');

    assert.ok(apiary);
    assert.ok(fields);
    assert.ok(pollen);
    assert.equal(apiary.geojson.features.length, 35);
    assert.equal(fields.geojson.features.length, 4);
    assert.equal(fields.geometryType, 'Polygon');
    assert.equal(fields.geojson.features[0].geometry.type, 'Polygon');
    assert.equal(fields.style.polygonMode, 'flat');
  });

  it('Apiary — labels Choice Grist → couleurs manifest (≠ value QGIS)', async () => {
    const manifest = loadJson('scene-manifest-bees-grist.json');
    const { layers } = await loadSceneManifestLayers(mockDocApi(), manifest, null);
    const apiary = layers.find((l) => l.sourceTable === 'Apiary');

    const colorsSeen = new Set();
    for (const f of apiary.geojson.features) {
      const species = f.properties.bee_species;
      const expected = APIARY_COLORS[species];
      assert.ok(expected, `espèce inconnue: ${species}`);
      assert.equal(
        f.properties._fill_color,
        expected,
        `${species} → ${expected} (got ${f.properties._fill_color})`,
      );
      colorsSeen.add(f.properties._fill_color);
    }

    assert.equal(colorsSeen.size, 3, '3 couleurs distinctes attendues');
    assert.ok(apiary.controls?.length >= 1);
    assert.equal(apiary.controls[0].field, 'bee_species');
    assert.equal(apiary.controls[0].type, 'select');
  });

  it('Fields — labels Choice (Colza, Grass…) → couleurs manifest', async () => {
    const manifest = loadJson('scene-manifest-bees-grist.json');
    const { layers } = await loadSceneManifestLayers(mockDocApi(), manifest, null);
    const fields = layers.find((l) => l.sourceTable === 'Fields');

    for (const f of fields.geojson.features) {
      const plant = f.properties.plant_species;
      const expected = FIELDS_COLORS[plant];
      assert.ok(expected, `plante inconnue: ${plant}`);
      assert.equal(f.properties._fill_color, expected);
    }

    const distinct = new Set(fields.geojson.features.map((f) => f.properties._fill_color));
    assert.equal(distinct.size, 3, 'Lavender, Dandelions, Grass → 3 couleurs');
  });

  it('Pollen — style single + control range', async () => {
    const manifest = loadJson('scene-manifest-bees-grist.json');
    const { layers } = await loadSceneManifestLayers(mockDocApi(), manifest, null);
    const pollen = layers.find((l) => l.sourceTable === 'Pollen_Consumption');

    assert.equal(pollen.style.symbolization.color.mode, 'single');
    assert.equal(pollen.geojson.features[0].properties._fill_color, '#3e5de7');
    const range = pollen.controls?.find((c) => c.type === 'range');
    assert.ok(range);
    assert.equal(range.field, 'percentage');
    assert.equal(range.min, 0);
    assert.equal(range.max, 100);
  });

  it('cohérence Atlas _fill_color ↔ fill_color Grist (Apiary)', async () => {
    const manifest = loadJson('scene-manifest-bees-grist.json');
    const gristApiary = stripMeta(loadJson('grist-apiary-sample.json'));
    const { layers } = await loadSceneManifestLayers(mockDocApi(), manifest, null);
    const apiary = layers.find((l) => l.sourceTable === 'Apiary');

    for (let i = 0; i < gristApiary.id.length; i++) {
      const rowId = gristApiary.id[i];
      const gristColor = gristApiary.fill_color[i];
      const feature = apiary.geojson.features.find((f) => f.properties._row_id === rowId);
      assert.ok(feature, `feature id ${rowId}`);
      assert.equal(
        feature.properties._fill_color,
        gristColor,
        `row ${rowId}: Atlas doit reproduire fill_color Grist`,
      );
    }
  });
});
