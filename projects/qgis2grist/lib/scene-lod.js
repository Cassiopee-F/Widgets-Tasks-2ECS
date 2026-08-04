/**
 * Scene Manifest V0.2.1 — LOD, fetch mode, limites viewport (Profils A/B/C).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.Q2GSceneLod = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MANIFEST_LOD_VERSION = '0.2.1';
  const FILE_MAX_BYTES = 500 * 1024 * 1024;
  const TIER_A_MAX = 50000;
  const TIER_B_MAX = 500000;
  const DEFAULT_MAX_IN_VIEW = 10000;
  const GEOMETRY_FIELD_NAMES = new Set([
    'geometry_json', 'centroid_lat', 'centroid_lon', 'latitude', 'longitude',
  ]);

  function isTileFetchMode(lod) {
    return lod?.fetch?.mode === 'tile';
  }

  function resolveLayerLod(layer) {
    if (layer?._lod) return layer._lod;
    const count = layer?.featureCount ?? layer?.features?.length ?? 0;
    return inferLayerLod(layer, count);
  }

  /** Champs Grist à importer — Profil C exclut la géométrie. */
  function fieldsForGristImport(layer) {
    const lod = resolveLayerLod(layer);
    if (!isTileFetchMode(lod)) return layer.fields || [];
    return (layer.fields || []).filter(f => !GEOMETRY_FIELD_NAMES.has(f.name));
  }

  function stripGeometryFromRow(row) {
    if (!row) return row;
    const out = { ...row };
    for (const k of GEOMETRY_FIELD_NAMES) delete out[k];
    return out;
  }

  function formatProfileCImportHint(displayName) {
    return `${displayName} : Profil C — attributs sans géométrie (tuiles/flux externe pour la carte)`;
  }

  function formatProfileCMapToast(layerNames) {
    const list = (layerNames || []).filter(Boolean);
    if (!list.length) return '';
    const suffix = list.length === 1 ? list[0] : list.join(', ');
    return `Profil C — ${suffix} : attributs Grist uniquement (géométrie via tuiles/flux externe)`;
  }

  function shouldRejectFileSize(sizeBytes, ext) {
    const isBinary = ext !== 'html' && ext !== 'htm' && ext !== 'qgs';
    return isBinary && sizeBytes > FILE_MAX_BYTES;
  }

  function isGridLayer(layer) {
    const n = String(layer.displayName || layer.name || layer.id || '').toLowerCase();
    return /grille|grid|maille|200m|grille_/.test(n);
  }

  /** Plancher de zoom d'une grille : ses mailles sont sous-pixel en petite échelle. */
  const GRID_MIN_ZOOM = 11;

  /**
   * Infère visibility / fetch / limits depuis le volume de la couche.
   *
   * Le LOD zoom n'est posé qu'à partir du Profil B : en Profil A la couche
   * tient intégralement en mémoire, contraindre le zoom ne ferait que la
   * rendre invisible sans contrepartie. Une grille voit son plancher relevé
   * à GRID_MIN_ZOOM (minZoom, pas maxZoom : une maille 200 m est illisible
   * en petite échelle, pas en grande).
   *
   * @param {object} layer - { geomType, displayName?, name?, featureCount? }
   * @param {number} [featureCount]
   */
  function inferLayerLod(layer, featureCount) {
    const count = featureCount ?? layer.featureCount ?? 0;
    const geom = layer.geomType || 'Polygon';
    const geomMinZoom = geom === 'Point' ? 8 : geom === 'Line' ? 9 : 10;
    const minZoom = isGridLayer(layer) ? Math.max(geomMinZoom, GRID_MIN_ZOOM) : geomMinZoom;

    if (count > TIER_B_MAX) {
      return {
        visibility: { minZoom, maxZoom: null },
        fetch: { mode: 'tile' },
        limits: { maxFeaturesInView: DEFAULT_MAX_IN_VIEW },
        profile: 'C',
      };
    }
    if (count > TIER_A_MAX) {
      return {
        visibility: { minZoom, maxZoom: null },
        fetch: { mode: 'viewport' },
        limits: { maxFeaturesInView: DEFAULT_MAX_IN_VIEW },
        profile: 'B',
      };
    }
    return {
      visibility: { minZoom: null, maxZoom: null },
      fetch: { mode: 'full' },
      limits: { maxFeaturesInView: DEFAULT_MAX_IN_VIEW },
      profile: 'A',
    };
  }

  function getRowLonLat(row, layer) {
    if (layer.geomType === 'Point') {
      const lon = parseFloat(row.longitude);
      const lat = parseFloat(row.latitude);
      if (Number.isFinite(lon) && Number.isFinite(lat)) return [lon, lat];
    }
    const lon = parseFloat(row.centroid_lon);
    const lat = parseFloat(row.centroid_lat);
    if (Number.isFinite(lon) && Number.isFinite(lat)) return [lon, lat];
    return null;
  }

  function rowInBounds(row, layer, bounds) {
    if (!bounds) return true;
    const ll = getRowLonLat(row, layer);
    if (!ll) return true;
    const [lon, lat] = ll;
    return lon >= bounds.west && lon <= bounds.east
      && lat >= bounds.south && lat <= bounds.north;
  }

  function boundsFromMap(map, bufferDeg) {
    const buf = bufferDeg ?? 0.02;
    const b = map.getBounds();
    return {
      west: b.getWest() - buf,
      east: b.getEast() + buf,
      south: b.getSouth() - buf,
      north: b.getNorth() + buf,
    };
  }

  function filterRowsForDisplay(rows, layer, bounds, lod) {
    if (!lod || lod.fetch?.mode !== 'viewport') return rows;
    let out = bounds ? rows.filter(r => rowInBounds(r, layer, bounds)) : rows.slice();
    const cap = lod.limits?.maxFeaturesInView ?? DEFAULT_MAX_IN_VIEW;
    if (out.length > cap) out = out.slice(0, cap);
    return out;
  }

  function isExternalSource(manifestLayer) {
    const t = manifestLayer?.source?.type || 'grist';
    return t !== 'grist';
  }

  function mergeLodFromManifest(layer, manifestLayer) {
    if (!manifestLayer) return layer._lod || inferLayerLod(layer);
    layer._lod = {
      visibility: manifestLayer.visibility || inferLayerLod(layer).visibility,
      fetch: manifestLayer.fetch || inferLayerLod(layer).fetch,
      limits: manifestLayer.limits || inferLayerLod(layer).limits,
      profile: manifestLayer.profile || null,
      sourceType: manifestLayer.source?.type || 'grist',
    };
    return layer._lod;
  }

  function formatFileSizeGuardMessage(sizeBytes) {
    const mb = (sizeBytes / (1024 * 1024)).toFixed(0);
    return `Fichier trop volumineux (${mb} Mo). Limite navigateur : ${Math.round(FILE_MAX_BYTES / (1024 * 1024))} Mo. `
      + 'Découpez le GPKG par région/thème (QGIS) ou utilisez export_grist / tuiles PMTiles (Profil C).';
  }

  return {
    MANIFEST_LOD_VERSION,
    FILE_MAX_BYTES,
    TIER_A_MAX,
    TIER_B_MAX,
    DEFAULT_MAX_IN_VIEW,
    GRID_MIN_ZOOM,
    GEOMETRY_FIELD_NAMES,
    inferLayerLod,
    isTileFetchMode,
    resolveLayerLod,
    fieldsForGristImport,
    stripGeometryFromRow,
    formatProfileCImportHint,
    formatProfileCMapToast,
    shouldRejectFileSize,
    getRowLonLat,
    rowInBounds,
    boundsFromMap,
    filterRowsForDisplay,
    isExternalSource,
    mergeLodFromManifest,
    formatFileSizeGuardMessage,
    isGridLayer,
  };
});
