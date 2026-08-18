/**
 * ZEBRA — Schéma canonique des tables Grist.
 *
 * Source de vérité partagée entre les 4 widgets (validation, inference,
 * terrain, atlas). Consommé via :
 *   import { ZEBRA_SCHEMA, PP_COLUMNS, ensureTables } from '../shared/grist_schema.js'
 *
 * Grist normalise les IDs de table : 'pp' → 'Pp', 'etudes' → 'Etudes'.
 * Toujours utiliser les formes capitalisées dans applyUserActions.
 */

// ── Table Pp — passage piéton (schéma v1.0) ──────────────────────────────────

export const PP_COLUMNS = [
  // Identité
  { id: 'pp_id',              fields: { type: 'Text',    label: 'PP ID' } },
  { id: 'id_zebra',           fields: { type: 'Text',    label: 'ID ZEBRA' } },
  { id: 'commune',            fields: { type: 'Text',    label: 'Commune' } },
  { id: 'campaign_ortho_id',  fields: { type: 'Text',    label: 'Campagne ortho' } },
  { id: 'detector',           fields: { type: 'Text',    label: 'Detecteur' } },
  { id: 'model_version',      fields: { type: 'Text',    label: 'Modele' } },
  { id: 'source_type',        fields: { type: 'Text',    label: 'Source' } },
  { id: 'origin',             fields: { type: 'Text',    label: 'Origine' } },
  { id: 'created_at',         fields: { type: 'Text',    label: 'Cree le' } },
  // Géométrie
  { id: 'geometry_json',      fields: { type: 'Text',    label: 'Geometrie' } },
  { id: 'lat',                fields: { type: 'Numeric', label: 'Latitude' } },
  { id: 'lng',                fields: { type: 'Numeric', label: 'Longitude' } },
  { id: 'heading_deg',        fields: { type: 'Numeric', label: 'Orientation (deg)' } },
  { id: 'longueur_m',         fields: { type: 'Numeric', label: 'Longueur (m)' } },
  // Score détection
  { id: 'score_detection',    fields: { type: 'Numeric', label: 'Score detection' } },
  { id: 'dangerosite_code',   fields: { type: 'Numeric', label: 'Dangerosite (code)' } },
  { id: 'dangerosite',        fields: { type: 'Text',    label: 'Dangerosite' } },
  { id: 'has_streetview',     fields: { type: 'Bool',    label: 'Streetview' } },
  { id: 'flag_litigieux',     fields: { type: 'Bool',    label: 'Litigieux' } },
  // 14 classifiers INSERM (valeur 0-1, float)
  { id: 'cl_valide_evaluable_sat',              fields: { type: 'Numeric', label: 'cl: eval sat' } },
  { id: 'cl_valide_evaluable_street',           fields: { type: 'Numeric', label: 'cl: eval street' } },
  { id: 'cl_ralentisseurs_trapezoidal_plateau', fields: { type: 'Numeric', label: 'cl: ralentisseur' } },
  { id: 'cl_manque_visibilite',                 fields: { type: 'Numeric', label: 'cl: visibilite' } },
  { id: 'cl_feu',                               fields: { type: 'Numeric', label: 'cl: feu' } },
  { id: 'cl_ligne_effet_sas_cycliste',          fields: { type: 'Numeric', label: 'cl: SAS velo' } },
  { id: 'cl_eclairage_public_moins_20m',        fields: { type: 'Numeric', label: 'cl: eclairage' } },
  { id: 'cl_coherence_longueur_passage_pieton', fields: { type: 'Numeric', label: 'cl: longueur' } },
  { id: 'cl_places_stationnement',              fields: { type: 'Numeric', label: 'cl: stationnement' } },
  { id: 'cl_presence_ilot',                     fields: { type: 'Numeric', label: 'cl: ilot' } },
  { id: 'cl_ilot_refuge_inferieur_2m',          fields: { type: 'Numeric', label: 'cl: ilot <2m' } },
  { id: 'cl_ilot_refuge_franchissable',         fields: { type: 'Numeric', label: 'cl: ilot franchissable' } },
  { id: 'cl_arret_de_bus',                      fields: { type: 'Numeric', label: 'cl: arret bus' } },
  { id: 'cl_bande_d_eveil_de_vigilance',        fields: { type: 'Numeric', label: 'cl: BEV' } },
  // LOM / Décret
  { id: 'lom_infraction',         fields: { type: 'Text',    label: 'LOM infraction' } },
  { id: 'lom_emprise_count',      fields: { type: 'Numeric', label: 'Emprises LOM (total)' } },
  { id: 'lom_emprise_count_amont',fields: { type: 'Numeric', label: 'Emprises amont' } },
  { id: 'lom_emprise_count_aval', fields: { type: 'Numeric', label: 'Emprises aval' } },
  { id: 'lom_amenagement',        fields: { type: 'Text',    label: 'LOM amenagement' } },
  { id: 'lom_decree_distance_m',  fields: { type: 'Numeric', label: 'Distance decret m' } },
  // Traçabilité filtrage BD TOPO
  { id: 'filter_status',   fields: { type: 'Text',    label: 'Filtre statut' } },
  { id: 'filter_reason',   fields: { type: 'Text',    label: 'Filtre raison' } },
  { id: 'dist_road',       fields: { type: 'Numeric', label: 'Dist. route (m)' } },
  { id: 'dist_bati',       fields: { type: 'Numeric', label: 'Dist. bati (m)' } },
  { id: 'filter_hash',     fields: { type: 'Text',    label: 'Filter hash' } },
  { id: 'filter_profile',  fields: { type: 'Text',    label: 'Filter profile' } },
  // Workflow révision
  { id: 'review_status',   fields: { type: 'Text',    label: 'Statut revision' } },
  { id: 'statut_terrain',  fields: { type: 'Text',    label: 'Statut terrain' } },
  { id: 'phase2_status',   fields: { type: 'Text',    label: 'Phase 2 statut' } },
  { id: 'assignee',        fields: { type: 'Text',    label: 'Assignee' } },
  { id: 'commentaire',     fields: { type: 'Text',    label: 'Commentaire' } },
  // Photos terrain (Attachments = blob, offline-safe)
  { id: 'photo_vue_ensemble',  fields: { type: 'Attachments', label: 'Photo ensemble' } },
  { id: 'photo_marquage',      fields: { type: 'Attachments', label: 'Photo marquage' } },
  { id: 'photo_signaletique',  fields: { type: 'Attachments', label: 'Photo signaletique' } },
  { id: 'photo_abaisse_trottoir', fields: { type: 'Attachments', label: 'Photo abaisse' } },
];

