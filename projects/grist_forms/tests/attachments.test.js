const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Att = require('../shared/attachments.js');

describe('FormAttachments', () => {
  it('normalizeUploadResponse — id, array, objet', () => {
    assert.deepEqual(Att.normalizeUploadResponse(42), [42]);
    assert.deepEqual(Att.normalizeUploadResponse([1, 2]), [1, 2]);
    assert.deepEqual(Att.normalizeUploadResponse({ id: 9 }), [9]);
    assert.deepEqual(Att.normalizeUploadResponse({ ids: [3, 4] }), [3, 4]);
  });

  it('uploadFiles concatène les ids via fetch mock', async () => {
    const calls = [];
    const files = [
      new File(['a'], 'a.pdf', { type: 'application/pdf' }),
      new File(['b'], 'b.pdf', { type: 'application/pdf' })
    ];
    const ids = await Att.uploadFiles(files, {
      getAccessToken: async () => ({ baseUrl: 'https://g/doc', token: 'tok' }),
      fetch: async (url, opts) => {
        calls.push({ url, hasBody: !!opts.body });
        return {
          ok: true,
          json: async () => [calls.length + 10]
        };
      }
    });
    assert.deepEqual(ids, [11, 12]);
    assert.equal(calls.length, 2);
    assert.ok(calls[0].url.includes('auth=tok'));
  });

  it('simpleUpload (option H) : fetch sans en-tête X-Requested-With', async () => {
    const headersSeen = [];
    const files = [new File(['a'], 'h.txt', { type: 'text/plain' })];
    await Att.uploadFiles(files, {
      getAccessToken: async () => ({ baseUrl: 'https://g/doc', token: 'tok' }),
      simpleUpload: true,
      fetch: async (url, opts) => {
        headersSeen.push(opts.headers || {});
        return { ok: true, json: async () => [99] };
      }
    });
    assert.equal(headersSeen.length, 1);
    assert.equal(headersSeen[0]['X-Requested-With'], undefined);
    assert.equal(headersSeen[0].accept, 'application/json');
  });

  it('simpleUpload false : fetch avec X-Requested-With', async () => {
    const headersSeen = [];
    const files = [new File(['a'], 'b.txt', { type: 'text/plain' })];
    await Att.uploadFiles(files, {
      getAccessToken: async () => ({ baseUrl: 'https://g/doc', token: 'tok' }),
      simpleUpload: false,
      fetch: async (url, opts) => {
        headersSeen.push(opts.headers || {});
        return { ok: true, json: async () => [88] };
      }
    });
    assert.equal(headersSeen[0]['X-Requested-With'], 'XMLHttpRequest');
  });

  it('resolveAttachmentFields remplace File-like par ids', async () => {
    const values = {
      Piece: [new File(['x'], 'x.png', { type: 'image/png' })]
    };
    await Att.resolveAttachmentFields({
      sections: [{
        fields: [{ colId: 'Piece', label: 'Pièce', type: 'Attachments', widget: 'file' }]
      }]
    }, values, {
      getAccessToken: async () => ({ baseUrl: 'https://g', token: 't' }),
      fetch: async () => ({ ok: true, json: async () => [77] })
    });
    assert.deepEqual(values.Piece, [77]);
  });
});
