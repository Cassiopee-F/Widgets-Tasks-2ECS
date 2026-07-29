/**
 * Recalage geomType depuis les features réelles (QGIS XML peut défauter à Point).
 */
(function (root) {
  const GEOM_COLS = new Set(['latitude', 'longitude', 'geometry_json', 'centroid_lat', 'centroid_lon']);

  function stripGeometryFields(fields) {
    return (fields || []).filter((f) => !GEOM_COLS.has(f.name));
  }

  function isNonSpatialGeomType(geomType) {
    const g = String(geomType || '').toLowerCase();
    return g === 'none' || g === 'no geometry' || g === 'nogeometry';
  }

  function geometryFieldsForType(geomType) {
    if (isNonSpatialGeomType(geomType)) return [];
    if (geomType === 'Point') {
      return [
        { name: 'latitude', qType: 'double', gType: 'Numeric' },
        { name: 'longitude', qType: 'double', gType: 'Numeric' },
      ];
    }
    return [
      { name: 'geometry_json', qType: 'string', gType: 'Text' },
      { name: 'centroid_lat', qType: 'double', gType: 'Numeric' },
      { name: 'centroid_lon', qType: 'double', gType: 'Numeric' },
    ];
  }

  /**
   * @param {string} xmlGeomType - type déduit du maplayer QGIS
   * @param {object[]} baseFields - champs métier (sans colonnes géo)
   * @param {object[]} features - Feature GeoJSON brutes
   * @param {boolean} featuresLoaded
   * @param {function} detectFn - detectGeomTypeFromFeatures
   * @param {function} flattenFn - flattenGeoJsonFeatures(features, fields, geomType)
   */
  function reconcileLayerGeometry(xmlGeomType, baseFields, features, featuresLoaded, detectFn, flattenFn) {
    const base = stripGeometryFields(baseFields);
    if (!featuresLoaded || !features?.length) {
      const geomType = isNonSpatialGeomType(xmlGeomType) ? 'No geometry' : (xmlGeomType || 'Polygon');
      const fields = base.concat(geometryFieldsForType(geomType));
      return { geomType, fields, rows: [] };
    }
    const hasGeometry = features.some((f) => f?.geometry);
    const geomType = hasGeometry
      ? detectFn(features)
      : (isNonSpatialGeomType(xmlGeomType) ? 'No geometry' : detectFn(features));
    const fields = base.concat(geometryFieldsForType(geomType));
    if (geomType !== xmlGeomType) {
      console.log('[qgis2grist] geomType recalé depuis features:', xmlGeomType, '→', geomType);
    }
    return {
      geomType,
      fields,
      rows: flattenFn(features, fields, geomType),
    };
  }

  root.Q2GGeomReconcile = {
    stripGeometryFields,
    geometryFieldsForType,
    isNonSpatialGeomType,
    reconcileLayerGeometry,
    GEOM_COLS,
  };
})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined') module.exports = globalThis.Q2GGeomReconcile;
