const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../runtime/engine.js');
const SessionContext = require('../shared/session-context.js');

describe('SessionContext', () => {
  it('groupsForEmail', () => {
    const rows = [
      { Email: 'a@x.fr', Groupe: 'terrain' },
      { Email: 'A@X.FR', Groupe: 'direction' },
      { Email: 'b@x.fr', Groupe: 'terrain' }
    ];
    assert.deepEqual(
      SessionContext.groupsForEmail(rows, 'Email', 'Groupe', 'a@x.fr').sort(),
      ['direction', 'terrain']
    );
  });

  it('probe forceContext', async () => {
    const ctx = await SessionContext.probe({}, {}, {
      forceContext: { inGristWidget: true, userEmail: 'u@t.fr', isLoggedIn: true, groups: ['g'] }
    });
    assert.equal(ctx.userEmail, 'u@t.fr');
    assert.equal(ctx.inGristWidget, true);
  });
});

describe('evaluateCondition context / audience', () => {
  it('context.inGristWidget', () => {
    const c = { source: 'context', path: 'inGristWidget', operator: '==', value: true };
    assert.equal(Engine.evaluateCondition(c, {}, { inGristWidget: true }), true);
    assert.equal(Engine.evaluateCondition(c, {}, { inGristWidget: false }), false);
  });

  it('raccourci field context.*', () => {
    const c = { field: 'context.isLoggedIn', operator: '==', value: true };
    assert.equal(Engine.evaluateCondition(c, {}, { isLoggedIn: true }), true);
  });

  it('audience email in list', () => {
    const c = { source: 'audience', path: 'email', operator: 'in', value: ['a@x.fr', 'b@x.fr'] };
    assert.equal(Engine.evaluateCondition(c, {}, { userEmail: 'A@X.FR' }), true);
    assert.equal(Engine.evaluateCondition(c, {}, { userEmail: 'z@x.fr' }), false);
  });

  it('audience group in', () => {
    const c = {
      source: 'audience',
      path: 'group',
      operator: 'in',
      value: ['terrain'],
      bind: { groups: ['terrain'] }
    };
    assert.equal(Engine.evaluateCondition(c, {}, { groups: ['direction', 'terrain'] }), true);
    assert.equal(Engine.evaluateCondition(c, {}, { groups: ['direction'] }), false);
  });

  it('legacy field inchangé', () => {
    assert.equal(
      Engine.evaluateCondition({ field: 'A', operator: '==', value: 1 }, { A: 1 }, {}),
      true
    );
  });
});
