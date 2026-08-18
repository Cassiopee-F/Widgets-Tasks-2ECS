/**
 * Chargement doc Grist qgis2grist via Scene Manifest V0.2.
 */
import {
  fetchTableToRows,
  rowsToGeoJSON,
  boundsFromGeoJSON,
  configLayerMeta,
  resolveSceneGeometryType,
} from './grist-rows.js?v=1.1.2';
import {
  manifestGeometryType,
  atlasGeomToBridge,
  primaryColorFromDeclarative,
  colorFnFromDeclarative,
  opacityFnFromDeclarative,
  applyDeclarativeToLayer,
} from './declarative-style.js?v=1.1.2';
import { defaultLayerVisible, applyAtlas3dFromRows } from './grist-sync.js?v=1.1.2';
import { applyManifestControlsToLayer } from './manifest-binding.js?v=1.1.2';

export const SCENE_MANIFEST_TABLE = 'SceneManifest';

/** Au-delà, une couche masquée à l'ouverture n'est convertie qu'à l'activation. */
export const DEFER_FEATURE_THRESHOLD = 8000;
export const QGIS_WIDGETS_TABLE = 'QgisWidgets';

/**
 * La couche peut-elle être différée **sans même télécharger sa table** ?
 *
 * Le report « chaud » (DEFER_FEATURE_THRESHOLD) évite la conversion en GeoJSON
 * mais pas le transfert : il faut compter les entités pour décider. Quand le
 * manifest déclare explicitement la couche masquée, la décision est connue
 * d'avance — on peut donc ne rien télécharger du tout.
 *
 * Prudence : on exige un type de géométrie déclaré, faute de quoi il serait
 * déduit du GeoJSON, qu'on n'aura pas.
 */
