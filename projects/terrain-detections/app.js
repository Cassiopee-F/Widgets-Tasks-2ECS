/**
 * Terrain Détections — Bootstrap orchestrateur.
 */

(function () {
  'use strict';

  let allRecords = [];

  function render() {
    const filtered = TerrainDet.filters.apply(allRecords);
    TerrainDet.list.render(filtered);
    TerrainDet.stats.render(allRecords);
  }

  function onSelect(id) {
    const r = allRecords.find(x => x._id === id);
    if (r) TerrainDet.detail.open(r);
  }

  async function init() {
    TerrainDet.list.init({ onSelect });
    TerrainDet.detail.init({ onClose: () => TerrainDet.list.setSelected(null) });
    TerrainDet.filters.init(render);

    const ok = await TerrainDet.grist.init({ access: 'read table' });
    if (!ok) {
      allRecords = demoRecords();
      render();
      return;
    }

    TerrainDet.grist.on('records', (records, colMap) => {
      allRecords = TerrainDet.model.normalize(records, colMap);
      render();
    });
  }

  function demoRecords() {
    const now = new Date();
    return [
      { _id: 1, session_id: 'SV_20260521_1430_ABCD', horodatage: now.toISOString(),
        classe_fr: 'Voiture', classe_en: 'car', categorie: 'Véhicule', confiance: 87,
        latitude: 43.297, longitude: 5.373, precision_gps: 5, vitesse_kmh: 12, cap_degres: 90,
        nb_objets_frame: 3, bbox: '[120,80,240,180]', snapshot: null },
      { _id: 2, session_id: 'SV_20260521_1430_ABCD', horodatage: new Date(now - 2000).toISOString(),
        classe_fr: 'Feu tricolore', classe_en: 'traffic light', categorie: 'Infrastructure', confiance: 92,
        latitude: 43.298, longitude: 5.374, precision_gps: 6, vitesse_kmh: 12, cap_degres: 90,
        nb_objets_frame: 5, bbox: '[420,40,80,120]', snapshot: null },
    ];
  }

  document.addEventListener('DOMContentLoaded', init);
})();
