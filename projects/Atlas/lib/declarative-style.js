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
  // Des classes explicitement bornées font autorité sur l'étalement linéaire.
  // Sans cela, une distribution asymétrique (la plupart des mailles à 1 ou 2
  // bâtiments, quelques-unes à 134) verse presque tout dans la première classe.
  const bornes = (layer._declarative?.stops || []).filter(
    (s) => Number.isFinite(s?.lower) || Number.isFinite(s?.upper));
  if (bornes.length) {
    const repli = sym.defaultColor || sym.value || layer.color || '#808080';
    for (const f of (layer.geojson?.features || [])) {
      if (!f.properties) f.properties = {};
      const n = parsePropertyNumber(f.properties[propKey]);
      if (!Number.isFinite(n)) { f.properties._fill_color = repli; continue; }
      const cl = bornes.find((s) => n >= (s.lower ?? -Infinity) && n <= (s.upper ?? Infinity));
      f.properties._fill_color = cl?.color || repli;
    }
    return;
  }
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
/**
 * Opacité par entité depuis les stops du style déclaratif.
 *
 * Le contrat Scene Manifest porte une `opacity` par classe ; sans cette
 * lecture, elle resterait décorative et toutes les entités s'afficheraient à
 * l'opacité fixe du moteur. Renvoie null si aucun stop n'en déclare, pour que
 * l'appelant garde son défaut.
 *
 * @returns {((row: object) => number) | null}
 */
export function opacityFnFromDeclarative(decl, fieldNames = null) {
  if (!decl) return null;

  if (decl.kind === 'single') {
    return Number.isFinite(decl.opacity) ? () => decl.opacity : null;
  }

  const stops = decl.stops || [];
  if (!stops.some((s) => Number.isFinite(s?.opacity))) return null;

  let field = decl.field;
  if (fieldNames?.length) field = resolveGristFieldName(fieldNames, field) || field;
  if (!field) return null;

  if (decl.kind === 'categorized') {
    const map = new Map();
    for (const s of stops) {
      if (Number.isFinite(s?.opacity)) registerStopColors(map, s, s.opacity);
    }
    return (row) => {
      const v = rowPropertyValue(row, fieldNames, field);
      const o = resolveCategoryColor(map, v, null, 0);
      return Number.isFinite(o) ? o : null;
    };
  }

  if (decl.kind === 'graduated') {
    return (row) => {
      const val = parsePropertyNumber(rowPropertyValue(row, fieldNames, field));
      if (!Number.isFinite(val)) return null;
      const match = stops.find((s) => val >= (s.lower ?? -Infinity) && val <= (s.upper ?? Infinity));
      const o = match?.opacity ?? stops[stops.length - 1]?.opacity;
      return Number.isFinite(o) ? o : null;
    };
  }
  return null;
}

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
 * La même symbologie, mais dite à MapLibre au lieu d'être peinte à la main.
 *
 * `colorFnFromDeclarative` ci-dessus calcule une couleur **par entité**, en
 * JavaScript, et l'écrit dans `_fill_color`. Cela suppose de détenir les
 * entités — ce qui n'est plus vrai d'une couche servie par URL ou par tuiles :
 * le champ n'existe pas dans les données, et toute la couche prend alors la
 * couleur de repli, sans que rien ne le signale.
 *
 * Une expression, elle, est évaluée par le moteur sur ce qu'il rend, quelle que
 * soit l'origine — et sans que le contrat ait à déclarer quoi que ce soit de
 * plus : les bornes sont déjà dans les `stops`.
 *
 * @returns {any[]|null} expression MapLibre, ou null si le déclaratif ne permet
 *   pas d'en construire une — l'appelant retombe alors sur sa couleur de repli.
 */
