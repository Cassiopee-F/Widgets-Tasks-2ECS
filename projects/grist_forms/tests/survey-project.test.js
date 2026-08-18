const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  formDefToSurveyManifest,
  surveyManifestToFormDef,
  mapQuestionType
} = require('../shared/survey-project.js');
const fixture = require('./fixtures/formdef-minimal.json');

it('projects title and questions', () => {
  const sm = formDefToSurveyManifest(fixture);
  assert.equal(sm.id, 'demo-contact');
  assert.equal(sm.sections[0].questions[0].colId, 'Nom');
  assert.equal(sm.sections[0].questions[0].type, 'text');
});

it('maps Attachments to attachment and preserves required', () => {
  const sm = formDefToSurveyManifest({
    manifest_version: '1.0.0',
    id: 'pj',
    title: 'PJ',
    classification: 'test',
    sections: [{
      id: 's1',
      label: 'Fichiers',
      gate: null,
      fields: [{
        colId: 'Piece',
        label: 'Pièce jointe',
        type: 'Attachments',
        widget: 'file',
        required: true,
        options: { maxFiles: 2, accept: 'image/*' }
      }]
    }],
    choices: {}
  });
  const q = sm.sections[0].questions[0];
  assert.equal(q.type, 'attachment');
  assert.equal(q.required, true);
  assert.equal(q.options.maxFiles, 2);
  assert.equal(q.options.accept, 'image/*');
});

it('maps Ref with grist meta', () => {
  assert.equal(mapQuestionType({ type: 'Ref', options: { refTable: 'T' } }), 'text');
  const sm = formDefToSurveyManifest({
    id: 'r', title: 'R', sections: [{
      id: 's', label: 'S', fields: [{
        colId: 'C', label: 'C', type: 'Ref', widget: 'select',
        options: { refTable: 'Clients', visibleCol: 'Nom' }
      }]
    }], choices: {}
  });
  assert.deepEqual(sm.sections[0].questions[0].grist, {
    type: 'Ref',
    refTable: 'Clients',
    visibleCol: 'Nom'
  });
});

it('roundtrip partiel SM → FormDef conserve attachment', () => {
  const def = {
    manifest_version: '1.0.0',
    id: 'round',
    title: 'Round',
    classification: 'c',
    tableId: 'T',
    composeMode: 'ensureSchema',
    sections: [{
      id: 's1', label: 'S', gate: 'Ok',
      fields: [
        { colId: 'Ok', label: 'OK', type: 'Bool', widget: 'checkbox', required: false, options: {} },
        { colId: 'Fic', label: 'Fichier', type: 'Attachments', widget: 'file', required: true, options: { maxFiles: 3 } }
      ]
    }],
    choices: {}
  };
  const sm = formDefToSurveyManifest(def);
  const back = surveyManifestToFormDef(sm, { tableId: 'T' });
  assert.equal(back.sections[0].gate, 'Ok');
  const fic = back.sections[0].fields.find(f => f.colId === 'Fic');
  assert.equal(fic.type, 'Attachments');
  assert.equal(fic.widget, 'file');
  assert.equal(fic.required, true);
  assert.equal(fic.options.maxFiles, 3);
});
