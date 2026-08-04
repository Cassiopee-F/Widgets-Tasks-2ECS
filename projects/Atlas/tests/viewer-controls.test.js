/**
 * Tests contrôles environnement Atlas.
 * node --test "projects/Atlas/tests/viewer-controls.test.js"
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultViewerControls,
  setViewerExposed,
  listExposedViewerControls,
  parseViewerControls,
  serializeViewerControls,
  suggestTransitionProfile,
} from '../lib/viewer-controls.js';

describe('viewer-controls', () => {
  it('defaults: sun/view3d/basemap non exposés', () => {
    const list = createDefaultViewerControls();
    assert.deepEqual(list.map((c) => c.id), ['sun', 'view3d', 'basemap']);
    assert.equal(listExposedViewerControls(list).length, 0);
  });

  it('setViewerExposed sun', () => {
    const list = createDefaultViewerControls();
    setViewerExposed(list, 'sun', true);
    assert.equal(list.find((c) => c.id === 'sun').exposed, true);
  });

  it('parse merge catalogue + ignore ids inconnus', () => {
    const list = parseViewerControls([{ id: 'sun', exposed: true }, { id: 'hack', exposed: true }]);
    assert.equal(list.find((c) => c.id === 'sun').exposed, true);
    assert.ok(!list.find((c) => c.id === 'hack'));
    assert.equal(list.length, 3);
  });

  it('parse accepte visible comme alias exposed', () => {
    const list = parseViewerControls([{ id: 'view3d', visible: true }]);
    assert.equal(list.find((c) => c.id === 'view3d').exposed, true);
  });

  it('serialize round-trip', () => {
    const list = createDefaultViewerControls();
    setViewerExposed(list, 'basemap', true);
    list.find((c) => c.id === 'basemap').config = { allowed: ['osm', 'sat'] };
    const again = parseViewerControls(serializeViewerControls(list));
    assert.equal(again.find((c) => c.id === 'basemap').exposed, true);
    assert.deepEqual(again.find((c) => c.id === 'basemap').config.allowed, ['osm', 'sat']);
  });

  it('suggestTransitionProfile: gros set couches → cut', () => {
    const a = { layers: [{ id: 'A', visible: true }], camera: { zoom: 10 }, settings: {} };
    const b = { layers: [{ id: 'B', visible: true }], camera: { zoom: 10 }, settings: {} };
    assert.equal(suggestTransitionProfile(a, b), 'cut');
  });

  it('suggestTransitionProfile: même couches, caméra change → ease', () => {
    const layers = [{ id: 'A', visible: true, controls: [] }];
    const a = { layers, camera: { zoom: 10, center: [0, 0], pitch: 0, bearing: 0 }, settings: { timeOfDay: 720 } };
    const b = { layers, camera: { zoom: 14, center: [1, 1], pitch: 55, bearing: 20 }, settings: { timeOfDay: 900 } };
    assert.equal(suggestTransitionProfile(a, b), 'ease');
  });
});