export function shouldDeferCold(ml) {
  return ml?.visibility?.defaultVisible === false && !!ml?.geometry_type;
}

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
  const primaryBounds = [];
  const fallbackBounds = [];

  for (const ml of manifest.layers) {
    const tableName = ml.source?.table || ml.id;
    if (!tableName) continue;

    // Couche déclarée masquée : on ne télécharge rien. La table sera lue au
    // moment de l'allumer (materializeDeferredLayer via _loadRows).
    const deferCold = shouldDeferCold(ml);

    let colData;
    if (!deferCold) {
      try {
        colData = await docApi.fetchTable(tableName);
      } catch (e) {
        console.warn('[Atlas scene-loader] table absente:', tableName, e.message);
        continue;
      }
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
      geometryFields: ml.source?.geometry_fields || null,
      opacityFn: opacityFnFromDeclarative(declarative, cfgLayer?.fields || []),
      _color: fallbackColor,
      color: fallbackColor,
    };

    const rows = deferCold ? [] : fetchTableToRows(colData);
    const featureCountHint = rows.length;
    const willHide = deferCold || !defaultLayerVisible(ml, featureCountHint);
    // Une couche masquée et volumineuse n'est pas convertie en GeoJSON tant
    // qu'on ne l'allume pas : le coût est le volume, pas la nature des données.
    const deferHeavy = deferCold || (willHide && featureCountHint > DEFER_FEATURE_THRESHOLD);

    let geojson;
    let featureCount;
    if (deferHeavy) {
      geojson = { type: 'FeatureCollection', features: [] };
      featureCount = featureCountHint;
      console.warn(deferCold
        ? `[Atlas scene-loader] ${tableName}: masquée au manifest — table non téléchargée (activer la pastille)`
        : `[Atlas scene-loader] ${tableName}: ${featureCountHint} entités masquées — chargement différé (activer la pastille)`);
    } else {
      const colorFn = colorFnFromDeclarative(declarative, fallbackColor, cfgLayer?.fields || []);
      geojson = rowsToGeoJSON(rows, layerMeta, colorFn);
      applyAtlas3dFromRows(rows, geojson);
      if (!geojson.features.length) continue;
      featureCount = geojson.features.length;
    }

    geometryType = resolveSceneGeometryType(
      ml.geometry_type,
      cfgLayer?.geomType,
      geojson,
      geometryType
    );

    const visible = deferHeavy ? false : defaultLayerVisible(ml, featureCount);

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
      _gristColumns: deferCold ? [] : Object.keys(colData).filter((k) => k !== 'id'),
      _manifestLayer: ml,
      _profile: ml.profile || 'A',
      _deferredRows: deferHeavy && !deferCold ? rows : null,
      _deferredLoad: deferHeavy,
    };

    // Différé « froid » : la couche porte son propre moyen de lire la table,
    // pour que materializeDeferredLayer n'ait pas besoin de connaître docApi.
    if (deferCold) {
      layer._loadRows = async () => {
        const cd = await docApi.fetchTable(tableName);
        layer._gristColumns = Object.keys(cd).filter((k) => k !== 'id');
        return fetchTableToRows(cd);
      };
    }

    applyDeclarativeToLayer(layer, declarative);
    applyManifestControlsToLayer(layer, ml);
    atlasLayers.push(layer);

    const b = boundsFromGeoJSON(geojson);
    // Cadrage : couches visibles porteuses de détail d'abord (surfaces, lignes).
    // Les points et les couches masquées ne servent qu'en repli — sinon des
    // repères dispersés imposent une échelle où le détail est sous-pixel.
    if (b) {
      const areal = geometryType === 'Polygon' || geometryType === 'Line'
        || geometryType === 'LineString';
      if (visible && areal) primaryBounds.push(b);
      else fallbackBounds.push(b);
    }
  }

  let bounds = null;
  const boundList = primaryBounds.length ? primaryBounds : fallbackBounds;
  if (boundList.length) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of boundList) {
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

/** Matérialise une couche lourde chargée en différé (bâtiments masqués). */
/**
 * Convertit une couche différée en GeoJSON affichable.
 *
 * @param {object} layer
 * @param {{onReady?: (layer: object) => void}} [opts] `onReady` n'est appelé que
 *   dans le cas « froid », où les lignes doivent d'abord être téléchargées : la
 *   fonction rend alors la main immédiatement et la couche se peuple ensuite.
 * @returns {boolean} true si la couche est prête *maintenant*
 */
export function materializeDeferredLayer(layer, opts = {}) {
  if (!layer?._deferredLoad) return false;

  // Différé « froid » : la table n'a jamais été téléchargée.
  if (!layer._deferredRows?.length) {
    if (!layer._loadRows || layer._deferredFetching) return false;
    layer._deferredFetching = true;
    layer._loadRows()
      .then((rows) => {
        layer._deferredFetching = false;
        layer._deferredRows = rows;
        if (materializeDeferredLayer(layer) && opts.onReady) opts.onReady(layer);
      })
      .catch((e) => {
        layer._deferredFetching = false;
        console.warn('[Atlas scene-loader] chargement différé', layer.sourceTable, e.message);
      });
    return false;
  }
  const declarative = layer._declarative || layer._manifestLayer?.style?.declarative || null;
  const fallbackColor = layer.color || '#808080';
  const layerMeta = {
    geomType: atlasGeomToBridge(layer.geometryType || 'Polygon'),
    fields: layer._fields || [],
    geometryFields: layer._manifestLayer?.source?.geometry_fields || null,
    opacityFn: opacityFnFromDeclarative(declarative, layer._fields || []),
    _color: fallbackColor,
    color: fallbackColor,
  };
  const colorFn = colorFnFromDeclarative(declarative, fallbackColor, layer._fields || []);
  const geojson = rowsToGeoJSON(layer._deferredRows, layerMeta, colorFn);
  applyAtlas3dFromRows(layer._deferredRows, geojson);
  layer.geojson = geojson;
  layer._deferredRows = null;
  layer._deferredLoad = false;
  if (declarative) applyDeclarativeToLayer(layer, declarative);
  return geojson.features.length > 0;
}

/**
 * Bounds à partir des couches déjà visibles (après prefs Atlas).
 *
 * Les couches surfaciques et linéaires cadrent en priorité : ce sont elles qui
 * portent le détail. Des points de repère dispersés sur un pourtour entier
 * étireraient la vue à une échelle où une maille de 200 m fait moins d'un
 * pixel — la carte paraîtrait vide à l'ouverture. Les points ne servent donc
 * de cadrage que s'il n'y a rien d'autre.
 */
export function boundsFromVisibleLayers(layers) {
  const areal = [];
  const punctual = [];
  for (const layer of layers || []) {
    if (layer.visible === false) continue;
    const b = boundsFromGeoJSON(layer.geojson);
    if (!b) continue;
    const gt = layer.geometryType;
    if (gt === 'Polygon' || gt === 'Line' || gt === 'LineString') areal.push(b);
    else punctual.push(b);
  }
  const list = areal.length ? areal : punctual;
  if (!list.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of list) {
    minX = Math.min(minX, b[0][0]); minY = Math.min(minY, b[0][1]);
    maxX = Math.max(maxX, b[1][0]); maxY = Math.max(maxY, b[1][1]);
  }
  return [[minX, minY], [maxX, maxY]];
}
