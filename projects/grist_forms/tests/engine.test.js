const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../runtime/engine.js');

describe('Engine conditions', () => {
  it('gate Bool hides section when false', () => {
    const sec = { id: 's2', gate: 'Concerne', fields: [] };
    assert.equal(Engine.isSectionVisible(sec, { Concerne: false }), false);
    assert.equal(Engine.isSectionVisible(sec, { Concerne: true }), true);
  });
  it('field condition ==', () => {
    const f = { colId: 'X', condition: { field: 'Type', operator: '==', value: 'A' } };
    assert.equal(Engine.isFieldVisible(f, { Type: 'A' }), true);
    assert.equal(Engine.isFieldVisible(f, { Type: 'B' }), false);
  });
});

describe('Engine.collectSubmitData', () => {
  it('omits hidden fields', () => {
    const def = {
      sections: [{
        id: 's1', gate: null, fields: [
          { colId: 'A', type: 'Text', widget: 'text', required: false },
          { colId: 'B', type: 'Text', widget: 'text', condition: { field: 'A', operator: '==', value: 'oui' } }
        ]
      }]
    };
    const data = Engine.collectSubmitData(def, { A: 'non', B: 'secret' });
    assert.deepEqual(data, { A: 'non' });
  });
});

describe('Engine.filterCascadeOptions', () => {
  it('filters by record id not array index', () => {
    const choices = [
      { value: 10, label: 'Nord' },
      { value: 20, label: 'Sud' }
    ];
    const refRecords = {
      id: [10, 20],
      name: ['Nord', 'Sud'],
      pays: [1, 2]
    };
    const out = Engine.filterCascadeOptions(choices, refRecords, 'pays', 2);
    assert.deepEqual(out, [{ value: 20, label: 'Sud' }]);
  });

  it('accepte parentValue string (select HTML) vs id number', () => {
    const choices = [
      { value: 10, label: 'Nord' },
      { value: 20, label: 'Sud' }
    ];
    const refRecords = { id: [10, 20], name: ['Nord', 'Sud'], pays: [1, 2] };
    const out = Engine.filterCascadeOptions(choices, refRecords, 'pays', '2');
    assert.deepEqual(out, [{ value: 20, label: 'Sud' }]);
  });

  it('liste vide si parent non choisi', () => {
    const choices = [{ value: 10, label: 'Nord' }];
    const refRecords = { id: [10], pays: [1] };
    assert.deepEqual(Engine.filterCascadeOptions(choices, refRecords, 'pays', null), []);
    assert.deepEqual(Engine.filterCascadeOptions(choices, refRecords, 'pays', ''), []);
  });
});

describe('Engine.resolveParentFilterValue', () => {
  const formDef = {
    sections: [{
      id: 's1', fields: [
        { colId: 'Groupe', type: 'Choice', widget: 'select' },
        {
          colId: 'Contact', type: 'Ref', widget: 'select',
          options: { refTable: 'Contacts', visibleCol: 'Nom' }
        },
        {
          colId: 'Autre', type: 'Ref', widget: 'select',
          options: { refTable: 'Contacts', visibleCol: 'Email' },
          dynamicFilter: {
            parentField: 'Contact',
            filterColumn: 'Groupe',
            parentResolve: 'refRow',
            parentValueColumn: 'Groupe'
          }
        }
      ]
    }]
  };
  const refRecords = {
    Contacts: {
      id: [1, 2, 3],
      Nom: ['Alice', 'Bob', 'Carol'],
      Groupe: ['Agents', 'Public', 'Agents']
    }
  };

  it('cas A : parentResolve value (défaut) retourne la valeur brute', () => {
    const field = {
      dynamicFilter: { parentField: 'Groupe', filterColumn: 'Groupe' }
    };
    assert.equal(
      Engine.resolveParentFilterValue(field, { Groupe: 'Agents' }, formDef, refRecords),
      'Agents'
    );
  });

  it('cas C : refRow lit la colonne sur la ligne parent', () => {
    const field = {
      dynamicFilter: {
        parentField: 'Contact',
        filterColumn: 'Groupe',
        parentResolve: 'refRow',
        parentValueColumn: 'Groupe'
      }
    };
    assert.equal(
      Engine.resolveParentFilterValue(field, { Contact: 1 }, formDef, refRecords),
      'Agents'
    );
    assert.equal(
      Engine.resolveParentFilterValue(field, { Contact: '2' }, formDef, refRecords),
      'Public'
    );
  });

  it('cas C : id manquant ou parent vide → null', () => {
    const field = {
      dynamicFilter: {
        parentField: 'Contact',
        filterColumn: 'Groupe',
        parentResolve: 'refRow',
        parentValueColumn: 'Groupe'
      }
    };
    assert.equal(Engine.resolveParentFilterValue(field, {}, formDef, refRecords), null);
    assert.equal(Engine.resolveParentFilterValue(field, { Contact: 99 }, formDef, refRecords), null);
  });
});
