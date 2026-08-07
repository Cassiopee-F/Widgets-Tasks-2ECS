import test from 'node:test';
import assert from 'node:assert/strict';
import { scanGeoTables } from '../lib/geo-tables.js';

/**
 * Faux docApi : enregistre les tables réellement demandées. C'est le point
 * qu'on protège — le scan ne doit toucher que les métadonnées, jamais les
 * données. Une régression ici coûte la totalité du document à chaque ouverture.
 */
function fauxDocApi(colonnesParTable) {
  const demandes = [];
  const tables = Object.keys(colonnesParTable);
  const meta = {
    _grist_Tables: {
      id: tables.map((_, i) => i + 1),
      tableId: tables,
    },
    _grist_Tables_column: {
      id: [],
      parentId: [],
      colId: [],
    },
  };
  tables.forEach((t, i) => {
    for (const col of colonnesParTable[t]) {
      meta._grist_Tables_column.id.push(meta._grist_Tables_column.id.length + 1);
      meta._grist_Tables_column.parentId.push(i + 1);
      meta._grist_Tables_column.colId.push(col);
    }
  });
  return {
    demandes,
    fetchTable: async (t) => {
      demandes.push(t);
      if (meta[t]) return meta[t];
      throw new Error(`le scan ne doit pas lire les données de ${t}`);
    },
  };
}

test('ne lit que les deux tables de métadonnées', async () => {
  const api = fauxDocApi({
    Batiments: ['id', 'geometry_json', 'hauteur'],
    Notes: ['id', 'texte'],
  });
  await scanGeoTables(api);
  assert.deepEqual(api.demandes.sort(), ['_grist_Tables', '_grist_Tables_column']);
});

test('retient les tables portant une colonne géométrique', async () => {
  const api = fauxDocApi({
    Batiments: ['id', 'geometry_json'],
    Notes: ['id', 'texte'],
  });
  const out = await scanGeoTables(api);
  assert.equal(out.length, 1);
  assert.equal(out[0].table, 'Batiments');
  assert.equal(out[0].geometryColumn, 'geometry_json');
});

test('reconnaît le couple latitude / longitude', async () => {
  const api = fauxDocApi({ Sites: ['id', 'latitude', 'longitude', 'nom'] });
  const out = await scanGeoTables(api);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].geometryColumn, { lat: 'latitude', lng: 'longitude' });
});

test('compte et type de géométrie inconnus — ils exigeraient les données', async () => {
  // L'interface doit les afficher comme inconnus plutôt que d'annoncer un zéro
  // qui serait faux.
  const api = fauxDocApi({ Sites: ['id', 'latitude', 'longitude'] });
  const [g] = await scanGeoTables(api);
  assert.equal(g.count, null);
  assert.equal(g.geomType, null);
});

test('écarte les tables système et les tables Atlas', async () => {
  const api = fauxDocApi({
    Atlas_Story: ['id', 'geometry_json'],
    SceneManifest: ['id', 'geometry_json'],
    GristHidden_import: ['id', 'geometry_json'],
    Utile: ['id', 'geometry_json'],
  });
  const out = await scanGeoTables(api);
  assert.deepEqual(out.map((g) => g.table), ['Utile']);
});

test('document sans table géo : liste vide, aucune erreur', async () => {
  const out = await scanGeoTables(fauxDocApi({ Notes: ['id', 'texte'] }));
  assert.deepEqual(out, []);
});

test('métadonnées illisibles : liste vide plutôt qu’exception', async () => {
  const out = await scanGeoTables({ fetchTable: async () => { throw new Error('403'); } });
  assert.deepEqual(out, []);
});

test('sans docApi : liste vide', async () => {
  assert.deepEqual(await scanGeoTables(null), []);
});
