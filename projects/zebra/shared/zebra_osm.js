/**
 * ZEBRA — Requêtes OSM/IGN pour les équipements de sécurité.
 *
 * Chaque preset charge des données de référence autour du PP courant.
 * Disponibilité confirmée sur Marseille (tests Overpass 2026-05-29).
 *
 * Usage dans atlas-zebra :
 *   import { ZEBRA_OSM_PRESETS, buildOverpassQuery, fetchOsmPreset } from '../shared/zebra_osm.js';
 */

/** Presets OSM pour les 14 critères ZEBRA. */
export const ZEBRA_OSM_PRESETS = [
  {
    id: 'traffic_signals',
    name: 'Feux piétons',
    icon: '🚦',
    criterion: 'cl_feu',
    availability: 'excellent',  // 628 nodes / 6km² Marseille
    model3d: 'traffic_light',
    query: `(
      node["highway"="traffic_signals"]({{bbox}});
      node["highway"="crossing"]["crossing"="traffic_signals"]({{bbox}});
    );`,
    useful_tags: ['crossing', 'button_operated', 'traffic_signals:sound'],
  },
  {
    id: 'bus_stops',
    name: 'Arrêts TC',
    icon: '🚏',
    criterion: 'cl_arret_de_bus',
    availability: 'excellent',  // 94 nodes / 6km²
    model3d: 'bus_shelter',
    query: `(
      node["highway"="bus_stop"]({{bbox}});
      node["public_transport"="stop_position"]({{bbox}});
      node["amenity"="shelter"]["shelter_type"="public_transport"]({{bbox}});
      node["railway"="tram_stop"]({{bbox}});
    );`,
    useful_tags: ['name', 'network', 'shelter', 'wheelchair'],
  },
  {
    id: 'tactile_paving',
    name: 'BEV / Podotactile',
    icon: '⬜',
    criterion: 'cl_bande_d_eveil_de_vigilance',
    availability: 'bon',  // 2452 nodes / 6km²
    model3d: 'tactile_strip',  // à créer
    query: `(
      node["tactile_paving"~"yes|no|incorrect"]({{bbox}});
      node["kerb"]({{bbox}});
    );`,
    useful_tags: ['tactile_paving', 'kerb'],
  },
  {
    id: 'street_lamps',
    name: 'Éclairage public',
    icon: '💡',
    criterion: 'cl_eclairage_public_moins_20m',
    availability: 'bon',  // 223 nodes + 692 ways / 6km²
    model3d: 'streetlamp',
    query: `(
      node["highway"="street_lamp"]({{bbox}});
      way["lit"="yes"]({{bbox}});
    );`,
    useful_tags: ['lamp_type', 'lit'],
  },
  {
    id: 'traffic_calming',
    name: 'Ralentisseurs / Plateaux',
    icon: '🔶',
    criterion: 'cl_ralentisseurs_trapezoidal_plateau',
    availability: 'partiel',  // 9 tables + 115 bumps / 6km²
    model3d: 'speed_bump',  // à créer
    query: `(
      node["traffic_calming"~"table|bump|hump|raised_crosswalk"]({{bbox}});
      way["traffic_calming"~"table|bump|hump"]({{bbox}});
    );`,
    useful_tags: ['traffic_calming', 'maxspeed'],
  },
  {
    id: 'pedestrian_islands',
    name: 'Îlots refuge',
    icon: '🏝️',
    criterion: 'cl_presence_ilot',
    availability: 'peu',  // 64 nodes / 6km² (sous-cartographié)
    model3d: 'pedestrian_island',  // à créer
    query: `(
      node["crossing:island"="yes"]({{bbox}});
    );`,
    useful_tags: ['crossing:island', 'width'],
  },
  {
    id: 'trees',
    name: 'Arbres masquants',
    icon: '🌳',
    criterion: 'cl_manque_visibilite',
    availability: 'excellent',  // 8777 nodes / 6km²
    model3d: 'tree_deciduous',
    query: `(
      node["natural"="tree"]({{bbox}});
      way["natural"="tree_row"]({{bbox}});
      way["barrier"="hedge"]({{bbox}});
    );`,
    useful_tags: ['natural', 'barrier', 'height', 'species'],
  },
  {
    id: 'parking',
    name: 'Stationnement',
    icon: '🅿️',
    criterion: 'cl_places_stationnement',
    availability: 'partiel',
    model3d: 'car',
    query: `(
      node["amenity"="parking"]({{bbox}});
      way["amenity"="parking"]({{bbox}});
    );`,
    useful_tags: ['amenity', 'access', 'fee', 'capacity'],
  },
  {
    id: 'cycle_lanes',
    name: 'Aménagements cyclables / SAS',
    icon: '🚲',
    criterion: 'cl_ligne_effet_sas_cycliste',
    availability: 'bon',
    model3d: null,
    query: `(
      way["cycleway:left"~"asl|lane"]({{bbox}});
      way["cycleway:right"~"asl|lane"]({{bbox}});
      way["cycleway"~"asl|lane"]({{bbox}});
    );`,
    useful_tags: ['cycleway', 'cycleway:left', 'cycleway:right'],
  },
];