// ── Table Etudes ──────────────────────────────────────────────────────────────

export const ETUDES_COLUMNS = [
  { id: 'etude_id',          fields: { type: 'Text',    label: 'Etude ID' } },
  { id: 'commune',           fields: { type: 'Text',    label: 'Commune' } },
  { id: 'campaign_ortho_id', fields: { type: 'Text',    label: 'Campagne' } },
  { id: 'detector',          fields: { type: 'Text',    label: 'Detecteur' } },
  { id: 'model_version',     fields: { type: 'Text',    label: 'Modele' } },
  { id: 'created_at',        fields: { type: 'Text',    label: 'Cree le' } },
  { id: 'n_pp_detected',     fields: { type: 'Numeric', label: 'PP detectes' } },
  { id: 'manifest_json',     fields: { type: 'Text',    label: 'Manifest' } },
];

// ── Table Campagnes — gestion campagnes Atlas ────────────────────────────────

export const CAMPAGNES_COLUMNS = [
  { id: 'campagne_id',       fields: { type: 'Text',    label: 'Campagne ID' } },
  { id: 'nom',               fields: { type: 'Text',    label: 'Nom' } },
  { id: 'commune',           fields: { type: 'Text',    label: 'Commune' } },
  { id: 'insee',             fields: { type: 'Text',    label: 'INSEE' } },
  { id: 'bbox_json',         fields: { type: 'Text',    label: 'Zone (bbox GeoJSON)' } },
  { id: 'source_type',       fields: { type: 'Text',    label: 'Source' } },
  { id: 'campaign_ortho_id', fields: { type: 'Text',    label: 'Millésime imagerie' } },
  { id: 'status',            fields: { type: 'Text',    label: 'Statut' } },
  { id: 'job_id',            fields: { type: 'Text',    label: 'Job ID' } },
  { id: 'n_pp_detectes',     fields: { type: 'Numeric', label: 'PP détectés' } },
  { id: 'etude_id',          fields: { type: 'Text',    label: 'Etude ID' } },
  { id: 'created_at',        fields: { type: 'Text',    label: 'Créé le' } },
  { id: 'created_by',        fields: { type: 'Text',    label: 'Créé par' } },
];

// ── Table Corrections — audit trail append-only ──────────────────────────────

export const CORRECTIONS_COLUMNS = [
  { id: 'correction_id', fields: { type: 'Text',    label: 'Correction ID' } },
  { id: 'pp_id',         fields: { type: 'Text',    label: 'PP ID' } },
  { id: 'user_id',       fields: { type: 'Text',    label: 'Utilisateur' } },
  { id: 'timestamp',     fields: { type: 'Text',    label: 'Timestamp' } },
  { id: 'action',        fields: { type: 'Text',    label: 'Action' } },
  { id: 'field_changed', fields: { type: 'Text',    label: 'Champ modifie' } },
  { id: 'old_value',     fields: { type: 'Text',    label: 'Ancienne valeur' } },
  { id: 'new_value',     fields: { type: 'Text',    label: 'Nouvelle valeur' } },
  { id: 'commentaire',   fields: { type: 'Text',    label: 'Commentaire' } },
  { id: 'source',        fields: { type: 'Text',    label: 'Source (validation|terrain|vision)' } },
];

