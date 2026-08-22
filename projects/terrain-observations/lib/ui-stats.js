/**
 * Terrain Observations — Chips de statistiques.
 */

(function () {
  'use strict';

  function render(records) {
    const el = document.getElementById('statsChips');
    if (!el) return;

    const total = records.length;
    const critiques = records.filter(r => r.niveau_urgence === 'critique').length;
    const aTraiter = records.filter(r => r.statut === 'à traiter').length;

    const chips = [`<span class="chip">${total} visite${total > 1 ? 's' : ''}</span>`];
    if (critiques > 0) chips.push(`<span class="chip chip-danger">${critiques} critique${critiques > 1 ? 's' : ''}</span>`);
    if (aTraiter > 0)  chips.push(`<span class="chip chip-warn">${aTraiter} à traiter</span>`);

    el.innerHTML = chips.join('');
  }

  window.TerrainObs = window.TerrainObs || {};
  window.TerrainObs.stats = { render };
})();
