const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Ux = require('../shared/ux.js');

describe('FormUx', () => {
  it('slugify strips accents and spaces', () => {
    assert.equal(Ux.slugify('Nom complet'), 'Nom_complet');
    assert.equal(Ux.slugify('Été 2026'), 'Ete_2026');
  });

  it('tableNameFromTitle prefixes Reponses_', () => {
    assert.equal(Ux.tableNameFromTitle('Satisfaction client'), 'Reponses_Satisfaction_client');
  });

  it('isValidGristIdent rejects accents and spaces', () => {
    assert.equal(Ux.isValidGristIdent('Reponses_OK'), true);
    assert.equal(Ux.isValidGristIdent('Mes Réponses'), false);
    assert.equal(Ux.isValidGristIdent('1bad'), false);
  });

  it('humanizeBindingErrors translates choices', () => {
    const msgs = Ux.humanizeBindingErrors(['Champ « Note » : choices manquants pour Choice']);
    assert.ok(msgs[0].includes('option'));
    assert.ok(msgs[0].includes('Note'));
  });

  it('templates expose contact / satisfaction / inscription', () => {
    const ids = Ux.templates().map(t => t.id);
    assert.deepEqual(ids, ['contact', 'satisfaction', 'inscription']);
  });
});
