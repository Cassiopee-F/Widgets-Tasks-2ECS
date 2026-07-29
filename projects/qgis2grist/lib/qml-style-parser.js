/**
 * parseQmlStyle — extraction styles QGIS (renderer-v2) pour Scene Manifest.
 * Gère pointCluster, ruleRenderer, fallback categorized imbriqué (Bee Farming).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.Q2GQmlParser = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function getDom() {
    if (typeof DOMParser !== 'undefined' && typeof XMLSerializer !== 'undefined') {
      return {
        parseFromString: (s, t) => new DOMParser().parseFromString(s, t),
        serializeToString: (n) => new XMLSerializer().serializeToString(n),
      };
    }
    try {
      const xmldom = require('@xmldom/xmldom');
      return {
        parseFromString: (s, t) => new xmldom.DOMParser().parseFromString(s, t),
        serializeToString: (n) => new xmldom.XMLSerializer().serializeToString(n),
      };
    } catch (_) {
      return null;
    }
  }

  function rgbaStringToHex(rgba) {
    if (!rgba) return null;
    const parts = String(rgba).split(',').map(s => parseInt(s.trim(), 10));
    if (parts.length < 3 || isNaN(parts[0])) return null;
    return '#' + parts.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function decodeQgsEntities(s) {
    return String(s || '')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  function parseQgsFilter(filter) {
    const f = decodeQgsEntities(filter).trim();
    if (!f) return { kind: 'else' };
    const rangeMatch = f.match(/"([^"]+)"\s*>=\s*([-\d.]+)\s+AND\s+"\1"\s*(?:<|<=)\s*([-\d.]+)/i);
    if (rangeMatch) {
      return { kind: 'range', field: rangeMatch[1], lower: parseFloat(rangeMatch[2]), upper: parseFloat(rangeMatch[3]) };
    }
    const eqMatch = f.match(/"([^"]+)"\s*=\s*'((?:\\'|[^'])*)'/);
    if (eqMatch) return { kind: 'eq', field: eqMatch[1], value: eqMatch[2].replace(/\\'/g, "'") };
    const eqNum = f.match(/"([^"]+)"\s*=\s*([-\d.]+)/);
    if (eqNum) return { kind: 'eq', field: eqNum[1], value: eqNum[2] };
    return { kind: 'expr', filter: f };
  }

  function inferRuleField(rules) {
    const r = (rules || []).find(x => x.field);
    return r?.field || '';
  }

  function normalizeRulesToStyle(rules) {
    const eqRules = (rules || []).filter(r => r.kind === 'eq' && r.field);
    if (eqRules.length >= 2 && eqRules.every(r => r.field === eqRules[0].field)) {
      return {
        type: 'categorizedSymbol',
        field: eqRules[0].field,
        categories: eqRules.map(r => ({ value: r.value, label: r.label || r.value, color: r.color })),
      };
    }
    const rangeRules = (rules || []).filter(r => r.kind === 'range' && r.field);
    if (rangeRules.length >= 2 && rangeRules.every(r => r.field === rangeRules[0].field)) {
      return {
        type: 'graduatedSymbol',
        field: rangeRules[0].field,
        categories: rangeRules.map(r => ({
          lower: r.lower,
          upper: r.upper,
          value: r.label || `${r.lower}–${r.upper}`,
          label: r.label || `${r.lower}–${r.upper}`,
          color: r.color,
        })),
      };
    }
    return null;
  }

  /** Déballage récursif pointCluster → renderer effectif. */
  function unwrapRendererElement(rendEl) {
    if (!rendEl) return null;
    let current = rendEl;
    for (let depth = 0; depth < 8; depth++) {
      const type = (current.getAttribute('type') || '').toLowerCase();
      if (type !== 'pointcluster') break;
      const children = current.getElementsByTagName('renderer-v2');
      let inner = null;
      for (let i = 0; i < children.length; i++) {
        if (children[i].parentNode === current) {
          inner = children[i];
          break;
        }
      }
      if (!inner) inner = qs(current, 'renderer-v2');
      if (!inner || inner === current) break;
      current = inner;
    }
    return current;
  }

  function qs(el, sel) {
    if (!el) return null;
    if (typeof el.querySelector === 'function') return el.querySelector(sel);
    if (sel === 'renderer-v2') {
      const nodes = el.getElementsByTagName('renderer-v2');
      return nodes.length ? nodes[0] : null;
    }
    if (sel === 'symbols > symbol') {
      const syms = el.getElementsByTagName('symbols');
      if (!syms.length) return null;
      const sym = syms[0].getElementsByTagName('symbol');
      return sym.length ? sym[0] : null;
    }
    return null;
  }

  function qsa(el, sel) {
    if (!el) return [];
    if (typeof el.querySelectorAll === 'function') return Array.from(el.querySelectorAll(sel));
    if (sel === 'renderer-v2') return Array.from(el.getElementsByTagName('renderer-v2'));
    if (sel === 'symbols > symbol') {
      const out = [];
      for (const syms of Array.from(el.getElementsByTagName('symbols'))) {
        for (const sym of Array.from(syms.getElementsByTagName('symbol'))) out.push(sym);
      }
      return out;
    }
    if (sel === 'categories > category') {
      const out = [];
      for (const cats of Array.from(el.getElementsByTagName('categories'))) {
        for (const cat of Array.from(cats.getElementsByTagName('category'))) out.push(cat);
      }
      return out;
    }
    if (sel === 'ranges > range') {
      const out = [];
      for (const ranges of Array.from(el.getElementsByTagName('ranges'))) {
        for (const range of Array.from(ranges.getElementsByTagName('range'))) out.push(range);
      }
      return out;
    }
    if (sel === 'rules > rule') {
      const out = [];
      for (const rules of Array.from(el.getElementsByTagName('rules'))) {
        for (const rule of Array.from(rules.getElementsByTagName('rule'))) out.push(rule);
      }
      return out;
    }
    return [];
  }

  function symColorHex(sym) {
    if (!sym) return null;
    let opt = null;
    if (typeof sym.querySelector === 'function') {
      opt = sym.querySelector("Option[name='color']");
    } else {
      for (const o of sym.getElementsByTagName('Option')) {
        if (o.getAttribute('name') === 'color') { opt = o; break; }
      }
    }
    let prop = null;
    if (typeof sym.querySelector === 'function') {
      prop = sym.querySelector("prop[k='color']");
    } else {
      for (const p of sym.getElementsByTagName('prop')) {
        if (p.getAttribute('k') === 'color') { prop = p; break; }
      }
    }
    return rgbaStringToHex(opt?.getAttribute('value')) || rgbaStringToHex(prop?.getAttribute('v'));
  }

  function buildSymColors(doc) {
    const symColors = {};
    for (const sym of qsa(doc, 'symbols > symbol')) {
      const name = sym.getAttribute('name');
      const hex = symColorHex(sym);
      if (hex) symColors[name] = hex;
    }
    return symColors;
  }

  function parseRendererDoc(doc) {
    const renderer = qs(doc, 'renderer-v2')
      || (doc.documentElement && doc.documentElement.tagName === 'renderer-v2' ? doc.documentElement : null);
    if (!renderer) return null;

    const unwrapped = unwrapRendererElement(renderer);
    const target = unwrapped || renderer;
    const type = target.getAttribute('type') || '';
    const field = target.getAttribute('attr') || target.getAttribute('field') || '';
    const symColors = buildSymColors(doc);

    if (type === 'categorizedSymbol') {
      const categories = [];
      for (const cat of qsa(target, 'categories > category')) {
        const value = cat.getAttribute('value') ?? '';
        const label = cat.getAttribute('label') || value;
        const symbol = cat.getAttribute('symbol');
        categories.push({ value, label, color: symColors[symbol] || null });
      }
      return { type, field, categories };
    }

    if (type === 'singleSymbol') {
      const sym = qs(target, 'symbols > symbol') || qs(doc, 'symbols > symbol');
      const color = symColorHex(sym);
      return { type, field: null, color, categories: [] };
    }

    if (type === 'graduatedSymbol') {
      const categories = [];
      for (const range of qsa(target, 'ranges > range')) {
        const lower = parseFloat(range.getAttribute('lower') || 0);
        const upper = parseFloat(range.getAttribute('upper') || 0);
        const label = range.getAttribute('label') || `${lower}–${upper}`;
        const symbol = range.getAttribute('symbol');
        categories.push({ lower, upper, value: label, label, color: symColors[symbol] || null });
      }
      return { type, field, categories };
    }

    if (type === 'RuleRenderer' || type === 'ruleRenderer') {
      const rules = [];
      for (const ruleEl of qsa(target, 'rules > rule')) {
        const filter = ruleEl.getAttribute('filter') || '';
        const label = ruleEl.getAttribute('label') || '';
        const symbol = ruleEl.getAttribute('symbol');
        rules.push({
          ...parseQgsFilter(filter),
          filter,
          label,
          color: symColors[symbol] || null,
          symbol,
        });
      }
      const normalized = normalizeRulesToStyle(rules);
      if (normalized) return normalized;
      const ruleField = field || inferRuleField(rules);
      return {
        type: 'ruleRenderer',
        field: ruleField,
        rules,
        categories: rules.filter(r => r.label).map(r => ({
          value: r.label,
          label: r.label,
          color: r.color,
        })),
      };
    }

    return null;
  }

  function scoreStyle(style) {
    if (!style) return -1;
    if (style.type === 'categorizedSymbol' && style.field && style.categories?.length) {
      return 100 + style.categories.length;
    }
    if (style.type === 'graduatedSymbol' && style.field && style.categories?.length) {
      return 80 + style.categories.length;
    }
    if (style.type === 'singleSymbol' && style.color) return 10;
    if (style.type === 'ruleRenderer') return style.field ? 20 : 5;
    return 0;
  }

  /**
   * Parse un fragment QML (renderer-v2 seul ou maplayer).
   */
  function parseQmlStyle(qmlText) {
    if (!qmlText) return null;
    const dom = getDom();
    if (!dom) return null;
    try {
      const doc = dom.parseFromString(qmlText, 'text/xml');
      return parseRendererDoc(doc);
    } catch (e) {
      return null;
    }
  }

  /**
   * Choisit le meilleur style d'une couche QGIS (pointCluster, categorized imbriqué).
   * @param {Element} mapLayerEl - élément maplayer
   */
  function parseMapLayerStyle(mapLayerEl) {
    if (!mapLayerEl) return null;
    const dom = getDom();
    if (!dom) return null;

    const candidates = [];
    const top = qs(mapLayerEl, 'renderer-v2')
      || (mapLayerEl.tagName === 'maplayer' ? mapLayerEl.getElementsByTagName('renderer-v2')[0] : null);
    if (top) {
      const unwrapped = unwrapRendererElement(top);
      if (unwrapped) {
        candidates.push(parseQmlStyle(dom.serializeToString(unwrapped)));
      }
      candidates.push(parseQmlStyle(dom.serializeToString(top)));
    }

    for (const rend of qsa(mapLayerEl, 'renderer-v2')) {
      const rtype = rend.getAttribute('type') || '';
      if (rtype === 'categorizedSymbol' || rtype === 'graduatedSymbol') {
        candidates.push(parseQmlStyle(dom.serializeToString(rend)));
      }
    }

    const valid = candidates.filter(Boolean);
    if (!valid.length) return null;
    valid.sort((a, b) => scoreStyle(b) - scoreStyle(a));
    return valid[0];
  }

  return {
    rgbaStringToHex,
    decodeQgsEntities,
    parseQgsFilter,
    inferRuleField,
    normalizeRulesToStyle,
    unwrapRendererElement,
    parseQmlStyle,
    parseMapLayerStyle,
    scoreStyle,
  };
});
