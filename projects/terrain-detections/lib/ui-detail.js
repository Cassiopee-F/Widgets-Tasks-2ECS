/**
 * Terrain Détections — Panneau détail (snapshot + carte).
 */

(function () {
  'use strict';

  const state = { onClose: null };

  function init(opts = {}) {
    state.onClose = opts.onClose;
    document.getElementById('btnDetailClose')?.addEventListener('click', close);
  }

  function open(record) {
    const M = TerrainDet.model;
    const r = record;
    const link = M.osmLink(r.latitude, r.longitude);

    const snap = r.snapshot
      ? `<img class="snapshot" src="${r.snapshot}" alt="Snapshot ${r.classe_fr || ''}" />`
      : `<div class="snapshot-empty">Pas de snapshot pour cette détection</div>`;

    const mapEmbed = link
      ? `<a class="map-mini" href="${link}" target="_blank" rel="noopener">📍 Voir sur la carte</a>`
      : `<div class="map-mini empty">Aucune coordonnée GPS</div>`;

    document.getElementById('detailTitle').textContent = r.classe_fr || r.classe_en || 'Détection';

    document.getElementById('detailBody').innerHTML = `
      ${snap}
      ${mapEmbed}

      ${row('Classe',       r.classe_fr || '—')}
      ${row('Classe (EN)',  r.classe_en || '—')}
      ${row('Catégorie',    `<span class="badge-cat ${M.categoryClass(r.categorie)}">${r.categorie || '—'}</span>`)}
      ${row('Confiance',    r.confiance != null ? r.confiance + '%' : '—')}
      ${row('Horodatage',   M.formatDateTime(r.horodatage))}
      ${row('Latitude',     r.latitude != null ? Number(r.latitude).toFixed(7) : '—')}
      ${row('Longitude',    r.longitude != null ? Number(r.longitude).toFixed(7) : '—')}
      ${row('Précision GPS', r.precision_gps != null ? '±' + r.precision_gps + ' m' : '—')}
      ${row('Vitesse',      r.vitesse_kmh != null ? r.vitesse_kmh + ' km/h' : '—')}
      ${row('Cap',          r.cap_degres != null ? r.cap_degres + '°' : '—')}
      ${row('Objets frame', r.nb_objets_frame ?? '—')}
      ${row('Session',      r.session_id || '—')}
      ${r.bbox ? row('Bounding Box', `<code>${r.bbox}</code>`) : ''}
    `;

    document.getElementById('detailPanel').classList.add('open');
  }

  function close() {
    document.getElementById('detailPanel').classList.remove('open');
    if (typeof state.onClose === 'function') state.onClose();
  }

  function row(k, v) { return `<div class="dfield"><div class="dlabel">${k}</div><div class="dvalue">${v}</div></div>`; }

  window.TerrainDet = window.TerrainDet || {};
  window.TerrainDet.detail = { init, open, close };
})();
