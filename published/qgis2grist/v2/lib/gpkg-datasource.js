/**
 * Parse datasource QGIS vectoriel (GPKG, GeoJSON…).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Q2GGpkgDs = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Ex: ./datasets/bees.gpkg|layername=area → "area" */
  function gpkgTableFromDatasource(datasource) {
    if (!datasource) return null;
    const m = String(datasource).match(/layername=([^|&\s]+)/i);
    return m ? m[1].trim() : null;
  }

  /** Nom fichier sans chemin ni paramètres : bees.gpkg */
  function gpkgFileBaseFromDatasource(datasource) {
    if (!datasource) return '';
    const pathPart = String(datasource).split('|')[0];
    const file = pathPart.split(/[/\\]/).pop() || '';
    return file.replace(/\.[^.]+$/, '').toLowerCase();
  }

  /**
   * Hint pour readGpkgWithSqlJs : table GPKG réelle prioritaire sur layername QGIS.
   * @param {string} qgisLayerName - layername dans le .qgs
   * @param {string} datasource - datasource QGIS
   */
  function resolveGpkgTableHint(qgisLayerName, datasource) {
    return gpkgTableFromDatasource(datasource) || qgisLayerName || '';
  }

  /** Types GPKG importables : spatiales + attributaires (sans géométrie). */
  const GPKG_IMPORTABLE_DATA_TYPES = ['features', 'attributes'];

  /**
   * Filtre les tables GPKG (features ou attributes) selon un hint.
   * @param {string[]} tableNames
   * @param {string} hint
   * @returns {string[]} 0 ou 1 table — jamais « toutes » si hint non vide
   */
  function matchGpkgTables(tableNames, hint) {
    if (!tableNames?.length) return [];
    const h = String(hint || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!h) return tableNames.length === 1 ? tableNames : [];

    const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const exact = tableNames.filter((t) => norm(t) === h);
    if (exact.length) return exact;

    const partial = tableNames.filter((t) => {
      const tn = norm(t);
      return tn.includes(h) || h.includes(tn) || tn.replace(/_/g, '') === h.replace(/_/g, '');
    });
    if (partial.length === 1) return partial;
    if (partial.length > 1) {
      const best = partial.find((t) => norm(t) === h) || partial[0];
      return [best];
    }
    return [];
  }

  /** @deprecated alias — préférer matchGpkgTables */
  const matchGpkgFeatureTables = matchGpkgTables;

  return {
    gpkgTableFromDatasource,
    gpkgFileBaseFromDatasource,
    resolveGpkgTableHint,
    matchGpkgTables,
    matchGpkgFeatureTables,
    GPKG_IMPORTABLE_DATA_TYPES,
  };
});
