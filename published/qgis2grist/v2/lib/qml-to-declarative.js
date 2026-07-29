/**
 * QGIS QML style (parseQmlStyle output) → Scene Manifest StyleDeclarative.
 * kinds MVP : single, categorized, graduated.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Q2G = root.Q2G || {};
    Object.assign(root.Q2G, factory());
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const QGIS_TO_KIND = {
    singleSymbol: 'single',
    categorizedSymbol: 'categorized',
    graduatedSymbol: 'graduated',
    ruleRenderer: 'categorized',
  };

  /** Normalise une couleur en #RRGGBB (6 digits, sans alpha). */
  function normalizeHex(color, fallback) {
    const fb = fallback || '#808080';
    if (!color || typeof color !== 'string') return fb;
    const c = color.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(c)) {
      return ('#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]).toLowerCase();
    }
    const rgba = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (rgba) {
      const hex = [rgba[1], rgba[2], rgba[3]]
        .map(v => Math.min(255, parseInt(v, 10)).toString(16).padStart(2, '0'))
        .join('');
      return '#' + hex;
    }
    return fb;
  }

  /**
   * Convertit le style interne qgis2grist (parseQmlStyle) en StyleDeclarative V0.2.
   * @param {object|null} qmlStyle - { type, field, color?, categories? }
   * @param {{ fallbackColor?: string }} [opts]
   */
  function qmlStyleToDeclarative(qmlStyle, opts) {
    const fallback = normalizeHex(opts?.fallbackColor, '#808080');
    if (!qmlStyle || !qmlStyle.type) {
      return { kind: 'single', color: fallback, opacity: 1 };
    }

    const kind = QGIS_TO_KIND[qmlStyle.type];
    if (!kind) return { kind: 'single', color: fallback, opacity: 1 };

    if (kind === 'single') {
      return {
        kind: 'single',
        color: normalizeHex(qmlStyle.color, fallback),
        opacity: 1,
      };
    }

    const field = qmlStyle.field || null;

    if (kind === 'categorized') {
      const stops = (qmlStyle.categories || []).map(cat => {
        const rawVal = cat.value != null ? String(cat.value) : '';
        const lbl = (cat.label || '').trim();
        return {
          value: rawVal || lbl,
          label: lbl || rawVal,
          color: normalizeHex(cat.color, fallback),
          opacity: 1,
        };
      });
      return { kind: 'categorized', field, stops };
    }

    if (kind === 'graduated') {
      const stops = (qmlStyle.categories || []).map(cat => ({
        lower: cat.lower ?? 0,
        upper: cat.upper ?? 0,
        label: cat.label || cat.value || '',
        color: normalizeHex(cat.color, fallback),
        opacity: 1,
      }));
      return { kind: 'graduated', field, method: 'equal', stops };
    }

    return { kind: 'single', color: fallback, opacity: 1 };
  }

  /**
   * Enrichit un objet layer avec style.declarative (sans muter l'original si copy=true).
   */
  function enrichLayerWithDeclarative(layer, fallbackColor) {
    const declarative = qmlStyleToDeclarative(layer.style, { fallbackColor });
    return {
      ...layer,
      style: {
        ...(layer.style || {}),
        declarative,
        qml_source: layer.style?.qml_source ?? null,
      },
    };
  }

  return {
    QGIS_TO_KIND,
    normalizeHex,
    qmlStyleToDeclarative,
    enrichLayerWithDeclarative,
  };
});
