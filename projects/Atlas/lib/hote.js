/**
 * L'hote — ce qu'Atlas fait quand il n'est pas dans un document.
 *
 * Dans Grist, le document fournit tout : les donnees, les droits, l'identite.
 * Ouvert seul, Atlas doit demander ou se connecter, puis quelle scene ouvrir.
 * Ce module tient l'enchainement et l'etat ; le rendu est ailleurs, pour que la
 * logique reste verifiable sans navigateur.
 *
 * Enchainement : connexion -> choix d'une scene -> Atlas.
 * Rien de plus. L'hote n'affiche aucune carte et ne lit aucune couche : il
 * oriente. C'est ce qui lui permettra d'accueillir d'autres modules — la saisie
 * sur formulaire, par exemple — sans etre rouvert.
 */

export const VERSION = '1.0.0';
export const CLE_STOCKAGE = 'atlas_connexion';

/** Les ecrans possibles, et rien d'autre. */
export const ECRANS = Object.freeze({
  WIDGET: 'widget',          // dans Grist : l'hote ne s'affiche pas
  CONNEXION: 'connexion',    // instance et cle a renseigner
  SCENES: 'scenes',          // choisir parmi les scenes trouvees
  ATLAS: 'atlas',            // la scene est ouverte
  LOCAL: 'local',            // navigateur : pas de compte, mais Atlas reste utilisable
  MENU: 'menu',              // l'accueil de l'application, ouvert depuis la marque
});

/**
 * Quel ecran montrer au demarrage ?
 *
 * Les capacites decident avant la configuration : inutile de demander une cle
 * dans un environnement qui la refusera. C'est le cas du navigateur, ou
 * l'instance rejette l'en-tete `Authorization` au controle prealable.
 */
export function ecranInitial(caps, config) {
  if (caps.mode === 'grist') return ECRANS.WIDGET;
  // Sans decouverte possible, on n'offre pas une connexion qui echouerait — mais
  // on ne barre pas la route : Atlas hors Grist sait deja travailler en local,
  // fichiers et OSM. L'ecran explique, il ne bloque pas.
  if (!caps.decouverte) return ECRANS.LOCAL;
  if (!estConfigComplete(config)) return ECRANS.CONNEXION;
  return config?.docId ? ECRANS.ATLAS : ECRANS.SCENES;
}

/** Une configuration utilisable : une instance et une cle. Le document vient apres. */
export function estConfigComplete(config) {
  return !!(config && String(config.baseUrl || '').trim() && String(config.jeton || '').trim());
}

/**
 * Normalise ce que l'utilisateur a tape.
 *
 * L'adresse est saisie a la main sur un telephone : on tolere l'absence de
 * protocole, les espaces et la barre finale. Une adresse sans schema serait
 * interpretee comme un chemin relatif et echouerait sans rien expliquer.
 */
export function normaliserConfig(brut = {}) {
  let base = String(brut.baseUrl || '').trim();
  if (base && !/^https?:\/\//i.test(base)) base = 'https://' + base;
  base = base.replace(/\/+$/, '');
  return {
    baseUrl: base,
    jeton: String(brut.jeton || '').trim(),
    docId: String(brut.docId || '').trim(),
  };
}

/** Ce qui manque pour se connecter, dit dans les mots de l'utilisateur. */
export function validerConfig(config) {
  const c = normaliserConfig(config);
  if (!c.baseUrl) return { ok: false, message: "Indiquez l'adresse de votre instance Grist." };
  try { new URL(c.baseUrl); } catch (_) {
    return { ok: false, message: "Cette adresse n'est pas valide." };
  }
  if (!c.jeton) return { ok: false, message: 'Collez votre cle API, depuis votre profil Grist.' };
  return { ok: true, config: c };
}

/* ------------------------------------------------------------------ */
/* Memoire de l'appareil                                              */
/* ------------------------------------------------------------------ */

/**
 * La cle est ecrite une fois puis relue a chaque ouverture — c'est tout
 * l'interet. Elle vaut pour le compte entier : l'oublier doit donc etre aussi
 * simple que la donner (cf. `oublier`).
 */
export function lireConfig(stockage) {
  try {
    const brut = stockage?.getItem(CLE_STOCKAGE);
    return brut ? normaliserConfig(JSON.parse(brut)) : null;
  } catch (_) { return null; }
}

/**
 * Rend `false` si rien n'a pu etre ecrit — y compris quand le stockage est
 * absent. L'appel optionnel `stockage?.setItem()` ne leve pas : sans ce test,
 * la fonction annoncait un succes sans avoir rien enregistre, et l'utilisateur
 * aurait cru sa cle memorisee.
 */
export function ecrireConfig(stockage, config) {
  if (!stockage || typeof stockage.setItem !== 'function') return false;
  try {
    stockage.setItem(CLE_STOCKAGE, JSON.stringify(normaliserConfig(config)));
    return true;
  } catch (_) { return false; }
}

export function oublier(stockage) {
  if (!stockage || typeof stockage.removeItem !== 'function') return false;
  try { stockage.removeItem(CLE_STOCKAGE); return true; } catch (_) { return false; }
}

/* ------------------------------------------------------------------ */
/* Presentation d'une scene                                            */
/* ------------------------------------------------------------------ */

/**
 * Fraicheur relative plutot que date ISO : devant une liste de scenes, c'est
 * « la semaine derniere » qui aide a reconnaitre la sienne, pas un horodatage.
 */
export function depuis(iso, maintenant = Date.now()) {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.floor((maintenant - t) / 1000));
  if (s < 90) return 'a l’instant';
  const min = Math.floor(s / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 31) return `il y a ${j} j`;
  const mo = Math.floor(j / 30);
  if (mo < 12) return `il y a ${mo} mois`;
  const an = Math.floor(mo / 12);
  return `il y a ${an} an${an > 1 ? 's' : ''}`;
}

/** Ou vit la scene : « Cerema · Etudes ». Les deux peuvent manquer. */
export function situer(scene) {
  return [scene?.org, scene?.espace].filter(Boolean).join(' · ');
}

/* ------------------------------------------------------------------ */
/* Changer de scene                                                    */
/* ------------------------------------------------------------------ */

/**
 * Le nom du projet est-il un chemin de retour ?
 *
 * Seulement dans l'application : le widget n'a rien au-dessus de la scene
 * courante, et le navigateur sans compte n'a aucune liste ou revenir.
 */
export function peutChangerDeScene(caps, config) {
  return !!(caps && caps.mode !== 'grist' && caps.decouverte && estConfigComplete(config));
}

/**
 * Quitter la scene courante en gardant l'instance et la cle.
 *
 * On efface le seul `docId` : au rechargement, `ecranInitial` retombe sur la
 * liste sans redemander la connexion. Rendre `false` si rien n'a pu etre ecrit
 * — sinon on rechargerait sur la meme scene, sans que rien ne l'explique.
 */
export function quitterScene(stockage, config) {
  return ecrireConfig(stockage, { ...(config || {}), docId: '' });
}
