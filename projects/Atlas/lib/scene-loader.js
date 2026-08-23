/**
 * Chargement doc Grist qgis2grist via Scene Manifest V0.2.
 */
import {
  fetchTableToRows,
  rowsToGeoJSON,
  boundsFromGeoJSON,
  configLayerMeta,
  resolveSceneGeometryType,
} from './grist-rows.js?v=20260730a';
import {
  manifestGeometryType,
  atlasGeomToBridge,
  primaryColorFromDeclarative,
  colorFnFromDeclarative,
  opacityFnFromDeclarative,
  applyDeclarativeToLayer,
} from './declarative-style.js?v=20260731a';
import { defaultLayerVisible, applyAtlas3dFromRows } from './grist-sync.js?v=20260730a';
import { applyManifestControlsToLayer } from './manifest-binding.js?v=20260729o';

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
/**
 * Où sont les données de cette couche ?
 *
 * Atlas n'a longtemps su lire qu'une origine : une table du document. Le repli
 * historique `ml.source?.table || ml.id` prenait donc l'identifiant d'une couche
 * venue d'ailleurs pour un nom de table, et cherchait ce qui n'existait pas.
 *
 * Les producteurs amont externalisent selon le volume — inline pour les petites
 * couches, une URL au-delà, des tuiles pour les très grosses. On reconnaît donc
 * l'origine avant de décider comment lire.
 *
 * @returns {{nature: 'table'|'inline'|'url'|'tuiles', valeur: any, deduite?: boolean}}
 */
export function origineDeCouche(ml) {
  if (ml?.source_type === 'pmtiles' && ml?.tiles_url) {
    return { nature: 'tuiles', valeur: ml.tiles_url };
  }
  // `geojson` porte soit les données elles-mêmes, soit l'adresse où les prendre.
  if (typeof ml?.geojson === 'string' && ml.geojson) {
    return { nature: 'url', valeur: ml.geojson };
  }
  if (ml?.geojson && typeof ml.geojson === 'object') {
    return { nature: 'inline', valeur: ml.geojson };
  }
  if (typeof ml?.data_url === 'string' && ml.data_url) {
    return { nature: 'url', valeur: ml.data_url };
  }
  if (ml?.source?.table) return { nature: 'table', valeur: ml.source.table };
  // Dernier recours, et c'est une déduction : l'identifiant tenu pour un nom de
  // table. On le signale, pour que l'échec dise « origine non déclarée » plutôt
  // que « table absente ».
  if (ml?.id) return { nature: 'table', valeur: ml.id, deduite: true };
  return { nature: 'table', valeur: null };
}

/**
 * L'emprise déclarée par le manifest, en [[minX,minY],[maxX,maxY]].
 *
 * Indispensable dès qu'Atlas ne détient pas les entités : sans elle, une couche
 * distante s'afficherait sans qu'on sache où regarder. Le producteur amont la
 * fournit depuis QGIS, seule source possible pour un raster ou un service.
 */
export function boundsDuManifest(ml) {
  const b = ml?.bbox;
  if (!Array.isArray(b) || b.length < 4) return null;
  const n = b.map(Number);
  if (n.slice(0, 4).some((v) => !Number.isFinite(v))) return null;
  return [[n[0], n[1]], [n[2], n[3]]];
}

/**
 * Construit une couche dont les données ne viennent pas du document.
 *
 * `geojson` porte ici soit l'objet, soit **l'URL** — MapLibre accepte les deux
 * comme source (`addSource(id, { type:'geojson', data })`), il n'y a donc pas de
 * chargement à écrire.
 *
 * Ce qu'Atlas dérivait des entités ne peut plus l'être : `boundsFromGeoJSON`,
 * `pointFallbackZoom` et `centroidCollection` rendent des valeurs neutres sur
 * une chaîne — vérifié — donc rien ne casse, mais rien n'est calculé non plus.
 * Ce que le manifest déclare prend le relais ; `_distant` permet au reste du
 * code de savoir qu'il ne faut pas compter sur les entités.
 */
