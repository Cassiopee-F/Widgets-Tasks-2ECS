import test from 'node:test';
import assert from 'node:assert/strict';
import {
  controlUniqueValues, controlBounds, optionsDeclarees,
  filteredGeoJSON, expressionFiltreControles, buildControlPredicate,
} from '../lib/controls.js';
import { evaluer } from './aide-expressions.js';
import { applyManifestControlsToLayer } from '../lib/manifest-binding.js';
import { nFeaturesDeclare, champsDeclares } from '../lib/scene-loader.js';

/**
 * Une couche dont Atlas ne détient pas les entités.
 *
 * C'est le cas nominal d'une scène publiée : MapLibre va chercher le GeoJSON à
 * son adresse, Atlas ne le voit jamais passer. Tout ce qu'il sait du contenu,
 * le manifeste le lui a dit.
 */
const distante = (controls) => ({
  id: 'bati', name: 'Bâtiments', _distant: true,
  geojson: null, controls,
});

const locale = (features, controls = []) => ({
  id: 'bati', name: 'Bâtiments',
  geojson: { type: 'FeatureCollection', features },
  controls,
});

/* ---------- les choix d'un select ---------- */

test('sans entités, les choix viennent de ce que le manifeste déclare', () => {
  const l = distante([{ field: 'nature', type: 'select', options: ['Résidentiel', 'Industriel', 'Annexe'] }]);
  const vals = controlUniqueValues(l, 'nature', 40);
  assert.deepEqual(vals.map((v) => v.value), ['Résidentiel', 'Industriel', 'Annexe']);
});

test('un choix sans compte vaut null, jamais zéro', () => {
  // Zéro se lit « aucune entité ne porte cette valeur » — un renseignement.
  // Or on n'en sait rien : on n'a pas les entités. Les deux se ressemblent à
  // l'écran et n'envoient pas au même endroit.
  const l = distante([{ field: 'nature', type: 'select', options: ['A', 'B'] }]);
  for (const v of controlUniqueValues(l, 'nature', 40)) {
    assert.equal(v.count, null, `« ${v.value} » : un compte inventé est pire qu'aucun`);
  }
});

test('les entités locales priment sur la déclaration', () => {
  // La déclaration date de la production ; les entités sont ce qu'on a sous les
  // yeux. Quand les deux sont là, c'est la mesure qui gagne — et elle porte des
  // comptes, que la déclaration n'a pas.
  const l = locale(
    [{ properties: { nature: 'A' } }, { properties: { nature: 'A' } }, { properties: { nature: 'B' } }],
    [{ field: 'nature', type: 'select', options: ['X', 'Y', 'Z'] }],
  );
  const vals = controlUniqueValues(l, 'nature', 40);
  assert.deepEqual(vals, [{ value: 'A', count: 2 }, { value: 'B', count: 1 }]);
});

test('ni entités ni déclaration : une liste vide, pas une liste inventée', () => {
  assert.deepEqual(controlUniqueValues(distante([{ field: 'nature', type: 'select' }]), 'nature', 40), []);
  assert.equal(optionsDeclarees(distante([]), 'nature'), null);
});

/* ---------- les bornes d'un range ---------- */

test('sans entités, les bornes viennent du manifeste', () => {
  const l = distante([{ field: 'hauteur', type: 'range', dataMin: 1.4, dataMax: 20.2, min: 5, max: 15 }]);
  const b = controlBounds(l, 'range', 'hauteur');
  assert.equal(b.dataMin, 1.4, 'la borne observée à la production');
  assert.equal(b.dataMax, 20.2);
  assert.equal(b.min, 5, 'et la position du curseur, si elle est déclarée');
  assert.equal(b.max, 15);
  assert.ok(!b._bornesInconnues);
});