/**
 * Construit une requête Overpass combinée pour un ensemble de presets.
 * @param {string[]} presetIds - IDs de presets (tous si omis)
 * @param {number[]} bbox - [minLat, minLng, maxLat, maxLng] format Overpass
 */
export function buildOverpassQuery(presetIds, bbox) {
  const selected = ZEBRA_OSM_PRESETS.filter(p =>
    !presetIds || presetIds.includes(p.id)
  );
  const [minLat, minLng, maxLat, maxLng] = bbox;
  const bboxStr = `${minLat},${minLng},${maxLat},${maxLng}`;

  const parts = selected.map(p =>
    p.query.replaceAll('{{bbox}}', bboxStr)
  );

  return `[out:json][timeout:25];\n(\n${parts.join('\n')}\n);\nout body;\n>;\nout skel qt;`;
}

/**
 * Envoie une requête Overpass et retourne des features GeoJSON.
 * @param {string[]} presetIds - IDs de presets
 * @param {Array} mapboxBounds - [[minLng, minLat], [maxLng, maxLat]]
 */
export async function fetchOsmPreset(presetIds, mapboxBounds) {
  const [[minLng, minLat], [maxLng, maxLat]] = mapboxBounds;
  const query = buildOverpassQuery(presetIds, [minLat, minLng, maxLat, maxLng]);

  const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query),
  });
  const data = await resp.json();

  // Convertir OSM → GeoJSON features
  const features = [];
  for (const el of (data.elements || [])) {
    if (el.type !== 'node' || !el.lat || !el.lon) continue;
    const preset = ZEBRA_OSM_PRESETS.find(p =>
      presetIds ? presetIds.includes(p.id) : true
    );
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [el.lon, el.lat] },
      properties: {
        _osmId: `${el.type}/${el.id}`,
        _criterion: detectCriterion(el.tags || {}),
        _model3d: detectModel3d(el.tags || {}),
        ...el.tags,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Détecte le critère ZEBRA depuis les tags OSM. */
function detectCriterion(tags) {
  if (tags.highway === 'traffic_signals' || tags.crossing === 'traffic_signals') return 'cl_feu';
  if (tags.highway === 'bus_stop' || tags.public_transport === 'stop_position') return 'cl_arret_de_bus';
  if (tags.railway === 'tram_stop') return 'cl_arret_de_bus';
  if (tags.tactile_paving) return 'cl_bande_d_eveil_de_vigilance';
  if (tags.kerb) return 'cl_bande_d_eveil_de_vigilance';
  if (tags.highway === 'street_lamp' || tags.lit === 'yes') return 'cl_eclairage_public_moins_20m';
  if (tags.traffic_calming) return 'cl_ralentisseurs_trapezoidal_plateau';
  if (tags['crossing:island'] === 'yes') return 'cl_presence_ilot';
  if (tags.natural === 'tree' || tags.barrier === 'hedge') return 'cl_manque_visibilite';
  if (tags.amenity === 'parking') return 'cl_places_stationnement';
  if (tags.cycleway || tags['cycleway:left'] || tags['cycleway:right']) return 'cl_ligne_effet_sas_cycliste';
  return null;
}

/** Détecte le modèle 3D depuis les tags OSM. */
function detectModel3d(tags) {
  if (tags.highway === 'traffic_signals') return 'traffic_light';
  if (tags.highway === 'bus_stop') return 'bus_shelter';
  if (tags['amenity'] === 'shelter') return 'bus_shelter';
  if (tags.railway === 'tram_stop') return 'traffic_light';
  if (tags.highway === 'street_lamp') return 'streetlamp';
  if (tags.natural === 'tree') return 'tree_deciduous';
  if (tags.barrier === 'hedge') return 'hedge';
  if (tags.traffic_calming === 'table') return 'speed_bump';
  if (tags.traffic_calming) return 'speed_bump';
  if (tags.amenity === 'parking') return 'car';
  return 'bollard';
}
