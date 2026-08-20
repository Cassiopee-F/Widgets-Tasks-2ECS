import test from 'node:test';
import assert from 'node:assert/strict';
import { saveStoryToGrist } from '../lib/story.js';

/** Faux docApi : enregistre les lots d'actions recus. */
function docApiFactice({ tables = ['Atlas_Story'], ids = [], echoueSur = null } = {}) {
  const lots = [];
  return {
    lots,
    listTables: async () => tables,
    fetchTable: async () => ({ id: ids }),
    applyUserActions: async (actions) => {
      lots.push(actions);
      if (echoueSur && actions.some((a) => a[0] === echoueSur)) {
        throw new Error('Blocked by table update access rules');
      }
      return { retValues: [] };
    },
  };
}

const recit = [{ title: 'Vue 1', text: 'a', state: { camera: null } }];

test('effacement et reecriture partent dans le meme lot', async () => {
  // En deux appels, le premier etait deja commis quand le second echouait :
  // un refus d'ACL au mauvais moment effacait le recit au lieu de le mettre a
  // jour. Grist applique une liste d'actions comme un tout.
  const api = docApiFactice({ ids: [1, 2, 3] });
  await saveStoryToGrist(api, recit, {});
  const ecritures = api.lots.filter((l) => l.some((a) => /Bulk/.test(a[0])));
  assert.equal(ecritures.length, 1, 'un seul lot, donc une seule transaction');
  assert.deepEqual(ecritures[0].map((a) => a[0]), ['BulkRemoveRecord', 'BulkAddRecord']);
});

test('un recit vide efface, sans reecrire', async () => {
  const api = docApiFactice({ ids: [1, 2] });
  await saveStoryToGrist(api, [], {});
  const ecritures = api.lots.filter((l) => l.some((a) => /Bulk/.test(a[0])));
  assert.deepEqual(ecritures[0].map((a) => a[0]), ['BulkRemoveRecord']);
});

test('table vide : rien a effacer, on ecrit seulement', async () => {
  const api = docApiFactice({ ids: [] });
  await saveStoryToGrist(api, recit, {});
  const ecritures = api.lots.filter((l) => l.some((a) => /Bulk/.test(a[0])));
  assert.deepEqual(ecritures[0].map((a) => a[0]), ['BulkAddRecord']);
});

test('l echec remonte a l appelant', async () => {
  // L'avaler laissait croire a un enregistrement qui n'avait pas eu lieu :
  // l'appelant doit pouvoir le signaler et basculer en lecture.
  const api = docApiFactice({ ids: [1], echoueSur: 'BulkRemoveRecord' });
  await assert.rejects(() => saveStoryToGrist(api, recit, {}), /access rules/);
});

test('un echec ne condamne pas les sauvegardes suivantes', async () => {
  // La chaine de sauvegardes est partagee : laissee en echec, plus rien ne
  // serait jamais enregistre ensuite.
  const casse = docApiFactice({ ids: [1], echoueSur: 'BulkRemoveRecord' });
  await saveStoryToGrist(casse, recit, {}).catch(() => {});
  const sain = docApiFactice({ ids: [] });
  await saveStoryToGrist(sain, recit, {});
  assert.ok(sain.lots.some((l) => l.some((a) => a[0] === 'BulkAddRecord')));
});

test('mode lecture : aucune ecriture', async () => {
  const api = docApiFactice({ ids: [1] });
  await saveStoryToGrist(api, recit, { viewMode: true });
  assert.equal(api.lots.length, 0);
});
