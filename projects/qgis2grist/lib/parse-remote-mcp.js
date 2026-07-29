/**
 * Parseur QgisRemoteMCP / export_web_map (var layersData = [...])
 * Utilisable en Node (tests) et en browser (script tag).
 */
(function (root, factory) {
  if (typeof module !== 'object' || !module.exports) {
    root.Q2GParseRemoteMcp = factory();
  } else {
    module.exports = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function normalizeHex(color) {
    if (!color) return '#888888';
    if (color.startsWith('#')) return color.slice(0, 7).toLowerCase();
    return color;
  }

  function normalizeLegendLabel(label) {
    return String(label || '').replace(/\s*\(\d+\)\s*$/, '').trim();
  }

  /** Légende graduée QGIS : "0-5 m", ">25 m", etc. */
  function isGraduatedLegend(legend) {
    if (!legend?.length) return false;
    const labels = legend.map(c => normalizeLegendLabel(c.label || c.value)).filter(Boolean);
    let hits = 0;
    for (const lab of labels) {
      if (/^>\s*\d+(?:[.,]\d+)?/.test(lab)) { hits++; continue; }
      if (/^\d+(?:[.,]\d+)?\s*-\s*\d+(?:[.,]\d+)?/.test(lab)) hits++;
    }
    return hits >= Math.max(2, Math.ceil(labels.length * 0.5));
  }

  function parseGraduatedLabel(label) {
    const lab = normalizeLegendLabel(label).replace(/,/g, '.');
    let m = lab.match(/^>\s*(\d+(?:\.\d+)?)/);
    if (m) return { lower: parseFloat(m[1]), upper: Infinity, label };
    m = lab.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
    if (m) return { lower: parseFloat(m[1]), upper: parseFloat(m[2]), label };
    return null;
  }

  function inferGraduatedField(features) {
    const sample = features.slice(0, 300);
    const preferred = ['hauteur', 'hauteur_max', 'hauteur_min', 'z', 'depth', 'niveau', 'valeur'];
    for (const pref of preferred) {
      if (sample.some(f => Number.isFinite(parseFloat(f.properties?.[pref])))) return pref;
    }
    const scores = {};
    for (const f of sample) {
      const p = f.properties || {};
      for (const [k, v] of Object.entries(p)) {
        if (k === '_color' || k === 'fid') continue;
        const n = parseFloat(v);
        if (!Number.isFinite(n)) continue;
        if (!scores[k]) scores[k] = 0;
        scores[k]++;
      }
    }
    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return ranked.length ? ranked[0][0] : null;
  }

  function buildGraduatedFromLegend(legend) {
    const categories = [];
    for (const cls of legend) {
      const parsed = parseGraduatedLabel(cls.label || cls.value);
      if (!parsed) continue;
      categories.push({
        lower: parsed.lower,
        upper: parsed.upper,
        value: parsed.label,
        label: cls.label || parsed.label,
        color: normalizeHex(cls.color),
      });
    }
    return categories.sort((a, b) => a.lower - b.lower);
  }

  function inferLegendCategoryField(features, legend) {
    const labels = legend.map(c => normalizeLegendLabel(c.label || c.value)).filter(Boolean);
    const sample = features.slice(0, 300);
    const skip = new Set(['_color', 'fid', 'gml_id', 'cleabs']);
    const scores = {};

    function valueMatchesLabel(sv, lab) {
      return sv === lab || lab.startsWith(sv) || sv.startsWith(lab) ||
        (lab.includes('unique') && (sv.includes('Sens direct') || sv.includes('Sens inverse'))) ||
        (lab.toLowerCase().includes('autre') && (sv === 'Sans objet' || sv.toLowerCase().includes('autre')));
    }

    for (const f of sample) {
      const p = f.properties || {};
      for (const [k, v] of Object.entries(p)) {
        if (skip.has(k) || v == null || v === '') continue;
        const sv = String(v).trim();
        if (!scores[k]) scores[k] = new Set();
        for (const lab of labels) {
          if (valueMatchesLabel(sv, lab)) scores[k].add(lab);
        }
      }
    }

    const ranked = Object.entries(scores)
      .map(([k, matched]) => ({ k, n: matched.size }))
      .filter(x => x.n > 0)
      .sort((a, b) => b.n - a.n);

    // Priorité explicite champs QGIS routiers
    const preferred = ['sens_de_circulation', 'nature', 'type_voie', 'importance'];
    for (const pref of preferred) {
      const hit = ranked.find(r => r.k === pref);
      if (hit) return hit.k;
    }
    if (ranked.length) return ranked[0].k;
    if (sample.some(f => f.properties && f.properties._color)) return '_color';
    return null;
  }

  function buildCategoriesFromLegend(legend, features, field) {
    if (field && field !== '_color') {
      const colorByValue = {};
      for (const f of features) {
        const p = f.properties || {};
        const key = String(p[field] ?? '').trim();
        if (key && p._color) colorByValue[key] = normalizeHex(p._color);
      }
      return legend.map(cls => {
        const base = normalizeLegendLabel(cls.label);
        const matchingValues = Object.keys(colorByValue).filter(v =>
          v === base || base.startsWith(v) || v.startsWith(base) ||
          (base.includes('unique') && (v.includes('Sens direct') || v.includes('Sens inverse')))
        );
        const value = matchingValues[0] || base;
        return {
          value,
          label: cls.label,
          color: colorByValue[value] || normalizeHex(cls.color),
        };
      });
    }
    if (field === '_color') {
      const colorCounts = {};
      for (const f of features) {
        const c = f.properties?._color;
        if (c) colorCounts[c.toLowerCase()] = (colorCounts[c.toLowerCase()] || 0) + 1;
      }
      return legend.map(cls => ({
        value: cls.color,
        label: cls.label,
        color: normalizeHex(cls.color),
        count: colorCounts[(cls.color || '').toLowerCase()] || 0,
      }));
    }
    return legend.map(cls => ({
      value: cls.value ?? normalizeLegendLabel(cls.label),
      label: cls.label,
      color: normalizeHex(cls.color),
    }));
  }

  /**
   * @param {string} html
   * @param {{ buildLayerFromGeojson?: Function }} hooks — requis en browser
   * @returns {Array|null}
   */
  function parseQgisRemoteMcpLayersData(html, hooks) {
    const m = html.match(/var\s+layersData\s*=\s*(\[[\s\S]*?\]);/);
    if (!m) return null;
    let layersData;
    try { layersData = JSON.parse(m[1]); } catch (e) { return null; }
    if (!Array.isArray(layersData) || !layersData.length) return null;

    const build = hooks?.buildLayerFromGeojson;
    if (typeof build !== 'function') return null;

    const layers = [];
    for (const ld of layersData) {
      const gj = ld.geojson;
      if (!gj || gj.type !== 'FeatureCollection' || !Array.isArray(gj.features) || !gj.features.length) continue;

      const layer = build(ld.name || ('Couche ' + (layers.length + 1)), gj);
      layer.datasource = layer.datasource || 'QgisRemoteMCP';
      layer.displayName = ld.name || layer.displayName;

      if (ld.legend && ld.legend.length) {
        if (isGraduatedLegend(ld.legend)) {
          const field = inferGraduatedField(gj.features);
          const categories = buildGraduatedFromLegend(ld.legend);
          if (field && categories.length >= 2) {
            layer.style = { type: 'graduatedSymbol', field, categories };
          } else if (gj.features.some(f => f.properties?._color)) {
            layer.style = {
              type: 'categorizedSymbol',
              field: '_color',
              categories: buildCategoriesFromLegend(ld.legend, gj.features, '_color'),
            };
          }
        } else {
          const field = inferLegendCategoryField(gj.features, ld.legend);
          layer.style = {
            type: 'categorizedSymbol',
            field: field || '_color',
            categories: buildCategoriesFromLegend(ld.legend, gj.features, field),
          };
        }
      } else if (ld.color) {
        layer.style = { type: 'singleSymbol', color: normalizeHex(ld.color) };
      }
      layers.push(layer);
    }
    return layers.length ? layers : null;
  }

  function hasInteractiveBigQgisUi(meta) {
    if (!meta) return false;
    if (meta.interactiveMap === 'flood' || meta.interactiveMap === 'temporal') return true;
    if (meta.colorScaleFns && Object.keys(meta.colorScaleFns).length) return true;
    const inf = meta.inferredStyles;
    if (inf && (inf.floodStyle || inf.buildingStyle)) return true;
    return !!(meta.sliderMax != null && meta.sliderMax !== meta.sliderMin && meta.legendItems?.some(i => i.threshold != null));
  }

  return {
    parseQgisRemoteMcpLayersData,
    inferLegendCategoryField,
    isGraduatedLegend,
    buildGraduatedFromLegend,
    inferGraduatedField,
    hasInteractiveBigQgisUi,
    normalizeHex,
  };
});
