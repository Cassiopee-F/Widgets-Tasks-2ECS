/**
 * Client de donnees a double mode — la seule piece qui sait ou tourne Atlas.
 *
 * UNE interface, DEUX implementations :
 *   - « grist » : Atlas est un widget dans un document (API plugin, doc vivant)
 *   - « rest »  : Atlas est une application autonome (API REST + cle d'acces)
 *
 * Regle : aucun autre module n'appelle `grist.docApi` en direct. C'est ce qui
 * permet au meme code de servir dans les deux mondes.
 *
 * CORS — mesure sur grist.numerique.gouv.fr, et decisif pour l'enveloppe :
 * l'instance repond `Access-Control-Allow-Headers: Content-Type,
 * X-Requested-With`. L'en-tete `Authorization` n'y figure pas, et c'est le seul
 * moyen de presenter une cle API (`?auth=` attend un jeton signe, pas une cle —
 * verifie : « Broken token » contre « invalid API key »). Depuis un navigateur,
 * une requete authentifiee est donc refusee au controle prealable.
 *
 * Consequence : le mode REST authentifie ne fonctionne QUE hors navigateur —
 * dans l'APK, ou le client HTTP natif de Capacitor emet les requetes. En PWA,
 * il reste la lecture anonyme, qui suffit aux documents partages en lecture
 * (verifie : `/tables`, `/records` et `/sql` repondent 200 sans jeton ; `/apply`
 * repond 403 et `/orgs` renvoie une liste vide).
 */

export const VERSION = '1.0.0';

/**
 * Ou tourne-t-on ?
 *
 * La presence de `grist.docApi` NE SUFFIT PAS, contrairement a ce que fait
 * SURFAC²E : Atlas charge `grist-plugin-api.js` depuis son HTML, et ce script
 * installe `window.grist` meme hors de tout document. Verifie en ouvrant Atlas
 * dans un onglet — l'objet est la, et ses appels echouent ensuite en
 * « RPC_UNKNOWN_FORWARD_DEST ». S'y fier ferait croire a un widget partout.
 *
 * Le second critere est l'encadrement : un widget vit TOUJOURS dans une iframe,
 * une application ouverte seule n'en a jamais. La comparaison ne lit aucune
 * propriete de la fenetre parente, donc elle ne bute pas sur l'isolation
 * d'origine ; si elle echouait tout de meme, on se sait encadre.
 */
export function detecterMode(portee = globalThis) {
  // Une page de presentation encadre aussi le widget, et le widget n'a aucun
  // moyen de la distinguer d'un document : meme iframe, meme script de plugin
  // charge. Sans ce parametre, l'apercu de la vitrine partirait interroger un
  // document qui n'existe pas.
  if (estVitrine(portee)) return 'rest';
  const g = portee?.grist;
  if (!g || !g.docApi) return 'rest';
  return estEncadre(portee) ? 'grist' : 'rest';
}

/** La page qui nous encadre est-elle une vitrine, et non un document ? */
export function estVitrine(portee = globalThis) {
  try {
    return new URLSearchParams(portee.location?.search || '').get('vitrine') === '1';
  } catch (_) { return false; }
}

/** Sommes-nous dans une iframe ? En cas de doute, oui. */
export function estEncadre(portee = globalThis) {
  try {
    if (portee.self === undefined || portee.top === undefined) return false;
    return portee.self !== portee.top;
  } catch (_) { return true; }
}

/**
 * L'en-tete `Authorization` peut-il partir d'ici ?
 *
 * Vrai seulement quand les requetes ne passent pas par le moteur web : APK
 * Capacitor avec `CapacitorHttp` actif, qui remplace `fetch` par le client
 * natif. Sans ce drapeau, un `fetch()` dans la WebView reste soumis a CORS —
 * c'est le piege de l'empaquetage.
 */
export function peutSAuthentifier(portee = globalThis) {
  const cap = portee?.Capacitor;
  if (!cap) return false;
  if (typeof cap.isNativePlatform === 'function') return cap.isNativePlatform();
  return !!cap.isNative;
}

