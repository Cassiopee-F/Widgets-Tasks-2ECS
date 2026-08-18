/*
 * audience-setup.js — Configuration auto de la colonne email pour la probe session.
 * Formule déclenchée « à la création » : user.Email (trigger formula Grist).
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else if (typeof define === 'function' && define.amd) define([], factory);
  else root.AudienceSetup = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PROBE_EMAIL_FORMULA = 'user.Email';
  /** Hors 0/1/2 → formule uniquement sur les nouvelles lignes (API Grist). */
  var PROBE_RECALC_WHEN = 3;

  function normalizeFormula(f) {
    return String(f == null ? '' : f).replace(/\s+/g, '');
  }

  function isNewRecordsOnly(recalcWhen) {
    if (recalcWhen === 0 || recalcWhen === '0') return false;
    if (recalcWhen === 1 || recalcWhen === '1') return false;
    if (recalcWhen === 2 || recalcWhen === '2') return false;
    return true;
  }

  function isProbeTriggerConfigured(col) {
    if (!col || col.isFormula) return false;
    var f = normalizeFormula(col.formula);
    if (!f) return false;
    if (f !== 'user.Email') return false;
    return isNewRecordsOnly(col.recalcWhen);
  }

  function probeModifyFields() {
    return {
      formula: PROBE_EMAIL_FORMULA,
      isFormula: false,
      recalcWhen: PROBE_RECALC_WHEN
    };
  }

  /**
   * @returns {{ ok: boolean, alreadyConfigured?: boolean, reason?: string, actions: Array }}
   */
  function planProbeEmailSetup(tableId, emailCol, columns) {
    if (!tableId || !emailCol) {
      return { ok: false, reason: 'missing', actions: [] };
    }
    var col = (columns || []).find(function (c) { return c.colId === emailCol; });
    if (!col) {
      return { ok: false, reason: 'column_not_found', actions: [] };
    }
    if (col.isFormula) {
      return { ok: false, reason: 'formula_column', actions: [] };
    }
    if (isProbeTriggerConfigured(col)) {
      return { ok: true, alreadyConfigured: true, actions: [] };
    }
    return {
      ok: true,
      alreadyConfigured: false,
      actions: [['ModifyColumn', tableId, emailCol, probeModifyFields()]]
    };
  }

  return {
    PROBE_EMAIL_FORMULA: PROBE_EMAIL_FORMULA,
    PROBE_RECALC_WHEN: PROBE_RECALC_WHEN,
    isProbeTriggerConfigured: isProbeTriggerConfigured,
    probeModifyFields: probeModifyFields,
    planProbeEmailSetup: planProbeEmailSetup
  };
}));
