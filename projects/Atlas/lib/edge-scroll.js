/**
 * Défilement de bord pendant un glisser-déposer.
 *
 * Dans une liste plus haute que son conteneur, un glissement ne peut pas
 * atteindre ce qui n'est pas à l'écran : au doigt, il n'y a pas de molette pour
 * défiler en même temps. On fait donc défiler le conteneur quand le pointeur
 * s'approche d'un bord, à une vitesse croissante — comme le déplacement de
 * fichiers dans un explorateur.
 */

/** Épaisseur de la bande sensible, en pixels. */
export const EDGE_ZONE_PX = 36;

/** Vitesse maximale, en pixels par image. */
export const EDGE_SPEED_MAX = 12;

/**
 * Pas de défilement à appliquer pour une position de pointeur.
 *
 * La vitesse croît linéairement du bord de la bande vers le bord du conteneur,
 * puis reste au maximum au-delà : le pointeur qui sort du conteneur — geste
 * courant quand on veut aller vite — ne doit pas arrêter le défilement.
 *
 * @param {{top: number, bottom: number}} rect conteneur défilant
 * @param {number} y ordonnée du pointeur
 * @param {number} [zone] épaisseur de la bande sensible
 * @param {number} [vmax] vitesse maximale
 * @returns {number} pixels à ajouter au scrollTop ; négatif vers le haut, 0 au repos
 */
export function edgeScrollStep(rect, y, zone = EDGE_ZONE_PX, vmax = EDGE_SPEED_MAX) {
  if (!rect || !Number.isFinite(y) || !(zone > 0)) return 0;
  const haut = y - rect.top;
  const bas = rect.bottom - y;
  // Conteneur plus mince que deux bandes : les zones se recouvriraient et le
  // défilement partirait dans les deux sens à la fois.
  if (rect.bottom - rect.top < zone * 2) return 0;
  if (haut < zone) return -Math.round(vmax * Math.min(1, (zone - Math.max(haut, 0)) / zone));
  if (bas < zone) return Math.round(vmax * Math.min(1, (zone - Math.max(bas, 0)) / zone));
  return 0;
}
