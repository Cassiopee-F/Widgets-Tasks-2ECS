/**
 * Trouver les scenes Atlas d'un compte.
 *
 * Porte de SURFAC²E (`_core/decouverte.js`), avec deux differences qui comptent.
 *
 * 1. La SIGNATURE. SURFAC²E exige que ses trois tables soient toutes presentes
 *    (`every`). Pour Atlas ce serait faux : une scene peut avoir un
 *    `SceneManifest` sans recit, ou des preferences sans manifeste. Une seule
 *    table suffit donc a reconnaitre un document (`some`) — avec `every`, la
 *    recherche ne ramenerait presque rien.
 *
 * 2. L'ADRESSE. SURFAC²E passe par un relais de meme origine (en-tete
 *    `X-Grist-Base`) pour contourner CORS. Atlas s'adresse directement a
 *    l'instance : c'est possible dans l'APK, ou le client HTTP natif emet les
 *    requetes hors du moteur web. En navigateur, `/orgs` renvoie une liste vide
 *    faute d'authentification — la decouverte y est donc impossible, et
 *    l'interface doit le dire plutot que d'afficher un resultat vide.
 */

export const VERSION = '1.0.0';

/** Une seule de ces tables suffit a reconnaitre une scene Atlas. */
export const TABLES_SIGNATURE = ['Atlas_LayerPrefs', 'Atlas_Story', 'SceneManifest', 'Atlas_ScenePrefs'];

/** Sondages simultanes. Au-dela, on inonde l'instance sans rien gagner. */
export const PARALLELISME = 8;

function entetes(jeton) {
  const h = { 'Content-Type': 'application/json' };
  if (jeton) h.Authorization = 'Bearer ' + jeton;
  return h;
}

async function jget(url, jeton, fetchFn) {
  const r = await (fetchFn || fetch)(url, { headers: entetes(jeton) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

/**
 * Pool a concurrence bornee. Une tache qui echoue rend `null` sans arreter les
 * autres : un document illisible ne doit pas interrompre l'exploration.
 */
async function enParallele(items, limite, tache) {
  const out = new Array(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const k = i++;
      try { out[k] = await tache(items[k], k); } catch (_) { out[k] = null; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, worker));
  return out;
}

/** Tous les documents accessibles, a plat, avec leur organisation et leur espace. */
export async function listerTousDocs(baseUrl, jeton, fetchFn) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const orgs = await jget(`${base}/api/orgs`, jeton, fetchFn);
  const docs = [];
  for (const org of orgs) {
    let espaces = [];
    try { espaces = await jget(`${base}/api/orgs/${org.id}/workspaces`, jeton, fetchFn); }
    catch (_) { continue; }
    for (const e of espaces) {
      for (const d of (e.docs || [])) {
        docs.push({
          id: d.id, nom: d.name, org: org.name, espace: e.name,
          maj: d.updatedAt || d.createdAt || '',
        });
      }
    }
  }
  return docs;
}

/** Ce document porte-t-il une scene Atlas ? */
export async function estSceneAtlas(docId, baseUrl, jeton, fetchFn) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  try {
    const t = await jget(`${base}/api/docs/${docId}/tables`, jeton, fetchFn);
    const ids = new Set((t.tables || []).map((x) => x.id));
    return TABLES_SIGNATURE.some((nom) => ids.has(nom));
  } catch (_) { return false; }
}

/**
 * Les scenes Atlas du compte, de la plus recemment modifiee a la plus ancienne.
 *
 * `onTrouve` est appele des qu'une scene est reconnue : la liste se remplit
 * pendant l'exploration au lieu d'apparaitre d'un bloc a la fin. `onProgres`
 * suit l'avancement, qui se compte en documents sondes, pas en scenes trouvees.
 */
export async function listerScenesAtlas(baseUrl, jeton, { onProgres, onTrouve, fetchFn } = {}) {
  const tous = await listerTousDocs(baseUrl, jeton, fetchFn);
  tous.sort((a, b) => String(b.maj || '').localeCompare(String(a.maj || '')));
  let faits = 0;
  const marques = await enParallele(tous, PARALLELISME, async (d) => {
    const ok = await estSceneAtlas(d.id, baseUrl, jeton, fetchFn);
    faits++;
    if (ok && onTrouve) onTrouve(d);
    if (onProgres) onProgres(faits, tous.length);
    return ok ? d : null;
  });
  return marques.filter(Boolean);
}
