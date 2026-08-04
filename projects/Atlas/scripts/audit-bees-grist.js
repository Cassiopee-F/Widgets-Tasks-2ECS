/**
 * Audit doc bees Grist — manifest Fields + colonnes géo.
 * Usage (console navigateur sur doc Grist avec full access) :
 *   copy(await fetch('/api/docs/DOC_ID/tables/Fields/records').then(r=>r.json()))
 *
 * Ou node avec fixture :
 *   node --test projects/Atlas/tests/bees-grist-atlas.test.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSceneManifestLayers } from '../lib/scene-loader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(__dirname, '../tests/fixtures');

function auditManifestFields(manifest) {
  const fields = manifest?.layers?.find((l) => l.id === 'Fields' || l.source?.table === 'Fields');
  const issues = [];
  if (!fields) issues.push('Couche Fields absente du SceneManifest');
  else if (fields.geometry_type !== 'polygon') {
    issues.push(`manifest Fields.geometry_type="${fields.geometry_type}" — attendu "polygon" (réimporter qgis2grist v2)`);
  }
  return { fields, issues };
}

function auditFieldsTable(colData) {
  const issues = [];
  const n = colData?.id?.length || 0;
  if (!n) issues.push('Table Fields vide');
  const hasGeomJson = Object.prototype.hasOwnProperty.call(colData || {}, 'geometry_json');
  if (!hasGeomJson) {
    issues.push('Colonne geometry_json absente — Fields sera en Point (lat/lon) ; réimporter avec geom-reconcile');
  } else {
    let poly = 0;
    let point = 0;
    for (let i = 0; i < n; i++) {
      try {
        const g = JSON.parse(colData.geometry_json[i] || 'null');
        if (g?.type === 'Polygon' || g?.type === 'MultiPolygon') poly++;
        else if (g?.type === 'Point') point++;
      } catch (_) { /* ignore */ }
    }
    if (poly === 0 && point > 0) issues.push(`${point} géométrie(s) Point dans geometry_json — attendu Polygon`);
    if (poly > 0) console.log(`  ✓ ${poly} polygone(s) dans geometry_json`);
  }
  return issues;
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(FIX, 'scene-manifest-bees-grist.json'), 'utf8'));
  const fieldsTable = JSON.parse(fs.readFileSync(path.join(FIX, 'grist-fields-sample.json'), 'utf8'));
  delete fieldsTable._source;

  console.log('=== Audit SceneManifest (fixture bees) ===');
  const { fields: mlFields, issues: mIssues } = auditManifestFields(manifest);
  console.log('Fields manifest:', mlFields?.geometry_type, mlFields?.name);
  mIssues.forEach((i) => console.warn('  ⚠', i));

  console.log('\n=== Audit table Fields (fixture Grist) ===');
  const tIssues = auditFieldsTable(fieldsTable);
  tIssues.forEach((i) => console.warn('  ⚠', i));
  if (!tIssues.length) console.log('  ✓ Table Fields OK pour polygones');

  const mockDoc = {
    listTables: async () => ['Apiary', 'Fields', 'Pollen_Consumption'],
    fetchTable: async (name) => {
      if (name === 'Fields') return fieldsTable;
      if (name === 'Apiary') {
        const a = JSON.parse(fs.readFileSync(path.join(FIX, 'grist-apiary-sample.json'), 'utf8'));
        delete a._source;
        return a;
      }
      return { id: [1], latitude: [46.808], longitude: [9.257], percentage: [55] };
    },
  };
  const { layers, bounds } = await loadSceneManifestLayers(mockDoc, manifest, null);
  const fieldsLayer = layers.find((l) => l.sourceTable === 'Fields');
  console.log('\n=== Pipeline Atlas ===');
  console.log('bounds:', bounds);
  console.log('Fields geometryType:', fieldsLayer?.geometryType);
  console.log('Fields 1ère feature:', fieldsLayer?.geojson?.features?.[0]?.geometry?.type);
  if (fieldsLayer?.geometryType !== 'Polygon') {
    console.warn('  ⚠ Atlas charge Fields en', fieldsLayer?.geometryType);
  } else {
    console.log('  ✓ Fields = Polygon dans Atlas');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
