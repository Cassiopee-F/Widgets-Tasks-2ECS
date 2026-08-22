/**
 * Terrain Observations — Tableau + tri.
 */

(function () {
  'use strict';

  const state = {
    sortCol: 'date_visite',
    sortAsc: false,
    selectedId: null,
    onSelect: null,
    onQuickStatus: null,
  };

  const COLUMNS = [
    { key: 'date_visite',          label: 'Date',      width: 78,  align: 'left'  },
    { key: 'type_observation',     label: 'Type',      width: null, align: 'left' },
    { key: 'localisation_precise', label: 'Lieu',      width: null, align: 'left' },
    { key: 'niveau_urgence',       label: 'Urgence',   width: 88,  align: 'left'  },
    { key: 'statut',               label: 'Statut',    width: 96,  align: 'left'  },
    { key: '_comment',             label: 'Extrait',   width: null, align: 'left', sortable: false },
    { key: '_quick',               label: '',          width: 120, align: 'left', sortable: false },
  ];

  function init(opts = {}) {
    state.onSelect = opts.onSelect;
    state.onQuickStatus = opts.onQuickStatus;

    // Header : rendu une fois
    const thead = document.getElementById('listHeader');
    if (thead) {
      thead.innerHTML = '<tr>' + COLUMNS.map(c =>
        `<th ${c.sortable === false ? '' : `data-sort="${c.key}"`} style="${c.width ? `width:${c.width}px;` : ''}">
          ${c.label}${c.sortable === false ? '' : ` <span class="sort-arrow"></span>`}
        </th>`
      ).join('') + '</tr>';

      thead.querySelectorAll('[data-sort]').forEach(th => {
        th.addEventListener('click', () => sortBy(th.dataset.sort));
      });
    }
  }

  function sortBy(col) {
    if (state.sortCol === col) state.sortAsc = !state.sortAsc;
    else { state.sortCol = col; state.sortAsc = true; }
    render(_lastRecords);
  }

  let _lastRecords = [];

  function render(records) {
    _lastRecords = records || [];
    const tbody = document.getElementById('listBody');
    if (!tbody) return;

    // Tri
    const rows = [..._lastRecords].sort((a, b) => {
      const av = a[state.sortCol] ?? '';
      const bv = b[state.sortCol] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') {
        return state.sortAsc ? av - bv : bv - av;
      }
      return state.sortAsc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="${COLUMNS.length}">
        <div class="empty"><div class="empty-icon">📭</div><p>Aucune visite correspondante</p></div>
      </td></tr>`;
      updateSortArrows();
      return;
    }

    const M = TerrainObs.model;
    tbody.innerHTML = rows.map(r => {
      const date = M.formatDate(r.date_visite);
      const comment = (r.commentaire_structure || r.transcription_brute || '').toString().slice(0, 70);
      const selected = r._id === state.selectedId ? ' class="selected"' : '';
      return `<tr${selected} data-id="${r._id}">
        <td class="nowrap">${date}</td>
        <td>${r.type_observation || '—'}</td>
        <td class="clip">${r.localisation_precise || '—'}</td>
        <td>${M.urgenceBadge(r.niveau_urgence)}</td>
        <td>${M.statutBadge(r.statut)}</td>
        <td class="dim">${escapeHtml(comment)}${comment.length >= 70 ? '…' : ''}</td>
        <td class="quick" onclick="event.stopPropagation()">
          <select class="status-select" data-quick="${r._id}"${window.TerrainObs?.grist?.lectureSeule?.() ? ' disabled' : ''}>
            ${M.STATUT_ORDER.map(s => `<option ${r.statut === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
      </tr>`;
    }).join('');

    // Handlers
    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', () => {
        state.selectedId = Number(tr.dataset.id);
        render(_lastRecords);
        if (typeof state.onSelect === 'function') state.onSelect(state.selectedId);
      });
    });
    tbody.querySelectorAll('[data-quick]').forEach(sel => {
      sel.addEventListener('change', () => {
        const id = Number(sel.dataset.quick);
        if (typeof state.onQuickStatus === 'function') state.onQuickStatus(id, sel.value);
      });
    });

    updateSortArrows();
  }

  function updateSortArrows() {
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

  function setSelected(id) { state.selectedId = id; render(_lastRecords); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  window.TerrainObs = window.TerrainObs || {};
  window.TerrainObs.list = { init, render, setSelected };
})();
