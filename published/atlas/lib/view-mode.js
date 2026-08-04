/**
 * Mode lecture Atlas — parse URL + intent d'accès Grist + garde écriture.
 * Spec : docs/superpowers/specs/2026-07-30-atlas-view-mobile-design.md
 */

/**
 * @param {string} [search] location.search (avec ou sans « ? »)
 * @returns {'view'|'edit'|'auto'}
 */
export function parseAtlasMode(search = '') {
  const q = String(search || '').replace(/^\?/, '');
  const params = new URLSearchParams(q);
  const raw = (params.get('mode') || '').trim().toLowerCase();
  if (raw === 'view' || raw === 'lecture' || raw === 'read') return 'view';
  if (raw === 'edit' || raw === 'edition' || raw === 'édition') return 'edit';
  return 'auto';
}

/**
 * @param {'view'|'edit'|'auto'} mode
 * @returns {{ viewModeForced: boolean, preferFull: boolean, requiredAccess: 'full'|'read table' }}
 */
export function accessIntentFromMode(mode) {
  if (mode === 'view') {
    return { viewModeForced: true, preferFull: false, requiredAccess: 'read table' };
  }
  if (mode === 'edit') {
    return { viewModeForced: false, preferFull: true, requiredAccess: 'full' };
  }
  return { viewModeForced: false, preferFull: true, requiredAccess: 'full' };
}

/** @param {boolean} viewMode */
export function canWrite(viewMode) {
  return !viewMode;
}

/**
 * Erreur ACL / viewer Grist (doc public view-only, droits lecture).
 * @param {unknown} err
 */
export function isWriteAclError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  if (!msg) return false;
  return /view[\s-]?only|read[\s-]?only|cannot modify|not allowed|permission|denied|forbidden|acl|access (is )?denied|insufficient|no write|écriture|lecture seule/.test(msg);
}

const PROBE_ROW_ID = 999999999;
const PROBE_TABLE_PREF = ['Atlas_LayerPrefs', 'Atlas_Story', 'SceneManifest', 'Maquette_Layers'];

/**
 * Table métier pour la sonde (évite `_Grist_*` : UpdateRecord y échoue même pour un admin).
 * @param {{ listTables?: Function }} docApi
 * @returns {Promise<string>}
 */
export async function resolveProbeTableId(docApi) {
  if (docApi && typeof docApi.listTables === 'function') {
    try {
      const tables = await docApi.listTables();
      const list = Array.isArray(tables) ? tables : [];
      const preferred = PROBE_TABLE_PREF.find((t) => list.includes(t));
      if (preferred) return preferred;
      const any = list.find((t) => t && !String(t).startsWith('_'));
      if (any) return any;
    } catch (_) { /* ignore */ }
  }
  return 'SceneManifest';
}

/**
 * Sonde : le compte courant peut-il muter le doc ?
 * `grist.ready({ requiredAccess: 'full' })` ne suffit pas — le widget peut être
 * « Full » au niveau section alors que l’utilisateur public est viewer-only ;
 * et le chemin Scene Manifest ne tente aucune écriture au boot.
 *
 * Politique : forcer lecture seulement sur erreur ACL claire.
 * Autres erreurs (row missing, table inconnue, metadata) → writable
 * (un admin ne doit pas rester bloqué en Lecture).
 *
 * @param {{ applyUserActions?: Function, listTables?: Function }} docApi
 * @returns {Promise<boolean>}
 */
export async function probeCanWriteDoc(docApi) {
  if (!docApi || typeof docApi.applyUserActions !== 'function') return false;
  const tableId = await resolveProbeTableId(docApi);
  try {
    // UpdateRecord sur row inexistante :
    // - ACL viewer → erreur droits → lecture
    // - éditeur → « not found » / invalid row → writable
    await docApi.applyUserActions([['UpdateRecord', tableId, PROBE_ROW_ID, {}]]);
    return true;
  } catch (e) {
    if (isWriteAclError(e)) return false;
    const msg = String(e?.message || e || '').toLowerCase();
    if (/not found|does not exist|no such|invalid|unknown row|row id|missing|no record/.test(msg)) {
      return true;
    }
    if (/metadata|cannot yet|internal table|_grist/.test(msg)) return true;
    if (/unknown table|no such table|table .*not found/.test(msg)) return true;
    // Doute après ready(full) : privilégier édition (admin) — ACL doit matcher isWriteAclError
    return true;
  }
}

/**
 * @param {{ viewMode?: boolean, no3dParam?: boolean, isNarrow?: boolean, hardwareConcurrency?: number }} opts
 */
export function shouldEnableLight3d(opts = {}) {
  if (opts.no3dParam) return true;
  const cores = Number(opts.hardwareConcurrency);
  if (opts.isNarrow && Number.isFinite(cores) && cores > 0 && cores <= 4) return true;
  if (opts.viewMode && opts.isNarrow) return true;
  return false;
}

/**
 * Lit ?no3d=1 depuis search.
 * @param {string} [search]
 */
export function parseNo3dParam(search = '') {
  const q = String(search || '').replace(/^\?/, '');
  const v = new URLSearchParams(q).get('no3d');
  return v === '1' || v === 'true' || v === 'yes';
}
