/**
 * Lisibilite des donnees quand la carte passe a la nuit.
 *
 * Atlas simule la course du soleil : au coucher, un voile sombre couvre la
 * carte (`night-tint`, jusqu'a 62 % d'opacite) et l'eclairage des volumes tombe
 * a 0,16. L'ambiance est juste — mais elle s'applique **aussi aux couches de
 * donnees**, alors qu'elles sont la raison d'etre de la carte. Une grille
 * graduee devient illisible des que le soleil se couche, sans qu'aucun reglage
 * ne permette d'y remedier.
 *
 * Ce module ne supprime pas la nuit : il la rend negociable. Le curseur va de
 * « ambiance pleine » (0) a « donnees toujours lisibles » (1).
 */

/** Eclairage des volumes en plein jour — plafond du plancher nocturne. */
export const INTENSITE_JOUR = 0.55;

/**
 * Voile nocturne effectivement pose sur la carte.
 *
 * A lisibilite maximale le voile disparait : la nuit reste lisible par le ciel,
 * les ombres et la couleur des lumieres, sans masquer la donnee.
 */
export function voileNocturne(voileBrut, lisibilite) {
  const v = Number.isFinite(voileBrut) ? Math.max(0, voileBrut) : 0;
  const l = clampUnite(lisibilite);
  return v * (1 - l);
}

/**
 * Intensite d'eclairage des volumes, jamais sous le plancher demande.
 *
 * `map.setLight` ne touche que les `fill-extrusion` : les couches en volume et
 * le bati du fond. Le ciel et les modeles three.js gardent leur propre
 * eclairage — c'est ce qui permet de relever la donnee sans effacer la nuit.
 */
export function intensiteLumiere(intensiteBrute, lisibilite) {
  const i = Number.isFinite(intensiteBrute) ? intensiteBrute : 0;
  const plancher = INTENSITE_JOUR * clampUnite(lisibilite);
  return Math.max(i, plancher);
}

/**
 * Couleur d'eclairage relevee vers le blanc a mesure qu'on privilegie la
 * lecture : une intensite suffisante dans un bleu nuit sature deteint encore
 * sur la symbologie.
 */
export function couleurLumiere(couleurBrute, lisibilite) {
  const l = clampUnite(lisibilite);
  const rgb = hexVersRgb(couleurBrute);
  if (!rgb) return couleurBrute;
  return rgbVersHex(rgb.map((c) => Math.round(c + (255 - c) * l)));
}

function clampUnite(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

function hexVersRgb(hex) {
  if (typeof hex !== 'string') return null;
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbVersHex([r, g, b]) {
  return '#' + [r, g, b].map((c) => Math.min(255, Math.max(0, c)).toString(16).padStart(2, '0')).join('');
}
