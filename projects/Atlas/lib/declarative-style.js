/**
 * StyleDeclarative (Scene Manifest V0.2) → symbolisation Atlas.
 */

const GEOM_FROM_MANIFEST = {
  point: 'Point',
  line: 'LineString',
  polygon: 'Polygon',
};

const QUALitative_PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
];

/** Normalise une valeur attribut Grist (Ref, Choice, array…) → string. */
export function normalizePropertyValue(v) {
  if (v == null || v === '') return '';
  if (Array.isArray(v)) return normalizePropertyValue(v[0]);
  if (typeof v === 'object') return String(v.label ?? v.name ?? v.id ?? '');
  return String(v);
}

/** Parse numérique robuste (Ref id, "12.3", etc.). */
export function parsePropertyNumber(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = normalizePropertyValue(v);
  if (!s) return NaN;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

function fieldMetaCandidates(fieldMeta) {
  if (!fieldMeta) return [];
  return [fieldMeta.name, fieldMeta._rawKey, fieldMeta.rawKey, fieldMeta.label].filter(Boolean);
}

function matchesFieldRef(fieldMeta, fieldRef) {
  const q = String(fieldRef);
  const ql = q.toLowerCase();
  return fieldMetaCandidates(fieldMeta).some((c) => c === q || String(c).toLowerCase() === ql);
}

/** QML attr / label → colId Grist (qgis2grist _fields). */
export function resolveGristFieldName(fields, qmlField) {
  if (!qmlField) return null;
  const q = String(qmlField);
  const ql = q.toLowerCase();
  const list = fields || [];
  const hit = list.find((f) =>
    matchesFieldRef(f, q)
    || (f.name && f.name.toLowerCase() === ql)
  );
  return hit?.name || qmlField;
}

/**
 * Clé réelle dans feature.properties pour un champ sym / métadonnée.
 * Gère _rawKey qgis2grist et différences de casse Grist.
 */
export function resolveFeaturePropertyKey(layer, fieldRef) {
  if (!fieldRef) return null;
  const features = layer.geojson?.features || [];
  const propKeys = new Set();
  for (const f of features.slice(0, 100)) {
    if (f.properties) {
      Object.keys(f.properties).forEach((k) => { if (!k.startsWith('_')) propKeys.add(k); });
    }
  }
  if (propKeys.has(fieldRef)) return fieldRef;

  const fields = layer._fields || [];
  const meta = fields.find((f) => matchesFieldRef(f, fieldRef));
  if (meta) {
    for (const c of fieldMetaCandidates(meta)) {
      if (propKeys.has(c)) return c;
    }
    const lowerMap = new Map([...propKeys].map((k) => [k.toLowerCase(), k]));
    for (const c of fieldMetaCandidates(meta)) {
      const hit = lowerMap.get(String(c).toLowerCase());
      if (hit) return hit;
    }
    return meta.name || fieldRef;
  }

  for (const k of propKeys) {
    if (k.toLowerCase() === String(fieldRef).toLowerCase()) return k;
  }
  return fieldRef;
}

export function getFeatureProperty(feature, layer, fieldRef) {
  const key = resolveFeaturePropertyKey(layer, fieldRef);
  return feature?.properties?.[key];
}

/** Lit une valeur ligne Grist via métadonnées champs (name / _rawKey / casse). */
export function rowPropertyValue(row, fields, fieldRef) {
  if (!row || !fieldRef) return undefined;
  const resolved = resolveGristFieldName(fields, fieldRef) || fieldRef;
  const meta = (fields || []).find((f) => f.name === resolved || matchesFieldRef(f, fieldRef));
  const candidates = meta ? fieldMetaCandidates(meta) : [resolved];
  for (const k of candidates) {
    if (row[k] != null && row[k] !== '') return row[k];
  }
  const rowKeys = Object.keys(row);
  for (const c of candidates) {
    const hit = rowKeys.find((k) => k.toLowerCase() === String(c).toLowerCase());
    if (hit != null && row[hit] != null && row[hit] !== '') return row[hit];
  }
  return row[resolved];
}

export function manifestGeometryType(geometryType) {
  const g = (geometryType || 'polygon').toLowerCase();
  if (g === 'point') return 'Point';
  if (g === 'line') return 'LineString';
  return 'Polygon';
}

export function atlasGeomToBridge(geometryType) {
  const g = geometryType || 'Polygon';
  if (g === 'Point' || g === 'MultiPoint') return 'Point';
  if (g === 'LineString' || g === 'MultiLineString') return 'Line';
  return 'Polygon';
}

/** Valeurs uniques d'un champ dans le GeoJSON couche. */
export function uniqueFieldValues(layer, field, max = 200) {
  const propKey = resolveFeaturePropertyKey(layer, field);
  const counts = new Map();
  for (const f of (layer.geojson?.features || [])) {
    let v = f.properties?.[propKey];
    const key = normalizePropertyValue(v);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, max);
}

/** Enregistre toutes les clés possibles d'un stop catégorisé (value, label, casse). */
function registerStopColors(colorByKey, stop, color) {
  if (!color) return;
  const keys = new Set();
  if (stop.value != null && stop.value !== '') keys.add(String(stop.value));
  if (stop.label) keys.add(String(stop.label));
  for (const k of keys) {
    colorByKey.set(k, color);
    colorByKey.set(k.toLowerCase(), color);
  }
}

function resolveCategoryColor(colorByKey, featureValue, fallback, index) {
  const key = normalizePropertyValue(featureValue);
  if (!key) return fallback || QUALitative_PALETTE[index % QUALitative_PALETTE.length];
  return colorByKey.get(key)
    || colorByKey.get(key.toLowerCase())
    || fallback
    || QUALitative_PALETTE[index % QUALitative_PALETTE.length];
}

/**
 * Aligne sym.categories sur les valeurs réelles des features.
 * Fusionne les couleurs declarative (stops value + label) et catégories existantes.
 */
export function syncColorCategoriesFromFeatures(layer) {
  const sym = layer.style?.symbolization?.color;
  if (!sym || sym.mode !== 'categorized' || !sym.field) return sym;

  const vals = uniqueFieldValues(layer, sym.field);
  if (!vals.length) return sym;

  const colorByKey = new Map();
  for (const s of (layer._declarative?.stops || [])) {
    registerStopColors(colorByKey, s, s.color);
  }
  for (const c of (sym.categories || [])) {
    if (c.color != null) registerStopColors(colorByKey, { value: c.value, label: c.label }, c.color);
  }

  sym.categories = vals.map(({ value, count }, i) => ({
    value,
    count,
    color: resolveCategoryColor(colorByKey, value, sym.defaultColor, i),
  }));
  return sym;
}

/** Met à jour _fill_color sur chaque feature (aligné qgis2grist maplibre-bridge). */
export function applyCategoryColorsToFeatures(layer) {
  const sym = layer.style?.symbolization?.color;
  if (!sym || sym.mode !== 'categorized' || !sym.field) return;
  syncColorCategoriesFromFeatures(layer);
  const map = Object.fromEntries(
    (sym.categories || []).map((c) => [String(c.value), c.color])
  );
  const fallback = sym.defaultColor || layer.color || '#808080';
  const propKey = resolveFeaturePropertyKey(layer, sym.field);
  for (const f of (layer.geojson?.features || [])) {
    if (!f.properties) f.properties = {};
    const key = normalizePropertyValue(f.properties[propKey]);
    f.properties._fill_color = map[key] || fallback;
  }
}

/** Gradué → _fill_color par feature (palette séquentielle simple). */
export function applyGraduatedColorsToFeatures(layer, paletteHex) {
  const sym = layer.style?.symbolization?.color;
  if (!sym || sym.mode !== 'graduated' || !sym.field) return;
  const propKey = resolveFeaturePropertyKey(layer, sym.field);
  const nums = [];
  for (const f of (layer.geojson?.features || [])) {
    const n = parsePropertyNumber(f.properties?.[propKey]);
    if (Number.isFinite(n)) nums.push(n);
  }
  if (!nums.length) return;
  let min = Math.min(...nums);
  let max = Math.max(...nums);
  if (min === max) max = min + 1;
  const pal = paletteHex?.length ? paletteHex : QUALitative_PALETTE;
  const fallback = sym.defaultColor || sym.value || layer.color || '#808080';
  for (const f of (layer.geojson?.features || [])) {
    if (!f.properties) f.properties = {};
    const n = parsePropertyNumber(f.properties[propKey]);
    if (!Number.isFinite(n)) {
      f.properties._fill_color = fallback;
      continue;
    }
    const t = (n - min) / (max - min);
    const idx = Math.min(pal.length - 1, Math.floor(t * (pal.length - 1)));
    f.properties._fill_color = pal[idx];
  }
}

/** Couleur fixe sur toutes les features. */
export function applySingleColorToFeatures(layer, color) {
  const c = color || layer.color || '#808080';
  for (const f of (layer.geojson?.features || [])) {
    if (!f.properties) f.properties = {};
    f.properties._fill_color = c;
  }
}

/**
 * Met à jour _fill_color selon le mode symbolisation courant.
 * Aligné qgis2grist : le paint MapLibre lit _fill_color.
 */
export function syncFeatureColorsFromSymbolization(layer, paletteHex) {
  const sym = layer.style?.symbolization?.color;
  if (!sym || !layer.geojson?.features?.length) return;
  if (sym.mode === 'single') {
    applySingleColorToFeatures(layer, sym.value || layer.color);
    return;
  }
  if (sym.mode === 'categorized' && sym.field) {
    applyCategoryColorsToFeatures(layer);
    return;
  }
  if (sym.mode === 'graduated' && sym.field) {
    applyGraduatedColorsToFeatures(layer, paletteHex);
  }
}

/** Couleur principale d'une couche depuis StyleDeclarative. */
export function primaryColorFromDeclarative(decl, fallback = '#808080') {
  if (!decl) return fallback;
  if (decl.kind === 'single') return decl.color || fallback;
  if (decl.stops?.length) return decl.stops[0].color || fallback;
  return fallback;
}

/** Fonction de couleur par ligne (pour GeoJSON _fill_color). */
export function colorFnFromDeclarative(decl, fallback = '#808080', fieldNames = null) {
  if (!decl || decl.kind === 'single') {
    const c = decl?.color || fallback;
    return () => c;
  }

  let field = decl.field;
  if (fieldNames?.length) field = resolveGristFieldName(fieldNames, field) || field;

  if (decl.kind === 'categorized' && field && decl.stops?.length) {
    const map = new Map();
    for (const s of decl.stops) {
      registerStopColors(map, s, s.color || fallback);
    }
    return (row) => {
      const v = rowPropertyValue(row, fieldNames, field);
      return resolveCategoryColor(map, v, fallback, 0);
    };
  }

  if (decl.kind === 'graduated' && field && decl.stops?.length) {
    const stops = decl.stops;
    return (row) => {
      const val = parsePropertyNumber(rowPropertyValue(row, fieldNames, field));
      if (!Number.isFinite(val)) return fallback;
      const match = stops.find((s) => val >= (s.lower ?? -Infinity) && val <= (s.upper ?? Infinity));
      return match?.color || stops[stops.length - 1]?.color || fallback;
    };
  }
  return () => fallback;
}

/**
 * Applique StyleDeclarative sur layer.style.symbolization Atlas (crée si absent).
 */
export function applyDeclarativeToLayer(layer, declarative) {
  if (!layer.style) layer.style = { mode: 'mapbox' };
  if (!layer.style.symbolization) {
    layer.style.symbolization = {
      color: { mode: 'single', field: null, value: layer.color, palette: 'Tableau10', colorRamp: 'Viridis', categories: [], defaultColor: '#999999', method: 'linear' },
      size: { mode: 'single', field: null, value: layer.geometryType === 'Point' ? 8 : (layer.geometryType === 'Polygon' ? 12 : 4), outputRange: [4, 24], method: 'linear' },
      model: { mode: 'single', field: null, categories: [], defaultModelId: null },
      label: { enabled: false, field: null },
    };
  }
  const sym = layer.style.symbolization;
  const fb = layer.color || '#808080';
  const decl = declarative || { kind: 'single', color: fb };

  if (decl.kind === 'categorized' && decl.field) {
    const resolved = resolveGristFieldName(layer._fields, decl.field);
    sym.color.mode = 'categorized';
    sym.color.field = resolved;
    sym.color.palette = sym.color.palette || 'Tableau10';
    sym.color.defaultColor = fb;
    layer._declarative = decl;
    sym.color.categories = (decl.stops || []).map((s) => ({
      value: s.value,
      label: s.label,
      color: s.color || fb,
      count: 0,
    }));
    if (layer.geojson?.features?.length) {
      syncColorCategoriesFromFeatures(layer);
      applyCategoryColorsToFeatures(layer);
    }
  } else if (decl.kind === 'graduated' && decl.field) {
    sym.color.mode = 'graduated';
    sym.color.field = resolveGristFieldName(layer._fields, decl.field) || decl.field;
    sym.color.method = decl.method || 'linear';
    sym.color.colorRamp = sym.color.colorRamp || 'Viridis';
    sym.color.palette = sym.color.palette || 'Viridis';
    sym.color.defaultColor = fb;
    layer._declarative = decl;
    if (layer.geojson?.features?.length) {
      const ramp = (decl.stops || []).map((s) => s.color).filter(Boolean);
      applyGraduatedColorsToFeatures(layer, ramp.length ? ramp : null);
    }
  } else {
    sym.color.mode = 'single';
    sym.color.value = decl.color || fb;
  }
  return sym;
}

export { GEOM_FROM_MANIFEST };
