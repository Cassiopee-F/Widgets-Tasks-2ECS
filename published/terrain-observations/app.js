/**
 * Terrain Observations — Bootstrap orchestrateur.
 * Assemble grist-adapter + data-model + ui-*.
 */

(function () {
  'use strict';

  let allRecords = [];

  function render() {
    const filtered = TerrainObs.filters.apply(allRecords);
    TerrainObs.list.render(filtered);
    TerrainObs.stats.render(allRecords);
  }

  async function onQuickStatus(id, newStatus) {
    const res = await TerrainObs.grist.quickField(id, 'statut', newStatus);
    if (!res.ok) { signaler(res); return; }
    const r = allRecords.find(x => x._id === id);
    if (r) r.statut = newStatus;
    render();
  }

  function onSelect(id) {
    const r = allRecords.find(x => x._id === id);
    if (r) TerrainObs.detail.open(r);
  }

  async function onSave(id, fields) {
    const res = await TerrainObs.grist.updateRecord(id, fields);
    if (!res.ok) { signaler(res); return false; }
    const r = allRecords.find(x => x._id === id);
    if (r) Object.assign(r, fields);
    render();
    return true;
  }

  /**
   * Dire pourquoi une ecriture n'a pas eu lieu.
   *
   * Un refus de droits n'est pas une panne : les distinguer evite qu'on cherche
   * un bug la ou il faut demander un acces. Et en demonstration, on ne reproche
   * a personne de ne pas pouvoir enregistrer.
   */
  function signaler(res) {
    if (res.horsGrist) return toast('Démonstration — rien n’est enregistré', 'info');
    if (res.refuse) return toast('Vos droits ne permettent pas cette modification', 'warn');
    toast('Enregistrement impossible : ' + res.message, 'error');
  }

  function toast(message, type) {
    let zone = document.getElementById('toasts');
    if (!zone) {
      zone = document.createElement('div');
      zone.id = 'toasts';
      document.body.appendChild(zone);
    }
    const t = document.createElement('div');
    t.className = 'toast ' + (type || 'info');
    t.textContent = message;
    zone.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  async function init() {
    TerrainObs.list.init({ onSelect, onQuickStatus });
    TerrainObs.detail.init({ onSave, onClose: () => TerrainObs.list.setSelected(null) });
    TerrainObs.filters.init(render);

    TerrainObs.grist.bandeauLectureSeule();
    const ok = await TerrainObs.grist.init({ access: 'full' });
    if (!ok) {
      // Mode démo hors Grist : quelques records fictifs pour aperçu
      allRecords = demoRecords();
      render();
      return;
    }

    TerrainObs.grist.on('records', (records, colMap) => {
      allRecords = TerrainObs.model.normalize(records, colMap);
      render();
    });
  }

  function demoRecords() {
    return [
      { _id: 1, transcription_brute: 'Nid-de-poule sur la D47 au PR 14+300…', commentaire_structure: 'Dégradation de chaussée, environ 2 m², bord de voie droite.',
        type_observation: 'Voirie', localisation_precise: 'D47, PR 14+300, voie droite', niveau_urgence: 'élevé',
        actions_requises: 'Colmatage provisoire puis réparation définitive.', materiaux_concernes: 'Bitume', surface_estimee: 2,
        date_visite: Math.floor(Date.now() / 1000), statut: 'à traiter', coordonnees_gps: '43.297, 5.373 (±5m)', audio: null },
      { _id: 2, transcription_brute: 'Panneau STOP tombé au carrefour…', commentaire_structure: 'Panneau au sol, socle intact, à remettre en place.',
        type_observation: 'Signalisation', localisation_precise: 'Carrefour rue X / rue Y', niveau_urgence: 'critique',
        actions_requises: 'Remise en place immédiate.', materiaux_concernes: 'Acier', surface_estimee: null,
        date_visite: Math.floor(Date.now() / 1000) - 86400, statut: 'à traiter', coordonnees_gps: '43.301, 5.369 (±3m)', audio: null },
    ];
  }

  document.addEventListener('DOMContentLoaded', init);
})();
