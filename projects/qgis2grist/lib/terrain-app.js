/**
 * Mode terrain mobile — carte MapLibre + formulaires FormEngine (QField-like).
 */
(function (root) {
  'use strict';

  const WIDGET_CONFIG_TABLE = 'QgisWidgets';
  const FORMULAIRES_TABLE = 'Formulaires';
  const LAYER_COLORS = ['#3e5de7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  let config = null;
  let terrainForms = [];
  let activeFormIdx = 0;
  let maplibreMap = null;
  let layerData = {};
  let activeTab = 'map';

  function $(id) { return document.getElementById(id); }

  function showToast(msg, kind) {
    const el = $('terrain-toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'terrain-toast' + (kind ? ' ' + kind : '');
    el.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { el.hidden = true; }, 3500);
  }

  async function loadLatestConfig() {
    const data = await grist.docApi.fetchTable(WIDGET_CONFIG_TABLE);
    if (!data?.id?.length) return null;
    const idx = data.id.length - 1;
    try {
      return JSON.parse(data.config_json[idx]);
    } catch (e) {
      return null;
    }
  }

  async function loadFormsFromTable() {
    try {
      const tables = await grist.docApi.listTables();
      if (!tables.includes(FORMULAIRES_TABLE)) return [];
      const data = await grist.docApi.fetchTable(FORMULAIRES_TABLE);
      const out = [];
      for (let i = 0; i < (data.id?.length || 0); i++) {
        if (data.Statut?.[i] !== 'terrain' && data.Statut?.[i] !== 'publie') continue;
        try {
          out.push(JSON.parse(data.Def[i]));
        } catch (e) { /* skip */ }
      }
      return out;
    } catch (e) {
      return [];
    }
  }

  function formsFromConfig(cfg) {
    return (cfg?.terrain?.forms || []).map(f => f.def || f).filter(Boolean);
  }

  function buildLayerData(cfg) {
    const out = {};
    (cfg?.layers || []).forEach((l, i) => {
      out[l.tableName] = {
        displayName: l.displayName,
        geomType: l.geomType,
        fields: (l.fields || []).map(f => ({
          ...f,
          _rawKey: f.rawKey ?? f._rawKey,
          _refTargetTable: f.refTargetTable ?? f._refTargetTable,
        })),
        color: l.color || LAYER_COLORS[i % LAYER_COLORS.length],
        style: l.style || null,
        featureCount: l.featureCount || 0,
      };
    });
    return out;
  }

  async function loadRows(tableName, fields) {
    const data = await grist.docApi.fetchTable(tableName);
    if (!data?.id?.length) return [];
    const rows = [];
    const cols = Object.keys(data).filter(k => k !== 'id');
    for (let i = 0; i < data.id.length; i++) {
      const row = { id: data.id[i] };
      for (const c of cols) row[c] = data[c][i];
      rows.push(row);
    }
    return rows;
  }

  async function refreshMap() {
    if (!maplibreMap || !config) return;
    const geojsonList = [];
    for (const [tableName, layer] of Object.entries(layerData)) {
      if (layer.geomType === 'None' || layer.geomType === 'No geometry') continue;
      const rows = await loadRows(tableName, layer.fields);
      const color = layer.color;
      const gj = Q2GMap.rowsToGeoJSON(rows, layer, () => color);
      if (gj.features.length) {
        Q2GMap.updateSourceData(maplibreMap, tableName, gj);
        geojsonList.push(gj);
      }
    }
    if (geojsonList.length) Q2GMap.fitMapToBounds(maplibreMap, geojsonList, 24);
  }

  async function initMap() {
    if (maplibreMap) return;
    maplibreMap = Q2GMap.initMap('terrain-map');
    maplibreMap.once('load', async () => {
      let ci = 0;
      for (const [tableName, layer] of Object.entries(layerData)) {
        if (layer.geomType === 'None' || layer.geomType === 'No geometry') continue;
        const color = layer.color || LAYER_COLORS[ci++ % LAYER_COLORS.length];
        const declarative = layer.style?.declarative
          || Q2G.qmlStyleToDeclarative(layer.style, { fallbackColor: color });
        const gj = { type: 'FeatureCollection', features: [] };
        Q2GMap.addGristLayer(maplibreMap, tableName, layer, declarative, color, gj, null);
      }
      await refreshMap();
      maplibreMap.resize();
    });
  }

  function renderFormPicker() {
    const sel = $('terrain-form-select');
    if (!sel) return;
    sel.innerHTML = terrainForms.map((f, i) =>
      `<option value="${i}">${f.title || f.id}</option>`
    ).join('');
    sel.value = String(activeFormIdx);
  }

  function mountActiveForm() {
    const root = $('terrain-form-root') || $('panel-form');
    if (!root) return;
    if (!terrainForms.length) {
      root.innerHTML = '<p class="terrain-empty">Aucun formulaire terrain.</p>';
      return;
    }
    root.innerHTML = '';
    const def = terrainForms[activeFormIdx];
    if (!def) {
      root.innerHTML = '<p class="terrain-empty">Formulaire introuvable.</p>';
      return;
    }
    if (!window.FormEngine) {
      root.innerHTML = '<p class="terrain-empty">Moteur formulaire indisponible (scripts grist_forms).</p>';
      return;
    }
    if (!window.GristBridge) {
      root.innerHTML = '<p class="terrain-empty">GristBridge indisponible.</p>';
      return;
    }
    try {
      FormEngine.mount(root, def, {
        loadTable: GristBridge.loadTable,
        submit: async (data) => {
          await GristBridge.addRow(def.tableId, data);
          showToast('Enregistrement OK', 'ok');
          await refreshMap();
        },
        getAccessToken: (opts) => grist.docApi.getAccessToken(opts),
      });
    } catch (e) {
      console.error('[terrain] FormEngine.mount', e);
      root.innerHTML = '<p class="terrain-empty">Erreur formulaire : ' + (e.message || e) + '</p>';
    }
  }

  function setTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.terrain-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    $('panel-map').hidden = tab !== 'map';
    $('panel-form').hidden = tab !== 'form';
    if (tab === 'map' && maplibreMap) setTimeout(() => maplibreMap.resize(), 50);
    if (tab === 'form') mountActiveForm();
  }

  async function boot() {
    const loading = $('terrain-loading');
    if (loading) loading.hidden = false;
    config = await loadLatestConfig();
    if (!config?.layers?.length) {
      if (loading) loading.textContent = 'Aucun projet importé — utilisez qgis2grist d’abord.';
      return;
    }
    layerData = buildLayerData(config);
    terrainForms = formsFromConfig(config);
    if (!terrainForms.length) terrainForms = await loadFormsFromTable();
    // Carte seule si pas de formulaires (tables attributaires / pack partiel)
    if (loading) loading.hidden = true;
    const app = $('terrain-app');
    if (app) app.hidden = false;
    $('terrain-title').textContent = config.meta?.title || config.meta?.source_file || 'Terrain';
    if (!terrainForms.length) {
      const bar = document.querySelector('.terrain-form-bar');
      if (bar) bar.innerHTML = '<p class="terrain-empty" style="margin:0;padding:0;text-align:left">Pas de formulaires — carte seule. Republiez le pack depuis qgis2grist.</p>';
    } else {
      renderFormPicker();
      $('terrain-form-select')?.addEventListener('change', (e) => {
        activeFormIdx = parseInt(e.target.value, 10) || 0;
        if (activeTab === 'form') mountActiveForm();
      });
    }
    document.querySelectorAll('.terrain-tab').forEach(btn => {
      btn.addEventListener('click', () => setTab(btn.dataset.tab));
    });
    if (typeof Q2GMap === 'undefined') {
      showToast('MapLibre indisponible — vérifiez la connexion CDN', 'error');
      return;
    }
    await initMap();
    setTab('map');
  }

  let _bootStarted = false;
  function startBoot() {
    if (_bootStarted) return;
    _bootStarted = true;
    boot().catch(e => {
      console.error('[terrain]', e);
      _bootStarted = false;
      const loading = $('terrain-loading');
      if (loading) {
        loading.hidden = false;
        loading.textContent = 'Erreur : ' + (e.message || e);
      }
    });
  }

  // Comme Atlas : boot juste après grist.ready() — grist.on('ready') ne fire
  // pas toujours (Grist bureau).
  if (typeof grist !== 'undefined') {
    try {
      grist.ready({ requiredAccess: 'full' });
    } catch (e) { console.warn('[terrain] grist.ready', e); }
    startBoot();
    try {
      grist.on('ready', startBoot);
    } catch (_) { /* ignore */ }
  } else {
    const loading = $('terrain-loading');
    if (loading) loading.textContent = 'API Grist indisponible — ouvrez ce widget dans un document Grist.';
  }
})(typeof window !== 'undefined' ? window : globalThis);
