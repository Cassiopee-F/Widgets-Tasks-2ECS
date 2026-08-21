import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estVitrine, detecterMode, peutSAuthentifier, capacites, recordsVersColonnes, creerClient, estEncadre,
} from '../lib/data-client.js';

/** Une fenetre de widget : encadree, avec l'API plugin. */
const widget = (extra = {}) => {
  const top = {};
  const w = { grist: { docApi: {} }, top, ...extra };
  w.self = w;
  return w;
};
/** Une fenetre d'application : au premier plan. Le script plugin peut y etre. */
const appli = (extra = {}) => {
  const w = { grist: { docApi: {} }, ...extra };
  w.self = w; w.top = w;
  return w;
};

/* ---------- ou tourne-t-on ---------- */

test('sans API plugin, c est une application', () => {
  assert.equal(detecterMode({}), 'rest');
  // Un `grist` sans `docApi` n'est pas davantage un widget.
  assert.equal(detecterMode({ grist: {} }), 'rest');
});

test('l API plugin seule ne prouve rien : Atlas la charge partout', () => {
  // Constate en ouvrant Atlas dans un onglet : `grist-plugin-api.js` installe
  // `window.grist` meme hors document, et ses appels echouent ensuite en
  // « RPC_UNKNOWN_FORWARD_DEST ». S'y fier faisait croire a un widget partout,
  // et l'accueil ne s'affichait jamais.
  assert.equal(detecterMode(appli()), 'rest');
  assert.equal(detecterMode(widget()), 'grist');
});

test('l encadrement tranche, et le doute penche vers le widget', () => {
  assert.equal(estEncadre(appli()), false);
  assert.equal(estEncadre(widget()), true);
  // Une fenetre parente inaccessible : on se sait encadre.
  const piege = { grist: { docApi: {} } };
  Object.defineProperty(piege, 'top', { get() { throw new Error('cross-origin'); } });
  piege.self = piege;
  assert.equal(estEncadre(piege), true);
  assert.equal(detecterMode(piege), 'grist');
});

/* ---------- ce que l environnement autorise ---------- */

test('en navigateur, l ecriture est impossible et il faut le dire', () => {
  // CORS mesure : `Authorization` n'est pas dans Access-Control-Allow-Headers.
  const c = capacites({});
  assert.equal(c.ecriture, false);
  assert.equal(c.decouverte, false);
  assert.ok(c.raison, 'une capacite refusee doit etre expliquee');
});

test('dans l application installee, tout redevient possible', () => {
  // CapacitorHttp emet les requetes hors du moteur web : plus de controle prealable.
  const natif = { Capacitor: { isNativePlatform: () => true } };
  assert.equal(peutSAuthentifier(natif), true);
  const c = capacites(natif);
  assert.equal(c.ecriture, true);
  assert.equal(c.decouverte, true);
  assert.equal(c.raison, null);
});

test('Capacitor en mode web ne suffit pas', () => {
  // Le piege de l'empaquetage : sans plateforme native, `fetch` reste dans la
  // WebView et CORS s'applique malgre la presence de Capacitor.
  assert.equal(peutSAuthentifier({ Capacitor: { isNativePlatform: () => false } }), false);
});

test('dans Grist, l ecriture est permise et la decouverte sans objet', () => {
  const c = capacites(widget());
  assert.equal(c.mode, 'grist');
  assert.equal(c.ecriture, true);
  assert.equal(c.decouverte, false, 'un widget ne voit qu un document, le sien');
});

/* ---------- conversion REST -> format plugin ---------- */

test('les enregistrements REST prennent la forme colonnaire du plugin', () => {
  // Sans cette conversion, tout le code de lecture d'Atlas serait a doubler.
  const col = recordsVersColonnes([
    { id: 3, fields: { nom: 'Nord', surface: 12 } },
    { id: 7, fields: { nom: 'Sud', surface: 40 } },
  ]);
  assert.deepEqual(col.id, [3, 7]);
  assert.deepEqual(col.nom, ['Nord', 'Sud']);
  assert.deepEqual(col.surface, [12, 40]);
});

