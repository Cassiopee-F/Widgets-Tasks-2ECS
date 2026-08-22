/**
 * Terrain Observations — Panneau détail éditable.
 */

(function () {
  'use strict';

  const state = {
    record: null,
    pending: {},
    onSave: null,
    onClose: null,
  };

  const EDITABLE = ['commentaire_structure', 'actions_requises', 'statut'];

  function init(opts = {}) {
    state.onSave = opts.onSave;
    state.onClose = opts.onClose;

    document.getElementById('btnDetailClose')?.addEventListener('click', close);
    document.getElementById('btnDetailSave')?.addEventListener('click', save);
    document.getElementById('btnDetailCancel')?.addEventListener('click', close);
  }

  function open(record) {
    state.record = record;
    state.pending = {};

    const M = TerrainObs.model;
    const r = record;

    document.getElementById('detailTitle').textContent =
      `${r.type_observation || 'Visite'} · ${M.formatDate(r.date_visite)}`;

    const body = document.getElementById('detailBody');
    body.innerHTML = `
      <div class="dfield full">
        <div class="dlabel">Transcription brute</div>
        <div class="dvalue transcription">${escape(r.transcription_brute) || '<span class="empty-dash">—</span>'}</div>
      </div>

      <div class="dfield full">
        <div class="dlabel">Commentaire structuré <span class="editable-tag">éditable</span></div>
        <textarea class="dinput" data-field="commentaire_structure" rows="3"
          placeholder="Reformulation professionnelle…">${escape(r.commentaire_structure) || ''}</textarea>
      </div>

      <div class="dfield">
        <div class="dlabel">Type d'observation</div>
        <div class="dvalue">${r.type_observation || '<span class="empty-dash">—</span>'}</div>
      </div>

      <div class="dfield">
        <div class="dlabel">Statut <span class="editable-tag">éditable</span></div>
        <select class="dinput" data-field="statut">
          ${M.STATUT_ORDER.map(s => `<option ${r.statut === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>

      <div class="dfield">
        <div class="dlabel">Urgence</div>
        <div class="dvalue">${M.urgenceBadge(r.niveau_urgence)}</div>
      </div>

      <div class="dfield">
        <div class="dlabel">Surface estimée</div>
        <div class="dvalue">${r.surface_estimee ? r.surface_estimee + ' m²' : '<span class="empty-dash">—</span>'}</div>
      </div>

      <div class="dfield">
        <div class="dlabel">Localisation</div>
        <div class="dvalue">${r.localisation_precise || '<span class="empty-dash">—</span>'}</div>
      </div>

      <div class="dfield">
        <div class="dlabel">Matériaux</div>
        <div class="dvalue">${r.materiaux_concernes || '<span class="empty-dash">—</span>'}</div>
      </div>

      <div class="dfield full">
        <div class="dlabel">Actions requises <span class="editable-tag">éditable</span></div>
        <textarea class="dinput" data-field="actions_requises" rows="2"
          placeholder="Actions à planifier…">${escape(r.actions_requises) || ''}</textarea>
      </div>

      ${renderGPS(r.coordonnees_gps)}
      ${renderAttachments(r.audio)}
    `;

    // Annoncer la lecture seule tout en proposant des champs a remplir serait
    // se moquer du monde : on desactive vraiment, plutot que de laisser saisir
    // pour refuser a l'enregistrement. `disabled` plutot qu'un habillage CSS,
    // sinon le champ reste atteignable au clavier.
    const enLecture = window.TerrainObs?.grist?.lectureSeule?.() === true;
    if (enLecture) {
      body.querySelectorAll('[data-field]').forEach(el => { el.disabled = true; });
      body.querySelectorAll('.editable-tag').forEach(el => el.remove());
    } else {
      body.querySelectorAll('[data-field]').forEach(el => {
        el.addEventListener('input',  () => onChange(el));
        el.addEventListener('change', () => onChange(el));
      });
    }

    document.getElementById('detailPanel').classList.add('open');
    updateSaveBar();
  }

  function onChange(el) {
    const field = el.dataset.field;
    const v = el.value;
    // Marquer pending seulement si différent de la valeur actuelle
    if ((state.record[field] || '') === v) delete state.pending[field];
    else state.pending[field] = v;
    updateSaveBar();
  }

  function updateSaveBar() {
    const bar = document.getElementById('saveBar');
    if (!bar) return;
    const n = Object.keys(state.pending).length;
    if (n === 0) { bar.classList.remove('visible'); return; }
    bar.classList.add('visible');
    const msg = document.getElementById('saveBarMsg');
    if (msg) msg.textContent = `${n} modification${n > 1 ? 's' : ''} non sauvegardée${n > 1 ? 's' : ''}`;
  }

  async function save() {
    if (!state.record || !Object.keys(state.pending).length) return;
    if (typeof state.onSave === 'function') {
      const ok = await state.onSave(state.record._id, { ...state.pending });
      if (ok) { state.pending = {}; updateSaveBar(); }
    }
  }

  function close() {
    if (Object.keys(state.pending).length > 0) {
      if (!confirm('Modifications non sauvegardées seront perdues. Continuer ?')) return;
    }
    state.record = null;
    state.pending = {};
    document.getElementById('detailPanel').classList.remove('open');
    updateSaveBar();
    if (typeof state.onClose === 'function') state.onClose();
  }

  function renderGPS(gps) {
    const link = TerrainObs.model.osmLink(gps);
    if (!gps) return '';
    if (!link) return `<div class="dfield full"><div class="dlabel">GPS</div><div class="dvalue">${escape(gps)}</div></div>`;
    return `<div class="dfield full">
      <div class="dlabel">Coordonnées GPS</div>
      <div class="dvalue"><a class="gps-link" href="${link}" target="_blank" rel="noopener">📍 ${escape(gps)}</a></div>
    </div>`;
  }

  function renderAttachments(audio) {
    const ids = TerrainObs.model.attachmentIds(audio);
    if (!ids.length) return '';
    return `<div class="dfield full">
      <div class="dlabel">Enregistrement audio</div>
      <div class="dvalue attach">🎧 Audio attaché (ID: ${ids.join(', ')})</div>
    </div>`;
  }

  function escape(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  window.TerrainObs = window.TerrainObs || {};
  window.TerrainObs.detail = { init, open, close };
})();
