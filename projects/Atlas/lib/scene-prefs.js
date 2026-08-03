/**
 * Persistance prefs scène Atlas — contrôles environnement (ViewerJSON).
 */
import {
  createDefaultViewerControls,
  parseViewerControls,
  serializeViewerControls,
} from './viewer-controls.js';

export const ATLAS_SCENE_PREFS_TABLE = 'Atlas_ScenePrefs';

const SCENE_PREFS_SCHEMA = [
  { id: 'ViewerJSON', fields: { label: 'Contrôles environnement (JSON)', type: 'Text' } },
];

let _prefRowId = null;

/** @param {import('./viewer-controls.js').ViewerControl[]} list */
export function prefsPayloadFromViewerControls(list) {
  return { ViewerJSON: JSON.stringify(serializeViewerControls(list)) };
}

/** @param {Record<string, unknown[]>} rec @param {number} i */
export function viewerControlsFromPrefsRow(rec, i) {
  try {
    const raw = JSON.parse(String(rec.ViewerJSON?.[i] || '[]'));
    return parseViewerControls(raw);
  } catch (_) {
    return createDefaultViewerControls();
  }
}

export async function ensureScenePrefsTable(docApi, opts = {}) {
  if (!docApi || opts.viewMode) return;
  const tables = await docApi.listTables();
  if (!tables.includes(ATLAS_SCENE_PREFS_TABLE)) {
    await docApi.applyUserActions([['AddTable', ATLAS_SCENE_PREFS_TABLE, SCENE_PREFS_SCHEMA]]);
  }
}

/** @returns {Promise<{ viewerControls: import('./viewer-controls.js').ViewerControl[] }>} */
export async function loadScenePrefs(docApi) {
  if (!docApi) return { viewerControls: createDefaultViewerControls() };
  try {
    const tables = await docApi.listTables();
    if (!tables.includes(ATLAS_SCENE_PREFS_TABLE)) {
      _prefRowId = null;
      return { viewerControls: createDefaultViewerControls() };
    }
    const rec = await docApi.fetchTable(ATLAS_SCENE_PREFS_TABLE);
    const ids = rec.id || [];
    if (!ids.length) {
      _prefRowId = null;
      return { viewerControls: createDefaultViewerControls() };
    }
    _prefRowId = ids[0];
    return { viewerControls: viewerControlsFromPrefsRow(rec, 0) };
  } catch (e) {
    console.warn('[Atlas scene-prefs] load', e.message);
    return { viewerControls: createDefaultViewerControls() };
  }
}

/** @param {{ viewerControls: import('./viewer-controls.js').ViewerControl[] }} prefs */
export async function saveScenePrefs(docApi, prefs, opts = {}) {
  if (!docApi || opts.viewMode) return;
  await ensureScenePrefsTable(docApi, opts);
  const data = prefsPayloadFromViewerControls(prefs.viewerControls || createDefaultViewerControls());
  if (_prefRowId != null) {
    await docApi.applyUserActions([['UpdateRecord', ATLAS_SCENE_PREFS_TABLE, _prefRowId, data]]);
  } else {
    const r = await docApi.applyUserActions([['AddRecord', ATLAS_SCENE_PREFS_TABLE, null, data]]);
    _prefRowId = r.retValues?.[0] ?? null;
  }
}
