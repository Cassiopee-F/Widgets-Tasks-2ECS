/**
 * Construction Scene Manifest V0.2 depuis les couches importées qgis2grist.
 */
(function (root, factory) {
  const qml = typeof require === 'function'
    ? require('./qml-to-declarative.js')
    : (root.Q2G || {});
  const lod = typeof require === 'function'
    ? require('./scene-lod.js')
    : (root.Q2GSceneLod || {});
  const ctrl = typeof require === 'function'
    ? require('./controls-from-layer.js')
    : (root.Q2GControls || {});

  const api = factory(qml, lod, ctrl);

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.Q2G = root.Q2G || {};
    Object.assign(root.Q2G, api);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (qml, lod, ctrl) {
  'use strict';

  const MANIFEST_VERSION = lod.MANIFEST_LOD_VERSION || '0.2.1';
  const DEFAULT_CLASSIFICATION = 'cerema_internal';

  /**
   * geometry_type Scene Manifest depuis geomType qgis2grist.
   */
  function geometryType(geomType) {
    const g = (geomType || 'Polygon').toLowerCase();
    if (g === 'point') return 'point';
    if (g === 'line') return 'line';
    return 'polygon';
  }

  /**
   * Construit un Scene Manifest V0.2 complet.
   * @param {Record<string, object>} importedLayerData - tableName → layer
   * @param {object|null} meta - meta BigQgisMCP / import
   * @param {string} fileName
   * @param {string[]} [palette] - couleurs fallback par couche
   */
  function buildSceneManifest(importedLayerData, meta, fileName, palette) {
    const colors = palette || ['#3e5de7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    let idx = 0;

    const layers = Object.entries(importedLayerData).map(([tableName, layer]) => {
      const fallback = layer._color || layer.color || colors[idx++ % colors.length];
      const declarative = qml.qmlStyleToDeclarative(layer.style, { fallbackColor: fallback });
      const featureCount = layer.featureCount ?? layer.features?.length ?? 0;
      const layerLod = layer._lod || (lod.inferLayerLod ? lod.inferLayerLod(layer, featureCount) : null);
      const controls = ctrl.inferLayerControls
        ? ctrl.inferLayerControls(layer, meta, tableName, declarative)
        : [];

      return {
        id: tableName,
        name: layer.displayName || tableName,
        source: { type: 'grist', table: tableName },
        geometry_type: geometryType(layer.geomType),
        visibility: layerLod?.visibility || null,
        fetch: layerLod?.fetch || { mode: 'full' },
        limits: layerLod?.limits || null,
        profile: layerLod?.profile || 'A',
        style: {
          declarative,
          qml_source: null,
        },
        controls,
      };
    });

    const {
      sources, provenance, source_info, classification, imported_at,
      ...restMeta
    } = meta || {};

    return {
      version: MANIFEST_VERSION,
      classification: classification || DEFAULT_CLASSIFICATION,
      title: meta?.title || fileName || 'Import QGIS',
      subtitle: meta?.subtitle || null,
      layers,
      meta: {
        imported_at: imported_at || new Date().toISOString(),
        source_file: fileName || '',
        widget: 'qgis2grist-v2',
        classification: classification || DEFAULT_CLASSIFICATION,
        sources: sources || [],
        provenance: provenance || [],
        source_info: source_info || null,
        ...restMeta,
      },
    };
  }

  /** JSON canonique stable (clés triées) pour hash optionnel. */
  function canonicalStringify(obj) {
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(canonicalStringify).join(',') + ']';
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalStringify(obj[k])).join(',') + '}';
  }

  /** SHA256 hex du manifest (navigateur ou Node 18+). */
  async function hashSceneManifest(manifest) {
    const text = canonicalStringify(manifest);
    if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
      const buf = new TextEncoder().encode(text);
      const hash = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return null;
  }

  return {
    MANIFEST_VERSION,
    DEFAULT_CLASSIFICATION,
    geometryType,
    buildSceneManifest,
    canonicalStringify,
    hashSceneManifest,
  };
});
