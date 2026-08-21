/**
 * Terrain Détections — Tableau + tri + barre de confiance.
 */

(function () {
  'use strict';

  const state = {
    sortCol: 'horodatage',
    sortAsc: false,
    selectedId: null,
    onSelect: null,
  };

  const COLUMNS = [
    { key: 'horodatage',   label: 'Heure',        width: 80  },
    { key: 'classe_fr',    label: 'Classe',       width: null },
    { key: 'categorie',    label: 'Catégorie',    width: 110 },
    { key: 'confiance',    label: 'Confiance',    width: 130 },
    { key: 'latitude',     label: 'Localisation', width: null, sortable: false },
    { key: 'vitesse_kmh',  label: 'Vitesse',      width: 78  },
    { key: 'session_id',   label: 'Session',      width: 130 },
  ];

  function init(opts = {}) {
    state.onSelect = opts.onSelect;
    const thead = document.getElementById('listHeader');
    if (!thead) return;
    thead.innerHTML = '<tr>' + COLUMNS.map(c =>
      `<th ${c.sortable === false ? '' : `data-sort="${c.key}"`}
         style="${c.width ? `width:${c.width}px;` : ''}">
        ${c.label}${c.sortable === false ? '' : ` <span class="sort-arrow"></span>`}
      </th>`
    ).join('') + '</tr>';
    thead.querySelectorAll('[data-sort]').forEach(th => {
      th.addEventListener('click', () => sortBy(th.dataset.sort));
    });
  }

  function sortBy(col) {
    if (state.sortCol === col) state.sortAsc = !state.sortAsc;
    else { state.sortCol = col; state.sortAsc = true; }
    render(_last);
  }

  let _last = [];

  function render(records) {
    _last = records || [];
    const tbody = document.getElementById('listBody');
    if (!tbody) return;

    const M = TerrainDet.model;
    const rows = [..._last].sort((a, b) => {
      const av = a[state.sortCol] ?? '';
      const bv = b[state.sortCol] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return state.sortAsc ? av - bv : bv - av;
      return state.sortAsc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="${COLUMNS.length}">
        <div class="empty"><div class="empty-icon">◎</div><p>Aucune détection.<br>Lancez Terrain Vision sur votre téléphone.</p></div>
      </td></tr>`;
      updateArrows();
      return;
    }

    tbody.innerHTML = rows.map(r => {
      const conf = r.confiance ?? 0;
      const cColor = M.confidenceColor(conf);
      const cat = r.categorie || '—';
      const catCls = M.categoryClass(cat);
      const gpsLink = M.osmLink(r.latitude, r.longitude);
      const gpsCell = gpsLink
        ? `<a class="gps-link" href="${gpsLink}" target="_blank" rel="noopener" onclick="event.stopPropagation()">📍 ${(+r.latitude).toFixed(4)}, ${(+r.longitude).toFixed(4)}</a>`
        : '<span class="empty-dash">—</span>';
      const speed = r.vitesse_kmh != null ? `${r.vitesse_kmh} km/h` : '—';

      return `<tr data-id="${r._id}" ${r._id === state.selectedId ? 'class="selected"' : ''}>
        <td class="nowrap">${M.formatTime(r.horodatage)}</td>
        <td class="strong">${r.classe_fr || r.classe_en || '—'}</td>
        <td><span class="badge-cat ${catCls}">${cat}</span></td>
        <td>
          <div class="conf-bar">
            <div class="conf-bg"><div class="conf-fill" style="width:${conf}%;background:${cColor}"></div></div>
            <span class="conf-txt" style="color:${cColor}">${conf}%</span>
          </div>
        </td>
        <td>${gpsCell}</td>
        <td class="dim">${speed}</td>
        <td class="dim session-cell">${M.shortSession(r.session_id)}</td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', () => {
        state.selectedId = Number(tr.dataset.id);
        render(_last);
        if (typeof state.onSelect === 'function') state.onSelect(state.selectedId);
      });
    });

    updateArrows();
  }

  function updateArrows() {
    document.querySelectorAll('#listHeader [data-sort]').forEach(th => {
      const arr = th.querySelector('.sort-arrow');
      if (!arr) return;
      if (th.dataset.sort === state.sortCol) {
        arr.textContent = state.sortAsc ? '↑' : '↓';
        th.classList.add('sorted');
      } else {
        arr.textContent = '';
        th.classList.remove('sorted');
      }
    });
  }

  function setSelected(id) { state.selectedId = id; render(_last); }

  window.TerrainDet = window.TerrainDet || {};
  window.TerrainDet.list = { init, render, setSelected };
})();
