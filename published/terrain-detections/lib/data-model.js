/**
 * Terrain Détections — Data Model.
 */

(function () {
  'use strict';

  const COLS = [
    'session_id', 'horodatage', 'classe_fr', 'classe_en', 'categorie', 'confiance',
    'latitude', 'longitude', 'precision_gps', 'vitesse_kmh', 'cap_degres',
    'nb_objets_frame', 'bbox', 'snapshot',
  ];

  const CATEGORIES = ['Véhicule', 'Personne', 'Animal', 'Infrastructure', 'Objet'];

  const CAT_COLOR = {
    'Véhicule':       '#1F6FEB',
    'Personne':       '#D29922',
    'Animal':         '#3FB950',
    'Infrastructure': '#F85149',
    'Objet':          '#BC8CFF',
  };

  const CAT_CLASS = {
    'Véhicule':       'cat-vehicule',
    'Personne':       'cat-personne',
    'Animal':         'cat-animal',
    'Infrastructure': 'cat-infrastructure',
    'Objet':          'cat-objet',
  };

  function normalize(records, colMap) {
    return (records || []).map(r => {
      const out = { _id: r.id };
      for (const c of COLS) out[c] = r[(colMap || {})[c] || c];
      return out;
    });
  }

  function categoryColor(cat) { return CAT_COLOR[cat] || '#8B949E'; }
  function categoryClass(cat) { return CAT_CLASS[cat] || 'cat-objet'; }

  function formatTime(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso).slice(0, 16);
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (_) { return String(iso).slice(0, 16); }
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      return d.toLocaleString('fr-FR');
    } catch (_) { return String(iso); }
  }

  function confidenceColor(conf) {
    if (conf == null) return '#8B949E';
    if (conf >= 80) return '#3FB950';
    if (conf >= 60) return '#D29922';
    return '#F85149';
  }

  function osmLink(lat, lon) {
    if (lat == null || lon == null) return null;
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=17#map=17/${lat}/${lon}`;
  }

  function shortSession(s) {
    if (!s) return '—';
    return String(s).replace(/^SV_/, '').slice(0, 14);
  }

  window.TerrainDet = window.TerrainDet || {};
  window.TerrainDet.model = {
    COLS, CATEGORIES, CAT_COLOR, CAT_CLASS,
    normalize, categoryColor, categoryClass,
    formatTime, formatDateTime, confidenceColor,
    osmLink, shortSession,
  };
})();
