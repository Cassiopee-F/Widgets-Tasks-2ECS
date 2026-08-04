/**
 * Tests Atlas v7 — le rafraîchissement périodique ne recharge que l'utile.
 * node --test projects/Atlas/tests/scene-polling.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { layersToRefresh } from '../lib/grist-sync.js';

const couche = (nom, extra = {}) => ({
  name: nom, sourceTable: nom, source: 'qgis2grist', visible: true, ...extra,
});

describe('layersToRefresh', () => {
  it('retient une couche visible et matérialisée', () => {
    assert.deepEqual(layersToRefresh([couche('Routes')]).map((l) => l.name), ['Routes']);
  });

  it('écarte une couche différée — recharger sa table n\'apporte rien', () => {
    // 42 182 mailles jamais converties : le cycle paierait le volume pour rien.
    assert.equal(layersToRefresh([couche('Grille', { _deferredLoad: true })]).length, 0);
  });

  it('écarte une couche masquée — rien n\'est peint', () => {
    assert.equal(layersToRefresh([couche('Batiments', { visible: false })]).length, 0);
  });

  it('écarte ce qui ne vient pas de qgis2grist', () => {
    assert.equal(layersToRefresh([couche('GeoJSON importé', { source: 'file' })]).length, 0);
  });

  it('scène CRESO : 2 couches rafraîchies sur 5', () => {
    const scene = [
      couche('Grille_sardaigne', { visible: false, _deferredLoad: true }), // 42 182
      couche('Ctr_dbtopo', { visible: false, _deferredLoad: true }),       // 52 165
      couche('Batiments_3', { visible: false }),                            // 38 848
      couche('Routes_3'),                                                   //  6 934
      couche('Grille_analyse_200m_3'),                                      //  3 843
    ];
    assert.deepEqual(layersToRefresh(scene).map((l) => l.name),
      ['Routes_3', 'Grille_analyse_200m_3']);
  });

  it('tolère une liste vide ou nulle', () => {
    assert.deepEqual(layersToRefresh(null), []);
    assert.deepEqual(layersToRefresh([]), []);
  });
});
