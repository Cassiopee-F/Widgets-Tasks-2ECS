const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../runtime/engine.js');
const FormUx = require('../shared/ux.js');

describe('evaluateCondition AND/OU', () => {
  it('règle simple', () => {
    assert.equal(Engine.evaluateCondition({ field: 'A', operator: '==', value: 'x' }, { A: 'x' }), true);
    assert.equal(Engine.evaluateCondition({ field: 'A', operator: '==', value: 'x' }, { A: 'y' }), false);
  });

  it('AND', () => {
    const c = {
      op: 'and',
      rules: [
        { field: 'A', operator: '==', value: 1 },
        { field: 'B', operator: '==', value: 'oui' }
      ]
    };
    assert.equal(Engine.evaluateCondition(c, { A: 1, B: 'oui' }), true);
    assert.equal(Engine.evaluateCondition(c, { A: 1, B: 'non' }), false);
  });

  it('OU', () => {
    const c = {
      op: 'or',
      rules: [
        { field: 'A', operator: '==', value: 'x' },
        { field: 'A', operator: '==', value: 'y' }
      ]
    };
    assert.equal(Engine.evaluateCondition(c, { A: 'y' }), true);
    assert.equal(Engine.evaluateCondition(c, { A: 'z' }), false);
  });
});

describe('section chemins', () => {
  it('condition section prime sur gate', () => {
    const sec = {
      gate: 'Flag',
      condition: { field: 'Type', operator: '==', value: 'Pro' }
    };
    assert.equal(Engine.isSectionVisible(sec, { Flag: true, Type: 'Perso' }), false);
    assert.equal(Engine.isSectionVisible(sec, { Flag: false, Type: 'Pro' }), true);
  });

  it('gate Bool legacy', () => {
    assert.equal(Engine.isSectionVisible({ gate: 'Ok' }, { Ok: false }), false);
    assert.equal(Engine.isSectionVisible({ gate: 'Ok' }, { Ok: true }), true);
  });
});

describe('filterDynamicOptions', () => {
  it('filtre par colonne != cascade Ref', () => {
    const choices = [
      { value: 1, label: 'A' },
      { value: 2, label: 'B' },
      { value: 3, label: 'C' }
    ];
    const records = {
      id: [1, 2, 3],
      Nom: ['A', 'B', 'C'],
      Type: ['Client', 'Prospect', 'Client']
    };
    const out = Engine.filterDynamicOptions(choices, records, 'Type', 'Client');
    assert.deepEqual(out.map(o => o.value), [1, 3]);
  });
});

describe('FormUx condition helpers', () => {
  it('compact / normalize roundtrip', () => {
    const simple = { field: 'X', operator: '==', value: 1 };
    const compound = FormUx.normalizeToCompound(simple);
    assert.equal(compound.op, 'and');
    assert.equal(compound.rules.length, 1);
    assert.deepEqual(FormUx.compactCondition(compound), simple);
  });

  it('detectRefColumn', () => {
    const cols = [
      { colId: 'Nom', type: 'Text' },
      { colId: 'Region', type: 'Ref:Regions' }
    ];
    assert.equal(FormUx.detectRefColumn(cols, 'Regions'), 'Region');
  });
});
