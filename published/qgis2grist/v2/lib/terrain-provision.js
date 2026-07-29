/**
 * Provisionne table Formulaires + config terrain après import QField.
 */
(function (root, factory) {
  const deps = factory();
  const api = deps.api;
  if (typeof module === 'object' && module.exports) {
    module.exports = { ...api, FormulairesTable: deps.FormulairesTable };
  } else {
    root.Q2GTerrain = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  let FormulairesTable;
  if (typeof require === 'function') {
    try { FormulairesTable = require('../../grist_forms/shared/formulaires-table.js'); } catch (e) { /* browser */ }
  }

  const TABLE = 'Formulaires';

  function planCreateFormulairesTable() {
    if (FormulairesTable) return FormulairesTable.planCreateFormulairesTable();
    return [[
      'AddTable', TABLE, [
        { id: 'Nom', type: 'Text', label: 'Nom' },
        { id: 'FormId', type: 'Text', label: 'FormId' },
        { id: 'Titre', type: 'Text', label: 'Titre' },
        { id: 'TableCible', type: 'Text', label: 'Table cible' },
        { id: 'Version', type: 'Int', label: 'Version' },
        { id: 'Def', type: 'Text', label: 'Def' },
        {
          id: 'Statut', type: 'Choice', label: 'Statut',
          widgetOptions: JSON.stringify({ choices: ['brouillon', 'publie', 'terrain'] }),
        },
        { id: 'PublishedSectionRef', type: 'Int', label: 'Section publiée' },
        { id: 'UpdatedAt', type: 'DateTime', label: 'Mis à jour' },
      ],
    ]];
  }

  function rowFromFormDef(def, meta) {
    if (FormulairesTable) return FormulairesTable.rowFromFormDef(def, meta);
    return {
      Nom: def.title || def.id,
      FormId: def.id,
      Titre: def.title || '',
      TableCible: def.tableId || '',
      Version: meta?.version ?? 0,
      Def: JSON.stringify(def),
      Statut: meta?.statut || 'terrain',
      UpdatedAt: Math.floor(Date.now() / 1000),
    };
  }

  async function ensureFormulairesTable(grist) {
    const api = grist?.docApi;
    if (!api) return false;
    const tables = await api.listTables();
    if (tables.includes(TABLE)) return true;
    await api.applyUserActions(planCreateFormulairesTable());
    return true;
  }

  function bulkColData(fields, rowIds) {
    const n = Array.isArray(rowIds) ? rowIds.length : 1;
    const out = {};
    for (const [k, v] of Object.entries(fields || {})) {
      out[k] = Array.isArray(v) ? v.slice() : Array(n).fill(v);
    }
    return out;
  }

  async function saveTerrainForms(grist, terrainPack) {
    const api = grist?.docApi;
    if (!api || !terrainPack?.forms?.length) return { saved: 0, formIds: [] };
    await ensureFormulairesTable(grist);
    const existing = await api.fetchTable(TABLE);
    const byFormId = {};
    const ids = existing?.FormId || [];
    for (let i = 0; i < ids.length; i++) {
      byFormId[ids[i]] = existing.id[i];
    }
    const formIds = [];
    let saved = 0;
    for (const item of terrainPack.forms) {
      const def = item.formDef;
      const fields = rowFromFormDef(def, { statut: 'terrain', version: 1 });
      formIds.push(def.id);
      if (byFormId[def.id] != null) {
        await api.applyUserActions([['BulkUpdateRecord', TABLE, [byFormId[def.id]], bulkColData(fields, [byFormId[def.id]])]]);
      } else {
        await api.applyUserActions([['BulkAddRecord', TABLE, [null], bulkColData(fields, [null])]]);
      }
      saved++;
    }
    return { saved, formIds };
  }

  const api = { TABLE, planCreateFormulairesTable, rowFromFormDef, ensureFormulairesTable, saveTerrainForms };
  return { api, FormulairesTable };
});
