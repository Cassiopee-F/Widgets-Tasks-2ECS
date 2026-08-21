/**
 * Terrain Observations — Grist Adapter
 * Abstraction du plugin Grist (ready, onRecords, update).
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


  /* ------------------------------------------------------------------ *
   * Les droits du document, pas les notres                              *
   *                                                                     *
   * Deux niveaux, comme dans TaskFlow (`taskflow-core.js`) : le document
   * ouvert en lecture seule — Grist passe alors `readonly=true` dans
   * l'URL de l'iframe — et le refus au niveau d'une ligne, ou l'acces du
   * widget peut valoir `full` alors que le serveur refuse cette
   * ecriture-la. Le second ne se voit qu'a l'erreur renvoyee.
   * ------------------------------------------------------------------ */

  function parametre(nom) {
    try { return new URLSearchParams(location.search).get(nom); } catch (_) { return null; }
  }

  /** Grist a-t-il ouvert le widget en lecture seule ? */
  function lectureSeule() { return parametre('readonly') === 'true'; }

  /** Ce message d'erreur est-il un refus de droits, et non une panne ? */
  function refusDeDroits(e) {
    const m = (e && (e.message || String(e))) || '';
    return /access denied|not allowed|permission|forbidden|read[- ]?only|cannot (modify|add|remove)|acl/i.test(m);
  }

  /**
   * Le bandeau de lecture seule, sans markup a prevoir dans la page.
   *
   * Il pousse le contenu vers le bas plutot que de le recouvrir : masquer la
   * barre de titre pour annoncer une restriction serait un remede pire que le
   * mal.
   */
  function bandeauLectureSeule() {
    if (!lectureSeule() || document.getElementById('bandeau-lecture-seule')) return;
    const b = document.createElement('div');
    b.id = 'bandeau-lecture-seule';
    b.textContent = 'Lecture seule — vos droits ne permettent pas la modification';
    document.body.appendChild(b);
    document.body.classList.add('avec-bandeau');
  }

  const state = {
    ready:      false,
    colMap:     {},
    tableId:    null,
    onRecords:  null,
  };

  async function init(opts = {}) {
    if (!IN_GRIST) { console.warn('Terrain Observations : hors contexte Grist'); return false; }
    try {
      grist.ready({ requiredAccess: opts.access || 'full' });
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

  function mapCol(logical) {
    return state.colMap[logical] || logical;
  }

  async function updateRecord(id, fields) {
    if (!IN_GRIST) return { ok: false, horsGrist: true };
    if (lectureSeule()) {
      return { ok: false, refuse: true, message: 'Document ouvert en lecture seule' };
    }
    const mapped = {};
    for (const [k, v] of Object.entries(fields)) mapped[mapCol(k)] = v;
    try {
      await grist.getTable().update({ id, fields: mapped });
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        refuse: refusDeDroits(e),
        message: (e && (e.message || String(e))) || 'Erreur inconnue',
      };
    }
  }

  async function quickField(id, logicalCol, value) {
    return updateRecord(id, { [logicalCol]: value });
  }

  window.TerrainObs = window.TerrainObs || {};
  window.TerrainObs.grist = { init, on, mapCol, updateRecord, quickField, lectureSeule, bandeauLectureSeule, IN_GRIST, state };
})();
