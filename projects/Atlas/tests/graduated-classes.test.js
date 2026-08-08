import test from 'node:test';
import assert from 'node:assert/strict';
import { classBounds, graduatedStops, recolorStops } from '../lib/declarative-style.js';

const VERTS = ['#e5f5e0', '#a1d99b', '#41ab5d', '#238b45', '#005a32'];
const BLEUS = ['#deebf7', '#9ecae1', '#4292c6', '#2171b5', '#084594'];

/* ---------- bornes ---------- */

test('linéaire : des classes d’égale largeur', () => {
  const b = classBounds(0, 100, 4, 'linear');
  assert.deepEqual(b.map((x) => [x.lower, x.upper]), [[0, 25], [25, 50], [50, 75], [75, 100]]);
});

test('log : les petites valeurs sont resserrées', () => {
  // Cas réel CRESO : nb_bat va de 1 à 134, l'immense majorité des mailles en
  // ayant 1 ou 2. En linéaire, tout tombe dans la première classe.
  const b = classBounds(1, 134, 5, 'log');
  assert.ok(b[0].upper < 5, `première classe trop large : ${b[0].upper}`);
  assert.ok(b[4].lower > 40, `dernière classe trop basse : ${b[4].lower}`);
});

test('racine : intermédiaire entre linéaire et log', () => {
  const lin = classBounds(1, 134, 5, 'linear')[0].upper;
  const sqrt = classBounds(1, 134, 5, 'sqrt')[0].upper;
  const log = classBounds(1, 134, 5, 'log')[0].upper;
  assert.ok(log < sqrt && sqrt < lin, `attendu log < sqrt < linéaire, obtenu ${log} ${sqrt} ${lin}`);
});

test('les bornes extrêmes collent aux valeurs réelles', () => {
  // Sans cela, une entité au minimum ou au maximum tomberait hors classe et
  // prendrait la couleur de repli.
  for (const m of ['linear', 'log', 'sqrt']) {
    const b = classBounds(1, 134, 5, m);
    assert.equal(b[0].lower, 1, m);
    assert.equal(b[b.length - 1].upper, 134, m);
  }
});

test('les classes sont contiguës, sans trou ni recouvrement', () => {
  const b = classBounds(1, 134, 5, 'log');
  for (let i = 1; i < b.length; i++) assert.equal(b[i].lower, b[i - 1].upper);
});

test('cas dégénérés', () => {
  assert.deepEqual(classBounds(5, 5, 4, 'linear'), [{ lower: 5, upper: 5 }]);
  assert.deepEqual(classBounds(NaN, 10, 4), []);
  assert.equal(classBounds(0, 10, 0).length, 1);
});

/* ---------- recoloriage ---------- */

test('changer de palette ne touche pas au découpage', () => {
  // C'est le défaut observé : la légende passait au bleu, la carte restait
  // verte, parce que le rendu lisait la couleur des classes existantes.
  const avant = graduatedStops(1, 134, VERTS, 'log');
  const apres = recolorStops(avant, BLEUS);
  assert.deepEqual(apres.map((s) => s.color), BLEUS);
  assert.deepEqual(
    apres.map((s) => [s.lower, s.upper]),
    avant.map((s) => [s.lower, s.upper]),
    'les bornes doivent survivre au changement de palette',
  );
});

test('recoloriage avec un nombre de couleurs différent', () => {
  const stops = graduatedStops(0, 100, VERTS, 'linear'); // 5 classes
  const out = recolorStops(stops, ['#000', '#fff']);     // 2 couleurs
  assert.equal(out.length, 5, 'le nombre de classes ne change pas');
  assert.equal(out[0].color, '#000');
  assert.equal(out[4].color, '#fff');
});

test('recoloriage sans palette : rien ne change', () => {
  const stops = graduatedStops(0, 100, VERTS, 'linear');
  assert.deepEqual(recolorStops(stops, []), stops);
  assert.deepEqual(recolorStops(stops, null), stops);
});

test('recoloriage d’une liste vide', () => {
  assert.deepEqual(recolorStops([], BLEUS), []);
  assert.deepEqual(recolorStops(null, BLEUS), []);
});

/* ---------- classes complètes ---------- */

test('autant de classes que de couleurs dans la palette', () => {
  assert.equal(graduatedStops(1, 134, VERTS, 'log').length, VERTS.length);
});

test('chaque classe porte bornes, couleur et opacité', () => {
  const [s] = graduatedStops(1, 134, BLEUS, 'linear');
  assert.equal(typeof s.lower, 'number');
  assert.equal(typeof s.upper, 'number');
  assert.equal(s.color, BLEUS[0]);
  assert.equal(s.opacity, 1);
});

test('palette vide : aucune classe plutôt qu’un rendu faux', () => {
  assert.deepEqual(graduatedStops(1, 134, [], 'log'), []);
});
