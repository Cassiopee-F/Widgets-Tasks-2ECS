import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  urlSceneDepuisParam, verifierFormeScene, deballerScene,
  chargerSceneExterne, sceneEstDeConfiance,
} from '../lib/scene-externe.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const lire = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/* ---------- l'adresse ---------- */

test('seul https est admis comme origine de scène', () => {
  assert.equal(urlSceneDepuisParam('?scene=https://h.fr/s.json').url, 'https://h.fr/s.json');

  // Un contenu sans origine ne peut être ni attribué, ni révoqué, ni recoupé ;
  // http laisserait un tiers réécrire la scène en chemin.
  // localhost est un contexte securise au sens du navigateur : rien ne
  // s'interpose. Le refuser n'ajouterait aucune surete et empecherait de mettre
  // au point une scene avant de la publier — donc pousserait a publier pour
  // essayer, ce qui est pire.
  assert.equal(urlSceneDepuisParam('?scene=' + encodeURIComponent('http://localhost:8908/s.json')).url,
    'http://localhost:8908/s.json');
  assert.ok(urlSceneDepuisParam('?scene=' + encodeURIComponent('http://127.0.0.1:99/s.json')).url);

  for (const mauvais of ['data:application/json,{}', 'blob:https://h.fr/x',
                         'http://h.fr/s.json', 'http://192.168.1.4/s.json',
                         'javascript:alert(1)']) {
    const r = urlSceneDepuisParam('?scene=' + encodeURIComponent(mauvais));
    assert.equal(r.url, null, mauvais + ' ne doit pas être admis');
    // Le refus doit se dire : sans message, l'auteur de l'adresse conclura a
    // un bug d'Atlas et cherchera au mauvais endroit.
    assert.match(r.refus || '', /refus|illisible/, mauvais + ' : refus muet');
  }
});

test('sans le paramètre, ni scène ni refus — le cas courant n’est pas une erreur', () => {
  for (const q of ['', '?', '?mode=view&readonly=1', '?scene=', '?scene=%20']) {
    const r = urlSceneDepuisParam(q);
    assert.equal(r.url, null);
    assert.equal(r.refus, null, `« ${q} » ne demande pas de scène, il n’y a rien à refuser`);
  }
});

/* ---------- la forme ---------- */

test('la garde de forme accepte les scènes réellement produites', () => {
  const dossier = path.join(ICI, 'fixtures');
  const fixtures = fs.readdirSync(dossier).filter((f) => /^scene-manifest.*\.json$/.test(f));
  assert.ok(fixtures.length >= 2, 'des scènes attestées doivent exister');
  for (const f of fixtures) {
    const scene = deballerScene(lire(path.join(dossier, f)));
    assert.deepEqual(verifierFormeScene(scene), [], `${f} refusée par la garde`);
  }
});

test('la garde refuse ce qui n’est pas une scène, et dit quoi', () => {
  const cas = [
    [null, /objet JSON/],
    ['une chaîne', /objet JSON/],
    [[], /objet JSON/],
    [{}, /version/],
    [{ version: '9.9', layers: [{ name: 'x' }] }, /non lue/],
    [{ version: '0.2.2' }, /layers/],
    [{ version: '0.2.2', layers: [] }, /vide/],
    [{ version: '0.2.2', layers: [{}] }, /ni « name » ni « id »/],
  ];
  for (const [entree, motif] of cas) {
    const e = verifierFormeScene(entree);
    assert.ok(e.length, `${JSON.stringify(entree)} aurait dû être refusé`);
    assert.match(e.join(' · '), motif);
  }
});

test('les trois enveloppes de sérialisation sont acceptées', () => {
  // Les producteurs sérialisent tantôt la scène nue, tantôt sous une clé. Les
  // trois formes existent dans les fixtures attestées.
  const nue = { version: '0.2.2', layers: [{ name: 'a' }] };
  assert.deepEqual(deballerScene(nue), nue);
  assert.deepEqual(deballerScene({ scene: nue }), nue);
  assert.deepEqual(deballerScene({ manifest: nue }), nue);
});

/* ---------- le chargement ---------- */

const scenette = { version: '0.2.2', layers: [{ name: 'Bâtiments' }] };
const repOk = (o) => ({ ok: true, status: 200, json: async () => o });

test('une scène chargée porte son origine et se déclare externe', async () => {
  const { manifest, echec } = await chargerSceneExterne('https://h.fr/s.json',
    { fetch: async () => repOk(scenette) });
  assert.equal(echec, null);
  assert.equal(manifest.externe, true);
  assert.equal(manifest._origine, 'https://h.fr/s.json');
  // Le drapeau est la seule chose qui distingue les deux régimes de confiance :
  // s'il ne voyage pas avec la scène, chaque appelant devra relire l'URL et
  // l'un d'eux oubliera.
  assert.equal(sceneEstDeConfiance(manifest), false);
  assert.equal(sceneEstDeConfiance({ version: '0.2.2' }), true, 'une scène du document, elle, l’est');
});

test('chaque échec de chargement se nomme, et aucun ne rend une scène vide', async () => {
  const cas = [
    ['réseau/CORS', async () => { throw new Error('Failed to fetch'); }, /injoignable|Access-Control/],
    ['HTTP 404',    async () => ({ ok: false, status: 404 }),            /HTTP 404/],
    ['pas du JSON', async () => ({ ok: true, status: 200, json: async () => { throw new Error('Unexpected token'); } }), /JSON/],
    ['pas une scène', async () => repOk({ bonjour: 1 }),                 /invalide/],
  ];
  for (const [nom, faux, motif] of cas) {
    const r = await chargerSceneExterne('https://h.fr/s.json', { fetch: faux });
    assert.equal(r.manifest, null, `${nom} : ne doit pas rendre de manifeste`);
    assert.match(r.echec || '', motif, `${nom} : message inexploitable`);
  }
});

test('un échec réseau nomme les deux causes possibles, pas une seule', async () => {
  // « Failed to fetch » couvre indistinctement le serveur muet et le CORS
  // manquant : le navigateur ne les sépare pas. N'en citer qu'une envoie
  // chercher le CORS d'un serveur qui ne répond même pas — vécu en éprouvant
  // la promotion, sur un serveur de test tombé.
  const { echec } = await chargerSceneExterne('https://h.fr/s.json',
    { fetch: async () => { throw new TypeError('Failed to fetch'); } });
  assert.match(echec, /ne répond pas/, 'la piste du serveur muet');
  assert.match(echec, /Access-Control-Allow-Origin/, 'et celle du refus d’origine');
});