// ── Table Pp_Vision — objets géoréférencés par le pipeline zebra-vision ──────

export const PP_VISION_COLUMNS = [
  { id: 'vision_id',        fields: { type: 'Text',    label: 'Vision ID' } },
  { id: 'pp_id',            fields: { type: 'Text',    label: 'PP parent' } },
  { id: 'label',            fields: { type: 'Text',    label: 'Objet detecte' } },
  { id: 'zebra_criterion',  fields: { type: 'Text',    label: 'Critere ZEBRA' } },
  { id: 'confidence',       fields: { type: 'Numeric', label: 'Confiance' } },
  { id: 'lat',              fields: { type: 'Numeric', label: 'Latitude' } },
  { id: 'lng',              fields: { type: 'Numeric', label: 'Longitude' } },
  { id: 'distance_m',       fields: { type: 'Numeric', label: 'Distance (m)' } },
  { id: 'heading_deg',      fields: { type: 'Numeric', label: 'Cap (deg)' } },
  { id: 'confirmed',        fields: { type: 'Bool',    label: 'Confirme agent' } },
  { id: 'photo_id',         fields: { type: 'Text',    label: 'Photo source' } },
  { id: 'detected_at',      fields: { type: 'Text',    label: 'Detecte le' } },
];

// ── Table Pp_stationnement_emprises — emprises parking Phase 2 ───────────────

export const PP_STATIONNEMENT_EMPRISES_COLUMNS = [
  { id: 'emprise_id',            fields: { type: 'Text',    label: 'Emprise ID' } },
  { id: 'parent_pp_id',          fields: { type: 'Text',    label: 'PP parent' } },
  { id: 'geometry_json',         fields: { type: 'Text',    label: 'Geometrie (ring WGS84)' } },
  { id: 'score',                 fields: { type: 'Numeric', label: 'Score intersection' } },
  { id: 'dans_zone_reglementee', fields: { type: 'Bool',    label: 'Zone reglementee' } },
  { id: 'lom_status',            fields: { type: 'Text',    label: 'Statut LOM' } },
  { id: 'last_synced_at',        fields: { type: 'Text',    label: 'Derniere sync' } },
];

// ── Schéma complet ────────────────────────────────────────────────────────────

export const ZEBRA_SCHEMA = {
  Pp:                            PP_COLUMNS,
  Etudes:                        ETUDES_COLUMNS,
  Campagnes:                     CAMPAGNES_COLUMNS,
  Corrections:                   CORRECTIONS_COLUMNS,
  Pp_vision:                     PP_VISION_COLUMNS,
  Pp_stationnement_emprises:     PP_STATIONNEMENT_EMPRISES_COLUMNS,
};

// ── Helper : créer une table si elle n'existe pas ────────────────────────────
// Stratégie : tenter AddTable directement.
//   - Si la table existe : Grist lève une erreur sandbox → on ignore.
//   - Si la table n'existe pas : AddTable réussit → table créée.
// fetchTable n'est PAS utilisé car certaines versions de l'API retournent
// une data vide plutôt qu'une erreur pour les tables inexistantes.

export async function ensureTable(tableId, columns) {
  // fetchTable retourne les données de la table si elle existe.
  // Si la table n'existe pas, il lève une erreur OU retourne des colonnes vides.
  // On distingue les deux cas en testant si les colonnes "id" sont présentes.
  let tableExists = false;
  try {
    const data = await grist.docApi.fetchTable(tableId);
    // fetchTable retourne {id: [...], ...}. Si la table existe, id est un array.
    tableExists = Array.isArray(data?.id);
  } catch (_) {
    tableExists = false;
  }

  if (tableExists) return 'existante';

  try {
    await grist.docApi.applyUserActions([['AddTable', tableId, columns]]);
    return 'creee';
  } catch (e) {
    // Peut arriver en cas de race condition (widget chargé deux fois)
    console.warn(`[ZEBRA schema] ensureTable(${tableId}):`, e.message?.slice(0, 80));
    return 'race';
  }
}

export async function ensureTables(tableIds = Object.keys(ZEBRA_SCHEMA)) {
  const results = {};
  for (const id of tableIds) {
    results[id] = await ensureTable(id, ZEBRA_SCHEMA[id]);
  }
  console.log('[ZEBRA schema] ensureTables:', results);
  return results;
}
