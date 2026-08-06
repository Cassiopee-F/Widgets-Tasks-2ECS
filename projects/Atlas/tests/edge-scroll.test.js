import test from 'node:test';
import assert from 'node:assert/strict';
import { edgeScrollStep, EDGE_ZONE_PX, EDGE_SPEED_MAX } from '../lib/edge-scroll.js';

const rect = { top: 100, bottom: 500 };

test('au repos au centre', () => {
  assert.equal(edgeScrollStep(rect, 300), 0);
});

test('juste hors de la bande : encore au repos', () => {
  assert.equal(edgeScrollStep(rect, 100 + EDGE_ZONE_PX), 0);
  assert.equal(edgeScrollStep(rect, 500 - EDGE_ZONE_PX), 0);
});

test('vers le haut près du bord supérieur', () => {
  const pas = edgeScrollStep(rect, 110);
  assert.ok(pas < 0, 'doit remonter');
  assert.ok(Math.abs(pas) <= EDGE_SPEED_MAX);
});

test('vers le bas près du bord inférieur', () => {
  const pas = edgeScrollStep(rect, 490);
  assert.ok(pas > 0, 'doit descendre');
});

test('vitesse croissante en approchant du bord', () => {
  assert.ok(Math.abs(edgeScrollStep(rect, 105)) > Math.abs(edgeScrollStep(rect, 125)));
});

test('pointeur sorti du conteneur : vitesse maximale, pas arrêt', () => {
  // Sortir de la liste pour aller plus vite est un geste courant ; s'arrêter
  // là serait exactement l'inverse de ce que l'utilisateur demande.
  assert.equal(edgeScrollStep(rect, 20), -EDGE_SPEED_MAX);
  assert.equal(edgeScrollStep(rect, 900), EDGE_SPEED_MAX);
});

test('conteneur trop court : aucun défilement', () => {
  // Deux bandes qui se recouvrent donneraient un sens arbitraire.
  assert.equal(edgeScrollStep({ top: 0, bottom: 40 }, 20), 0);
});

test('entrées invalides', () => {
  assert.equal(edgeScrollStep(null, 10), 0);
  assert.equal(edgeScrollStep(rect, NaN), 0);
  assert.equal(edgeScrollStep(rect, 300, 0), 0);
});
