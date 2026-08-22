/**
 * Terrain Observations — Barre de filtres (statut + urgence + recherche).
 */

(function () {
  'use strict';

  const state = {
    statut:  'all',
    urgence: null,
    query:   '',
    onChange: null,
  };

  function init(onChange) {
    state.onChange = onChange;
    render();
  }

  function render() {
    const el = document.getElementById('filtersBar');
    if (!el) return;

    const statutButtons = [
      ['all',       'Toutes'],
      ['à traiter', 'À traiter'],
      ['en cours',  'En cours'],
      ['validé',    'Validées'],
      ['rejeté',    'Rejetées'],
    ].map(([val, label]) =>
      `<button class="filter-btn ${state.statut === val ? 'active' : ''}" data-statut="${val}">${label}</button>`
    ).join('');

    el.innerHTML = `
      <div class="filter-group">${statutButtons}</div>
      <div class="filter-sep"></div>
      <button class="filter-btn urgence-btn ${state.urgence === 'critique' ? 'active' : ''}" data-urgence="critique">
        <span class="urgence-dot"></span>Critiques
      </button>
      <div class="filter-sep"></div>
      <input class="filter-search" type="search" id="filterSearch"
             placeholder="Rechercher…" value="${state.query.replace(/"/g, '&quot;')}" />
    `;

    el.querySelectorAll('[data-statut]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.statut = btn.dataset.statut;
        render();
        emit();
      });
    });

    el.querySelectorAll('[data-urgence]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.urgence = state.urgence === btn.dataset.urgence ? null : btn.dataset.urgence;
        render();
        emit();
      });
    });

    const search = document.getElementById('filterSearch');
    if (search) {
      search.addEventListener('input', () => {
        state.query = search.value;
        emit();
      });
    }
  }

  function apply(records) {
    let out = [...records];
    if (state.statut !== 'all') out = out.filter(r => r.statut === state.statut);
    if (state.urgence)          out = out.filter(r => r.niveau_urgence === state.urgence);
    if (state.query) {
      const q = state.query.toLowerCase();
      out = out.filter(r =>
        ['commentaire_structure', 'transcription_brute', 'type_observation', 'localisation_precise', 'actions_requises']
          .some(k => (r[k] || '').toString().toLowerCase().includes(q))
      );
    }
    return out;
  }

  function emit() { if (typeof state.onChange === 'function') state.onChange(); }

  window.TerrainObs = window.TerrainObs || {};
  window.TerrainObs.filters = { init, apply, state };
})();