test('sans rien du tout, l’ignorance est signalée — 0 à 1 est plausible', () => {
  // Un curseur de hauteur qui irait de 0 à 1 m ne dit pas qu'il ne sait pas :
  // il propose un intervalle que rien ne distingue d'une vraie mesure.
  const b = controlBounds(distante([{ field: 'hauteur', type: 'range' }]), 'range', 'hauteur');
  assert.equal(b._bornesInconnues, true);
});

test('les bornes mesurées priment, et ne portent pas le drapeau', () => {
  const l = locale(
    [{ properties: { h: 3 } }, { properties: { h: 18 } }],
    [{ field: 'h', type: 'range', dataMin: 0, dataMax: 999 }],
  );
  const b = controlBounds(l, 'range', 'h');
  assert.deepEqual([b.dataMin, b.dataMax], [3, 18]);
  assert.ok(!b._bornesInconnues);
});

test('une borne déclarée absurde ne remplace pas une absence', () => {
  // dataMax <= dataMin ne fait pas un intervalle : mieux vaut avouer.
  const b = controlBounds(distante([{ field: 'h', type: 'range', dataMin: 7, dataMax: 7 }]), 'range', 'h');
  assert.equal(b._bornesInconnues, true);
});

/* ---------- bout en bout depuis le manifeste ---------- */

test('un contrôle du manifeste rend une couche distante filtrable', () => {
  // Le chemin complet : ce que le producteur écrit dans la scène doit suffire à
  // peupler le contrôle, puisque le consommateur n'a rien d'autre.
  const layer = { id: 'bati', _distant: true, geojson: null, controls: [] };
  applyManifestControlsToLayer(layer, {
    controls: [
      { field: 'nature', type: 'select', values: ['Résidentiel', 'Industriel'], label: 'Nature' },
      { field: 'hauteur', type: 'range', dataMin: 1.4, dataMax: 20.2 },
    ],
  });

  const nature = layer.controls.find((c) => c.field === 'nature');
  assert.deepEqual(nature.options, ['Résidentiel', 'Industriel']);
  assert.equal(nature.label, 'Nature');
  assert.deepEqual(controlUniqueValues(layer, 'nature', 40).map((v) => v.value),
    ['Résidentiel', 'Industriel']);

  const hauteur = layer.controls.find((c) => c.field === 'hauteur');
  assert.equal(hauteur.dataMin, 1.4);
  assert.equal(hauteur.dataMax, 20.2);
});

/* ---------- filtrer sans détenir les entités ---------- */

test('un contrôle actif n’efface pas une couche distante', () => {
  // `filteredGeoJSON` filtrait « ce qu'on a » : sur une couche dont `geojson`
  // est une adresse, cela rendait une collection vide, donc effaçait la couche
  // au premier contrôle activé. Un filtre qui supprime tout ressemble à un
  // filtre trop strict, et on va chercher l'erreur dans ses bornes.
  const l = distante([{ field: 'nature', type: 'select', active: true, values: ['A'], options: ['A', 'B'] }]);
  l.geojson = 'https://hub.example/couche.geojson';
  assert.equal(filteredGeoJSON(l), 'https://hub.example/couche.geojson',
    'l’adresse doit ressortir intacte');
});

test('l’expression de filtre et le prédicat classent pareil', () => {
  // Les deux servent la même scène selon qu'Atlas détient ses entités ou non.
  // Un écart donnerait deux cartes pour la même donnée et les mêmes réglages —
  // et on l'attribuerait à la donnée.
  const controls = [
    { field: 'nature', type: 'select', active: true, values: ['Résidentiel', 'ANNEXE'],
      options: ['Résidentiel', 'Industriel', 'Annexe'] },
    { field: 'hauteur', type: 'range', active: true, min: 5, max: 15, dataMin: 0, dataMax: 30 },
  ];
  const entites = [
    { properties: { nature: 'Résidentiel', hauteur: 8 } },      // dedans
    { properties: { nature: 'résidentiel', hauteur: 12 } },     // casse différente : dedans
    { properties: { nature: 'Annexe', hauteur: 5 } },           // sur la borne basse
    { properties: { nature: 'Annexe', hauteur: 15 } },          // sur la borne haute
    { properties: { nature: 'Industriel', hauteur: 8 } },       // nature écartée
    { properties: { nature: 'Résidentiel', hauteur: 30 } },     // hauteur écartée
    { properties: { nature: 'Résidentiel', hauteur: 'NULL' } },  // valeur illisible
    { properties: { nature: 'Résidentiel' } },                   // hauteur absente
  ];
  const layer = locale(entites, controls);
  const pred = buildControlPredicate(layer);
  const expr = expressionFiltreControles(layer);
  assert.ok(expr, 'des contrôles actifs doivent produire une expression');

  entites.forEach((f, i) => {
    assert.equal(evaluer(expr, f.properties), !!pred(f),
      `divergence sur l’entité ${i} : ${JSON.stringify(f.properties)}`);
  });
});

