const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../shared/formulaires-table.js');
const fixture = require('./fixtures/formdef-minimal.json');

it('serializes Def JSON', () => {
  const fields = F.rowFromFormDef(fixture, { version: 1, statut: 'brouillon' });
  assert.equal(fields.FormId, 'demo-contact');
  assert.equal(fields.TableCible, 'Contacts');
  assert.equal(JSON.parse(fields.Def).id, 'demo-contact');
  assert.equal(fields.Version, 1);
});

it('plans AddTable for Formulaires', () => {
  const actions = F.planCreateFormulairesTable();
  assert.equal(actions.length, 1);
  assert.equal(actions[0][0], 'AddTable');
  assert.equal(actions[0][1], 'Formulaires');
  const cols = actions[0][2];
  assert.ok(Array.isArray(cols));
  const ids = cols.map((c) => c.id);
  assert.deepEqual(ids, [
    'Nom', 'FormId', 'Titre', 'TableCible', 'Version', 'Def',
    'Statut', 'PublishedSectionRef', 'UpdatedAt'
  ]);
});