/** Capacites du mode courant, pour que l'interface n'offre pas l'impossible. */
export function capacites(portee = globalThis) {
  const mode = detecterMode(portee);
  const vitrine = estVitrine(portee);
  if (mode === 'grist') {
    return { mode, vitrine, lecture: true, ecriture: true, decouverte: false, raison: null };
  }
  if (peutSAuthentifier(portee)) {
    return { mode, vitrine, lecture: true, ecriture: true, decouverte: true, raison: null };
  }
  return {
    mode, vitrine, lecture: true, ecriture: false, decouverte: false,
    raison: "Sans application installée, l'instance refuse les requêtes signées : "
          + 'seules les scènes partagées en lecture sont accessibles.',
  };
}

/* ------------------------------------------------------------------ */
/* Mode widget — l'API plugin fait tout                                */
/* ------------------------------------------------------------------ */

class ClientGrist {
  constructor(portee = globalThis) { this.mode = 'grist'; this._g = portee.grist; }
  async init() { return this; }
  get docApi() { return this._g.docApi; }
  listTables() { return this._g.docApi.listTables(); }
  fetchTable(table) { return this._g.docApi.fetchTable(table); }
  applyUserActions(actions) { return this._g.docApi.applyUserActions(actions); }
}

/* ------------------------------------------------------------------ */
/* Mode autonome — API REST                                            */
/* ------------------------------------------------------------------ */

class ClientRest {
  /**
   * @param {{baseUrl: string, docId: string, jeton?: string, fetch?: Function}} o
   */
  constructor(o = {}) {
    this.mode = 'rest';
    this.baseUrl = String(o.baseUrl || '').replace(/\/+$/, '');
    this.docId = o.docId || '';
    this.jeton = o.jeton || '';
    this._fetch = o.fetch || ((...a) => globalThis.fetch(...a));
  }

  async init() { return this; }

  _entetes() {
    const h = { 'Content-Type': 'application/json' };
    // Sans jeton, la requete reste « simple » et passe partout ; avec, elle
    // n'aboutit que la ou aucun controle prealable ne s'applique.
    if (this.jeton) h.Authorization = 'Bearer ' + this.jeton;
    return h;
  }

  _url(chemin) { return `${this.baseUrl}/api/docs/${this.docId}${chemin}`; }

  async _json(url, options) {
    const r = await this._fetch(url, options);
    if (!r.ok) {
      const corps = await r.text().catch(() => '');
      throw new Error(`HTTP ${r.status}${corps ? ' — ' + corps.slice(0, 160) : ''}`);
    }
    return r.json();
  }

  async listTables() {
    const d = await this._json(this._url('/tables'), { headers: this._entetes() });
    return (d.tables || []).map((t) => t.id);
  }

  /**
   * Rend les donnees au format colonnaire de l'API plugin — `{id: [], col: []}` —
   * et non la liste d'enregistrements que rend l'API REST. Sans cette
   * conversion, tout le code de lecture d'Atlas serait a doubler.
   */
  async fetchTable(table) {
    const d = await this._json(
      `${this.baseUrl}/api/docs/${this.docId}/tables/${encodeURIComponent(table)}/records`,
      { headers: this._entetes() },
    );
    return recordsVersColonnes(d.records || []);
  }

  async applyUserActions(actions) {
    return this._json(this._url('/apply'), {
      method: 'POST', headers: this._entetes(), body: JSON.stringify(actions),
    });
  }
}

/**
 * `[{id, fields}]` → `{id: [...], colonne: [...]}`.
 *
 * Les colonnes sont l'union de tous les enregistrements : une valeur absente
 * devient `null` plutot que de decaler la colonne, sinon les lignes ne
 * correspondraient plus entre elles.
 */
export function recordsVersColonnes(records) {
  const out = { id: [] };
  const champs = new Set();
  for (const r of records) for (const k of Object.keys(r.fields || {})) champs.add(k);
  for (const c of champs) out[c] = [];
  for (const r of records) {
    out.id.push(r.id);
    for (const c of champs) out[c].push(r.fields?.[c] ?? null);
  }
  return out;
}

/**
 * @param {{mode?: 'grist'|'rest', baseUrl?, docId?, jeton?, portee?, fetch?}} o
 */
export async function creerClient(o = {}) {
  const portee = o.portee || globalThis;
  const mode = o.mode || detecterMode(portee);
  const client = (mode === 'grist') ? new ClientGrist(portee) : new ClientRest(o);
  await client.init();
  client.version = VERSION;
  return client;
}

export { ClientGrist, ClientRest };
