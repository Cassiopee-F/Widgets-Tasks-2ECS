/**
 * Tests parseGristBool (prefs Grist Visible).
 * node --test projects/Atlas/tests/grist-bool.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseGristBool } from '../lib/grist-bool.js';
import { applyLayerPrefsBinding } from '../lib/manifest-binding.js';

describe('parseGristBool', () => {
  it('interprète false, 0 et chaînes False', () => {
    assert.equal(parseGristBool(false), false);
    assert.equal(parseGristBool(0), false);
    assert.equal(parseGristBool('False'), false);
    assert.equal(parseGristBool('false'), false);
    assert.equal(parseGristBool('0'), false);
  });

  it('interprète true, 1 et chaînes True', () => {
    assert.equal(parseGristBool(true), true);
    assert.equal(parseGristBool(1), true);
    assert.equal(parseGristBool('True'), true);
    assert.equal(parseGristBool('true'), true);
  });

  it('null/undefined → défaut', () => {
    assert.equal(parseGristBool(null, true), true);
    assert.equal(parseGristBool(undefined, false), false);
  });
});

describe('applyLayerPrefsBinding visible Grist', () => {
  it('masque quand Visible vaut chaîne False', () => {
    const layer = {
      source: 'qgis2grist',
      sourceTable: 'Fields',
      visible: true,
      style: { mode: 'mapbox' },
      geojson: { features: [] },
    };
    applyLayerPrefsBinding(layer, { prefRowId: 1, visible: 'False', style: null });
    assert.equal(layer.visible, false);
  });
});
