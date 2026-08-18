/**
 * ZEBRA — Coordination inter-widgets (pattern Taskflow).
 *
 * Tous les widgets ZEBRA partagent le même document Grist et la même table Pp.
 * Ce module gère la navigation coordonnée : sélectionner un PP dans un widget
 * le met en évidence dans tous les autres.
 *
 * Usage :
 *   import { ZebraGristBridge } from '../shared/grist_bridge.js';
 *   const bridge = new ZebraGristBridge();
 *   await bridge.init();
 *   bridge.onPpSelected(pp => renderDetail(pp));
 *   bridge.selectPp(ppId);
 */

export class ZebraGristBridge {
  constructor() {
    this._selectedPpId = null;
    this._ppListeners = [];
    this._recordListeners = [];
    this._allRecords = [];
    this._mode = 'grist'; // 'grist' | 'mock'
  }

  /** Initialise le bridge Grist. Retourne 'grist' ou 'mock'. */
  async init() {
    const inGrist = typeof grist !== 'undefined' && window.parent !== window;
    if (!inGrist) {
      this._mode = 'mock';
      return 'mock';
    }
    this._mode = 'grist';

    try { grist.ready({ requiredAccess: 'full' }); }
    catch (_) { try { grist.ready(); } catch (__) {} }

    // Écoute les records de la table connectée (table Pp)
    grist.onRecords((records) => {
      this._allRecords = records;
      this._recordListeners.forEach(fn => fn(records));
    });

    // Écoute la sélection courante (row sélectionnée dans une autre vue)
    grist.onRecord((record) => {
      if (record && record.pp_id) {
        this._selectedPpId = record.pp_id;
        this._ppListeners.forEach(fn => fn(record));
      }
    });

    return 'grist';
  }

  /** Callback appelé quand tous les records sont (re)chargés. */
  onRecords(fn) { this._recordListeners.push(fn); }

  /** Callback appelé quand un PP est sélectionné (depuis n'importe quel widget). */
  onPpSelected(fn) { this._ppListeners.push(fn); }

  /** Sélectionne un PP — notifie tous les widgets Grist. */
  selectPp(ppId) {
    this._selectedPpId = ppId;
    if (this._mode !== 'grist') return;
    const record = this._allRecords.find(r => r.pp_id === ppId);
    if (record && record.id) {
      grist.setSelectedRows([record.id]);
    }
    this._ppListeners.forEach(fn => fn(record || { pp_id: ppId }));
  }

  get selectedPpId() { return this._selectedPpId; }
  get allRecords() { return this._allRecords; }
  get mode() { return this._mode; }

  // ── Écriture Grist ─────────────────────────────────────────────────────────

  /** Met à jour les champs d'un PP existant. Ajoute une correction dans l'audit trail. */
  async updatePp(gristRowId, fields, { userId = 'agent', source = 'validation' } = {}) {
    if (this._mode !== 'grist') return;
    const now = new Date().toISOString();

    const actions = [
      ['UpdateRecord', 'Pp', gristRowId, fields],
    ];

    // Audit trail append-only
    for (const [field, newVal] of Object.entries(fields)) {
      const oldRecord = this._allRecords.find(r => r.id === gristRowId);
      actions.push(['AddRecord', 'Corrections', null, {
        correction_id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        pp_id: oldRecord?.pp_id || '',
        user_id: userId,
        timestamp: now,
        action: 'correct',
        field_changed: field,
        old_value: String(oldRecord?.[field] ?? ''),
        new_value: String(newVal),
        source,
      }]);
    }

    await grist.docApi.applyUserActions(actions);
  }

  /** Ajoute des objets vision géoréférencés dans Pp_vision. */
  async addVisionObjects(objects) {
    if (this._mode !== 'grist' || !objects.length) return;
    const now = new Date().toISOString();
    const records = objects.map(obj => ({
      vision_id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
      pp_id: obj.pp_id || '',
      label: obj.label,
      zebra_criterion: obj.zebra_criterion || '',
      confidence: obj.confidence,
      lat: obj.lat,
      lng: obj.lng,
      distance_m: obj.distance_m,
      heading_deg: obj.heading_deg || 0,
      confirmed: false,
      detected_at: now,
    }));

    // Créer table si absente, puis insérer
    try { await grist.docApi.fetchTable('Pp_vision'); }
    catch (_) {
      const { PP_VISION_COLUMNS } = await import('./grist_schema.js');
      await grist.docApi.applyUserActions([['AddTable', 'Pp_vision', PP_VISION_COLUMNS]]);
    }

    await grist.docApi.applyUserActions([
      ['BulkAddRecord', 'Pp_vision', Array(records.length).fill(null),
        Object.fromEntries(Object.keys(records[0]).map(k => [k, records.map(r => r[k])]))
      ]
    ]);
  }
}
