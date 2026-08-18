const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  planEnsureSchema,
  columnsFromFormDef,
  bindingIsComplete,
  fieldToGristType,
  planVisibleColUpdates
} = require('../shared/ensure-schema.js');

it('plans AddColumn for missing', () => {
  const def = {
    tableId: 'Contacts',
    sections: [{ fields: [{ colId: 'Nom', type: 'Text' }, { colId: 'Age', type: 'Int' }] }]
  };
  const plan = planEnsureSchema(def, [{ id: 'Nom', type: 'Text' }]);
  assert.equal(plan.ok, true);
  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0][0], 'AddColumn');
  assert.equal(plan.actions[0][1], 'Contacts');
  assert.equal(plan.actions[0][2], 'Age');
});

it('plans Attachments column', () => {
  const def = {
    tableId: 'Demandes',
    sections: [{ fields: [{ colId: 'Piece', type: 'Attachments', label: 'PJ' }] }]
  };
  const plan = planEnsureSchema(def, [], { tableExists: false });
  assert.equal(plan.ok, true);
  assert.equal(plan.actions[0][0], 'AddTable');
  const cols = plan.actions[0][2];
  assert.equal(cols[0].type, 'Attachments');
  assert.equal(fieldToGristType({ type: 'Attachments' }), 'Attachments');
});

it('errors on incompatible type', () => {
  const def = {
    tableId: 'Contacts',
    sections: [{ fields: [{ colId: 'Nom', type: 'Int' }] }]
  };
  const plan = planEnsureSchema(def, [{ id: 'Nom', type: 'Text' }]);
  assert.equal(plan.ok, false);
  assert.ok(plan.errors[0].includes('Nom'));
});

it('rejects invalid table / column identifiers', () => {
  const def = {
    tableId: 'Mes Réponses!',
    sections: [{ fields: [{ colId: 'Nom', type: 'Text' }] }]
  };
  const plan = planEnsureSchema(def, [], { tableExists: false });
  assert.equal(plan.ok, false);
  assert.ok(plan.errors.some(e => /identifiant invalide/i.test(e)));
});

it('bindingIsComplete rejects Ref without refTable', () => {
  const def = {
    tableId: 'Demandes',
    sections: [{ fields: [{ colId: 'Region', type: 'Ref' }] }]
  };
  const b = bindingIsComplete(def);
  assert.equal(b.ok, false);
  assert.ok(b.errors.some(e => e.includes('refTable')));
});
it('fieldToGristType reads options.refTable', () => {
  assert.equal(
    fieldToGristType({ type: 'Ref', options: { refTable: 'Regions' } }),
    'Ref:Regions'
  );
});

it('plans AddTable when table missing (form → données)', () => {
  const def = {
    tableId: 'NouvellesDemandes',
    choices: { Statut: ['ouvert', 'clos'] },
    sections: [{
      fields: [
        { colId: 'Titre', type: 'Text', label: 'Titre' },
        { colId: 'Statut', type: 'Choice' },
        { colId: 'Region', type: 'Ref', refTable: 'Regions' }
      ]
    }]
  };
  const plan = planEnsureSchema(def, [], { tableExists: false });
  assert.equal(plan.ok, true);
  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0][0], 'AddTable');
  assert.equal(plan.actions[0][1], 'NouvellesDemandes');
  const cols = plan.actions[0][2];
  assert.equal(cols.length, 3);
  assert.equal(cols[1].type, 'Choice');
  assert.ok(cols[1].widgetOptions.includes('ouvert'));
  assert.equal(cols[2].type, 'Ref:Regions');
});

it('round-trip: columnsFromFormDef puis ensureSchema = no-op', () => {
  const def = {
    tableId: 'Contacts',
    choices: { Role: ['admin', 'user'] },
    sections: [{
      fields: [
        { colId: 'Nom', type: 'Text' },
        { colId: 'Role', type: 'Choice' },
        { colId: 'Org', type: 'Ref', options: { refTable: 'Orgs' } }
      ]
    }]
  };
  assert.equal(bindingIsComplete(def).ok, true);
  const projected = columnsFromFormDef(def);
  const existing = projected.map(c => ({ id: c.id, type: c.type }));
  const plan = planEnsureSchema(def, existing, { tableExists: true });
  assert.equal(plan.ok, true);
  assert.equal(plan.actions.length, 0);
});

it('planVisibleColUpdates maps Nom → colRef id', () => {
  const def = {
    tableId: 'Demandes',
    sections: [{
      fields: [{
        colId: 'Region',
        type: 'Ref',
        options: { refTable: 'Regions', visibleCol: 'Nom' }
      }]
    }]
  };
  const tables = [
    { id: 1, tableId: 'Regions' },
    { id: 2, tableId: 'Demandes' }
  ];
  const columns = [
    { id: 10, parentId: 1, colId: 'Nom', visibleCol: 0 },
    { id: 20, parentId: 2, colId: 'Region', visibleCol: 0 }
  ];
  const plan = planVisibleColUpdates(def, tables, columns);
  assert.equal(plan.ok, true);
  assert.equal(plan.actions.length, 1);
  assert.deepEqual(plan.actions[0], [
    'UpdateRecord', '_grist_Tables_column', 20, { visibleCol: 10 }
  ]);
});
