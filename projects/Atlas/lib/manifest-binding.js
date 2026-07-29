/**
 * Binding Atlas ↔ Scene Manifest V0.2 (StyleDeclarative + ControlDeclarative + prefs).
 * Aligné offre de service Cerema / interop interactive_map.
 */
import {
  applyDeclarativeToLayer,
  resolveGristFieldName,
} from './declarative-style.js?v=20260729b';
import {
  applyControlDeclarativesToLayer,
  applyControlsFromPrefs,
  controlDeclarativesFromAtlasLayer,
  controlsPrefsPayload,
} from './controls.js?v=20260729m';
import { parseGristBool } from './grist-bool.js';

/** StyleDeclarative ← symbolisation Atlas courante. */
export function declarativeFromAtlasLayer(layer) {
  const sym = layer.style?.symbolization?.color;
  const fb = layer.color || '#808080';
  if (!sym) return { kind: 'single', color: fb, opacity: 1 };

  if (sym.mode === 'single') {
    return { kind: 'single', color: sym.value || fb, opacity: 1 };
  }

  if (sym.mode === 'categorized' && sym.field) {
    const field = resolveGristFieldName(layer._fields, sym.field) || sym.field;
    const stops = (sym.categories || []).map((c) => ({
      value: c.value,
      label: String(c.value ?? ''),
      color: c.color || fb,
      opacity: 1,
    }));
    return { kind: 'categorized', field, stops };
  }

  if (sym.mode === 'graduated' && sym.field) {
    const field = resolveGristFieldName(layer._fields, sym.field) || sym.field;
    const prev = layer._declarative;
    if (prev?.kind === 'graduated' && prev.field === field && prev.stops?.length) {
      return {
        kind: 'graduated',
        field,
        method: sym.method || prev.method || 'linear',
        stops: prev.stops,
      };
    }
    const lo = sym.inputRange?.[0] ?? 0;
    const hi = sym.inputRange?.[1] ?? (lo + 1);
    const span = hi - lo || 1;
    const colors = ['#ffffcc', '#a1dab4', '#41b6c4', '#2c7fb8', '#253494'];
    const stops = colors.map((color, i) => ({
      lower: lo + (span * i) / colors.length,
      upper: lo + (span * (i + 1)) / colors.length,
      color,
      opacity: 1,
    }));
    return { kind: 'graduated', field, method: sym.method || 'linear', stops };
  }

  return { kind: 'single', color: fb, opacity: 1 };
}

/** Payload prefs Grist (StyleJSON structuré). */
export function layerPrefsPayload(layer) {
  return {
    mode: layer.style?.mode || 'mapbox',
    symbolization: layer.style?.symbolization || null,
    controls: controlsPrefsPayload(layer),
    declarative: declarativeFromAtlasLayer(layer),
  };
}

/**
 * Applique prefs Atlas (priorité utilisateur sur manifest import).
 * Visibilité appliquée dès qu'une ligne prefs existe (même sans StyleJSON).
 * @returns {boolean} true si des prefs ont été appliquées
 */
export function applyLayerPrefsBinding(layer, prefs) {
  if (!prefs) return false;
  let applied = false;

  if (prefs.style) {
    const payload = prefs.style;

    if (payload.declarative) {
      layer._declarative = payload.declarative;
      applyDeclarativeToLayer(layer, payload.declarative);
    } else if (payload.symbolization) {
      layer.style = { ...layer.style, mode: payload.mode || 'mapbox', symbolization: payload.symbolization };
    }

    if (payload.controls?.length) {
      applyControlsFromPrefs(layer, payload.controls);
    } else if (Array.isArray(payload._controls)) {
      applyControlsFromPrefs(layer, payload._controls);
    }
    applied = true;
  }

  if (prefs.prefRowId != null) {
    layer.visible = parseGristBool(prefs.visible, true);
    layer._prefRowId = prefs.prefRowId;
    applied = true;
  }

  return applied;
}

/** Applique controls[] d'une entrée Scene Manifest layer. */
export function applyManifestControlsToLayer(layer, manifestLayer) {
  const controls = manifestLayer?.controls;
  if (!controls?.length) return;
  applyControlDeclarativesToLayer(layer, controls, { activateDefaults: false });
}

/** Met à jour _declarative couche après édition symbo (round-trip). */
export function syncLayerDeclarative(layer) {
  layer._declarative = declarativeFromAtlasLayer(layer);
}

export { controlDeclarativesFromAtlasLayer, applyControlDeclarativesToLayer };
