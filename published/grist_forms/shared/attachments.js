/*
 * attachments.js — upload pièces jointes Grist via access token (custom widget).
 */
(function (root, factory) {
  'use strict';
  var asNode = typeof process !== 'undefined' && process.versions && process.versions.node;
  if (asNode && typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.FormAttachments = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function normalizeGristType(t) {
    if (!t) return 'Text';
    if (String(t).startsWith('RefList:')) return 'RefList';
    if (String(t).startsWith('Ref:')) return 'Ref';
    return t;
  }

  /** Réponse POST /attachments → liste d'ids numériques. */
  function normalizeUploadResponse(body) {
    if (body == null) return [];
    if (typeof body === 'number' && Number.isFinite(body)) return [body];
    if (typeof body === 'string' && /^\d+$/.test(body)) return [parseInt(body, 10)];
    if (Array.isArray(body)) {
      var out = [];
      body.forEach(function (x) {
        if (typeof x === 'number' && Number.isFinite(x)) out.push(x);
        else if (x && typeof x === 'object' && Number.isFinite(x.id)) out.push(x.id);
        else if (typeof x === 'string' && /^\d+$/.test(x)) out.push(parseInt(x, 10));
      });
      return out;
    }
    if (typeof body === 'object') {
      if (Array.isArray(body.ids)) return normalizeUploadResponse(body.ids);
      if (Number.isFinite(body.id)) return [body.id];
    }
    return [];
  }

  function isFileLike(x) {
    return x && typeof x === 'object' && typeof x.name === 'string' &&
      (typeof Blob !== 'undefined' ? x instanceof Blob || typeof x.size === 'number' : typeof x.size === 'number');
  }

  function filesFromValue(raw) {
    if (!raw) return [];
    if (typeof FileList !== 'undefined' && raw instanceof FileList) {
      return Array.prototype.slice.call(raw);
    }
    if (Array.isArray(raw)) return raw.filter(isFileLike);
    if (isFileLike(raw)) return [raw];
    // Déjà des ids (édition / après upload)
    if (Array.isArray(raw) && raw.every(function (x) { return Number.isFinite(Number(x)); })) {
      return [];
    }
    return [];
  }

  function idsFromValue(raw) {
    if (!raw) return [];
    if (Array.isArray(raw) && raw[0] === 'L') {
      return raw.slice(1).map(Number).filter(Number.isFinite);
    }
    if (Array.isArray(raw) && raw.every(function (x) {
      return Number.isFinite(Number(x)) && !isFileLike(x);
    })) {
      return raw.map(Number);
    }
    return [];
  }

  /**
   * @param {File[]|Blob[]} files
   * @param {{ getAccessToken: Function, fetch?: Function }} deps
   */
  function uploadFiles(files, deps) {
    deps = deps || {};
    var fetchFn = deps.fetch || (typeof fetch !== 'undefined' ? fetch.bind(typeof window !== 'undefined' ? window : globalThis) : null);
    var getToken = deps.getAccessToken;
    if (!files || !files.length) return Promise.resolve([]);
    if (typeof getToken !== 'function') {
      return Promise.reject(new Error('Upload de fichiers impossible : pas de jeton Grist (getAccessToken).'));
    }

    function postOne(tokenInfo, file) {
      var url = tokenInfo.baseUrl.replace(/\/$/, '') + '/attachments?auth=' + encodeURIComponent(tokenInfo.token);
      var formData = new FormData();
      formData.append('upload', file, file.name || 'fichier');

      // XHR d’abord (recommandé Grist / CORS custom widgets)
      if (typeof XMLHttpRequest !== 'undefined' && !deps.fetch) {
        return new Promise(function (resolve, reject) {
          var req = new XMLHttpRequest();
          req.open('POST', url, true);
          req.setRequestHeader('accept', 'application/json');
          req.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
          req.onload = function () {
            if (req.status < 200 || req.status >= 300) {
              reject(new Error('Échec upload (« ' + (file.name || 'fichier') + ' ») : HTTP ' + req.status));
              return;
            }
            try {
              var body = JSON.parse(req.responseText);
              var ids = normalizeUploadResponse(body);
              if (!ids.length) {
                reject(new Error('Réponse upload inattendue pour « ' + (file.name || 'fichier') + ' ».'));
                return;
              }
              resolve(ids);
            } catch (e) {
              reject(e);
            }
          };
          req.onerror = function () {
            reject(new Error('Échec réseau upload (« ' + (file.name || 'fichier') + ' »).'));
          };
          req.send(formData);
        });
      }

      if (!fetchFn) {
        return Promise.reject(new Error('Upload de fichiers impossible : fetch/XHR indisponible.'));
      }
      return fetchFn(url, {
        method: 'POST',
        body: formData,
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      }).then(function (res) {
        if (!res.ok) {
          return Promise.reject(new Error('Échec upload (« ' + (file.name || 'fichier') + ' ») : HTTP ' + res.status));
        }
        return res.json().then(function (body) {
          var ids = normalizeUploadResponse(body);
          if (!ids.length) {
            throw new Error('Réponse upload inattendue pour « ' + (file.name || 'fichier') + ' ».');
          }
          return ids;
        });
      });
    }

    return Promise.resolve(getToken({ readOnly: false })).then(function (tokenInfo) {
      if (!tokenInfo || !tokenInfo.baseUrl || !tokenInfo.token) {
        throw new Error('Jeton Grist invalide pour l\'upload.');
      }
      var chain = Promise.resolve([]);
      files.forEach(function (file) {
        chain = chain.then(function (acc) {
          return postOne(tokenInfo, file).then(function (ids) {
            return acc.concat(ids);
          });
        });
      });
      return chain;
    });
  }

  /**
   * Remplace les File[] des champs Attachments par des ids (in-place sur values).
   */
  function resolveAttachmentFields(formDef, values, deps) {
    values = values || {};
    var tasks = [];
    (formDef.sections || []).forEach(function (section) {
      (section.fields || []).forEach(function (field) {
        if (normalizeGristType(field.type) !== 'Attachments') return;
        var files = filesFromValue(values[field.colId]);
        var existing = idsFromValue(values[field.colId]);
        if (!files.length) {
          values[field.colId] = existing.length ? existing : null;
          return;
        }
        var max = (field.options && field.options.maxFiles) || 5;
        if (files.length > max) {
          tasks.push(Promise.reject(new Error(
            'Trop de fichiers pour « ' + field.label + ' » (max ' + max + ').'
          )));
          return;
        }
        tasks.push(uploadFiles(files, deps).then(function (ids) {
          values[field.colId] = existing.concat(ids);
        }));
      });
    });
    if (!tasks.length) return Promise.resolve(values);
    return Promise.all(tasks).then(function () { return values; });
  }

  return {
    normalizeUploadResponse: normalizeUploadResponse,
    filesFromValue: filesFromValue,
    idsFromValue: idsFromValue,
    uploadFiles: uploadFiles,
    resolveAttachmentFields: resolveAttachmentFields
  };
}));