function coucheDistante(ml, origine, widgetConfig) {
  const nom = ml.name || ml.displayName || ml.id || 'couche';
  const cfgLayer = configLayerMeta(widgetConfig, ml.id || nom);
  const declarative = ml.style?.declarative || cfgLayer?.style?.declarative || null;
  const fallbackColor = primaryColorFromDeclarative(declarative, cfgLayer?.color || '#808080');
  const geometryType = manifestGeometryType(ml.geometry_type || ml.geomType || cfgLayer?.geomType);

  const layer = {
    id: 'layer-scene-' + String(ml.id || nom).replace(/[^a-zA-Z0-9_-]/g, '_'),
    name: nom,
    color: fallbackColor,
    visible: defaultLayerVisible(ml, ml.n_features ?? 0),
    geometryType,
    source: origine.nature === 'url' ? 'url' : 'manifest',
    sourceTable: null,
    manifestLayerId: ml.id || nom,
    // Objet GeoJSON, ou adresse : MapLibre reçoit l'un ou l'autre tel quel.
    geojson: origine.valeur,
    style: { mode: 'mapbox', polygonMode: geometryType === 'Polygon' ? 'flat' : undefined },
    _modelCat: 'furniture',
    _declarative: declarative,
    _fields: cfgLayer?.fields || [],
    _gristColumns: [],
    _manifestLayer: ml,
    _profile: ml.profile || 'A',
    _deferredRows: null,
    _deferredLoad: false,
    // Atlas ne détient pas les entités de cette couche.
    _distant: true,
    _origine: origine.nature,
    _bboxDeclaree: boundsDuManifest(ml),
    _nFeaturesDeclare: Number.isFinite(ml.n_features) ? ml.n_features : null,
  };

  applyDeclarativeToLayer(layer, declarative);
  applyManifestControlsToLayer(layer, ml);
  return layer;
}

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
  /**
   * Les couches qu'on n'a pas su charger.
   *
   * Sans cette liste, une couche qui echoue disparait exactement comme une
   * couche qu'on aurait choisi de ne pas mettre : le manifest est valide, la
   * carte s'affiche, et rien ne dit qu'elle est incomplete. Un console.warn ne
   * previent que celui qui a la console ouverte — c'est-a-dire personne sur le
   * terrain.
   */
  const echecs = [];
  const primaryBounds = [];
  const fallbackBounds = [];

  for (const ml of manifest.layers) {
    const origine = origineDeCouche(ml);

    // Données portées par la couche, ou joignables par une adresse : on ne
    // passe pas par le document. MapLibre sait recevoir une URL comme source,
    // donc il n'y a rien à télécharger ici — seulement à laisser passer.
    if (origine.nature === 'inline' || origine.nature === 'url') {
      const couche = coucheDistante(ml, origine, widgetConfig);
      atlasLayers.push(couche);
      const bd = boundsDuManifest(ml);
      if (bd) {
        // Même règle de priorité que pour les couches locales : le détail
        // d'abord, les points en repli.
        const areal = couche.geometryType === 'Polygon' || couche.geometryType === 'Line'
          || couche.geometryType === 'LineString';
        if (couche.visible && areal) primaryBounds.push(bd);
        else fallbackBounds.push(bd);
      } else {
        // Sans emprise, la couche s'affichera mais ne pourra pas être cadrée :
        // il faut le dire, sinon on regarde au mauvais endroit en croyant que
        // la donnée manque.
        echecs.push({
          nom: ml.name || ml.displayName || ml.id || '(couche sans nom)',
          origine: `${origine.nature} ${String(origine.valeur).slice(0, 60)}`,
          raison: 'aucune emprise déclarée (bbox) — la couche ne peut pas être cadrée',
        });
      }
      continue;
    }

    // Tuiles : reconnues, pas encore rendues — le protocole manque.
    if (origine.nature === 'tuiles') {
      echecs.push({
        nom: ml.name || ml.displayName || ml.id || '(couche sans nom)',
        origine: `tuiles ${String(origine.valeur).slice(0, 60)}`,
        raison: 'origine reconnue mais pas encore prise en charge (protocole pmtiles absent)',
      });
      continue;
    }

    const tableName = origine.valeur;
    if (!tableName) {
      // Ni source ni identifiant : rien ne dit ou chercher.
      echecs.push({
        nom: ml.name || ml.displayName || '(couche sans nom)',
        origine: 'aucune origine declaree',
        raison: 'la couche ne porte ni source ni identifiant',
      });
      continue;
    }

    // Couche déclarée masquée : on ne télécharge rien. La table sera lue au
    // moment de l'allumer (materializeDeferredLayer via _loadRows).
    const deferCold = shouldDeferCold(ml);

    let colData;
    if (!deferCold) {
      try {
        colData = await docApi.fetchTable(tableName);
      } catch (e) {
        // Le repli `ml.source?.table || ml.id` transforme une origine absente
        // en nom de table : une couche venue d'ailleurs — fichier, URL, tuiles —
        // echoue donc ici avec son identifiant pris pour un nom de table. Le
        // message doit permettre de distinguer les deux cas.
        const declaree = origine.deduite
          ? `table Grist « ${tableName} » (deduite de l'identifiant, faute de source declaree)`
          : `table Grist « ${tableName} »`;
        console.warn('[Atlas scene-loader] couche non chargee:', tableName, e.message);
        echecs.push({
          nom: ml.name || ml.displayName || tableName,
          origine: declaree,
          raison: e.message || 'lecture impossible',
        });
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
    echecs,
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
