import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ECRANS, CLE_STOCKAGE, ecranInitial, estConfigComplete, normaliserConfig,
  validerConfig, lireConfig, ecrireConfig, oublier, depuis, situer,
} from '../lib/hote.js';

const stockageFactice = () => {
  const m = new Map();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
    _m: m,
  };
};
const caps = (o = {}) => ({ mode: 'rest', lecture: true, ecriture: true, decouverte: true, raison: null, ...o });

/* ---------- quel ecran ---------- */

test('dans Grist, l’hote ne s’affiche pas', () => {
  assert.equal(ecranInitial(caps({ mode: 'grist' }), null), ECRANS.WIDGET);
});

test('sans configuration, on demande instance et cle', () => {
  assert.equal(ecranInitial(caps(), null), ECRANS.CONNEXION);
  assert.equal(ecranInitial(caps(), { baseUrl: 'https://x.fr' }), ECRANS.CONNEXION);
});

test('configure sans document : on choisit une scene', () => {
  assert.equal(ecranInitial(caps(), { baseUrl: 'https://x.fr', jeton: 'K' }), ECRANS.SCENES);
});

test('une scene deja choisie ouvre Atlas directement', () => {
  assert.equal(ecranInitial(caps(), { baseUrl: 'https://x.fr', jeton: 'K', docId: 'D' }), ECRANS.ATLAS);
});

test('en navigateur, on ne demande pas une cle qui sera refusee', () => {
  // L'instance rejette `Authorization` au controle prealable : demander la cle
  // ferait echouer l'utilisateur sur une manoeuvre impossible.
  const e = ecranInitial(caps({ decouverte: false, ecriture: false, raison: 'CORS' }), null);
  assert.equal(e, ECRANS.IMPOSSIBLE);
});

/* ---------- ce que l’utilisateur tape ---------- */

test('une adresse sans protocole est completee', () => {
  // Sans schema, l'adresse serait lue comme un chemin relatif et echouerait
  // sans rien expliquer.
  assert.equal(
    normaliserConfig({ baseUrl: 'grist.numerique.gouv.fr' }).baseUrl,
    'https://grist.numerique.gouv.fr',
  );
});

test('espaces et barres finales sont absorbes', () => {
  const c = normaliserConfig({ baseUrl: '  https://x.fr///  ', jeton: '  K  ' });
  assert.equal(c.baseUrl, 'https://x.fr');
  assert.equal(c.jeton, 'K');
});

test('http explicite est respecte', () => {
  // Instance locale ou reseau interne : ne pas forcer https.
  assert.equal(normaliserConfig({ baseUrl: 'http://192.168.1.10:8484' }).baseUrl, 'http://192.168.1.10:8484');
});

test('ce qui manque est dit clairement', () => {
  assert.match(validerConfig({}).message, /adresse/i);
  assert.match(validerConfig({ baseUrl: 'x.fr' }).message, /cle API/i);
  assert.equal(validerConfig({ baseUrl: 'x.fr', jeton: 'K' }).ok, true);
});

test('estConfigComplete ignore le document', () => {
  assert.equal(estConfigComplete({ baseUrl: 'https://x.fr', jeton: 'K' }), true);
  assert.equal(estConfigComplete({ baseUrl: '  ', jeton: 'K' }), false);
});

/* ---------- memoire de l’appareil ---------- */

test('la cle est ecrite une fois, relue ensuite', () => {
  const s = stockageFactice();
  ecrireConfig(s, { baseUrl: 'x.fr', jeton: 'K', docId: 'D' });
  const c = lireConfig(s);
  assert.equal(c.baseUrl, 'https://x.fr');
  assert.equal(c.jeton, 'K');
  assert.equal(c.docId, 'D');
});

test('oublier efface vraiment', () => {
  // Une cle de portee compte doit pouvoir partir aussi simplement qu'elle est venue.
  const s = stockageFactice();
  ecrireConfig(s, { baseUrl: 'x.fr', jeton: 'K' });
  oublier(s);
  assert.equal(lireConfig(s), null);
  assert.equal(s._m.has(CLE_STOCKAGE), false);
});

test('un stockage illisible ou absent ne fait pas planter', () => {
  assert.equal(lireConfig(null), null);
  assert.equal(lireConfig({ getItem: () => 'pas du json' }), null);
  assert.equal(ecrireConfig(null, {}), false);
});

/* ---------- presentation ---------- */

test('la fraicheur se lit d’un coup d’oeil', () => {
  const T = Date.parse('2026-08-20T12:00:00Z');
  const q = (iso) => depuis(iso, T);
  assert.equal(q('2026-08-20T11:59:30Z'), 'a l’instant');
  assert.equal(q('2026-08-20T11:20:00Z'), 'il y a 40 min');
  assert.equal(q('2026-08-20T07:00:00Z'), 'il y a 5 h');
  assert.equal(q('2026-08-17T12:00:00Z'), 'il y a 3 j');
  assert.equal(q('2026-06-20T12:00:00Z'), 'il y a 2 mois');
  assert.equal(q('2024-08-20T12:00:00Z'), 'il y a 2 ans');
});

test('une date absente ou illisible ne montre rien', () => {
  assert.equal(depuis(null), '');
  assert.equal(depuis('hier'), '');
});

test('la situation tolere ce qui manque', () => {
  assert.equal(situer({ org: 'Cerema', espace: 'Etudes' }), 'Cerema · Etudes');
  assert.equal(situer({ org: 'Cerema' }), 'Cerema');
  assert.equal(situer({}), '');
});