export function expressionCouleurDeclarative(decl, fallback = '#808080', fieldNames = null) {
  if (!decl) return null;
  if (decl.kind === 'single') return decl.color || fallback;

  let field = decl.field;
  if (fieldNames?.length) field = resolveGristFieldName(fieldNames, field) || field;
  if (!field || !decl.stops?.length) return null;

  if (decl.kind === 'categorized') {
    const expr = ['match', ['get', field]];
    for (const st of decl.stops) {
      // Une catégorie peut se désigner par sa valeur brute ou par son libellé —
      // `registerStopColors` en tient compte, l'expression doit en faire autant.
      const valeurs = [...new Set([st.value, st.label].filter(
        (v) => v !== undefined && v !== null && v !== ''))];
      if (!valeurs.length) continue;
      // MapLibre refuse un tableau vide et accepte une valeur seule ou plusieurs.
      expr.push(valeurs.length === 1 ? valeurs[0] : valeurs, st.color || fallback);
    }
    // 'match' exige au moins un couple, plus la valeur par défaut.
    if (expr.length < 4) return null;
    expr.push(fallback);
    return expr;
  }

  if (decl.kind === 'graduated') {
    const stops = [...decl.stops]
      .filter((st) => Number.isFinite(Number(st.lower ?? st.upper)))
      .sort((a, b) => Number(a.lower ?? -Infinity) - Number(b.lower ?? -Infinity));
    if (!stops.length) return null;

    // 'step' rend la couleur de base sous le premier seuil, puis change à
    // chaque borne inférieure. Les classes d'une graduation étant contiguës,
    // les bornes basses suffisent — les hautes seraient redondantes.
    const expr = ['step', ['to-number', ['get', field], -Infinity], stops[0].color || fallback];
    for (const st of stops.slice(1)) {
      const seuil = Number(st.lower);
      if (!Number.isFinite(seuil)) continue;
      expr.push(seuil, st.color || fallback);
    }
    if (expr.length < 3) return null;
    return expr;
  }

  return null;
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

/* ------------------------------------------------------------------ *
 * Classes graduées — bornes et couleurs.
 *
 * Un style gradué porte deux informations de nature différente : les **bornes**
 * de classes, qui disent comment la donnée est découpée (choix d'analyse), et
 * les **couleurs**, qui disent comment ce découpage se lit (choix graphique).
 *
 * Les confondre a produit un défaut visible : choisir une palette dans
 * l'inspecteur mettait à jour la légende sans jamais atteindre la carte, parce
 * que le rendu lisait la couleur des classes existantes. Les deux réglages sont
 * donc traités séparément ci-dessous.
 * ------------------------------------------------------------------ */

/** Transformation d'échelle appliquée aux bornes. */
function transformer(v, method) {
  if (method === 'log') return Math.log(Math.max(0, v) + 1);
  if (method === 'sqrt') return Math.sqrt(Math.max(0, v));
  return v;
}

/** Transformation inverse, pour revenir aux valeurs de la donnée. */
function detransformer(v, method) {
  if (method === 'log') return Math.exp(v) - 1;
  if (method === 'sqrt') return v * v;
  return v;
}

/**
 * Bornes de `n` classes entre `min` et `max`, selon la méthode de répartition.
 *
 * En linéaire les classes sont d'égale largeur ; en log ou en racine elles le
 * sont dans l'espace transformé, ce qui resserre les petites valeurs. Sur une
 * distribution asymétrique — la plupart des mailles à 1 ou 2 bâtiments,
 * quelques-unes à 134 — c'est ce qui rend la carte lisible.
 *
 * @returns {Array<{lower: number, upper: number}>}
 */
export function classBounds(min, max, n, method = 'linear') {
  const nb = Math.max(1, Math.floor(n) || 1);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (max <= min) return [{ lower: min, upper: min }];
  const a = transformer(min, method);
  const b = transformer(max, method);
  const pas = (b - a) / nb;
  const out = [];
  for (let i = 0; i < nb; i++) {
    out.push({
      lower: i === 0 ? min : detransformer(a + pas * i, method),
      upper: i === nb - 1 ? max : detransformer(a + pas * (i + 1), method),
    });
  }
  return out;
}

/**
 * Ré-applique une palette aux classes existantes, **sans toucher aux bornes**.
 *
 * C'est ce que veut dire « changer de palette » : le découpage de la donnée est
 * un choix d'analyse, il ne doit pas être perdu parce qu'on change de couleurs.
 */
export function recolorStops(stops, paletteHex) {
  const list = Array.isArray(stops) ? stops : [];
  const pal = Array.isArray(paletteHex) ? paletteHex.filter(Boolean) : [];
  if (!list.length || !pal.length) return list;
  const dernier = Math.max(1, list.length - 1);
  return list.map((s, i) => ({
    ...s,
    color: pal[Math.min(pal.length - 1, Math.round((i * (pal.length - 1)) / dernier))],
  }));
}

/** Classes complètes — bornes selon la méthode, couleurs selon la palette. */
export function graduatedStops(min, max, paletteHex, method = 'linear') {
  const pal = Array.isArray(paletteHex) ? paletteHex.filter(Boolean) : [];
  if (!pal.length) return [];
  return classBounds(min, max, pal.length, method).map((b, i) => ({
    ...b,
    color: pal[Math.min(pal.length - 1, i)],
    opacity: 1,
  }));
}
