/**
 * Terrain Observations — Data Model
 * Colonnes attendues, normalisation, badges, formatage.
 */

(function () {
  'use strict';

  const COLS = [
    'transcription_brute',
    'commentaire_structure',
    'type_observation',
    'localisation_precise',
    'niveau_urgence',
    'actions_requises',
    'materiaux_concernes',
    'surface_estimee',
    'date_visite',
    'statut',
    'audio',
    'coordonnees_gps',
  ];

  const URGENCE_ORDER = ['faible', 'moyen', 'élevé', 'critique'];
  const STATUT_ORDER  = ['à traiter', 'en cours', 'validé', 'rejeté'];

  const URGENCE_CLASS = { 'faible': 'faible', 'moyen': 'moyen', 'élevé': 'eleve', 'critique': 'critique' };
  const STATUT_CLASS  = { 'à traiter': 'traiter', 'en cours': 'encours', 'validé': 'valide', 'rejeté': 'rejete' };

  function normalize(records, colMap) {
    return (records || []).map(r => {
      const out = { _id: r.id };
      for (const c of COLS) out[c] = r[(colMap || {})[c] || c];
      return out;
    });
  }

  function urgenceBadge(v) {
    if (!v) return '<span class="empty-dash">—</span>';
    const cls = URGENCE_CLASS[v] || 'faible';
    return `<span class="badge badge-${cls}">${v}</span>`;
  }

  function statutBadge(v) {
    if (!v) return '<span class="empty-dash">—</span>';
    const cls = STATUT_CLASS[v] || 'traiter';
    return `<span class="badge badge-${cls}">${v}</span>`;
  }

  function formatDate(ts) {
    if (ts == null || ts === '') return '—';
    // Grist stocke les Date en secondes Unix (nombre) ; on tolère aussi ISO string
    let d;
    if (typeof ts === 'number') d = new Date(ts * 1000);
    else if (/^\d+$/.test(String(ts))) d = new Date(Number(ts) * 1000);
    else d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts).slice(0, 10);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  function parseGPS(gps) {
    if (!gps) return null;
    const s = String(gps);
    const m = s.match(/^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
    if (!m) return null;
    return { lat: parseFloat(m[1]), lon: parseFloat(m[2]), raw: s };
  }

  function osmLink(gps) {
    const p = parseGPS(gps);
    if (!p) return null;
    return `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}&zoom=17#map=17/${p.lat}/${p.lon}`;
  }

  function attachmentIds(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(x => typeof x === 'number');
    if (typeof v === 'number') return [v];
    return [];
  }

  window.TerrainObs = window.TerrainObs || {};
  window.TerrainObs.model = {
    COLS, URGENCE_ORDER, STATUT_ORDER,
    normalize, urgenceBadge, statutBadge,
    formatDate, parseGPS, osmLink, attachmentIds,
  };
})();
