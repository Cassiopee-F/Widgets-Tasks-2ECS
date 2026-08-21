/**
 * Terrain Détections — Filtres par catégorie + recherche.
 */

(function () {
  'use strict';

  const state = {
    category: null,
    query:    '',
    onChange: null,
  };

  function init(onChange) {
    state.onChange = onChange;
    render();
  }

  function render() {
    const el = document.getElementById('filtersBar');
    if (!el) return;

    const M = TerrainDet.model;
    const catButtons = [
      { label: 'Toutes', value: null },
      ...M.CATEGORIES.map(c => ({ label: c, value: c })),
    ].map(({ label, value }) => {
      const active = state.category === value;
      const style = value ? `color:${M.categoryColor(value)}; border-color:${active ? M.categoryColor(value) : ''}` : '';
      return `<button class="filter-btn ${active ? 'active' : ''}" data-cat="${value == null ? '' : value}" style="${style}">${label}</button>`;
    }).join('');

    el.innerHTML = `
      <div class="filter-group">${catButtons}</div>
      <div class="filter-sep"></div>
      <input class="filter-search" type="search" id="filterSearch"
             placeholder="Rechercher classe, session…" value="${state.query.replace(/"/g, '&quot;')}" />
    `;

    el.querySelectorAll('[data-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.category = btn.dataset.cat || null;
        render();
        emit();
      });
    });

    const search = document.getElementById('filterSearch');
    if (search) search.addEventListener('input', () => { state.query = search.value; emit(); });
  }

  function apply(records) {
    let out = [...records];
    if (state.category) out = out.filter(r => r.categorie === state.category);
    if (state.query) {
      const q = state.query.toLowerCase();
      out = out.filter(r =>
        [r.classe_fr, r.classe_en, r.session_id, r.categorie]
          .some(k => (k || '').toString().toLowerCase().includes(q))
      );
    }
    return out;
  }

  function emit() { if (typeof state.onChange === 'function') state.onChange(); }

  window.TerrainDet = window.TerrainDet || {};
  window.TerrainDet.filters = { init, apply, state };
})();
