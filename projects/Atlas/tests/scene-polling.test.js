/**
 * Tests Atlas v7 — le rafraîchissement périodique ne recharge que l'utile.
 * node --test projects/Atlas/tests/scene-polling.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { layersToRefresh } from '../lib/grist-sync.js';
import { shouldDeferCold, materializeDeferredLayer } from '../lib/scene-loader.js';

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

describe('shouldDeferCold — ne pas telecharger ce qui est declare masque', () => {
  it('vrai quand le manifest masque explicitement et declare la geometrie', () => {
    assert.equal(shouldDeferCold({ visibility: { defaultVisible: false }, geometry_type: 'Polygon' }), true);
  });

  it('faux sans type de geometrie — il serait deduit du GeoJSON absent', () => {
    assert.equal(shouldDeferCold({ visibility: { defaultVisible: false } }), false);
  });

  it('faux quand la couche est visible', () => {
    assert.equal(shouldDeferCold({ visibility: { defaultVisible: true }, geometry_type: 'Polygon' }), false);
  });

  it('faux quand la visibilite n\'est pas declaree — le comptage reste necessaire', () => {
    // Sans declaration, isBasemapLayer tranche au nombre d'entites : il faut la table.
    assert.equal(shouldDeferCold({ geometry_type: 'Polygon' }), false);
    assert.equal(shouldDeferCold(null), false);
  });
});

describe('materializeDeferredLayer — chargement froid', () => {
  const base = () => ({
    sourceTable: 'T', geometryType: 'Point', color: '#123456',
    _deferredLoad: true, _deferredRows: null, _fields: [],
    geojson: { type: 'FeatureCollection', features: [] },
  });

  it('declenche le chargement et peuple la couche', async () => {
    const layer = base();
    layer._loadRows = async () => ([{ id: 1, latitude: 43, longitude: 5 }]);
    let pret = null;
    // Rend la main immediatement : les lignes ne sont pas encore la.
    assert.equal(materializeDeferredLayer(layer, { onReady: (l) => { pret = l; } }), false);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(layer._deferredLoad, false, 'la couche doit etre materialisee');
    assert.equal(pret, layer, 'onReady doit signaler la couche prete');
  });

  it('ne lance pas deux chargements en parallele', async () => {
    const layer = base();
    let appels = 0;
    layer._loadRows = async () => { appels++; return [{ id: 1, latitude: 43, longitude: 5 }]; };
    materializeDeferredLayer(layer);
    materializeDeferredLayer(layer);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(appels, 1);
  });

  it('un echec de chargement laisse la couche rechargeable', async () => {
    const layer = base();
    layer._loadRows = async () => { throw new Error('table absente'); };
    materializeDeferredLayer(layer);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(layer._deferredFetching, false, 'le verrou doit etre relache');
    assert.equal(layer._deferredLoad, true, 'la couche reste a charger');
  });
});
