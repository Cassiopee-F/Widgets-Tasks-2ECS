/**
 * Terrain Détections — Grist Adapter (lecture seule).
 */

(function () {
  'use strict';

  /**
   * Sommes-nous dans une iframe Grist ?
   *
   * Surtout pas `typeof grist !== 'undefined'` : le bundle
   * grist-plugin-api.js se termine par `grist = __webpack_exports__;` — une
   * affectation sans declaration, donc une globale posee des que le script se
   * charge, iframe ou pas. Tester sa presence rend la condition toujours vraie
   * hors Grist, `onRecords` ne se declenche jamais, et la page reste vide et
   * muette au lieu de basculer en demonstration.
   *
   * On teste donc le contexte, comme Atlas (`estEncadre`). En cas de doute —
   * un acces a `top` refuse pour cause d'origine differente — la reponse est
   * oui : cette exception ne se produit que si un parent existe.
   */
  function encadre() {
    try {
      if (window.self === undefined || window.top === undefined) return false;
      return window.self !== window.top;
    } catch (_) { return true; }
  }

  const IN_GRIST = encadre() && typeof grist !== 'undefined';

  const state = {
    ready:     false,
    colMap:    {},
    onRecords: null,
  };

  async function init(opts = {}) {
    if (!IN_GRIST) { console.warn('Terrain Détections : hors contexte Grist'); return false; }
    try {
      grist.ready({ requiredAccess: opts.access || 'read table' });
    } catch (_) {
      try { grist.ready(); } catch (__) {}
    }
    state.ready = true;

    grist.onRecords((records, mappings) => {
      state.colMap = mappings || {};
      if (typeof state.onRecords === 'function') state.onRecords(records || [], state.colMap);
    });

    return true;
  }

  function on(event, fn) {
    if (event === 'records') state.onRecords = fn;
  }

  window.TerrainDet = window.TerrainDet || {};
  window.TerrainDet.grist = { init, on, IN_GRIST, state };
})();
