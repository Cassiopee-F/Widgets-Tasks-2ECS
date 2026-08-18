import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INTENSITE_JOUR, couleurLumiere, intensiteLumiere, voileNocturne,
} from '../lib/night-readability.js';

/* ---------- voile nocturne ---------- */

test('ambiance pleine : le voile est intact', () => {
  // Reglage a 0 = comportement d'origine, aucune regression sur les scenes
  // existantes.
  assert.equal(voileNocturne(0.62, 0), 0.62);
});

test('lisibilite maximale : plus aucun voile', () => {
  // La nuit reste lisible par le ciel, les ombres et la couleur des lumieres —
  // sans masquer la donnee.
  assert.equal(voileNocturne(0.62, 1), 0);
});

test('reglage intermediaire : le voile s’attenue proportionnellement', () => {
  assert.ok(Math.abs(voileNocturne(0.62, 0.5) - 0.31) < 1e-9);
});

test('le voile ne devient jamais negatif', () => {
  assert.equal(voileNocturne(-0.2, 0), 0);
  assert.equal(voileNocturne(0, 1), 0);
});

test('valeurs aberrantes : repli sur du sens', () => {
  assert.equal(voileNocturne(NaN, 0.5), 0);
  assert.equal(voileNocturne(0.4, NaN), 0.4, 'reglage illisible = ambiance pleine');
  assert.equal(voileNocturne(0.4, 5), 0, 'reglage borne a 1');
  assert.equal(voileNocturne(0.4, -3), 0.4, 'reglage borne a 0');
});

/* ---------- eclairage des volumes ---------- */

test('de nuit, l’eclairage remonte au plancher demande', () => {
  // Mesure dans computeAmbient : 0,16 en pleine nuit — une grille graduee y
  // devient illisible.
  assert.equal(intensiteLumiere(0.16, 1), INTENSITE_JOUR);
  assert.ok(intensiteLumiere(0.16, 0.5) > 0.16);
});

test('de jour, le plancher ne change rien', () => {
  // Sans cette garde, forcer la lisibilite ecraserait le modele de la journee.
  assert.equal(intensiteLumiere(0.55, 1), 0.55);
  assert.equal(intensiteLumiere(0.8, 1), 0.8, 'une valeur superieure est conservee');
});

test('ambiance pleine : aucun plancher', () => {
  assert.equal(intensiteLumiere(0.16, 0), 0.16);
});

/* ---------- couleur d’eclairage ---------- */

test('la teinte nocturne est relevee vers le blanc', () => {
  // Une intensite suffisante dans un bleu nuit sature deteint encore sur la
  // symbologie : la couleur doit suivre l'intensite.
  assert.equal(couleurLumiere('#141c3c', 0), '#141c3c');
  assert.equal(couleurLumiere('#141c3c', 1), '#ffffff');
});

test('couleur illisible : laissee telle quelle', () => {
  assert.equal(couleurLumiere('rgb(1,2,3)', 0.5), 'rgb(1,2,3)');
  assert.equal(couleurLumiere(null, 0.5), null);
});

test('le blanc reste blanc', () => {
  assert.equal(couleurLumiere('#ffffff', 0.5), '#ffffff');
});
