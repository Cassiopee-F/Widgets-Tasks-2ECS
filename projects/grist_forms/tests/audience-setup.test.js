'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const AS = require('../shared/audience-setup.js');

describe('audience-setup', () => {
  it('détecte une trigger formula user.Email (nouvelles lignes)', () => {
    assert.equal(AS.isProbeTriggerConfigured({
      colId: 'Email', isFormula: false, formula: 'user.Email', recalcWhen: 3
    }), true);
  });

  it('rejette colonne formule pure', () => {
    assert.equal(AS.isProbeTriggerConfigured({
      colId: 'Email', isFormula: true, formula: 'user.Email', recalcWhen: 3
    }), false);
  });

  it('rejette recalcWhen qui recalcule trop souvent', () => {
    assert.equal(AS.isProbeTriggerConfigured({
      colId: 'Email', isFormula: false, formula: 'user.Email', recalcWhen: 0
    }), false);
  });

  it('plan : déjà configuré → pas d’action', () => {
    const plan = AS.planProbeEmailSetup('Contacts', 'Email', [{
      colId: 'Email', isFormula: false, formula: 'user.Email', recalcWhen: 3
    }]);
    assert.equal(plan.ok, true);
    assert.equal(plan.alreadyConfigured, true);
    assert.equal(plan.actions.length, 0);
  });

  it('plan : applique ModifyColumn si besoin', () => {
    const plan = AS.planProbeEmailSetup('Contacts', 'Email', [{
      colId: 'Email', type: 'Text', isFormula: false, formula: ''
    }]);
    assert.equal(plan.ok, true);
    assert.equal(plan.alreadyConfigured, false);
    assert.equal(plan.actions.length, 1);
    assert.equal(plan.actions[0][0], 'ModifyColumn');
    assert.equal(plan.actions[0][1], 'Contacts');
    assert.equal(plan.actions[0][2], 'Email');
    assert.equal(plan.actions[0][3].formula, 'user.Email');
    assert.equal(plan.actions[0][3].isFormula, false);
    assert.equal(plan.actions[0][3].recalcWhen, 3);
  });
});