test('un champ absent devient null, il ne decale pas la colonne', () => {
  // Le decalage serait pire que l'absence : les lignes ne correspondraient plus.
  const col = recordsVersColonnes([
    { id: 1, fields: { a: 'x' } },
    { id: 2, fields: { a: 'y', b: 'z' } },
  ]);
  assert.deepEqual(col.id, [1, 2]);
  assert.deepEqual(col.a, ['x', 'y']);
  assert.deepEqual(col.b, [null, 'z']);
});

test('table vide', () => {
  assert.deepEqual(recordsVersColonnes([]), { id: [] });
});

/* ---------- le client REST ---------- */

test('le jeton n est envoye que s il existe', async () => {
  const vus = [];
  const faux = async (url, opt) => {
    vus.push({ url, auth: opt?.headers?.Authorization || null });
    return { ok: true, json: async () => ({ records: [] }) };
  };
  const anonyme = await creerClient({ mode: 'rest', baseUrl: 'https://x.fr/', docId: 'D1', fetch: faux });
  await anonyme.fetchTable('Atlas_Story');
  assert.equal(vus[0].auth, null, 'sans jeton, la requete doit rester simple');

  const signe = await creerClient({ mode: 'rest', baseUrl: 'https://x.fr', docId: 'D1', jeton: 'K', fetch: faux });
  await signe.fetchTable('Atlas_Story');
  assert.equal(vus[1].auth, 'Bearer K');
});

test('l adresse est construite sans double barre', async () => {
  let vue = '';
  const faux = async (url) => { vue = url; return { ok: true, json: async () => ({ tables: [] }) }; };
  const c = await creerClient({ mode: 'rest', baseUrl: 'https://x.fr///', docId: 'D1', fetch: faux });
  await c.listTables();
  assert.equal(vue, 'https://x.fr/api/docs/D1/tables');
});

test('une erreur HTTP porte le code et le message', async () => {
  const faux = async () => ({ ok: false, status: 403, text: async () => '{"error":"Blocked by table update access rules"}' });
  const c = await creerClient({ mode: 'rest', baseUrl: 'https://x.fr', docId: 'D1', fetch: faux });
  await assert.rejects(() => c.listTables(), /403.*access rules/);
});

test('le mode widget delegue a l API plugin', async () => {
  const appels = [];
  const portee = widget(); portee.grist = { docApi: {
    listTables: async () => { appels.push('listTables'); return ['A']; },
    fetchTable: async (t) => { appels.push('fetch:' + t); return { id: [] }; },
    applyUserActions: async (a) => { appels.push('apply:' + a.length); return {}; },
  } };
  const c = await creerClient({ portee });
  await c.listTables();
  await c.fetchTable('Atlas_Story');
  await c.applyUserActions([['AddRecord', 'T', null, {}]]);
  assert.deepEqual(appels, ['listTables', 'fetch:Atlas_Story', 'apply:1']);
});

test('une vitrine qui encadre le widget n’est pas un document', () => {
  // La page de presentation charge le widget dans une iframe, comme Grist. Le
  // widget n'a aucun moyen de les distinguer — meme encadrement, meme script de
  // plugin charge — et partirait interroger un document inexistant.
  const portee = {
    grist: { docApi: {} },
    self: {}, top: {},                      // encadre
    location: { search: '?vitrine=1' },
  };
  assert.equal(detecterMode(portee), 'rest');
  assert.equal(estVitrine(portee), true);
});

test('sans le parametre, un widget encadre reste un widget', () => {
  const portee = { grist: { docApi: {} }, self: {}, top: {}, location: { search: '' } };
  assert.equal(detecterMode(portee), 'grist');
  assert.equal(estVitrine(portee), false);
  assert.equal(estVitrine({}), false, 'une portee sans location ne fait pas echouer');
});
