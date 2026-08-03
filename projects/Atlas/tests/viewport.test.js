import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cameraStorageKey,
  savedCameraNearBounds,
  shouldAutoFitInitialBounds,
} from '../lib/viewport.js';

const BEES_BOUNDS = [[9.252, 46.805], [9.258, 46.808]];
const TOULOUSE = { lng: 1.4437, lat: 43.6043, zoom: 16 };

describe('viewport — centrage initial', () => {
  it('cameraStorageKey scope par projet', () => {
    assert.equal(cameraStorageKey('qfield_bees.zip'), 'atlas_v7_camera_qfield_bees_zip');
  });

  it('caméra Toulouse loin des données bees → pas near bounds', () => {
    const mem = new Map([['atlas_v7_camera_qfield_bees_zip', JSON.stringify(TOULOUSE)]]);
    const storage = { getItem: (k) => mem.get(k) ?? null };
    assert.equal(
      savedCameraNearBounds(BEES_BOUNDS, 'atlas_v7_camera_qfield_bees_zip', storage),
      false,
    );
    assert.equal(
      shouldAutoFitInitialBounds(BEES_BOUNDS, 'atlas_v7_camera_qfield_bees_zip', storage),
      true,
    );
  });

  it('caméra proche des données → conserve navigation', () => {
    const near = { lng: 9.255, lat: 46.8065, zoom: 14 };
    const mem = new Map([['atlas_v7_camera_qfield_bees_zip', JSON.stringify(near)]]);
    const storage = { getItem: (k) => mem.get(k) ?? null };
    assert.equal(
      savedCameraNearBounds(BEES_BOUNDS, 'atlas_v7_camera_qfield_bees_zip', storage),
      true,
    );
    assert.equal(
      shouldAutoFitInitialBounds(BEES_BOUNDS, 'atlas_v7_camera_qfield_bees_zip', storage),
      false,
    );
  });
});
