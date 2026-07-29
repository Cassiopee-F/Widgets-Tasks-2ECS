/**
 * Chargement doc Grist qgis2grist via Scene Manifest V0.2.
 */
import {
  fetchTableToRows,
  rowsToGeoJSON,
  boundsFromGeoJSON,
  configLayerMeta,
  resolveSceneGeometryType,
} from './grist-rows.js?v=20260729o';
import {
  manifestGeometryType,
  atlasGeomToBridge,
  primaryColorFromDeclarative,
  colorFnFromDeclarative,
  applyDeclarativeToLayer,
} from './declarative-style.js?v=20260729b';
import { defaultLayerVisible, applyAtlas3dFromRows, isBasemapLayer } from './grist-sync.js?v=20260729o';
import { applyManifestControlsToLayer } from './manifest-binding.js?v=20260729o';

export const SCENE_MANIFEST_TABLE = 'SceneManifest';
export const QGIS_WIDGETS_TABLE = 'QgisWidgets';

/** Détecte le mode de doc Grist. */
export async function detectDocMode(docApi) {
  const tables = await docApi.listTables();
  if (tables.includes(SCENE_MANIFEST_TABLE)) {
    try {
      const data = await docApi.fetchTable(SCENE_MANIFEST_TABLE);
      if (data?.id?.length) return 'scene-manifest';
    } catch (_) { /* table vide ou inaccessible */ }
  }
  if (tables.includes('Maquette_Layers')) return 'maquette';
  return null;
}

/** Dernière ligne SceneManifest (manifest le plus récent). */
export async function loadLatestSceneManifest(docApi) {
  const data = await docApi.fetchTable(SCENE_MANIFEST_TABLE);
  if (!data?.id?.length) return null;
  let bestIdx = 0;
  for (let i = 1; i < data.id.length; i++) {
    const t = data.created_at?.[i] || 0;
    const bestT = data.created_at?.[bestIdx] || 0;
    if (t >= bestT) bestIdx = i;
  }
  try {
    return JSON.parse(data.manifest_json[bestIdx]);
  } catch (e) {
    console.warn('[Atlas scene-loader] manifest JSON invalide', e);
    return null;
  }
}

/** Config widget qgis2grist (métadonnées champs par couche). */
export async function loadQgisWidgetConfig(docApi) {
  if (!(await docApi.listTables()).includes(QGIS_WIDGETS_TABLE)) return null;
  try {
    const data = await docApi.fetchTable(QGIS_WIDGETS_TABLE);
    if (!data?.id?.length) return null;
    const idx = data.id.length - 1;
    return JSON.parse(data.config_json[idx]);
  } catch (e) {
    console.warn('[Atlas scene-loader] QgisWidgets config', e.message);
    return null;
  }
}

/**
 * Charge les couches Atlas depuis Scene Manifest + tables Grist source.
 * @returns {{ layers: object[], manifest: object, projectName?: string, bounds: number[][]|null }}
 */
export async function loadSceneManifestLayers(docApi, manifest, widgetConfig) {
  if (!manifest?.layers?.length) {
    return { layers: [], manifest, projectName: manifest?.title, bounds: null };
  }

  const atlasLayers = [];
  const allBounds = [];

  for (const ml of manifest.layers) {
    const tableName = ml.source?.table || ml.id;
    if (!tableName) continue;

    let colData;
    try {
      colData = await docApi.fetchTable(tableName);
    } catch (e) {
      console.warn('[Atlas scene-loader] table absente:', tableName, e.message);
      continue;
    }

    const cfgLayer = configLayerMeta(widgetConfig, tableName);
    let geometryType = manifestGeometryType(ml.geometry_type || cfgLayer?.geomType);
    const declarative = ml.style?.declarative || cfgLayer?.style?.declarative || null;
    const fallbackColor = primaryColorFromDeclarative(
      declarative,
      cfgLayer?.color || '#808080'
    );

    const layerMeta = {
      geomType: atlasGeomToBridge(geometryType),
      fields: cfgLayer?.fields || [],
      _color: fallbackColor,
      color: fallbackColor,
    };

    const rows = fetchTableToRows(colData);
    const colorFn = colorFnFromDeclarative(declarative, fallbackColor, cfgLayer?.fields || []);
    const geojson = rowsToGeoJSON(rows, layerMeta, colorFn);
    applyAtlas3dFromRows(rows, geojson);

    if (!geojson.features.length) continue;

    geometryType = resolveSceneGeometryType(
      ml.geometry_type,
      cfgLayer?.geomType,
      geojson,
      geometryType
    );

    const featureCount = geojson.features.length;
    const visible = defaultLayerVisible(ml, featureCount);

    const layer = {
      id: 'layer-scene-' + tableName.replace(/[^a-zA-Z0-9_-]/g, '_'),
      name: ml.name || cfgLayer?.displayName || tableName,
      color: fallbackColor,
      visible,
      geometryType,
      source: 'qgis2grist',
      sourceTable: tableName,
      manifestLayerId: ml.id || tableName,
      geojson,
      style: { mode: 'mapbox', polygonMode: geometryType === 'Polygon' ? 'flat' : undefined },
      _modelCat: 'furniture',
      _declarative: declarative,
      _fields: cfgLayer?.fields || [],
      _gristColumns: Object.keys(colData).filter((k) => k !== 'id'),
      _manifestLayer: ml,
      _profile: ml.profile || 'A',
    };

    applyDeclarativeToLayer(layer, declarative);
    applyManifestControlsToLayer(layer, ml);
    atlasLayers.push(layer);

    const b = boundsFromGeoJSON(geojson);
    if (b && !isBasemapLayer(ml, featureCount)) allBounds.push(b);
  }

  let bounds = null;
  if (allBounds.length) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of allBounds) {
      minX = Math.min(minX, b[0][0]); minY = Math.min(minY, b[0][1]);
      maxX = Math.max(maxX, b[1][0]); maxY = Math.max(maxY, b[1][1]);
    }
    bounds = [[minX, minY], [maxX, maxY]];
  }

  return {
    layers: atlasLayers,
    manifest,
    projectName: manifest.title || widgetConfig?.meta?.source_file || 'Import QGIS',
    bounds,
  };
}
