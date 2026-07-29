/**
 * promote-qgis2grist.js
 * Publie qgis2grist v2 en parallèle de v1 (CADRAGE D4-B).
 *
 * - published/qgis2grist/index.html  = v1 Leaflet (inchangé si déjà présent)
 * - published/qgis2grist/v2/         = MapLibre + Scene Manifest + terrain
 * - package.json : deux entrées grist
 *
 * Usage: node scripts/promote-qgis2grist.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'projects', 'qgis2grist');
const forms = path.join(root, 'projects', 'grist_forms');
const pub = path.join(root, 'published', 'qgis2grist');
const v2 = path.join(pub, 'v2');
const vendor = path.join(v2, 'vendor', 'grist_forms');
const VER = '2.0.0';

function mkdirp(d) {
  fs.mkdirSync(d, { recursive: true });
}
function copyFile(from, to) {
  mkdirp(path.dirname(to));
  fs.copyFileSync(from, to);
}
function copyDirJs(fromDir, toDir) {
  mkdirp(toDir);
  for (const f of fs.readdirSync(fromDir)) {
    if (!f.endsWith('.js')) continue;
    fs.copyFileSync(path.join(fromDir, f), path.join(toDir, f));
  }
}
function rewrite(file, replacers) {
  let s = fs.readFileSync(file, 'utf8');
  for (const [re, to] of replacers) s = s.replace(re, to);
  fs.writeFileSync(file, s);
}

mkdirp(v2);
mkdirp(path.join(v2, 'lib'));
mkdirp(vendor);

// --- v2 HTML ---
copyFile(path.join(src, 'index_v2.html'), path.join(v2, 'index.html'));
copyFile(path.join(src, 'terrain.html'), path.join(v2, 'terrain.html'));
copyDirJs(path.join(src, 'lib'), path.join(v2, 'lib'));

// Vendor grist_forms deps (chemins relatifs cassés hors monorepo)
const vendorFiles = [
  ['shared/publish.js', 'publish.js'],
  ['shared/grist-bridge.js', 'grist-bridge.js'],
  ['shared/types.js', 'types.js'],
  ['shared/attachments.js', 'attachments.js'],
  ['shared/session-context.js', 'session-context.js'],
  ['shared/dsfr-like.css', 'dsfr-like.css'],
  ['runtime/engine.js', 'engine.js'],
];
for (const [rel, name] of vendorFiles) {
  const from = path.join(forms, rel);
  if (!fs.existsSync(from)) {
    console.warn('WARN missing', rel);
    continue;
  }
  copyFile(from, path.join(vendor, name));
}

rewrite(path.join(v2, 'index.html'), [
  [/<title>[^<]*<\/title>/, '<title>QGIS → Grist Importer v2</title>'],
  [/lib\/([\w.-]+\.js)\?v=[^"']+/g, `lib/$1?v=${VER}`],
  [/\.\.\/grist_forms\/shared\/publish\.js/g, 'vendor/grist_forms/publish.js'],
]);

rewrite(path.join(v2, 'terrain.html'), [
  [/lib\/([\w.-]+\.js)\?v=[^"']+/g, `lib/$1?v=${VER}`],
  [/\.\.\/grist_forms\/shared\/grist-bridge\.js/g, 'vendor/grist_forms/grist-bridge.js'],
  [/\.\.\/grist_forms\/shared\/types\.js/g, 'vendor/grist_forms/types.js'],
  [/\.\.\/grist_forms\/shared\/attachments\.js/g, 'vendor/grist_forms/attachments.js'],
  [/\.\.\/grist_forms\/shared\/session-context\.js/g, 'vendor/grist_forms/session-context.js'],
  [/\.\.\/grist_forms\/runtime\/engine\.js/g, 'vendor/grist_forms/engine.js'],
  [/\.\.\/grist_forms\/shared\/dsfr-like\.css/g, 'vendor/grist_forms/dsfr-like.css'],
]);

// package.json dual widget
const pkg = {
  name: 'qgis2grist',
  version: VER,
  description:
    'Importateur QGIS → Grist : schéma typé, Scene Manifest V0.2, carte MapLibre (v2), pack terrain',
  authors: [{ name: 'nic01asfr', url: 'https://github.com/nic01asfr' }],
  grist: [
    {
      widgetId: 'qgis2grist',
      name: 'QGIS → Grist Importer',
      url: '',
      accessLevel: 'full',
      description:
        'v1 Leaflet — importez qgis2web / QGZ / QField / GPKG dans Grist (schéma auto)',
    },
    {
      widgetId: 'qgis2grist-v2',
      name: 'QGIS → Grist Importer v2',
      url: 'v2/',
      accessLevel: 'full',
      description:
        'v2 MapLibre + Scene Manifest + contrôles + pack terrain (interop Atlas)',
    },
  ],
};
fs.writeFileSync(path.join(pub, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');

console.log('published/qgis2grist/v2 ready (v' + VER + ')');
console.log('  widgets: qgis2grist (v1) + qgis2grist-v2');
