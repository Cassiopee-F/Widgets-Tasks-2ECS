/**
 * Frontière entre le fond de carte et les données Atlas.
 *
 * Les réglages du module Vues — bâti en volume, étiquettes — agissent sur le
 * **fond** : le bâti OpenStreetMap du style, ses libellés de rues et de villes.
 * Ils ne doivent jamais toucher aux couches de données : leur visibilité
 * appartient au panneau Couches, et à lui seul.
 *
 * La distinction se fait sur l'identifiant. Toute couche montée par Atlas est
 * préfixée `layer-` — `layer-scene-<table>` pour un import de manifeste,
 * `layer-grist-<id>` pour une table liée, `layer-<horodatage>` pour un import
 * direct — ainsi que ses habillages (`-outline`, `-pts`, `-label`, `-hit`).
 *
 * Sans ce filtre, éteindre « Bâtiments 3D » masquerait aussi une couche de bâti
 * importée depuis Grist et rendue en volume : les deux sont des
 * `fill-extrusion` aux yeux de MapLibre. Et la rallumer ferait réapparaître une
 * couche que l'utilisateur avait masquée — deux réglages se disputant la même
 * autorité.
 */

/** Préfixe porté par toute couche montée par Atlas. */
export const ATLAS_LAYER_PREFIX = 'layer-';

/** L'identifiant désigne-t-il une couche de données Atlas ? */
export function isAtlasLayerId(id) {
  return typeof id === 'string' && id.startsWith(ATLAS_LAYER_PREFIX);
}

/**
 * Identifiants des couches **du fond** d'un type donné.
 *
 * @param {Array<{id: string, type: string}>} styleLayers `map.getStyle().layers`
 * @param {string} type type MapLibre ('fill-extrusion', 'symbol'…)
 * @returns {string[]} identifiants à piloter depuis le module Vues
 */
export function basemapLayerIds(styleLayers, type) {
  return (styleLayers || [])
    .filter((l) => l && l.type === type && !isAtlasLayerId(l.id))
    .map((l) => l.id);
}
