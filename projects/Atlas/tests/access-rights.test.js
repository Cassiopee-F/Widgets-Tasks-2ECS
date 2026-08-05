/**
 * Tests Atlas v7 — le mode d'ouverture suit les droits Grist.
 * node --test projects/Atlas/tests/access-rights.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gristGrantFromSearch, resolveAccess, decodeAccessToken, initialsFrom } from '../lib/view-mode.js';

describe('gristGrantFromSearch', () => {
  it('lit ce que Grist transmet reellement', () => {
    // URL observee en production
    const g = gristGrantFromSearch('?access=full&readonly=false&culture=fr-FR&currency=USD');
    assert.deepEqual(g, { readonly: false, access: 'full' });
  });

  it('distingue « non transmis » de « false »', () => {
    assert.equal(gristGrantFromSearch('?access=full').readonly, null);
    assert.equal(gristGrantFromSearch('?readonly=false').readonly, false);
  });

  it('accepte les ecritures usuelles du booleen', () => {
    for (const v of ['true', 'TRUE', '1', 'yes']) {
      assert.equal(gristGrantFromSearch(`?readonly=${v}`).readonly, true, v);
    }
  });
});

describe('resolveAccess — les droits Grist font autorite', () => {
  it('editeur : ecriture accordee sans sonder', () => {
    const r = resolveAccess({ search: '?access=full&readonly=false' });
    assert.equal(r.viewMode, false);
    assert.equal(r.needsProbe, false, 'inutile de sonder quand Grist a repondu');
  });

  it('document partage en lecture : mode visite, sans connexion ni parametre', () => {
    const r = resolveAccess({ search: '?access=read%20table&readonly=true' });
    assert.equal(r.viewMode, true);
    assert.equal(r.requiredAccess, 'read table');
  });

  it('lecteur authentifie non editeur : lecture', () => {
    assert.equal(resolveAccess({ search: '?access=full&readonly=true' }).viewMode, true);
  });

  it('?mode= ne peut PAS octroyer l\'ecriture', () => {
    // Quelqu'un ajoute mode=edit sur un document ou il est lecteur.
    const r = resolveAccess({ search: '?access=read%20table&readonly=true&mode=edit' });
    assert.equal(r.viewMode, true, 'les droits Grist priment sur l\'URL');
    assert.equal(r.reason, 'grist-readonly');
  });

  it('?mode=view peut restreindre un editeur qui previsualise', () => {
    const r = resolveAccess({ search: '?access=full&readonly=false&mode=view' });
    assert.equal(r.viewMode, true);
    assert.equal(r.reason, 'mode-view');
  });

  it('rien de transmis : on retombe sur la sonde', () => {
    const r = resolveAccess({ search: '' });
    assert.equal(r.needsProbe, true);
    assert.equal(r.viewMode, false);
  });

  it('access=none : lecture', () => {
    assert.equal(resolveAccess({ search: '?access=none' }).viewMode, true);
  });
});

describe('decodeAccessToken — base64url', () => {
  const mk = (payload) => {
    const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${b64u({ alg: 'HS256' })}.${b64u(payload)}.sig`;
  };

  it('decode une charge utile simple', () => {
    assert.equal(decodeAccessToken(mk({ userId: 42 })).userId, 42);
  });

  it('decode une charge utile contenant - et _ apres encodage', () => {
    // Payload choisi pour produire des caracteres base64url : sans la
    // conversion, atob leve et l'identification tombe en silence.
    const p = { userId: 7, docId: 'g6MXJMbjseTn', scope: '~?~>>>???' };
    const jeton = mk(p);
    assert.ok(/[-_]/.test(jeton.split('.')[1]), 'le test doit bien exercer base64url');
    assert.equal(decodeAccessToken(jeton).userId, 7);
    assert.equal(decodeAccessToken(jeton).docId, 'g6MXJMbjseTn');
  });

  it('null sur un jeton absent ou malforme', () => {
    assert.equal(decodeAccessToken(null), null);
    assert.equal(decodeAccessToken('abc'), null);
    assert.equal(decodeAccessToken('a.b.c'), null);
  });
});

describe('initiales affichees', () => {
  it('initiales — nom compose, nom pointe, repli sur l\'email', () => {
    assert.equal(initialsFrom('Quentin Leroy', null), 'QL');
    assert.equal(initialsFrom('nicolas.laval', null), 'NL');
    assert.equal(initialsFrom(null, 'marie.dupont@cerema.fr'), 'MD');
    assert.equal(initialsFrom('Cher', null), 'C');
    assert.equal(initialsFrom(null, null), null);
  });
});