test('requireValue écarte les entités muettes, des deux côtés', () => {
  // Sans lui, une entité sans mesure passe le filtre et reçoit la couleur de
  // repli, qui recouvre alors la thématique.
  const controls = [{ field: 'h', type: 'range', active: true, min: 0, max: 100, requireValue: true }];
  const entites = [{ properties: { h: 42 } }, { properties: { h: 'NULL' } }, { properties: {} }];
  const layer = locale(entites, controls);
  const pred = buildControlPredicate(layer);
  const expr = expressionFiltreControles(layer);
  entites.forEach((f, i) => {
    assert.equal(evaluer(expr, f.properties), !!pred(f), `divergence sur l’entité ${i}`);
  });
  assert.equal(evaluer(expr, { h: 42 }), true);
  assert.equal(evaluer(expr, { h: 'NULL' }), false);
});

test('un select activé mais rien coché ne restreint rien', () => {
  // Sinon activer un contrôle viderait la carte avant tout choix, et on
  // croirait le filtre cassé.
  const l = distante([{ field: 'nature', type: 'select', active: true, options: ['A', 'B'] }]);
  assert.equal(expressionFiltreControles(l), null);
});

test('aucun contrôle actif : pas d’expression, donc pas de filtre à retirer', () => {
  const l = distante([{ field: 'nature', type: 'select', active: false, values: ['A'] }]);
  assert.equal(expressionFiltreControles(l), null);
});

/* ---------- ce que la couche déclare d'elle-même ---------- */

test('le compte se lit sous les deux clés, et il en existe deux', () => {
  // `featureCount` est la clé du contrat 0.2.2 ; `n_features` celle qu'écrit la
  // cascade de publication amont. N'en lire qu'une, c'est le pont rompu
  // classique : chacun fonctionne parfaitement de son côté.
  assert.equal(nFeaturesDeclare({ n_features: 400 }), 400);
  assert.equal(nFeaturesDeclare({ featureCount: 400 }), 400);
  assert.equal(nFeaturesDeclare({ featureCount: 0 }), 0, 'zéro déclaré est une réponse');
  assert.equal(nFeaturesDeclare({}), null, 'rien déclaré n’est pas zéro');
  assert.equal(nFeaturesDeclare({ n_features: 'beaucoup' }), null);
});

test('les champs déclarés remontent avec leur type Grist', () => {
  const f = champsDeclares({ fields: [
    { name: 'hauteur', label: 'Hauteur (m)', gType: 'Numeric' },
    { name: 'nature', gType: 'Choice' },
    { id: 'code' },
    null,
    { label: 'sans nom' },
  ] });
  assert.deepEqual(f, [
    { name: 'hauteur', label: 'Hauteur (m)', gType: 'Numeric' },
    { name: 'nature', label: 'nature', gType: 'Choice' },
    { name: 'code', label: 'code', gType: undefined },
  ]);
});

test('une couche sans fields déclarés ne fabrique pas de champs', () => {
  assert.deepEqual(champsDeclares({}), []);
  assert.deepEqual(champsDeclares({ fields: [] }), []);
  assert.deepEqual(champsDeclares(null), []);
});
