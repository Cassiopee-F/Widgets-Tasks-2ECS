/**
 * Terrain Détections — Compteurs.
 */

(function () {
  'use strict';

  function render(records) {
    const total    = records.length;
    const sessions = new Set(records.map(r => r.session_id).filter(Boolean)).size;
    const classes  = new Set(records.map(r => r.classe_en).filter(Boolean)).size;
    const confs    = records.map(r => r.confiance).filter(v => v != null);
    const avgConf  = confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : null;

    const el = document.getElementById('statsChips');
    if (!el) return;
    el.innerHTML = `
      <span class="chip"><span class="chip-v">${total}</span> détection${total > 1 ? 's' : ''}</span>
      <span class="chip"><span class="chip-v">${sessions}</span> session${sessions > 1 ? 's' : ''}</span>
      <span class="chip"><span class="chip-v">${classes}</span> classe${classes > 1 ? 's' : ''}</span>
      <span class="chip">Conf. moy. <span class="chip-v">${avgConf != null ? avgConf + '%' : '—'}</span></span>
    `;
  }

  window.TerrainDet = window.TerrainDet || {};
  window.TerrainDet.stats = { render };
})();
